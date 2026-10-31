const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractItems } = require('../.test-build/gemini.js');

test('transient overload retries primary before moving to a different supported fallback', async (t) => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only-key';
  t.after(() => { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; });
  const models = [];
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async (url) => {
    const model = String(url).match(/models\/([^:]+):/)?.[1];
    models.push(model);
    if (model === (process.env.GEMINI_MODEL || 'gemini-flash-latest')) return Response.json({ error: { code: 503, status: 'UNAVAILABLE', message: 'temporarily overloaded' } }, { status: 503 });
    const output = { items: [{ category: 'Task', content: 'Clean the kitchen', tags: [], event_timestamp: '2026-10-31T10:00:00Z', calendar_action: { is_actionable: false } }] };
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(output) }] }, finishReason: 'STOP' }] });
  });
  const items = await extractItems('Clean the kitchen', { currentTime: '2026-10-31T10:00:00Z', timezone: 'Asia/Kolkata' });
  assert.equal(items[0].category, 'Task');
  assert.equal(models.filter((model) => model === (process.env.GEMINI_MODEL || 'gemini-flash-latest')).length, 3);
  assert.equal(models.at(-1), process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite');
});
