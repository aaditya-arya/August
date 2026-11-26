package app.august.nativejournal

import app.august.nativejournal.data.*
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

private class MemoryStorage(var value: DeviceState) : DeviceStorage {
    private val mutex = Mutex()
    override suspend fun read() = value
    override suspend fun update(transform: (DeviceState) -> DeviceState): DeviceState = mutex.withLock { transform(value).also { value = it } }
}

class JournalRepositoryTest {
    private fun device(server: MockWebServer, expired: Boolean = false): DeviceState {
        val origin = server.url("/").toString().trimEnd('/')
        return DeviceState(Connection(origin, AuthConfig(origin, "public-test-key", true)),
            Session("old-access", "refresh-token", if (expired) 1 else Instant.now().epochSecond + 3600, user = Account("account-a", "a@example.test")))
    }

    @Test fun journalAndReviewAcceptOlderNullableTagsAndKeepSourceEvidence() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = JournalRepository(MemoryStorage(device(server)), AugustHttp(), true)
            repository.initialize()
            val entry = """{"id":"entry-a","content":"I shipped the project.","category":"Milestone_HardWork","tags":null,"event_timestamp":"2026-11-26T06:00:00Z","created_at":"2026-11-26T06:00:00Z","memory":null}"""
            server.enqueue(MockResponse().setBody("""{"items":[$entry]}"""))
            assertEquals(emptyList<String>(), repository.moments().single().tags)
            assertEquals("/api/items?days=all", server.takeRequest().path)
            server.enqueue(MockResponse().setBody("""{"status":"ready","selected_count":1,"entries":[$entry],"review":{"opening":"A week of movement.","focus":null,"progress":[{"title":"You shipped","meaning":"The project was completed.","takeaway":"Notice the progress.","source_ids":["entry-a"]}],"experiences":[],"lessons":[],"patterns":[],"next_step":null,"question":"What helped?"},"intentions":[{"anchor_id":"entry-a","title":"Build the next version","next_step":"Choose one change","source_ids":["entry-a"],"deadline":null}]}"""))
            val review = repository.review("all", true)
            assertEquals("entry-a", review.review!!.progress.single().sourceIds.single())
            assertEquals("Choose one change", review.intentions.single().nextStep)
            assertEquals(emptyList<String>(), review.entries.single().tags)
            val request = server.takeRequest()
            assertTrue(request.path!!.contains("days=all"))
            assertTrue(request.path!!.contains("refresh=1"))
            assertEquals("Bearer old-access", request.getHeader("Authorization"))
        }
    }

    @Test fun connectionsRefreshAuthenticationThenPreserveGraphLinks() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val initial = device(server)
            val repository = JournalRepository(MemoryStorage(initial), AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Expired session"}"""))
            server.enqueue(MockResponse().setBody(AugustJson.encodeToString(initial.session!!.copy(accessToken = "rotated-access"))))
            server.enqueue(MockResponse().setBody("""{"nodes":[{"id":"a","name":"First moment","group":"Idea","color":"#5855D6","tags":null},{"id":"b","name":"Second moment","group":"Idea","color":"#5855D6","tags":["work"]}],"links":[{"source":"a","target":"b","weight":0.8,"link_type":"semantic","id":"edge-a"}],"stats":{"nodeCount":2}}"""))
            val graph = repository.graph()
            assertEquals(2, graph.nodes.size)
            assertEquals("semantic", graph.links.single().type)
            assertEquals("a", graph.links.single().source)
            assertEquals("Bearer old-access", server.takeRequest().getHeader("Authorization"))
            assertTrue(server.takeRequest().path!!.startsWith("/auth/v1/token?"))
            assertEquals("Bearer rotated-access", server.takeRequest().getHeader("Authorization"))
        }
    }

    @Test fun serviceChecksStayAuthenticatedAndExplainMissingAiConfiguration() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = JournalRepository(MemoryStorage(device(server)), AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setBody("""{"journal":{"ready":true,"message":"Reachable"},"graph":{"ready":true,"message":"Reachable"},"review":{"ready":false,"message":"Add GEMINI_API_KEY and redeploy"}}"""))
            val status = repository.serverStatus()
            assertTrue(status.journal.ready)
            assertFalse(status.review.ready)
            assertTrue(status.review.message.contains("GEMINI_API_KEY"))
            val request = server.takeRequest()
            assertEquals("/api/health", request.path)
            assertEquals("Bearer old-access", request.getHeader("Authorization"))
        }
    }

    @Test fun protectedPreviewRedirectsGiveAnActionableError() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = JournalRepository(MemoryStorage(device(server)), AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "https://vercel.com/sso-api"))
            try { repository.graph(); fail("Expected protected preview") }
            catch (error: ApiFailure) { assertTrue(error.message!!.contains("public Production address")) }
        }
    }

    @Test fun failedSavesRetainTheDraftAndRetryTheSameKey() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val storage = MemoryStorage(device(server))
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize(); repository.setDraft("My actual words")
            server.enqueue(MockResponse().setResponseCode(503).setBody("{\"error\":\"Please retry\"}"))
            try { repository.save(); fail("Expected failure") } catch (_: ApiFailure) { }
            val key = storage.value.accountKey()!!
            val pending = storage.value.drafts[key]!!.pending!!
            assertEquals("My actual words", storage.value.drafts[key]!!.content)
            val first = server.takeRequest(2, TimeUnit.SECONDS)!!
            assertEquals("Bearer old-access", first.getHeader("Authorization"))
            assertEquals(pending.key, first.getHeader("Idempotency-Key"))
            server.enqueue(MockResponse().setBody("{\"success\":true,\"noteId\":\"note-a\",\"extractedCount\":1}"))
            repository.save()
            assertEquals(pending.key, server.takeRequest(2, TimeUnit.SECONDS)!!.getHeader("Idempotency-Key"))
            assertEquals(Draft(), storage.value.drafts[key])
        }
    }

    @Test fun tokenRefreshIsSharedAndRequestsUseTheRotatedToken() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val refreshes = AtomicInteger()
            val initial = device(server, expired = true)
            val fresh = initial.session!!.copy(accessToken = "new-access", refreshToken = "new-refresh", expiresAt = Instant.now().epochSecond + 3600)
            server.dispatcher = object : Dispatcher() {
                override fun dispatch(request: RecordedRequest): MockResponse {
                    if (request.path!!.startsWith("/auth/v1/token")) { refreshes.incrementAndGet(); return MockResponse().setBody(AugustJson.encodeToString(fresh)) }
                    assertEquals("Bearer new-access", request.getHeader("Authorization"))
                    return MockResponse().setBody(if (request.path!!.startsWith("/api/items")) "{\"items\":[]}" else "{\"nodes\":[],\"links\":[]}")
                }
            }
            val storage = MemoryStorage(initial)
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            awaitAll(async { repository.moments() }, async { repository.graph() })
            assertEquals(1, refreshes.get())
            assertEquals("new-refresh", storage.value.session!!.refreshToken)
        }
    }

    @Test fun signingOutClearsSessionAndCacheButRetainsTheAccountsDraft() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val initial = device(server)
            val key = initial.accountKey()!!
            val storage = MemoryStorage(initial.copy(drafts = mapOf(key to Draft("Keep this")), cachedMoments = mapOf(key to emptyList())))
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setBody("{}"))
            repository.signOut()
            assertNull(storage.value.session)
            assertTrue(storage.value.cachedMoments.isEmpty())
            assertEquals("Keep this", storage.value.drafts[key]!!.content)
        }
    }

    @Test fun changingServersRemovesTheSessionAndRetainsAccountScopedDrafts() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val initial = device(server)
            val key = initial.accountKey()!!
            val storage = MemoryStorage(initial.copy(drafts = mapOf(key to Draft("Original draft"))))
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setBody(AugustJson.encodeToString(AuthConfig(server.url("/").toString().trimEnd('/'), "changed-public-key", true))))
            repository.connect(server.url("/").toString())
            assertNull(storage.value.session)
            assertEquals("Original draft", storage.value.drafts[key]!!.content)
        }
    }

    @Test fun aLateJournalResponseCannotRestoreDataAfterSignOut() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val storage = MemoryStorage(device(server))
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setBody("{\"items\":[]}").setBodyDelay(500, TimeUnit.MILLISECONDS))
            val pending = async { runCatching { repository.moments() } }
            withContext(Dispatchers.IO) { assertNotNull(server.takeRequest(2, TimeUnit.SECONDS)) }
            server.enqueue(MockResponse().setBody("{}"))
            repository.signOut()
            assertTrue(pending.await().isFailure)
            assertNull(storage.value.session)
            assertTrue(storage.value.cachedMoments.isEmpty())
        }
    }

    @Test fun anotherAccountCannotReceiveAnOldAccountsDraftWrite() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val initial = device(server)
            val previousKey = initial.accountKey()!!
            val storage = MemoryStorage(initial.copy(session = initial.session!!.copy(user = Account("account-b"))))
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            try { repository.setDraft("Private A writing", previousKey); fail("Expected account rejection") }
            catch (_: IllegalStateException) { }
            assertTrue(storage.value.drafts.isEmpty())
        }
    }

    @Test fun reachingTheServerIsSeparateFromGoogleProviderConfiguration() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val storage = MemoryStorage(DeviceState())
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            val origin = server.url("/").toString().trimEnd('/')
            server.enqueue(MockResponse().setBody(AugustJson.encodeToString(AuthConfig(origin, "public-test-key", false))))
            assertFalse(repository.connect(origin).config.googleEnabled)
            try { repository.beginSignIn(); fail("Expected disabled provider") }
            catch (error: IllegalArgumentException) { assertTrue(error.message!!.contains("reachable")) }
        }
    }

    @Test fun aNonAugustServerGetsAnActionableConfigurationError() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val repository = JournalRepository(MemoryStorage(DeviceState()), AugustHttp(), true)
            repository.initialize()
            server.enqueue(MockResponse().setBody("<html>another server</html>"))
            try { repository.connect(server.url("/").toString()); fail("Expected invalid server settings") }
            catch (error: IOException) { assertTrue(error.message!!.contains("address and port")) }
        }
    }

    @Test fun cancellationCannotLeaveCommittedDeviceDataUnpublished() = runBlocking {
        MockWebServer().use { server ->
            server.start()
            val committed = CompletableDeferred<Unit>()
            val release = CompletableDeferred<Unit>()
            val storage = object : DeviceStorage {
                var value = device(server)
                override suspend fun read() = value
                override suspend fun update(transform: (DeviceState) -> DeviceState): DeviceState {
                    value = transform(value)
                    committed.complete(Unit)
                    release.await()
                    return value
                }
            }
            val repository = JournalRepository(storage, AugustHttp(), true)
            repository.initialize()
            val write = launch { repository.setDraft("Keep the committed draft") }
            committed.await()
            write.cancel()
            release.complete(Unit)
            write.join()
            assertEquals(storage.value, repository.state.value)
            assertEquals("Keep the committed draft", repository.state.value.drafts[repository.state.value.accountKey()]!!.content)
        }
    }
}
