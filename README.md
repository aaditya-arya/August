# August

August is an AI-assisted life journal with categorized memories, source-grounded reflections, intention plans, a task board, and a graph of related thoughts. The web app and API use Next.js, React, and TypeScript on Vercel. Supabase provides Google sign-in and account-owned PostgreSQL storage, including pgvector for related memories. Gemini handles extraction, embeddings, and reflections. The native Android client uses Kotlin, Jetpack Compose, Material 3, and WorkManager.

Open the [live journal](https://august-topaz.vercel.app/) or [download Android 0.6.0](https://august-topaz.vercel.app/downloads/august-android-preview.apk) for Android 8.0 or newer. Tap **Continue with Google** to connect to the public journal. Use the same account on web and Android to see your saved data. The live backend works while your PC is off. See [Android setup and updates](ANDROID.md) and [deployment and OAuth setup](AUTH_SETUP.md#4-deploy-and-verify).

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

Open [http://localhost:3000](http://localhost:3000) and sign in. The same account and Supabase project provide the same saved journal entries and web draft. Android keeps its draft on the device until you save. Connect Google Calendar in each browser where you want Calendar sync.

There is no need to copy `node_modules`, `.next`, or generated Android/iOS folders. For production web hosting, configure the environment on the host and run `npm run build` followed by `npm start`, or use a Next.js-compatible hosting service.

## Writing on the web

Write in **Journal** after signing in. **Saved to cloud** means the latest text has reached your account. You can continue that draft in another browser signed into the same account. Keep the tab open while you're offline so pending edits can upload once you reconnect. If another tab changed the draft, the editor keeps your text visible and asks which version to use.

Step away from the editor for about 15 seconds and August begins organizing the saved text into moments, tasks, reminders, and events. The receipt shows what was filed. Use **New entry** when you're ready to write again. If organization fails, your draft remains available and **Try again** retries it. **Text** adjusts size, typeface, and animation. **Focus** opens a full-screen editor, with Escape to return.

**Connect Google Calendar** is separate from Google sign-in. After you return from Google, August checks Calendar access and reports the result. The sidebar shows the connection status and offers **Check connection**.

## Android

For the new native Material 3 application, open `apps/android` in Android Studio or follow [its build and setup guide](apps/android/README.md). It builds an installable APK using Gradle and uses the existing authenticated backend.

## Tasks

The checkmark tab on the website and Android keeps work mentioned in journal notes. “I want to create a website” and “I'm working on a product” become tasks even without dates; passing ideas, purchase wishes, cancellations, and already finished work are excluded. Explicit deadlines use the writer's timezone. Both clients offer grid/list views, deadline editing, completed filters, and completion with Undo. Completion is shared with Sunday Review through the existing account-owned entry metadata.

On Android, write naturally and tap **Save moment**. The save summary shows the tasks, reminders, and upcoming events found in the writing. Tasks and reminders appear on the board and widget without a second entry. An appointment keeps its event date and appears as an event. Google Calendar sync depends on the existing Calendar connection.

The Android board includes a date strip, grid and list layouts, and a swipeable Focus view. You can also add a task manually. The resizable **August Tasks** widget's **+** opens quick add over the home screen. Saving closes the window and refreshes the widget. Expand **Tasks → Reminders & widget** to allow notifications or pin the widget. A reminder with a time alerts at that time. A task with a deadline gets one-day and one-hour alerts where possible. If both times have passed and the deadline is still ahead, it gets an alert at the deadline. Android battery restrictions can delay delivery. The widget shows cached tasks offline and needs a connection to save changes.

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
