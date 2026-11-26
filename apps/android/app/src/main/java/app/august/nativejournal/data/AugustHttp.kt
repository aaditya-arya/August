package app.august.nativejournal.data

import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiFailure(val status: Int, message: String) : IOException(message)

fun connectionFailure(url: String, cause: IOException): IOException {
    val address = url.toHttpUrl()
    val origin = "${address.scheme}://${address.host}:${address.port}"
    val message = when {
        address.host == "10.0.2.2" -> "10.0.2.2 is for Android Emulator. On a physical phone, enter your PC's Wi-Fi address instead."
        cause is SSLHandshakeException -> "Couldn't establish a secure connection to $origin. Check the server's HTTPS certificate."
        cause is UnknownHostException -> "Couldn't find ${address.host}. Check the server address and your internet connection."
        cause is InterruptedIOException -> if (address.scheme == "https") "The server at $origin took too long to respond. Check your internet connection and try again."
            else "The connection to $origin timed out. Open this address in your phone's browser and check the PC's firewall."
        cause is ConnectException -> if (address.scheme == "https") "Couldn't connect to $origin. Check your internet connection and the website's availability."
            else "Couldn't connect to $origin. Keep the server running, use the same Wi-Fi, and allow the port through the PC's firewall."
        cause.message?.contains("CLEARTEXT", ignoreCase = true) == true -> "This build requires HTTPS. Use the development APK for a local HTTP server."
        else -> "Couldn't reach $origin. Try opening this address in your phone's browser to check the connection."
    }
    return IOException(message, cause)
}

class AugustHttp(private val client: OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS).readTimeout(300, TimeUnit.SECONDS)
    .callTimeout(300, TimeUnit.SECONDS).followRedirects(false).followSslRedirects(false).build()) {

    suspend fun request(url: String, method: String = "GET", body: String? = null, token: String? = null,
                        apiKey: String? = null, retryKey: String? = null, timeoutSeconds: Long = 300): String {
        val request = Request.Builder().url(url).header("Accept", "application/json").apply {
            token?.let { header("Authorization", "Bearer $it") }
            apiKey?.let { header("apikey", it) }
            retryKey?.let { header("Idempotency-Key", it) }
            method(method, body?.toRequestBody("application/json; charset=utf-8".toMediaType()))
        }.build()
        return suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            call.timeout().timeout(timeoutSeconds, TimeUnit.SECONDS)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(connectionFailure(url, e))
                }
                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        try {
                            val content = it.body?.string().orEmpty()
                            if (!it.isSuccessful) {
                                if (it.code in 300..399) throw ApiFailure(it.code,
                                    "This server redirects to another page instead of returning your journal. Use your public Production address; protected Vercel previews require browser sign-in.")
                                val error = runCatching { AugustJson.decodeFromString<JsonObject>(content) }.getOrNull()
                                val message = listOf("error_description", "msg", "message", "error").firstNotNullOfOrNull { key ->
                                    runCatching { error?.get(key)?.jsonPrimitive?.content?.takeIf { value -> value.isNotBlank() } }.getOrNull()
                                } ?: "Your journal returned an error (${it.code}). Please try again."
                                throw ApiFailure(it.code, message.take(400))
                            }
                            if (continuation.isActive) continuation.resume(content)
                        } catch (error: Exception) { if (continuation.isActive) continuation.resumeWithException(error) }
                    }
                }
            })
        }
    }

    fun url(base: String, path: String, parameters: Map<String, String> = emptyMap()): String =
        "$base$path".toHttpUrl().newBuilder().apply { parameters.forEach { (key, value) -> addQueryParameter(key, value) } }.build().toString()
}
