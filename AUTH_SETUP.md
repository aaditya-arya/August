# Google sign-in and saved progress

The web and Android clients now use Supabase accounts. Saved notes, extracted items, plans, and graph connections belong to the signed-in account. Android sessions and new drafts use encrypted device storage; browser drafts stay in that browser's local storage. A draft becomes available on other devices after **Save moment** succeeds. This is not end-to-end encryption: the backend and AI processing still handle saved journal text.

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
```

Expect three tables with `rls_enabled = true` and six account policies, including one restrictive boundary for each table. The API also checks the installed security version before accessing journal data.

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
| Additional redirect URL for Android | `august://auth/callback` |
| Additional redirect URL after deployment | `https://YOUR_WEB_HOST/auth/callback` |

Set Site URL to the real HTTPS web origin when deploying. Keep the exact native callback in the allowlist. Native authentication uses a PKCE code exchange and your installed August app's URL scheme. Use an August development or preview build for this flow; Expo Go is not the target for the custom callback.

## 4. Verify before distributing

From the repository root:

```powershell
npm run check:supabase
npm run dev
```

The diagnostic should report **Anonymous table access denied as expected** for all three tables, and `google-sign-in` enabled. It uses HEAD requests and does not download journal content. It does not replace testing two real accounts.

Open `http://localhost:3000`, sign in, save a test moment, sign out, then sign in again and confirm it remains. Use a second Google account in another browser profile and confirm it cannot see the first account's moment. Keep each test account on the Google testing allowlist if required. Test cloud saves on Android using the same Google account and backend.

There is no deployed web address yet. To sync from a distributed Android APK, deploy the Next.js backend to an HTTPS host with the root server environment variables configured, then enter that origin in Android's connection screen. Public Supabase URL/key are the only Supabase settings exposed to the clients; AI keys and Calendar secrets stay on the server. A local-only backend cannot provide always-available phone synchronization.

## 5. Recover earlier progress deliberately

Browser and Android writing screens offer **Recover earlier draft** after sign-in when a pre-login draft exists. Recovery copies it into that account's draft and only removes the older draft after the copy is stored. Save the recovered writing to sync it.

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

This change adds native authentication/storage modules, so install one new preview APK:

```powershell
npm run build:android:preview
```

After that, publish compatible JavaScript/UI changes with:

```powershell
npm run update:android:preview -- --message "Describe the change"
```

The update command works from the root or `apps/mobile`. Login, EAS project initialization, and keystore creation do not need repeating. Devices receive compatible updates through Expo Updates on app launches; they do not all update at the same instant. Native dependencies, permissions, and configuration changes require a new APK. See [Expo's update lifecycle](https://docs.expo.dev/eas-update/how-it-works/).

For Google Keep imports, reload the updated extension, keep a signed-in August browser tab open, and run sync from Keep. The extension sends the import through the August tab's same-origin session. It asks for access only to the HTTPS server you select and does not copy login tokens.
