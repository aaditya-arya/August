const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseExtraction, getClassification, groupByCategory, normalizeStoredItem } = require('../.test-build/ledger.js');
const { STARTER_CATALOGUE, mergeCategoryCatalogue, applyCategoryDecisions, novelCategories } = require('../.test-build/taxonomy.js');

const now = '2026-10-31T10:00:00Z';
const raw = (category, content = 'A vivid dream about flying') => ({ category, content, tags: [], event_timestamp: now, calendar_action: { is_actionable: false, kind: 'none' } });
const proposed = (category, content) => ({ ...raw(category, content), category_description: 'Dreams remembered during sleep and recorded for later reflection.', category_confidence: .97, category_reason: 'Neither a creative idea nor a factual waking experience describes a dream during sleep.' });

test('wishes and original concepts have distinct category identities and UI groups', () => {
  const items = parseExtraction({ items: [raw('Wishlist', 'I wanna play Gta6'), raw('Wishlist', 'I want to buy PS6'), raw('Idea', 'An original idea for a new game engine')] }, now, STARTER_CATALOGUE);
  const groups = groupByCategory(items);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.category === 'Wishlist').items.length, 2);
  assert.equal(groups.find((group) => group.category === 'Idea').items.length, 1);
  assert.equal(getClassification(items[0]).label, 'Wishlist');
  assert.throws(() => parseExtraction({ items: [raw('Idea_Desire')] }, now, STARTER_CATALOGUE), /separately/);
});

test('genuinely new categories are allowed with evidence, and render without a code enum change', () => {
  const item = parseExtraction({ items: [proposed('Dream Journal')] }, now, STARTER_CATALOGUE)[0];
  assert.equal(item.category, 'Dream Journal');
  assert.equal(getClassification(item).texture, 'custom');
  assert.equal(getClassification(item).label, 'Dream Journal');
  const groups = groupByCategory([item]);
  assert.equal(groups[0].label, 'Dream Journal');
  assert.equal(normalizeStoredItem(item).category, 'Dream Journal');
});

test('an unsubstantiated, vague, or low-confidence new label cannot be persisted', () => {
  for (const item of [raw('Dream Journal'), { ...proposed('Dream Journal'), category_confidence: .4 }, { ...proposed('Dream Journal'), category_reason: '' }, proposed('Misc'), proposed('This Category Has Far Too Many Words'), proposed('A/B')]) assert.throws(() => parseExtraction({ items: [item] }, now, STARTER_CATALOGUE));
});

test('existing custom categories survive reload and are reused without creating another bracket', () => {
  const catalogue = mergeCategoryCatalogue([{ category: 'Dream Journal', content: 'Dreamed about flying' }, { category: 'dream_journal', content: 'Dreamed about rain' }]);
  assert.equal(catalogue.filter((entry) => entry.category === 'Dream Journal').length, 1);
  const items = parseExtraction({ items: [raw('dream journal', 'Dreamed about a library')] }, now, catalogue);
  assert.deepEqual(novelCategories(items, catalogue), []);
  assert.equal(items[0].category, 'Dream Journal');
});

test('independent review merges a topic-specific wish bracket into Wishlist', () => {
  const items = parseExtraction({ items: [{ ...proposed('Gaming Wishes', 'I want a PS6'), calendar_action: { is_actionable: true, kind: 'event', start_time: '2026-11-01T10:00:00Z' } }] }, now, STARTER_CATALOGUE);
  const review = applyCategoryDecisions(items, STARTER_CATALOGUE, { categories: [{ proposed: 'Gaming Wishes', decision: 'reuse', category: 'Wishlist', description: '', confidence: .99, reason: 'Gaming is the subject of an optional wish; Wishlist already covers it.' }] });
  const validated = parseExtraction({ items: review.items }, now, review.catalogue);
  assert.equal(validated[0].category, 'Wishlist');
  assert.equal(validated[0].life_texture, 'wishlist');
  assert.equal(validated[0].calendar_action.is_actionable, false);
  assert.equal(review.catalogue.length, STARTER_CATALOGUE.length);
});

test('curator approvals require real confidence and cannot invent or omit proposals', () => {
  const items = parseExtraction({ items: [proposed('Dream Journal')] }, now, STARTER_CATALOGUE);
  const valid = { proposed: 'Dream Journal', decision: 'create', category: 'Dream Journal', description: 'Dreams remembered during sleep and recorded in a journal.', confidence: .99, reason: 'A sleeping dream is not a waking idea, media consumption or ordinary daily activity.' };
  const reviewed = applyCategoryDecisions(items, STARTER_CATALOGUE, { categories: [valid] });
  assert.equal(reviewed.catalogue.length, STARTER_CATALOGUE.length + 1);
  for (const categories of [[], [valid, valid], [{ ...valid, confidence: .5 }], [{ ...valid, decision: 'reuse', category: 'Unknown Bracket' }], [{ ...valid, proposed: 'Unrequested Bracket' }]]) assert.throws(() => applyCategoryDecisions(items, STARTER_CATALOGUE, { categories }));
});

test('custom categories require independent scheduling intent; a label never activates Calendar', () => {
  const catalog = mergeCategoryCatalogue([{ category: 'Medical Appointments', content: 'Eye exam tomorrow' }]);
  const scheduled = { ...raw('Medical Appointments', 'Eye exam tomorrow'), calendar_action: { is_actionable: true, kind: 'event', start_time: '2026-11-01T10:00:00Z' } };
  assert.equal(parseExtraction({ items: [scheduled] }, now, catalog)[0].calendar_action.is_actionable, true);
  assert.equal(parseExtraction({ items: [{ ...scheduled, calendar_action: { ...scheduled.calendar_action, kind: 'none' } }] }, now, catalog)[0].calendar_action.is_actionable, false);
  assert.equal(parseExtraction({ items: [{ ...scheduled, category: 'Wishlist' }] }, now, catalog)[0].calendar_action.is_actionable, false);
  assert.equal(parseExtraction({ items: [{ ...scheduled, category: 'Task', calendar_action: { ...scheduled.calendar_action, kind: 'none' } }] }, now, catalog)[0].calendar_action.is_actionable, false);
});

test('catalogue reloads use saved examples, coalesce requests, and refresh incrementally', async (t) => {
  const modulePath = require.resolve('../.test-build/supabase.js');
  const previous = require.cache[modulePath];
  const rows = [{ category: 'Dream Journal', content: 'A dream of flying', created_at: '2026-10-30T10:00:00Z' }];
  const requests = [];
  const db = { from() {
    let since;
    const query = { select: () => query, order: () => query, gte: (_, value) => { since = value; return query; }, range: async (from, to) => { requests.push(since); return { data: rows.filter((row) => !since || row.created_at >= since).slice(from, to + 1), error: null }; } };
    return query;
  } };
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: { supabase: db } };
  t.after(() => { if (previous) require.cache[modulePath] = previous; else delete require.cache[modulePath]; });
  const { loadCategoryCatalogue } = require('../.test-build/category-catalogue.js');
  const [first, same] = await Promise.all([loadCategoryCatalogue(), loadCategoryCatalogue()]);
  assert.equal(first, same); assert.equal(requests.length, 1);
  assert.ok(first.some((entry) => entry.category === 'Dream Journal' && entry.examples.includes('A dream of flying')));
  await loadCategoryCatalogue(); assert.equal(requests.length, 1);
  rows.push({ category: 'Health Measurements', content: 'Blood pressure 120/80', created_at: '2026-10-31T10:00:00Z' });
  const next = await loadCategoryCatalogue(true);
  assert.equal(requests[1], '2026-10-30T10:00:00Z');
  assert.ok(next.some((entry) => entry.category === 'Health Measurements'));
  assert.ok(next.some((entry) => entry.category === 'Dream Journal'));
});
