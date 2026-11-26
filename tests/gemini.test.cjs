const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractItems, candidateModels, reviewModels } = require('../.test-build/gemini.js');

function configure(t) {
  for (const name of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL', 'GEMINI_REVIEW_MODEL']) {
    const previous = process.env[name];
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
    delete process.env[name];
  }
  process.env.GEMINI_API_KEY = 'test-only-key';
  t.mock.method(console, 'warn', () => {});
}
const valid = () => Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify({ items: [
  { category: 'Task', title: 'Clean the kitchen', source_spans: [{ block_id: 'b1', start_quote: null, end_quote: null }], tags: [], event_timestamp: '2026-10-31T10:00:00Z', calendar_action: { is_actionable: false } },
] }) }] }, finishReason: 'STOP' }] });
const context = { currentTime: '2026-10-31T10:00:00Z', timezone: 'Asia/Kolkata' };

test('extraction prefers distinct Lite models and supports independent review overrides', t => {
  configure(t);
  assert.deepEqual(candidateModels(), ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash']);
  assert.equal(reviewModels()[0], 'gemini-3.5-flash-lite');
  process.env.GEMINI_MODEL = 'gemini-3.8-flash';
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite';
  process.env.GEMINI_REVIEW_MODEL = 'gemini-3.6-flash';
  assert.equal(candidateModels()[0], 'gemini-3.8-flash');
  assert.equal(candidateModels()[1], 'gemini-3.5-flash-lite');
  assert.equal(reviewModels()[0], 'gemini-3.6-flash');
  assert.equal(new Set(candidateModels()).size, candidateModels().length);
});

for (const status of [429, 503, 504]) test(`${status} moves immediately to a distinct fallback without SDK retries`, async t => {
  configure(t);
  const models = [];
  t.mock.method(globalThis, 'fetch', async url => {
    const model = String(url).match(/models\/([^:]+):/)?.[1]; models.push(model);
    return models.length === 1 ? Response.json({ error: { code: status, message: 'provider failure' } }, { status }) : valid();
  });
  const items = await extractItems('Clean the kitchen', context);
  assert.equal(items[0].category, 'Task');
  assert.deepEqual(models, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
});

test('fallback Flash requests bound thinking while Lite requests omit unsupported settings', async t => {
  configure(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return requests.length < 3 ? Response.json({ error: { code: 503, message: 'overloaded' } }, { status: 503 }) : valid();
  });
  await extractItems('Clean the kitchen', context);
  assert.equal(requests[0].generationConfig.thinkingConfig, undefined);
  assert.equal(requests[2].generationConfig.thinkingConfig.thinkingLevel, 'LOW');
});

test('exhausting the shared time budget stops the fallback chain with a retryable error', async t => {
  configure(t);
  let clock = 1_000, calls = 0;
  t.mock.method(Date, 'now', () => clock);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++; clock += 181_000;
    return Response.json({ error: { code: 503, message: 'overloaded' } }, { status: 503 });
  });
  await assert.rejects(extractItems('Clean the kitchen', context), /took too long.*no new note was saved/);
  assert.equal(calls, 1);
});
