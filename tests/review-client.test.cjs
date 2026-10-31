const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createReviewLoader } = require('../.test-build/review-client.js');
const report = (days, extra = {}) => ({ status: 'ready', context_count: 3, period: { days }, ...extra });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('switching review periods reuses prepared views; an explicit refresh only refreshes its own period', async () => {
  const calls = [];
  const loader = createReviewLoader(async (days, zone, refresh) => { calls.push({ days, refresh }); return report(days); });
  const week = await loader.load('7', 'Asia/Kolkata');
  const month = await loader.load('30', 'Asia/Kolkata');
  await loader.load('all', 'Asia/Kolkata');
  assert.equal(await loader.load('7', 'Asia/Kolkata'), week);
  assert.equal(loader.peek('30', 'Asia/Kolkata'), month);
  await loader.load('7', 'Asia/Kolkata', true);
  assert.equal(await loader.load('30', 'Asia/Kolkata'), month);
  assert.deepEqual(calls, [{ days: '7', refresh: false }, { days: '30', refresh: false }, { days: 'all', refresh: false }, { days: '7', refresh: true }]);
});

test('rapid switching and background warming share an in-flight request instead of cancelling it', async () => {
  const work = deferred(); let calls = 0;
  const loader = createReviewLoader(() => { calls++; return work.promise; });
  const initial = loader.load('7', 'UTC');
  assert.equal(loader.load('7', 'UTC'), initial);
  assert.equal(loader.load('7', 'UTC', true), initial);
  work.resolve(report('7'));
  await initial;
  assert.equal(calls, 1);
  assert.equal(loader.peek('7', 'UTC').period.days, '7');
});

test('saving or deleting entries invalidates all periods and late old work cannot repopulate them', async () => {
  const old = deferred(), current = deferred(); let calls = 0;
  const loader = createReviewLoader(() => (++calls === 1 ? old.promise : current.promise));
  const stale = loader.load('7', 'UTC');
  loader.invalidate();
  const fresh = loader.load('7', 'UTC');
  old.resolve(report('7', { marker: 'stale' })); await stale;
  assert.equal(loader.peek('7', 'UTC'), null);
  assert.equal(loader.load('7', 'UTC'), fresh);
  current.resolve(report('7', { marker: 'current' })); await fresh;
  assert.equal(loader.peek('7', 'UTC').marker, 'current');
});

test('cached reviews expire and never cross timezone or local-date boundaries', async () => {
  let clock = Date.parse('2026-10-31T18:28:00Z'), calls = 0;
  const loader = createReviewLoader(async days => { calls++; return report(days); }, () => clock);
  await loader.load('7', 'Asia/Kolkata');
  assert.equal(loader.peek('7', 'UTC'), null);
  clock += 3 * 60000; // Midnight in India, still the same UTC date.
  assert.equal(loader.peek('7', 'Asia/Kolkata'), null);
  await loader.load('7', 'Asia/Kolkata');
  clock += 300001;
  assert.equal(loader.peek('7', 'Asia/Kolkata'), null);
  await loader.load('7', 'Asia/Kolkata');
  assert.equal(calls, 3);
});

test('provider failures remain retryable; successful empty ledgers are cached', async () => {
  let calls = 0;
  const loader = createReviewLoader(async days => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return report(days, { status: 'unavailable', context_count: calls < 4 ? 3 : 0 });
  });
  await assert.rejects(loader.load('all', 'UTC'), /offline/);
  await loader.load('all', 'UTC'); await loader.load('all', 'UTC');
  assert.equal(loader.peek('all', 'UTC'), null);
  await loader.load('all', 'UTC'); await loader.load('all', 'UTC');
  assert.equal(calls, 4);
});
