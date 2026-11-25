# August

August is an AI-assisted life journal with categorized memories, source-grounded reflections, intention plans, and a graph of related thoughts. Next.js serves the web app and backend; Expo / React Native provides the Android app in the same npm-workspaces repository.

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

Run `npm run dev:mobile` from another terminal. See [ANDROID.md](ANDROID.md) for native development/preview builds, backend addresses, and EAS releases. Root server credentials must never be copied into the mobile environment.

## Checks and implementation notes

```powershell
npm test
npm run lint
npm run build
npm run check:mobile
npm run lint --workspace @august/mobile
```

See [tests/README.md](tests/README.md) for the optional in-memory PostgreSQL/pgvector migration test, which requires separate local test dependencies. [CLASSIFICATION.md](CLASSIFICATION.md), [RELIABILITY.md](RELIABILITY.md), and [SUNDAY_REVIEW.md](SUNDAY_REVIEW.md) explain the AI and persistence behavior.
