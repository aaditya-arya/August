# August

August is an AI-assisted life journal with categorized memories, source-grounded reflections, intention plans, and a graph of related thoughts. Next.js serves the web app and backend. The native Kotlin / Jetpack Compose Android client lives in `apps/android`.

## Run on another PC

Install Git and Node.js with npm. The current working environment uses Node.js 22.23.1 and npm 10.9.8.

Clone the branch containing the current web and Android implementation:

```powershell
git clone --branch AndroidAppPushes https://github.com/aaditya-arya/August.git
cd August
npm ci
Copy-Item .env.example .env.local
```

Fill in `.env.local`, or privately transfer your existing file instead of copying the template. Keep real credentials out of Git. Supabase Google sign-in and the account ownership migration must be configured as described in [AUTH_SETUP.md](AUTH_SETUP.md). An existing Supabase project's dashboard configuration is shared across PCs; it does not need repeating for each clone.

```powershell
npm run check:supabase
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in. The same account and Supabase project provide the same saved journal entries. Unsaved drafts remain on their original device/browser, and Google Calendar must be connected in the new browser.

There is no need to copy `node_modules`, `.next`, or generated Android/iOS folders. For production web hosting, configure the environment on the host and run `npm run build` followed by `npm start`, or use a Next.js-compatible hosting service.

## Android

For the new native Material 3 application, open `apps/android` in Android Studio or follow [its build and setup guide](apps/android/README.md). It builds an installable APK using Gradle and uses the existing authenticated backend.

The website's **Download for Android** button serves the packaged preview APK directly. To update that download after building a new APK, run `npm run package:android` and commit `public/downloads` with the release metadata.

For a phone on the same Wi-Fi, run `npm run dev:lan` and enter the printed Wi-Fi address in the app. Tap **Check connection**, then **Continue with Google**. See [ANDROID.md](ANDROID.md) for firewall setup, native builds, and connection troubleshooting. Root server credentials must never be copied into the Android client.

## Checks and implementation notes

```powershell
npm test
npm run lint
npm run build
npm run check:android
```

See [tests/README.md](tests/README.md) for the optional in-memory PostgreSQL/pgvector migration test, which requires separate local test dependencies. [CLASSIFICATION.md](CLASSIFICATION.md), [RELIABILITY.md](RELIABILITY.md), and [SUNDAY_REVIEW.md](SUNDAY_REVIEW.md) explain the AI and persistence behavior.
