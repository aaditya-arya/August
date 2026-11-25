package app.august.nativejournal.data

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.time.ZoneId
import java.util.Base64
import java.util.UUID

const val AUTH_CALLBACK = "augustnative://auth/callback"

fun normalizeServer(value: String, allowHttp: Boolean): String {
    val url = value.trim().toHttpUrlOrNull() ?: throw IllegalArgumentException("Enter your August server's full HTTPS address.")
    require(url.scheme == "https" || allowHttp && url.scheme == "http") { "Use HTTPS to connect to your journal." }
    require(url.host != "0.0.0.0" && url.host != "::") { "0.0.0.0 is a listening address. Enter your PC's actual Wi-Fi address." }
    require(url.username.isEmpty() && url.password.isEmpty() && url.encodedPath == "/" && url.query == null && url.fragment == null) {
        "Use only the server address, without a path, credentials, or query."
    }
    return url.toString().trimEnd('/')
}

fun randomUrlToken(): String = ByteArray(32).also { SecureRandom().nextBytes(it) }.let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
fun pkceChallenge(verifier: String): String = Base64.getUrlEncoder().withoutPadding()
    .encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)))

fun Draft.submission(now: Instant = Instant.now(), timezone: String = ZoneId.systemDefault().id): NoteSubmission {
    val text = content.trim()
    require(text.isNotEmpty()) { "Write a little something first." }
    return pending?.takeIf { it.content == text } ?: NoteSubmission(text, UUID.randomUUID().toString(), now.toString(), timezone)
}

fun Draft.afterSave(submitted: NoteSubmission): Draft = copy(
    content = if (content.trim() == submitted.content) "" else content,
    pending = if (pending?.key == submitted.key) null else pending,
)

fun callbackCode(url: String, attempt: AuthAttempt, now: Long): String {
    // java.net.URI is available in local JVM tests as well as Android.
    val uri = java.net.URI(url)
    require(uri.scheme == "augustnative" && uri.host == "auth" && uri.path == "/callback" && uri.userInfo == null && uri.port == -1 && uri.fragment == null) { "This sign-in return address is invalid." }
    val parameters = uri.rawQuery.orEmpty().split('&').filter { it.isNotEmpty() }.map {
        val pair = it.split('=', limit = 2)
        java.net.URLDecoder.decode(pair[0], "UTF-8") to java.net.URLDecoder.decode(pair.getOrElse(1) { "" }, "UTF-8")
    }.groupBy({ it.first }, { it.second })
    require(now >= attempt.createdAt && now - attempt.createdAt < 600) { "Sign-in expired. Please try again." }
    require(parameters["native_state"] == listOf(attempt.state)) { "This sign-in request does not match this device." }
    require(parameters["error"] == null) { "Google sign-in was not completed. Please try again." }
    return parameters["code"]?.singleOrNull()?.takeIf { it.isNotBlank() } ?: throw IllegalArgumentException("No sign-in code was returned. Please try again.")
}
