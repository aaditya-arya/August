const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runWithAccount } = require('../.test-build/account-context.js');
const { readServerStatus } = require('../.test-build/server-status.js');

test('service checks use account storage and separate missing AI configuration from readable journal data', async t => {
  const previous = process.env.GEMINI_API_KEY;
  t.after(() => { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; });
  delete process.env.GEMINI_API_KEY;
  let version = 0, failingTable = null;
  const reads = [];
  const database = {
    rpc: async name => { assert.equal(name, 'account_security_version'); return { data: version, error: null }; },
    from: table => ({ select: (columns, options) => {
      assert.equal(columns, 'id'); assert.equal(options.head, true);
      return { limit: async size => { assert.equal(size, 1); reads.push(table); return { error: table === failingTable ? { message: 'internal database detail' } : null }; } };
    } }),
  };
  const check = () => runWithAccount({ userId: 'account-a', database }, readServerStatus);
  let status = await check();
  assert.equal(status.journal.ready, false);
  assert.match(status.journal.message, /migration/);
  assert.deepEqual(reads, []);
  version = 1;
  status = await check();
  assert.equal(status.journal.ready, true);
  assert.equal(status.graph.ready, true);
  assert.equal(status.review.ready, false);
  assert.match(status.review.message, /GEMINI_API_KEY/);
  process.env.GEMINI_API_KEY = 'test-only-never-return-this';
  status = await check();
  assert.equal(status.review.ready, true);
  assert.ok(!JSON.stringify(status).includes(process.env.GEMINI_API_KEY));
  failingTable = 'graph_edges';
  status = await check();
  assert.equal(status.journal.ready, true);
  assert.equal(status.graph.ready, false);
  assert.ok(!JSON.stringify(status).includes('internal database detail'));
});

test('a populated review reports missing AI configuration while an empty journal needs no AI key', async t => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const data = require('../.test-build/review-data.js');
  const original = data.readReviewEntries;
  let entries = [{ id: 'entry-a', content: 'A real moment', category: 'Daily_Log', tags: [], event_timestamp: new Date().toISOString(), created_at: new Date().toISOString() }];
  data.readReviewEntries = async () => entries;
  t.after(() => {
    data.readReviewEntries = original;
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
  });
  const { buildReviewSummary, buildSundayReview } = require('../.test-build/review-service.js');
  const review = () => runWithAccount({ userId: 'review-account', database: {} }, () => buildSundayReview('all', 'UTC'));
  const summary = await buildReviewSummary('7');
  assert.equal(summary.status, 'summary');
  assert.equal(summary.selected_count, 1);
  assert.equal(summary.review, null);
  assert.equal(summary.entries[0].id, 'entry-a');
  const unavailable = await review();
  assert.equal(unavailable.status, 'unavailable');
  assert.match(unavailable.message, /GEMINI_API_KEY.*Production/);
  assert.equal(unavailable.entries[0].id, 'entry-a');
  entries = [];
  const empty = await review();
  assert.equal(empty.selected_count, 0);
  assert.equal(empty.status, 'unavailable');
});
