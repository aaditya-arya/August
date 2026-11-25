# Account boundary verification

`npm test` includes server identity verification, failure when database security is not installed, concurrent account contexts, separate caches, Calendar ownership, authenticated mobile HTTP requests, encrypted-storage chunking/interrupted writes, and existing journal behavior.

To run the actual ownership migration against a disposable local PostgreSQL/pgvector engine, install the test tools outside the application's dependency tree:

```powershell
npm install --prefix .local/sql-validation --no-audit --no-fund @electric-sql/pglite@0.5.16 @electric-sql/pglite-pgvector@0.0.17
npm run test:accounts:sql
```

This test creates only an in-memory database. It applies the real base schema and migration twice, tests restrictive policies alongside old permissive policies, checks legacy preservation, and simulates two authenticated roles. It verifies anonymous denial, default ownership, rejected ownership changes, parent-note and graph-edge ownership, and vector-search isolation. It never connects to Supabase. Live Google OAuth and Android device behavior still require the end-to-end checks in [AUTH_SETUP.md](../AUTH_SETUP.md).
