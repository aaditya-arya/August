Categories are an open vocabulary. `src/lib/ledger.ts` contains starter presentation styles and compatibility aliases, not a closed classification enum. The database stores the category name in the existing text column, so a newly approved category needs no database migration or frontend code change. `Idea` and `Wishlist` are separate: wanting to own, play, read, watch or experience something is a Wishlist entry; proposing an original concept or solution is an Idea.

Extraction receives the existing category catalogue with definitions and representative saved examples. It reuses an established category when that meaning fits. A novel category requires a concise reusable name, a definition, confidence of at least 0.9, and a reason explaining why existing meanings do not fit. An independent semantic review then either reuses an existing category or approves the proposal. That review sees all new proposals together and must merge synonyms and reject topic/brand/person/date-specific subdivisions. Tags carry subjects such as gaming, GTA6 and PS6; those subjects do not need their own wishlist categories. There is no hard total category cap that would force unrelated entries together.

`category-catalogue.ts` rebuilds category names and scope from persisted entries on a cold start, caches the catalogue, coalesces concurrent refreshes and reads new entries incrementally. The curator refreshes the catalogue before approving genuinely new names. Precise definitions are retained in the warm catalogue; saved representative entries preserve the meaning after a restart. The catalogue is not a separate unsaved frontend array.

Ledger filters, Clusters and graph colors are derived from the actual stored categories. New names are preserved and rendered with stable colors rather than mapped to Unclassified or Quiet Moment. Sunday Review instead connects progress, experiences, lessons and intentions across time; it does not repeat category sections. See SUNDAY_REVIEW.md. Presentation textures are decorative and must never merge distinct category groups.

Scheduling intent is independent of the human category. `calendar_action.kind` is task, reminder, event or none; these are scheduling controls, not a limit on expressive categories. A valid future trigger is still required, known non-obligation categories such as Wishlist cannot activate Calendar, and reviewed categories are validated again before persistence. Historical Task/Reminder/Event rows retain compatibility. Custom categories require explicit scheduling intent to create an event.

Validation commands:

- `npm test`: deterministic classification, taxonomy/reuse/novelty, catalogue persistence/cache, scheduling, ingestion, graph, OAuth and scraper regressions.
- `npm run test:ai`: live intent, tense, timezone and mixed-thought extraction checks.
- `npm run test:taxonomy`: live Wishlist-versus-Idea checks plus genuine new-category creation and subsequent synonym reuse. It makes no database or calendar writes.
- `npm run lint` and `npm run build`: repository checks.

Already saved `Idea_Desire` rows need semantic reclassification because the old name cannot say whether they were wishes or concepts. The seven existing merged entries were backed up and reviewed: six became Wishlist, including the GTA6 and PS6 entries, and the study-planner concept became Idea. Their content, dates, ids, tags, embeddings and graph links were preserved.

The repair utility still supports preview-first plans under the git-ignored `.local/classification-repair/` directory. `npm run repair:classifications` produces a local full backup and proposed changes; `npm run repair:classifications -- --apply <plan-file>` applies the reviewed plan with old-category/content checks. Plans accept validated open category names, not just the starter list. Backups contain private ledger data and must remain local.
