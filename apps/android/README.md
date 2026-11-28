# August: native Android

The native client uses Kotlin, Jetpack Compose, Material 3, coroutines, and OkHttp. It produces a standalone Android APK. The Next.js backend handles AI processing and database access.

## Build and install

Open **this directory** in Android Studio and let Gradle sync. Install Android SDK Platform 36 and Build Tools 35.0.0 if Studio requests them. The build uses JDK 17, Gradle 8.13, Android Gradle Plugin 8.13.2, Kotlin 2.2.21, and a pinned Compose BOM. Minimum device version: Android 8.0 / API 26.

From this directory on Windows:

```powershell
# Set ANDROID_HOME to your SDK if Android Studio has not created local.properties.
$env:ANDROID_HOME = "$env:LOCALAPPDATA/Android/Sdk"
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

On macOS/Linux, use `sh ./gradlew` with the same task names. The wrapper downloads Gradle and verifies its distribution checksum. The checked-in wrapper JAR matches Gradle's published 8.13 wrapper checksum.

The installable development APK is `app/build/outputs/apk/debug/app-debug.apk`. With an authorized USB-debugging device connected, run `:app:installDebug`, or choose Run in Android Studio. Release builds require your own signing configuration before distribution; no signing key is committed.

## Website download

The website includes **Download for Android** on the public sign-in screen and in its navigation. The [0.5.0 preview APK](https://august-topaz.vercel.app/downloads/august-android-preview.apk) is available without signing in. The [release manifest](https://august-topaz.vercel.app/downloads/android-release.json) records its version, byte count, and SHA-256. The app reads the public manifest from **Settings → App updates**. Each website release must retain the distributed APK's signing certificate for in-place updates.

After a new debug build, run `npm run package:android` from the repository root. This copies the APK into `public/downloads` and regenerates the release metadata. Commit both files so the web host can serve the installer without needing an Android SDK during deployment. The website labels this as a development preview, installed as August Dev; it is not a Play Store release.

The debug app is labelled **August Dev**, with application ID `app.august.nativejournal.debug`. The release application ID is `app.august.nativejournal`.

## Connect your existing journal

On first launch, **Continue with Google** connects to the public website automatically. For local development or a custom backend, choose **Use a different server**. The LAN command `npm run dev:lan` prints addresses you can enter on your phone:

| Where the backend runs | Native server address |
| --- | --- |
| Development PC, Android emulator | `http://10.0.2.2:3000` |
| Development PC, physical phone on the same Wi-Fi | `http://YOUR_PC_LAN_IP:3000` |
| Public August deployment | `https://august-topaz.vercel.app` |

HTTP is enabled only in debug builds. Release builds require HTTPS. A physical phone needs a reachable development server and firewall permission. The app downloads only public auth configuration from `/api/auth/config`; never copy root `.env.local`, Gemini credentials, Google client secrets, or Supabase admin credentials into this Android project.

There is no prefilled emulator address. `10.0.2.2` works only inside Android Emulator; `0.0.0.0` is a listening address and is rejected as a destination. A successful server check is displayed separately from Google provider availability. Connection checks time out after 15 seconds; AI saves retain the longer processing timeout.

If the phone's browser cannot open the PC's LAN address, open **Administrator PowerShell** in the repository root and run `.\scripts\allow-phone-dev.ps1`. This creates one Node.js/TCP-3000 inbound rule restricted to the local subnet, including when Windows classifies the Wi-Fi network as Public. It does not disable the firewall. Use `-Remove` to remove the rule later. Guest Wi-Fi/client isolation or VPN routing can also block device-to-device traffic; switch both devices to a network that permits it.

Complete [the account setup](../../AUTH_SETUP.md) for the shared Supabase project. Under Supabase **Authentication → URL Configuration → Redirect URLs**, add:

```text
augustnative://auth/callback?native_state=*
```

This pattern permits the per-attempt state query on one callback path. The native activity accepts only the `augustnative` scheme, `auth` host, and `/callback` path; application validation also checks the unpredictable state, attempt lifetime, and PKCE verifier.

Google's authorized redirect URI remains the **Supabase** callback shown in its Google provider settings. Do not put the custom native scheme into Google's web-client redirect settings. Google Calendar authorization remains a separate web feature.

## Features

- Material 3 navigation, edge-to-edge layout, light/dark/system appearance, and native text input.
- Google sign-in through the system browser/Custom Tabs with Supabase PKCE and token refresh.
- Account-scoped writing drafts, stable retry identities, and a disabled editor while saving.
- Searchable journal with category filters, expandable entries, and Android share-out.
- Seven-day, thirty-day, and all-time reviews. Saved moments appear first while Gemini prepares the source-backed reflection.
- A checkmark Tasks tab with two-column grid/list layouts, undated and dated work, editable deadlines, completed filters, confirmation haptics, and Undo. Completions sync to the website and reviews.
- Direct task entry with an optional deadline. The resizable **August Tasks** widget has a **+** to open quick add, checkboxes to complete tasks, and a refresh action. Successful task writes update the widget from the same account cache used by the app.
- With notifications allowed, open tasks get reminders one day and one hour before their deadline when those times are still ahead. If both have passed, August schedules a reminder at the deadline. WorkManager persists reminders and periodically refreshes tasks while connected. Android battery restrictions can delay delivery. Completion, rescheduling, sign-out, and disabling reminders cancel the relevant pending jobs.
- A bounded force-directed connections canvas with pinch zoom, pan, selection, category filters, and an accessible list. At most 120 nodes are drawn at once.
- Incoming plain-text Android shares that the user can append to their draft before saving.
- AES-GCM encryption using an Android Keystore key and atomic file replacement for sessions, drafts, and a cache of the latest 200 loaded moments. Device data is excluded from backup.
- An explicitly labelled sample journal for exploring the interface without credentials. Sample entries are never sent to the backend.

Cached moments and widget tasks can be read offline while the local account session is retained. Saving, widget completion, new reviews, graphs, and authentication need connectivity. A widget completion that cannot reach the server leaves the task open. Draft persistence is debounced by 300 ms and flushed on activity stop and before saving. Sign-out clears sessions and cached entries while retaining the account's encrypted draft.

Detailed financial/goal-plan editing, Calendar authorization/session handoff, biometric locking, and offline note-upload synchronization remain follow-up work. Task sync and deadline notifications are available; saved writing still needs a network connection.

## Verification

JVM tests cover URL validation, PKCE and callback validation, retry identity, account scoping, graph layout, failed-save recovery, token refresh, server changes, and sign-out. Run `:app:testDebugUnitTest` and `:app:lintDebug` before changes are distributed.

With a device connected, run `:app:connectedDebugAndroidTest` for the preview navigation/editor smoke test. Live validation still requires signing in on a device, saving a moment, restarting the app, checking draft recovery, sharing text into it, and comparing two accounts against a properly configured backend. An APK build or JVM test does not establish that live Google OAuth has been configured.

`TasksIntegrationTest` uses a synthetic on-device HTTP backend to exercise authenticated task loading, completion/Undo, widget check actions, and notification deduplication/cancellation. Run it on a disposable emulator; it skips an existing signed-in account. JVM tests cover reminder times, overdue/undated exclusion, account boundaries, failed completions, and stale task reads. `node tests/live-tasks.cjs` after compiling test sources checks real Gemini work-intent extraction without database writes.
