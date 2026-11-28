package app.august.nativejournal.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.SerializationException
import java.io.IOException
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicInteger

class JournalRepository(private val storage: DeviceStorage, private val http: AugustHttp, private val allowHttp: Boolean) {
    private val mutable = MutableStateFlow(DeviceState())
    val state = mutable.asStateFlow()
    private val refreshMutex = Mutex()
    private val authMutex = Mutex()
    private val mutationMutex = Mutex()
    private val initializationMutex = Mutex()
    private var initialized = false
    private val taskRevision = AtomicLong()
    private val taskWrites = AtomicInteger()
    @Volatile private var generation = 0L

    suspend fun initialize() = initializationMutex.withLock {
        if (!initialized) { mutable.value = storage.read(); initialized = true }
    }
    private suspend fun change(transform: (DeviceState) -> DeviceState) {
        mutationMutex.withLock {
            // Publishing the committed state must finish even if a debounced draft
            // write is cancelled while the atomic file replacement is completing.
            withContext(NonCancellable) { mutable.value = storage.update(transform) }
        }
    }
    private fun checkAccount(key: String, expectedGeneration: Long) {
        check(state.value.accountKey() == key && generation == expectedGeneration) { "The active account changed. Please try again." }
    }

    suspend fun connect(value: String): Connection {
        val server = normalizeServer(value, allowHttp)
        val response = http.request("$server/api/auth/config", timeoutSeconds = 15)
        val config = try { AugustJson.decodeFromString<AuthConfig>(response) }
        catch (_: SerializationException) { throw IOException("Reached $server, but it didn't return August sign-in settings. Check the address and port.") }
        normalizeServer(config.supabaseUrl, allowHttp)
        require(config.supabaseAnonKey.isNotBlank()) { "This server has not configured sign-in yet." }
        if (state.value.connection != Connection(server, config)) {
            generation++
            change { it.copy(connection = Connection(server, config), session = null, authAttempt = null) }
        }
        return Connection(server, config)
    }

    suspend fun beginSignIn(): String = authMutex.withLock {
        val connection = state.value.connection ?: error("Connect your August server first.")
        require(connection.config.googleEnabled) { "Your server is reachable, but Google sign-in is not enabled yet." }
        val attempt = AuthAttempt(randomUrlToken(), randomUrlToken(), Instant.now().epochSecond)
        change { it.copy(authAttempt = attempt) }
        val redirect = "$AUTH_CALLBACK?native_state=${attempt.state}"
        http.url(connection.config.supabaseUrl, "/auth/v1/authorize", mapOf(
            "provider" to "google", "redirect_to" to redirect,
            "code_challenge" to pkceChallenge(attempt.verifier), "code_challenge_method" to "s256",
            "prompt" to "select_account",
        ))
    }

    suspend fun completeSignIn(url: String) = authMutex.withLock {
        val before = state.value
        val connection = before.connection ?: error("Connect your August server first.")
        val attempt = before.authAttempt ?: error("Start Google sign-in from August first.")
        val expectedGeneration = generation
        val code = callbackCode(url, attempt, Instant.now().epochSecond)
        val response = http.request(http.url(connection.config.supabaseUrl, "/auth/v1/token", mapOf("grant_type" to "pkce")),
            "POST", buildJsonObject { put("auth_code", code); put("code_verifier", attempt.verifier) }.toString(), apiKey = connection.config.supabaseAnonKey, timeoutSeconds = 30)
        val session = AugustJson.decodeFromString<Session>(response).withExpiry()
        check(state.value.authAttempt == attempt && generation == expectedGeneration) { "The sign-in request changed. Please try again." }
        val loginGeneration = ++generation
        change {
            check(it.authAttempt == attempt && generation == loginGeneration) { "The sign-in request changed. Please try again." }
            it.copy(session = session, authAttempt = null)
        }
    }

    private fun Session.withExpiry() = copy(expiresAt = expiresAt.takeIf { it > 0 } ?: (Instant.now().epochSecond + expiresIn))

    private suspend fun session(force: Boolean = false): Session = refreshMutex.withLock {
        val before = state.value
        val old = before.session ?: error("Sign in to open your journal.")
        val connection = before.connection ?: error("Connect your journal first.")
        val key = before.accountKey()!!
        val expectedGeneration = generation
        if (!force && old.expiresAt > Instant.now().epochSecond + 60) return@withLock old
        val fresh = try {
            AugustJson.decodeFromString<Session>(http.request(
                http.url(connection.config.supabaseUrl, "/auth/v1/token", mapOf("grant_type" to "refresh_token")),
                "POST", buildJsonObject { put("refresh_token", old.refreshToken) }.toString(), apiKey = connection.config.supabaseAnonKey, timeoutSeconds = 30,
            )).withExpiry()
        } catch (error: ApiFailure) {
            if (error.status == 400 || error.status == 401 || error.status == 403) {
                checkAccount(key, expectedGeneration)
                val invalidGeneration = ++generation
                change {
                    check(it.accountKey() == key && generation == invalidGeneration) { "The active account changed. Please try again." }
                    it.copy(session = null, authAttempt = null)
                }
                error("Your session expired. Sign in again; your draft is kept on this device.")
            }
            throw error
        }
        checkAccount(key, expectedGeneration)
        check(fresh.user.id == old.user.id) { "Your refreshed session belongs to a different account. Sign in again." }
        change {
            check(it.accountKey() == key && generation == expectedGeneration) { "The active account changed. Please try again." }
            it.copy(session = fresh)
        }
        fresh
    }

    private suspend fun authorized(path: String, parameters: Map<String, String> = emptyMap(),
                                   method: String = "GET", body: String? = null, retryKey: String? = null,
                                   timeoutSeconds: Long = 30): String {
        val key = state.value.accountKey() ?: error("Sign in to open your journal.")
        val expectedGeneration = generation
        val connection = state.value.connection!!
        suspend fun send(force: Boolean): String {
            val token = session(force).accessToken
            checkAccount(key, expectedGeneration)
            val result = http.request(http.url(connection.server, path, parameters), method, body, token, retryKey = retryKey, timeoutSeconds = timeoutSeconds)
            checkAccount(key, expectedGeneration)
            return result
        }
        return try { send(false) } catch (error: ApiFailure) { if (error.status == 401) send(true) else throw error }
    }

    suspend fun moments(): List<Moment> {
        val key = state.value.accountKey() ?: error("Sign in to open your journal.")
        val expectedGeneration = generation
        val items = ServerJson.decodeFromString<ItemsResponse>(authorized("/api/items", mapOf("days" to "all"))).items
        checkAccount(key, expectedGeneration)
        change {
            check(it.accountKey() == key && generation == expectedGeneration) { "The active account changed. Please try again." }
            it.copy(cachedMoments = it.cachedMoments + (key to items.take(200)))
        }
        return items
    }

    suspend fun setDraft(value: String, key: String = state.value.accountKey() ?: error("Sign in to write a moment.")) {
        change { current ->
            check(current.accountKey() == key) { "The active account changed. Please try again." }
            current.copy(drafts = current.drafts + (key to (current.drafts[key] ?: Draft()).copy(content = value)))
        }
    }

    suspend fun save(): SaveResponse {
        val key = state.value.accountKey() ?: error("Sign in to save a moment.")
        val expectedGeneration = generation
        val draft = state.value.drafts[key] ?: Draft()
        val submission = draft.submission()
        // Write the exact retry identity before sending anything over the network.
        change { it.copy(drafts = it.drafts + (key to (it.drafts[key] ?: Draft()).copy(pending = submission))) }
        val body = buildJsonObject { put("content", submission.content); put("currentTime", submission.currentTime); put("timezone", submission.timezone) }.toString()
        val saved = ServerJson.decodeFromString<SaveResponse>(authorized("/api/notes", method = "POST", body = body, retryKey = submission.key, timeoutSeconds = 300))
        check(saved.success) { "The moment was not saved. Your draft is still here." }
        checkAccount(key, expectedGeneration)
        if (saved.tasks.isNotEmpty()) taskRevision.incrementAndGet()
        change { current ->
            check(current.accountKey() == key && generation == expectedGeneration) { "The active account changed. Please try again." }
            val existing = current.cachedTasks[key].orEmpty()
            val merged = (existing + saved.tasks).distinctBy { it.id }.sortedBy { it.id }
            current.copy(
                drafts = current.drafts + (key to (current.drafts[key] ?: Draft()).afterSave(submission)),
                cachedTasks = if (saved.tasks.isEmpty()) current.cachedTasks else current.cachedTasks + (key to merged),
            )
        }
        return saved
    }

    suspend fun review(days: String, refresh: Boolean, summary: Boolean = false): ReviewResponse {
        require(days in listOf("7", "30", "all"))
        return ServerJson.decodeFromString(authorized("/api/digest/synthesis", mapOf(
            "days" to days, "timezone" to ZoneId.systemDefault().id, "refresh" to if (refresh) "1" else "0",
            "summary" to if (summary) "1" else "0",
        ), timeoutSeconds = if (summary) 30 else 175))
    }

    suspend fun graph(): GraphResponse = ServerJson.decodeFromString(authorized("/api/graph"))
    suspend fun tasks(): List<JournalTask> {
        val key = state.value.accountKey() ?: error("Sign in to open your tasks.")
        val expectedGeneration = generation
        val revision = taskRevision.get()
        val tasks = ServerJson.decodeFromString<TasksResponse>(authorized("/api/tasks", mapOf("timezone" to ZoneId.systemDefault().id))).tasks.sortedBy { it.id }
        checkAccount(key, expectedGeneration)
        change {
            check(it.accountKey() == key && generation == expectedGeneration) { "The active account changed. Please try again." }
            if (revision != taskRevision.get() || taskWrites.get() > 0) it
            else it.copy(cachedTasks = it.cachedTasks + (key to tasks), taskSyncAt = it.taskSyncAt + (key to Instant.now().epochSecond))
        }
        return state.value.cachedTasks[key].orEmpty()
    }

    suspend fun createTask(title: String, dueAt: String?, key: String): JournalTask = writeTask("POST", buildJsonObject {
        put("title", title.trim())
        dueAt?.let { put("due_at", it) }
    }, key)

    suspend fun completeTask(id: String, completed: Boolean): JournalTask = writeTask("PATCH", buildJsonObject {
        put("item_id", id)
        put("completed", completed)
    })
    suspend fun editTask(id: String, title: String, dueAt: String?, expectedUpdatedAt: String? = null): JournalTask = writeTask("PATCH", buildJsonObject {
        put("item_id", id)
        put("title", title.trim()); put("due_at", dueAt?.let { kotlinx.serialization.json.JsonPrimitive(it) } ?: kotlinx.serialization.json.JsonNull)
        expectedUpdatedAt?.let { put("expected_updated_at", it) }
    })
    private suspend fun writeTask(method: String, fields: kotlinx.serialization.json.JsonObject, retryKey: String? = null): JournalTask {
        val key = state.value.accountKey() ?: error("Sign in to update a task.")
        val expectedGeneration = generation
        taskWrites.incrementAndGet(); taskRevision.incrementAndGet()
        try {
            val body = buildJsonObject { put("timezone", ZoneId.systemDefault().id); fields.forEach { (name, value) -> put(name, value) } }
            val task = ServerJson.decodeFromString<TaskMutation>(authorized("/api/tasks", method = method, body = body.toString(), retryKey = retryKey)).task
            checkAccount(key, expectedGeneration)
            change {
                check(it.accountKey() == key && generation == expectedGeneration) { "The active account changed. Please try again." }
                val tasks = (it.cachedTasks[key].orEmpty().filterNot { saved -> saved.id == task.id } + task).sortedBy { saved -> saved.id }
                it.copy(cachedTasks = it.cachedTasks + (key to tasks))
            }
            return task
        } finally { taskRevision.incrementAndGet(); taskWrites.decrementAndGet() }
    }
    suspend fun taskReminders(enabled: Boolean) { change { it.copy(taskRemindersEnabled = enabled) } }
    suspend fun claimReminder(account: String, identity: String): Boolean {
        var claimed = false
        change {
            if (it.accountKey() != account || identity in it.deliveredTaskReminders) it
            else { claimed = true; it.copy(deliveredTaskReminders = (it.deliveredTaskReminders + identity).toList().takeLast(1000).toSet()) }
        }
        return claimed
    }
    suspend fun serverStatus(): ServerStatus = ServerJson.decodeFromString(authorized("/api/health"))
    suspend fun appearance(value: String) { require(value in listOf("system", "light", "dark")); change { it.copy(appearance = value) } }

    suspend fun signOut() {
        val before = state.value
        generation++
        // Local sign-out succeeds even offline. Drafts remain encrypted and scoped to their account.
        change { it.copy(session = null, authAttempt = null, cachedMoments = emptyMap(), cachedTasks = emptyMap(), taskSyncAt = emptyMap(), deliveredTaskReminders = emptySet()) }
        try {
            before.session?.let { old -> before.connection?.let { connection ->
                http.request(http.url(connection.config.supabaseUrl, "/auth/v1/logout", mapOf("scope" to "local")),
                    "POST", "{}", old.accessToken, connection.config.supabaseAnonKey)
            } }
        } catch (error: Exception) { if (error is CancellationException) throw error }
    }
}
