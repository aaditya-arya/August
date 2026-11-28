# August

August is an AI-assisted life journal with categorized memories, source-grounded reflections, intention plans, a task board, and a graph of related thoughts. The web app and API use Next.js, React, and TypeScript on Vercel. Supabase provides Google sign-in and account-owned PostgreSQL storage, including pgvector for related memories. Gemini handles extraction, embeddings, and reflections. The native Android client uses Kotlin, Jetpack Compose, Material 3, and WorkManager.

Open the [live journal](https://august-topaz.vercel.app/) or [download Android 0.4.0](https://august-topaz.vercel.app/downloads/august-android-preview.apk) for Android 8.0 or newer. In August Dev, connect to `https://august-topaz.vercel.app` and sign in with the same Google account you use on the web. The live backend works without your PC running. See [Android setup](ANDROID.md) for installation and [deployment and OAuth setup](AUTH_SETUP.md#4-deploy-and-verify) for hosting.

## Run on another PC

Install Git and Node.js with npm. The current working environment uses Node.js 22.23.1 and npm 10.9.8.

Clone the repository from the production branch:

```powershell
git clone --branch main https://github.com/aaditya-arya/August.git
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

## Tasks

The checkmark tab on the website and Android keeps work mentioned in journal notes. “I want to create a website” and “I'm working on a product” become tasks even without dates; passing ideas, purchase wishes, cancellations, and already finished work are excluded. Explicit deadlines use the writer's timezone. Both clients offer grid/list views, deadline editing, completed filters, and completion with Undo. Completion is shared with Sunday Review through the existing account-owned entry metadata.

Android 0.4.0 adds a resizable **August Tasks** widget that lists open tasks and lets you check them off from the home screen. Expand **Tasks → Reminders & widget** to allow notifications or pin the widget. For open tasks with future deadlines, the Android app schedules reminders one day and one hour before, skipping times that have already passed. If neither reminder time remains, it schedules one at the deadline. Android battery restrictions can delay delivery. The widget shows cached tasks offline and needs a connection to save completions.

Tasks reuse existing account-protected `extracted_items` metadata, so installations with the [ownership migration](AUTH_SETUP.md#1-apply-the-database-migration) need no additional SQL. Existing Task and Reminder entries remain eligible. Older entries are not reprocessed to discover previously unrecognized tasks. Marking a task complete cancels its Android reminders and leaves any existing Google Calendar event in place.

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
