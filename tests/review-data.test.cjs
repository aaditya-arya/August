const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runWithAccount } = require('../.test-build/account-context.js');
const { readReviewEntries, invalidateReviewData } = require('../.test-build/review-data.js');

test('a read started before task completion cannot repopulate the invalidated review cache', async () => {
  const waiting = [];
  const database = { from: () => ({ select: () => ({ order: () => ({ order: () => ({ range: () => new Promise(resolve => waiting.push(resolve)) }) }) }) }) };
  await runWithAccount({ userId: 'task-review-race', database }, async () => {
    const older = readReviewEntries();
    invalidateReviewData();
    const newer = readReviewEntries();
    const entry = { id: 'task-a', category: 'Task', content: 'Build a website', tags: [], created_at: '2026-11-26T10:00:00Z', event_timestamp: '2026-11-26T10:00:00Z' };
    waiting[0]({ data: [entry], error: null });
    await older;
    const completed = { ...entry, calendar_action: { is_actionable: false, review_state: { version: 1, status: 'completed', title: 'Build a website', next_step: '', target_date: null, target_amount: null, saved_amount: null, currency: 'USD', updated_at: '2026-11-26T11:00:00Z' } } };
    waiting[1]({ data: [completed], error: null });
    await newer;
    const result = await readReviewEntries();
    assert.equal(waiting.length, 2);
    assert.equal(result[0].review_state.status, 'completed');
  });
});
