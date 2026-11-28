# August on Android

The Android app is a native Kotlin / Jetpack Compose application in [apps/android](apps/android/README.md), using Material 3. The web app and backend remain in the repository root.

## Install on your phone

1. On an Android 8.0 or newer phone, [download August Dev 0.6.0](https://august-topaz.vercel.app/downloads/august-android-preview.apk) and install it. If Android asks, allow installs from the app you used to open the APK.
2. Open August Dev and tap **Continue with Google**. The app uses `https://august-topaz.vercel.app` by default. A saved sign-in on an existing install can open the journal directly.
3. Save a journal note such as “I'm building my portfolio. Remind me to call the bank tomorrow at 9 a.m.” The save summary shows the task and reminder, and both appear under **Tasks**.
4. In **Tasks → Reminders & widget**, allow notifications and tap **Add home-screen widget**. The widget's **+** opens a small form over the home screen. Save or close it to go back to where you were. Each circle marks a task complete.

The deployed backend works over Wi-Fi or mobile data with your PC switched off. If a protected Vercel preview asks you to log into Vercel, change the journal address to the public production URL above.

## Update an installed app

Install the new website APK over August Dev and accept Android's **Update** prompt. Leave the existing app installed. Updates signed with the same key preserve the app's server address, local drafts, and session while it remains valid. Website and backend fixes become available with the deployment. Native screen and widget changes require a new APK.

From 0.5.0, **Settings → App updates → Check for updates** checks the public release and offers **Download update** when one is available. It opens the APK download in the browser, and Android asks you to confirm installation.

## Develop on a physical phone over Wi-Fi

1. Run `npm run build:android` or build from Android Studio.
2. Transfer `apps/android/app/build/outputs/apk/debug/app-debug.apk` to the phone and install it.
3. Run `npm run dev:lan` from the repository root and keep the terminal running.
4. Put both devices on the same Wi-Fi. In August Dev, tap **Use a different server** and enter the printed PC Wi-Fi address. Tap **Check connection**, then **Continue with Google**.

A physical phone must use an address such as `http://192.168.1.31:3000`. `10.0.2.2` is an Android emulator alias. `0.0.0.0` means the server listens on all interfaces; it is not a destination address. DHCP can change the PC address, so use the value printed by the LAN command.

## When the phone cannot connect

Open the same address in the phone's browser. If it cannot load, the problem is network access before Google sign-in. Check the PC is awake, the server is running, and both devices are on a network that allows device-to-device traffic.

On Windows, open **PowerShell as Administrator** in the repository root and run:

```powershell
.\scripts\allow-phone-dev.ps1
```

This adds a firewall rule for Node.js on TCP 3000 from the local subnet only. It works on a Public or Private network without disabling Windows Firewall. To remove the rule later, run the same script with `-Remove`. If the connection still fails, check guest-network/client isolation and VPN routing.

The app has a separate connection-check step, a 15-second connection timeout, and specific messages for emulator addresses, DNS, TLS, timeouts, and unavailable servers. A reachable server with Google disabled is shown as a sign-in setup issue.

## Accounts and builds

Complete [AUTH_SETUP.md](AUTH_SETUP.md), including the ownership migration and Supabase redirect pattern `augustnative://auth/callback?native_state=*`. The phone receives only public auth configuration; keep all server secrets in the root environment.

```powershell
npm run build:android
npm run check:android
npm run android
```

The last command installs a debug APK on a connected, authorized Android device or emulator. A deployed HTTPS backend removes the need to leave the PC running. Release APKs require signing; release builds require HTTPS. The [native guide](apps/android/README.md) documents the remaining feature gaps and device tests.
