# Account boundary verification

`npm test` includes server identity verification, failure when database security is not installed, concurrent account contexts, separate caches, Calendar ownership, authenticated mobile HTTP requests, encrypted-storage chunking/interrupted writes, and existing journal behavior.

To run the actual ownership migration against a disposable local PostgreSQL/pgvector engine, install the test tools outside the application's dependency tree:

```powershell
npm install --prefix .local/sql-validation --no-audit --no-fund @electric-sql/pglite@0.5.16 @electric-sql/pglite-pgvector@0.0.17
npm run test:accounts:sql
```

This test creates only an in-memory database. It applies the real base schema and migration twice, tests restrictive policies alongside old permissive policies, checks legacy preservation, and simulates two authenticated roles. It verifies anonymous denial, default ownership, rejected ownership changes, parent-note and graph-edge ownership, and vector-search isolation. It never connects to Supabase. Live Google OAuth and Android device behavior still require the end-to-end checks in [AUTH_SETUP.md](../AUTH_SETUP.md).

## Tasks

- `npm test` covers deadline validation, task eligibility, preserving Calendar metadata on completion, and stale review-cache reads. The SQL check above also verifies cross-account denial for task metadata updates.
- Run `npx tsc -p tsconfig.test.json` followed by `node tests/live-tasks.cjs` to check real Gemini extraction with synthetic notes. It reads the configured Gemini key and makes no database or Calendar writes.
- `npm run check:android` runs JVM tests and Android lint. With a disposable emulator connected, `npm run test:android:device` covers task load, completion and Undo, reminder deduplication and cancellation, and widget completion using a synthetic backend. Server and Google account checks on the live deployment are in [the deployment guide](../AUTH_SETUP.md#4-deploy-and-verify).
