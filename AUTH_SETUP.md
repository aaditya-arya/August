# Google sign-in and saved progress

The web and Android clients share Supabase accounts. Saved notes, extracted items, tasks, plans, and graph connections belong to the signed-in account. The web editor autosaves its draft to Supabase as you write. Android uses encrypted device storage for sessions and drafts until you save a moment. Filed journal entries are available to the account on both platforms. The backend and AI processing handle saved journal text.

The app code is ready for configuration. Live Google sign-in and account privacy are **not enabled until the following dashboard steps are complete**. The current public app key cannot administer your project. Do not paste Google client secrets or Supabase admin keys into chat or the mobile app.

## 1. Apply the database migration

Open your existing Supabase project → **SQL Editor** → **New query**. Paste the entire contents of [the ownership migration](supabase/migrations/202611120001_account_ownership.sql) and run it once. This file assumes the existing tables and vector helper from `supabase_schema.sql` are present. Do not rerun an old permissive schema after applying it.

The migration runs in a transaction. It adds ownership, enables row-level security, blocks anonymous table access, and makes the vector helper obey the caller's policies. Existing rows are kept with no owner and are hidden from app accounts until you explicitly recover them. No first login automatically receives old data.

In SQL Editor, verify the installation as an administrator:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('notes', 'extracted_items', 'graph_edges');

select tablename, policyname, permissive, roles
from pg_policies
where schemaname = 'public' and policyname like 'account_%';

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('notes', 'extracted_items', 'graph_edges')
  and grantee in ('anon', 'authenticated');
```

Expect three tables with `rls_enabled = true` and six account policies, including one restrictive boundary for each table. `authenticated` needs SELECT, INSERT, UPDATE, and DELETE on all three tables; `anon` should have no table grants. RLS policies restrict the rows after the table privileges permit access. The API also checks the installed security version before accessing journal data.

## 2. Configure Google

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) in your Google Cloud project. Configure the consent screen and support email. If the app is in testing, add your Gmail address as a test user.
2. Create an OAuth client of type **Web application**. Supabase handles Google's callback, including when sign-in starts on Android.
3. In Supabase → **Authentication → Sign In / Providers → Google**, copy the displayed callback URL. It has the form `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Add that exact URL to the Google web client's **Authorized redirect URIs**. Add your web origin under **Authorized JavaScript origins** (`http://localhost:3000` for local testing; your deployed HTTPS origin later).
5. Copy the Google client ID and client secret into the Supabase Google provider settings, enable the provider, and save. Leave nonce verification enabled. The app requests Google identity for sign-in and does not request Gmail inbox access. Calendar authorization remains a separate optional feature.

See [Supabase's Google provider instructions](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## 3. Allow August's return addresses

Under Supabase → **Authentication → URL Configuration**:

| Setting | Value |
| --- | --- |
| Site URL during local testing | `http://localhost:3000` |
| Additional redirect URL for local web | `http://localhost:3000/auth/callback` |
| Android callback pattern | `augustnative://auth/callback?native_state=*` |
| Additional redirect URL for the public deployment | `https://august-topaz.vercel.app/auth/callback` |

Set Site URL to the real HTTPS web origin when deploying. Native authentication uses a PKCE code exchange and the installed August app's URL scheme. Install the development APK or a signed release build to use the callback.

The Kotlin client's callback pattern allows a per-attempt state query, validated along with PKCE in the app. See [the native Android guide](apps/android/README.md). Google's registered web-client callback remains Supabase's `/auth/v1/callback`.

## 4. Deploy and verify

`main` serves [public production](https://august-topaz.vercel.app/). Pushes to `AndroidAppPushes` get a Vercel Preview. Set the following in the **August project** on Vercel under **Settings → Environment Variables**. Your PC's `.env.local` applies only to local runs.

| Variable | Purpose and Vercel type |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Config. Your Supabase project URL, used by web and Android sign-in. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config. The public Supabase key exposed to app clients. |
| `NEXT_PUBLIC_APP_URL` | Config. Use `https://august-topaz.vercel.app` in Production. |
| `GEMINI_API_KEY` | Secret. Required for AI extraction, embeddings, and generated reviews. |
| `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | Calendar OAuth client credentials. Store the secret as Secret. |
| `CALENDAR_TOKEN_SECRET` | Optional Secret for encrypting Calendar session cookies. Defaults to `GOOGLE_CLIENT_SECRET`. |

For Calendar, add `https://august-topaz.vercel.app/api/auth/google/callback` to the Google web OAuth client's **Authorized redirect URIs**. This callback is separate from the Supabase callback used by **Continue with Google**. The Calendar routes use the incoming request origin to construct their callback.

On the deployed web app, sign in and select **Connect Google Calendar**. Grant the requested access and wait for the connection notice after Google returns. The sidebar's **Check connection** can verify access again. Calendar is connected per browser session.

Redeploy after changing variables. Production variables are scoped separately from Preview. An unconfigured preview can build and serve the APK, with sign-in unavailable. To test signed-in features on a preview, configure its public Supabase variables, the necessary server-side secrets, and that preview origin's allowed callback URLs. Prefer the public production URL for normal Android sign-in. A Vercel login page on a preview link can be caused by Deployment Protection. See [Vercel environment variables](https://vercel.com/docs/environment-variables) and [Deployment Protection](https://vercel.com/docs/deployment-protection).

Check Vercel's deployment result for the most recent commit on the branch named in any failure email. An older failed deployment remains marked failed after a later commit builds successfully. If the latest build fails, open that deployment's build log and check its environment scope and first reported error.

Optional `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, and `GEMINI_REVIEW_MODEL` settings override each respective model preference. See [the AI fallback behavior](RELIABILITY.md) and [the environment template](.env.example).

From the repository root:

```powershell
npm run check:supabase
npm run dev
```

The diagnostic should report **Anonymous table access denied as expected** for all three tables, and `google-sign-in` enabled. It uses HEAD requests and does not download journal content. It does not replace testing two real accounts.

Open `http://localhost:3000`, sign in, save a test moment, sign out, then sign in again and confirm it remains. Use a second Google account in another browser profile and confirm it cannot see the first account's moment. Keep each test account on the Google testing allowlist if required. Test cloud saves on Android using the same Google account and backend.

On the live website, confirm **Download for Android** works while signed out. The public `/api/auth/config` endpoint can confirm that Google is enabled. Signed-out requests to `/api/tasks` and `/api/health` should return HTTP 401.

For a signed-in test on Android, install the [latest website APK](ANDROID.md#install-on-your-phone), then verify the version and **Server status** in Settings. Save a note such as “I want to build a portfolio website.” Confirm it appears in Tasks on Android and the web with no deadline. Pin **August Tasks**, tap the widget's **+**, and save another task. Confirm it appears immediately, then check it off and confirm it moves to Completed on the web after refresh. Open **7 days** in Review to check that saved moments appear while the reflection loads. Use **All time** for older entries and open Connections to verify the account can read both views. If stored entries report `permission denied for table extracted_items`, check the grants and RLS in [step 1](#1-apply-the-database-migration). If **Connect Google Calendar** reports that OAuth is not configured, check the Calendar credentials on Vercel Production and redeploy.

## 5. Recover earlier progress deliberately

Browser and Android writing screens offer **Recover earlier draft** after sign-in when a pre-login draft exists. Web recovery uploads the older text to your signed-in account and removes the browser copy after its cloud save. Android recovery keeps the draft in encrypted device storage until you save the moment.

For old cloud records, first sign in once so the correct account exists. In Supabase's SQL Editor, find your account ID using your verified email:

```sql
select id, email, email_confirmed_at
from auth.users
where email = 'YOUR_VERIFIED_GOOGLE_EMAIL';
```

Only if **all unowned records in this previously single-user project belong to that account**, replace the ID below and run this administrator-only recovery. For a project with data from multiple people, assign individual notes to their verified owners instead.

```sql
begin;
update public.notes set user_id = 'YOUR_ACCOUNT_UUID'::uuid where user_id is null;
update public.extracted_items i set user_id = n.user_id
from public.notes n
where i.note_id = n.id and i.user_id is null and n.user_id = 'YOUR_ACCOUNT_UUID'::uuid;
update public.graph_edges e set user_id = a.user_id
from public.extracted_items a, public.extracted_items b
where e.source_node_id = a.id and e.target_node_id = b.id
  and e.user_id is null and a.user_id = b.user_id
  and a.user_id = 'YOUR_ACCOUNT_UUID'::uuid;
commit;
```

Refresh the app after assignment. Account ownership cannot be changed through an application client. Existing Calendar credentials must be connected again under your signed-in account.

## Android releases after setup

Build the native APK with `npm run build:android`, or open `apps/android` in Android Studio. Run `npm run check:android` before distributing changes. Install each new APK on the device; release signing is configured separately. See [ANDROID.md](ANDROID.md) for phone connections and [the native guide](apps/android/README.md) for Gradle tasks.

For Google Keep imports, reload the updated extension, keep a signed-in August browser tab open, and run sync from Keep. The extension sends the import through the August tab's same-origin session. It asks for access only to the HTTPS server you select and does not copy login tokens.
