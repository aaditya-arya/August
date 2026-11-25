# August on web and Android

August is now an npm-workspaces monorepo. Keep one repository and one main development branch. Use short-lived feature branches for changes; do not maintain a permanent Android fork.

```text
src/                 Existing Next.js web UI and backend
apps/mobile/         Expo / React Native Android application
packages/shared/     API contracts, API client, writing prompts, draft persistence
tests/               Existing domain tests and shared-client tests
```

The web project stays at the repository root so existing Next.js commands and deployments keep working. We can move it to `apps/web` later if that becomes useful; it is not required for a monorepo.

## What is implemented

- Native writing screen with the same prompts as the web editor, local draft recovery, focus mode, and haptic feedback.
- Native moments list with time/category filters, text/tag search, pull-to-refresh, and the Android share sheet.
- Native Sunday Review reading screen and an interactive graph overview.
- Device appearance support and a checked, persisted backend address in Settings.
- Shared save API with idempotency keys. Interrupted saves can retry without creating duplicate notes.
- Android bundle export and development/preview/production EAS profiles.

React is aligned at 19.3 across both apps to avoid duplicate native React runtimes. Next.js and its ESLint configuration were updated to 16.4.6 after the dependency audit identified advisories in the previous version; `source-map-js` was also updated within its supported range. This is not a claim that every transitive dependency advisory is resolved.

This is the first native implementation, not full feature parity or a Play Store release. Native editing of intention plans, Google Calendar OAuth/session handoff, incoming Android share intents, push notifications, biometric locking, and offline synchronization of saved entries remain follow-up work. Offline support currently covers the writing draft; saving and reading the journal require the backend. Web and Android drafts are device-local; saved entries share the same database.

## Run locally

From the repository root:

```powershell
npm install
npm run dev
```

In another terminal:

```powershell
npm run dev:mobile
```

The project uses Expo SDK 58 and React Native 0.88. Use a matching development build; do not assume a currently installed Expo Go version supports it. Android Studio and an SDK were found on this workstation, but no connected Android device or configured emulator was available during setup.

Open native **Settings → Connect your journal**:

- Android emulator: `http://10.0.2.2:3000`.
- Physical phone: `http://<computer-Wi-Fi-IP>:3000`; use the same Wi-Fi network and allow the development server through the firewall.
- A deployed build: your future HTTPS backend origin.

Alternatively set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local`. Never copy the root `.env.local` into the mobile project: the AI and Google server credentials belong on the backend.

For a local Android development build:

```powershell
cd apps/mobile
$env:AUGUST_ALLOW_HTTP = "1"
npx expo run:android
```

This generates native directories through Expo. They are ignored by Git. The explicit HTTP flag is for development builds only; preview and production profiles require HTTPS. `npm run android` opens an already installed development client; it does not build an APK itself.

## How coordinated releases work

1. Make the change in a feature branch. Put common contracts and pure application logic in `packages/shared`, and platform-specific UI in the respective app.
2. Check both applications and merge one commit.
3. Deploy the Next.js backend/web app. Keep API changes backward-compatible with Android versions already installed.
4. Publish a compatible mobile JavaScript/assets update through Expo Updates, or create an Android build when native dependencies, permissions, or native configuration changed.

These releases can be automated from the same commit. They do **not** guarantee that every device updates at exactly the same instant: mobile updates depend on application launches, connectivity, runtime compatibility, and store rollout. The `fingerprint` runtime policy keeps updates matched to their native build.

Before the first distributed build, choose the final Android application ID (the current `app.august.ledger` is a development default), connect an Expo account/project, and configure a deployed HTTPS API. From `apps/mobile`:

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest update:configure
npx eas-cli@latest build --platform android --profile development
```

Expo initialization writes the actual project ID and update URL; no fake project ID or signing credentials are committed. Set `EXPO_PUBLIC_API_URL` in the appropriate Expo environment before preview/production builds or updates. Later:

```powershell
npx eas-cli@latest update --channel production --environment production --message "Describe the release"
npx eas-cli@latest build --platform android --profile production
```

The clients now implement Google account sign-in, verified server sessions, and account-scoped data access. Complete the [manual Supabase setup](AUTH_SETUP.md) before using live accounts. The database migration and Google provider configuration must be installed in the dashboard; the public app key cannot do that. Google Calendar authorization remains separate from application sign-in.

## Checks

```powershell
npm test
npm run build
npm run check:mobile
npm run lint --workspace @august/mobile
npm run export:android --workspace @august/mobile
cd apps/mobile
npx expo-doctor
```

`export:android` builds the Android JavaScript/Hermes bundle. It is not an APK/AAB, signing check, or device test.

### EAS fails during “Install dependencies”

The November 12 preview builds failed with `npm ci` reporting missing `@emnapi/core` / `@emnapi/wasi-threads` entries. The Windows-generated lockfile omitted dependencies of Tailwind's optional WASM package and a required peer of the shared native WASM runtime. The fix records the bundled dependencies and explicitly pins `@emnapi/core` as a root build dependency, which also locks its required threads package. Application package versions are unchanged. `tests/lockfile.test.cjs` checks dependency completeness and platform runtime peers so these omissions are caught before another upload.

Keep the root lockfile in Git. Run installation commands from the repository root; EAS detects the mobile workspace and runs its clean installation there as well. The preview command works from either the repository root or `apps/mobile`:

```powershell
npm run build:android:preview
```

Login, project initialization, update configuration, and keystore generation do not need to be repeated. The “No environment variables” message was not the dependency-install failure. The account-enabled preview starts with the connection/sign-in screen; it preserves existing drafts until sign-in and explicit recovery. Account synchronization requires an HTTPS backend address.

The preview script pins the verified EAS CLI 27.7.2. During verification, newly published `eas-cli@27.8.0` failed to install because its `@expo/turtle-spawn@27.8.0` tarball returned npm 404; avoid `@latest` until that upstream publication is complete.

Verified on November 12, 2026: [preview build b4e026ad](https://expo.dev/accounts/aaditya-arya/projects/august-ledger/builds/b4e026ad-8706-491e-a290-dc0b806203ab) finished successfully and generated a signed APK. All 74 local tests, mobile type-checking, and mobile lint passed.

## Supabase diagnostics

```powershell
npm run check:supabase
npm run check:supabase -- --realtime
```

The script checks that anonymous table access is denied using HEAD requests and verifies that Google sign-in is enabled. It does not print keys, fetch journal contents, or write database rows. The optional Realtime test opens a temporary channel and disconnects without sending messages. This is a configuration check, not a complete cross-account audit.

On November 12, 2026, all required tables returned HTTP 200, the app's items/graph/intentions endpoints returned HTTP 200, and Realtime returned `SUBSCRIBED`. The screenshot's `Database supervisor not found for tenant` warning was not reproduced. Its original cause remains unconfirmed without project logs. The application does not currently subscribe to Realtime; do not change SQL tables or RLS to try to repair a Realtime service warning.

The ledger now presents failed loads with a retry button instead of incorrectly showing an empty journal. If the warning repeats alongside failed live checks, inspect the Supabase Realtime logs/project health using the connected Supabase integration or project dashboard.

References: [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Expo runtime compatibility](https://docs.expo.dev/eas-update/runtime-versions/), [configuring updates](https://docs.expo.dev/eas-update/getting-started/).
