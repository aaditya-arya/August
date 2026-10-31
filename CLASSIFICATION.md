Classification uses `src/lib/ledger.ts` as the shared category registry. The database stores `category`; `life_texture` is derived from it in API responses and presentation. No database migration is needed. Do not add queries for a `life_texture` database column or classify entries again using keywords or tags in a page.

The previous implementation mixed three taxonomies: extraction emitted current categories, Clusters filtered old names, and the ledger/Sunday Review guessed categories again from incidental words and tags. The synthesis endpoint also selected a nonexistent `life_texture` column. The shared registry, enum-constrained extraction, runtime validation, and complete review groups replace those paths.

Category and scheduling are separate. An undated concrete action is a Task; an optional wish is an Idea_Desire. Events may be past or future. A calendar action requires an obligation category and a valid future start. Quotes, routine activities, and unknown historical categories have their own groups rather than falling into Quiet Moments or Milestones. Legacy aliases remain readable.

Validation commands:

- `npm test`: deterministic regression tests for normalization, complete grouping, model-output validation, and calendar gating.
- `npm run test:ai`: optional live Gemini tests for intent, tense, negation, timezone calculation, and splitting; requires the existing Gemini credentials and makes no database/calendar changes.
- `npm run build`: production compilation and TypeScript checks.

To repair already misclassified snippets, run `npm run repair:classifications`. It saves a full local backup and a proposed category-change plan under the git-ignored `.local/classification-repair/` directory. Review the plan, then apply that exact plan with `npm run repair:classifications -- --apply <plan-file>`. Application preserves ids, raw notes, snippet content, dates, tags, embeddings, and graph links; it never creates calendar events. Changes to non-obligation categories disable stale local calendar-action flags. Each update checks the old category and content to avoid overwriting concurrent edits. Backups contain private ledger data and should stay local.
