# [PENDING REVIEW] Google Keep Chrome Extension & Notion Scraper Pipeline

> **Status:** `REQUIRES FURTHER TESTING & USER REVIEW`  
> **Date Added:** 2026-10-03  
> **Scope:** Browser DOM Scraping for Google Keep & Server-Side Notion Sync

---

## 1. Overview
This module was created to eliminate manual copy-pasting and formatting friction when importing legacy thoughts from Google Keep and Notion into **Write**.

### Core Components:
1. **Chrome Extension (Manifest V3)** (`extension/`):
   - `manifest.json`: Defines active tab and host permissions (`keep.google.com`).
   - `content.js`: DOM scraper that selects Google Keep note cards (`div.IZ65Rd-TBnAttached`, `div[role="listitem"]`), extracts titles, checkbox states (`[x]` / `[ ]`), and body text.
   - `popup.html` & `popup.js`: User interface in Chrome toolbar to trigger sync and send JSON payload to the backend.
   - `styles.css`: Styled to match the Write theme.
2. **Backend Keep Ingestion Endpoint** (`src/app/api/import/keep/route.ts`):
   - Handles CORS from extension origins.
   - Chunks notes in concurrency batches of 3.
   - Runs Gemini structured extraction (`extractItems`), calculates temporal timestamps, extracts calendar actionability, generates embeddings (`generateEmbedding`), saves to Supabase, and builds graph edges (`computeAndStoreGraphEdges`).
3. **Notion Direct API Architecture**:
   - Proposed server-side OAuth flow (`/api/auth/notion`) using Notion API `blocks.children.list` to stream page content directly into the Gemini pipeline.

---

## 2. Items Requiring Later Review & Testing
- [ ] Test DOM selector resilience against recent or future Google Keep web UI updates.
- [ ] Test large batches (100+ notes) against Gemini rate limits and measure latency.
- [ ] Add selective filtering (e.g. choose specific labels or notes to sync before ingestion).
- [ ] Implement deduplication check so re-running sync on Google Keep doesn't duplicate existing notes in Supabase.
- [ ] Finalize Notion OAuth App credentials and token storage schema in Supabase.

---
*Marked for later deep review and hardening.*
