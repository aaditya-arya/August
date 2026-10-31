// Real-model check of open vocabulary, semantic reuse, and precision; no database/calendar writes.
const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const { extractItems } = require('../.test-build/gemini.js');
const { STARTER_CATALOGUE } = require('../.test-build/taxonomy.js');
const { getClassification } = require('../.test-build/ledger.js');
const context = { currentTime: '2026-10-31T10:00:00.000Z', timezone: 'Asia/Kolkata' };

(async () => {
  const wishes = await extractItems('1. I wanna play Gta6\n2. I want to but PS6\n3. Idea for a study planner that blocks distractions automatically', { ...context, categories: STARTER_CATALOGUE });
  assert.deepEqual(wishes.map((item) => item.category), ['Wishlist', 'Wishlist', 'Idea']);
  let catalogue;
  const first = await extractItems('Dream journal: last night I dreamed I could breathe underwater and the city floated above the sea.', { ...context, categories: STARTER_CATALOGUE, onCategoriesReviewed: (value) => { catalogue = value; } });
  assert.equal(first.length, 1);
  assert.equal(getClassification(first[0]).texture, 'custom', 'A distinct dream entry must not be forced into Daily Life or Ideas.');
  const created = first[0].category;
  assert.ok(catalogue.some((entry) => entry.category === created));
  const next = await extractItems('Dream diary: dreamed I was flying through an endless library last night.', { ...context, categories: catalogue });
  assert.equal(next[0].category, created, 'A synonymous dream entry should reuse the existing category.');
  assert.ok(!first[0].calendar_action.is_actionable && !next[0].calendar_action.is_actionable);
  console.log(JSON.stringify({ wishlistVsIdea: 'passed', createdCategory: created, synonymReuse: 'passed', unexpectedCalendarEvents: 0 }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
