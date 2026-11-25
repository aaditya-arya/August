# August on Android

The Android app is a native Kotlin / Jetpack Compose application in [apps/android](apps/android/README.md), using Material 3. The web app and backend remain in the repository root.

## Run on a physical phone

1. Run `npm run build:android` or open `apps/android` in Android Studio.
2. Transfer `apps/android/app/build/outputs/apk/debug/app-debug.apk` to the phone and install **August Dev**.
3. Run `npm run dev:lan` from the repository root. Keep that terminal running.
4. Put both devices on the same Wi-Fi and enter the printed PC Wi-Fi address in the app.
5. Tap **Check connection**. Once the server and Google provider are ready, tap **Continue with Google**.

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
