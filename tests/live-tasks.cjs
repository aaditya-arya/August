// Real Gemini task-intent verification using synthetic notes; no storage writes.
const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const { extractItems } = require('../.test-build/gemini.js');
const { toTask } = require('../.test-build/tasks.js');
const currentTime = '2026-11-26T10:00:00.000Z';
const examples = [
  'I want to create a portfolio website.',
  'I am working on a new product that helps neighbours share tools.',
  'Need to finish the dashboard by December 1, 2026 at 6pm.',
  'What if an app could turn recipes into a shopping list? Just an idea.',
  'I want to buy a new keyboard someday.',
  'The dentist appointment was cancelled; I will stay home.',
  'I finished building the landing page yesterday.',
];
(async () => {
  const started = Date.now();
  const items = await extractItems(examples.map((text, index) => `${index + 1}. ${text}`).join('\n'), { currentTime, timezone: 'Asia/Kolkata' });
  const find = anchor => { const item = items.find(item => item.content.includes(anchor)); assert.ok(item, `Missing source: ${anchor}`); return toTask({ ...item, id: anchor, created_at: currentTime }, 'Asia/Kolkata'); };
  assert.equal(find('portfolio website').due_at, null);
  assert.equal(find('neighbours').due_at, null);
  assert.equal(find('dashboard').due_at, '2026-12-01T12:30:00.000Z');
  assert.equal(find('recipes'), null);
  assert.equal(find('keyboard'), null);
  assert.equal(find('dentist'), null);
  assert.equal(find('landing page'), null);
  console.log(JSON.stringify({ liveTaskIntent: 'passed', undatedWork: 2, datedWork: 1, nonTasksExcluded: 4, seconds: +((Date.now() - started) / 1000).toFixed(1) }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
