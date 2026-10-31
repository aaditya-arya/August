const { test } = require('node:test');
const assert = require('node:assert/strict');
const { enforceSemanticPruning, normalizeEdgePair, computeEdgesInMemory, parseEmbedding } = require('../.test-build/graph-math.js');

test('pruning evicts weaker connections from BOTH saturated endpoints', () => {
  const edges = [...Array.from({ length: 5 }, (_, i) => normalizeEdgePair('a', `x${i}`, .63 + i * .01, 'semantic')), ...Array.from({ length: 5 }, (_, i) => normalizeEdgePair('b', `y${i}`, .65 + i * .01, 'semantic'))];
  const candidate = normalizeEdgePair('a', 'b', .9, 'semantic');
  const plan = enforceSemanticPruning(candidate, edges);
  assert.equal(plan.shouldInsert, true); assert.equal(plan.edgesToDelete.length, 2);
  const remaining = [...edges.filter((edge) => !plan.edgesToDelete.includes(edge)), candidate];
  for (const id of ['a', 'b']) assert.equal(remaining.filter((edge) => edge.source_node_id === id || edge.target_node_id === id).length, 5);
});

test('overfull historical endpoints evict every required edge; rejected candidates evict nothing', () => {
  const edges = Array.from({ length: 8 }, (_, i) => normalizeEdgePair('a', `x${i}`, .64 + i * .01, 'semantic'));
  assert.equal(enforceSemanticPruning(normalizeEdgePair('a', 'b', .9, 'semantic'), edges).edgesToDelete.length, 4);
  assert.deepEqual(enforceSemanticPruning(normalizeEdgePair('a', 'b', .62, 'semantic'), edges), { shouldInsert: false, edgesToDelete: [] });
});

test('in-memory graph includes .62–.65 semantic edges and caps degrees without hiding tags', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i), category: 'Task', content: 'test', tags: ['shared'], embedding: [1, 0] }));
  const edges = computeEdgesInMemory(items);
  assert.equal(edges.filter((edge) => edge.link_type === 'explicit_tag').length, 66);
  for (const item of items) assert.ok(edges.filter((edge) => edge.link_type === 'semantic' && (edge.source_node_id === item.id || edge.target_node_id === item.id)).length <= 5);
  const low = computeEdgesInMemory([{ ...items[0], embedding: [1, 0] }, { ...items[1], embedding: [.63, Math.sqrt(1 - .63 ** 2)] }]);
  assert.equal(low.find((edge) => edge.link_type === 'semantic').weight, .63);
});

test('malformed embeddings are rejected instead of producing NaN edges', () => {
  for (const value of ['[]', '[1, null]', '[1, "two"]', 'broken', [Infinity], [NaN]]) assert.equal(parseEmbedding(value), null);
  assert.deepEqual(parseEmbedding('[0.5, 1]'), [.5, 1]);
});

test('write-time tag matching pages related metadata and preserves bonds beyond the first page', async (t) => {
  const modulePath = require.resolve('../.test-build/supabase.js');
  const previous = require.cache[modulePath];
  const pages = [], selections = [], inserted = [];
  const related = Array.from({ length: 450 }, (_, i) => ({ id: `related-${i}`, tags: ['shared'] }));
  const db = { from(table) {
    if (table === 'graph_edges') return { upsert: (rows) => { inserted.push(...rows); return { select: async () => ({ data: rows.map((_, i) => ({ id: String(i) })), error: null }) }; } };
    const query = { select: (columns) => { selections.push(columns); return query; }, neq: () => query, overlaps: () => query, order: () => query, range: async (from, to) => { pages.push([from, to]); return { data: related.slice(from, to + 1), error: null }; } };
    return query;
  } };
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: { supabase: db } };
  t.after(() => { if (previous) require.cache[modulePath] = previous; else delete require.cache[modulePath]; });
  const { computeAndStoreGraphEdges } = require('../.test-build/graph.js');
  const result = await computeAndStoreGraphEdges([{ id: 'new', category: 'Task', content: 'new item', tags: ['shared'] }]);
  assert.deepEqual(result.errors, []); assert.equal(result.edgesCreated, 450); assert.equal(inserted.length, 450);
  assert.deepEqual(pages, [[0, 199], [200, 399], [400, 599]]);
  assert.ok(selections.every((columns) => columns === 'id, tags'));
});
