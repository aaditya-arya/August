package app.august.nativejournal.data

import app.august.nativejournal.BuildConfig
import kotlinx.serialization.Serializable

const val PUBLIC_JOURNAL = "https://august-topaz.vercel.app"
private const val APK_PATH = "/downloads/august-android-preview.apk"

@Serializable
data class AppRelease(val version: String, val versionCode: Int, val applicationId: String) {
    val downloadUrl get() = "$PUBLIC_JOURNAL$APK_PATH?v=$versionCode"
}

suspend fun availableAppUpdate(): AppRelease? {
    val manifest = AugustHttp().request("$PUBLIC_JOURNAL/downloads/android-release.json", timeoutSeconds = 15)
    val release = AugustJson.decodeFromString<AppRelease>(manifest)
    check(release.applicationId == BuildConfig.APPLICATION_ID && release.versionCode > 0) {
        "The website doesn't have an update for this build."
    }
    return release.takeIf { it.versionCode > BuildConfig.VERSION_CODE }
}
