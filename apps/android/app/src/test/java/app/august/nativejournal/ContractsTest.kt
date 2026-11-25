package app.august.nativejournal

import app.august.nativejournal.data.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.net.ConnectException
import java.net.UnknownHostException

class ContractsTest {
    @Test fun serverOriginsRejectCredentialLeaksAndReleaseHttp() {
        assertEquals("https://august.example", normalizeServer(" https://august.example/ ", false))
        assertEquals("http://10.0.2.2:3000", normalizeServer("http://10.0.2.2:3000", true))
        listOf("http://august.example", "http://0.0.0.0:3000", "https://user:pass@august.example", "https://august.example/api", "https://august.example?key=secret", "https://august.example#fragment", "file:///tmp").forEach {
            assertThrows(IllegalArgumentException::class.java) { normalizeServer(it, false) }
        }
    }

    @Test fun connectionErrorsIdentifyTheDestinationAndEmulatorMistake() {
        val emulator = connectionFailure("http://10.0.2.2:3000/api/auth/config", ConnectException())
        assertTrue(emulator.message!!.contains("physical phone"))
        val local = connectionFailure("http://192.168.1.31:3000/api/auth/config?private=do-not-show", ConnectException())
        assertTrue(local.message!!.contains("192.168.1.31:3000"))
        assertTrue(local.message!!.contains("firewall"))
        assertFalse(local.message!!.contains("do-not-show"))
        val dns = connectionFailure("https://journal.example/api/auth/config", UnknownHostException())
        assertTrue(dns.message!!.contains("Couldn't find journal.example"))
    }

    @Test fun pkceUsesTheRfc7636Sha256Vector() {
        assertEquals("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
        val verifier = randomUrlToken()
        assertEquals(43, verifier.length)
        assertTrue(verifier.matches(Regex("[a-zA-Z0-9_-]+")))
    }

    @Test fun oauthCallbacksRequireExactAddressStateLifetimeAndOneCode() {
        val attempt = AuthAttempt("verifier", "device-state", 1000)
        assertEquals("auth-code", callbackCode("$AUTH_CALLBACK?native_state=device-state&code=auth-code", attempt, 1100))
        listOf(
            "august://auth/callback?native_state=device-state&code=auth-code",
            "$AUTH_CALLBACK?native_state=wrong&code=auth-code",
            "$AUTH_CALLBACK?native_state=device-state&native_state=device-state&code=auth-code",
            "$AUTH_CALLBACK?native_state=device-state&code=a&code=b",
            "$AUTH_CALLBACK?native_state=device-state&error=access_denied",
        ).forEach { assertThrows(IllegalArgumentException::class.java) { callbackCode(it, attempt, 1100) } }
        assertThrows(IllegalArgumentException::class.java) { callbackCode("$AUTH_CALLBACK?native_state=device-state&code=a", attempt, 1700) }
    }

    @Test fun retriesKeepTheirIdentityAndChangedContentCreatesAnotherSubmission() {
        val first = Draft(" Hello ").submission(Instant.parse("2026-01-01T00:00:00Z"), "Asia/Kolkata")
        assertEquals("Hello", first.content)
        assertEquals(first, Draft("Hello", first).submission())
        assertNotEquals(first.key, Draft("Something else", first).submission().key)
        assertEquals(Draft(), Draft("Hello", first).afterSave(first))
        assertEquals("Later writing", Draft("Later writing", first).afterSave(first).content)
    }

    @Test fun draftsAreSeparatedByServerAndAccount() {
        val connection = Connection("https://august.example", AuthConfig("https://project.supabase.co", "public-key", true))
        val a = DeviceState(connection, Session("a", "a-refresh", user = Account("a")))
        assertNotEquals(a.accountKey(), a.copy(session = a.session!!.copy(user = Account("b"))).accountKey())
        assertNotEquals(a.accountKey(), a.copy(connection = connection.copy(server = "https://other.example")).accountKey())
    }

    @Test fun graphLayoutIsBoundedDeterministicAndDoesNotChangeNodes() {
        val nodes = (1..150).map { GraphNode("$it", "Moment $it", "Idea", "#5855D6") }
        val links = listOf(GraphLink("1", "2", .8, "semantic"), GraphLink("1", "missing", 1.0, "explicit_tag"))
        val result = layoutGraph(nodes, links)
        assertEquals(120, result.size)
        assertEquals(result, layoutGraph(nodes, links))
        assertTrue(result.all { it.x.isFinite() && it.y.isFinite() && it.x in .06f.. .94f && it.y in .06f.. .94f })
        assertEquals(nodes.take(120), result.map { it.node })
        assertEquals(emptyList<PlacedNode>(), layoutGraph(emptyList(), links))
        assertEquals(.5f, layoutGraph(nodes.take(1), links).single().x)
    }
}
