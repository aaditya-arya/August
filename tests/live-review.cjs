// Real AI verification with synthetic ledger facts; no database or Calendar writes.
const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const { generateSundayReview } = require('../.test-build/gemini.js');
const { reviewPeriod } = require('../.test-build/review.js');
const date = '2026-10-31T10:00:00Z';
const entry = (id, category, content, time) => ({ id, category, content, created_at: time, event_timestamp: time, calendar_action: { is_actionable: false }, tags: [] });
const items = [
  entry('ps6-wish', 'Wishlist', 'I want a PS6', '2026-09-01T10:00:00Z'),
  entry('gta-wish', 'Wishlist', 'I want to play GTA6', '2026-09-02T10:00:00Z'),
  entry('application-plan', 'Task', 'Need to send the internship application', '2026-10-20T10:00:00Z'),
  entry('application-done', 'Milestone_HardWork', 'Finally submitted the internship application after rewriting my resume', '2026-10-30T10:00:00Z'),
  entry('song', 'Media_Log', 'Heard Blinding Lights while cooking dinner', '2026-10-29T10:00:00Z'),
  entry('walk', 'Quiet_Moment', 'A quiet walk with Dad felt peaceful', '2026-10-29T11:00:00Z'),
  entry('loss', 'Hard_Truth', 'Lost the gains I made at the beginning of the month', '2026-10-30T10:00:00Z'),
  entry('ps6-bought', 'Hard_Truth', 'Finally bought the PS6 I wanted', '2026-10-31T08:00:00Z'),
];
(async () => {
  const review = await generateSundayReview(items, reviewPeriod('7', new Date(date)), 'Asia/Kolkata');
  assert.ok(review, 'The review model must return a validated reflection.');
  assert.ok(review.progress.some((point) => point.source_ids.includes('application-done')));
  assert.ok(review.experiences.some((point) => point.source_ids.includes('song') || point.source_ids.includes('walk')));
  assert.ok(review.intentions.some((point) => point.anchor_id === 'ps6-wish' && point.status === 'completed' && point.source_ids.includes('ps6-bought')), 'The old PS6 wish must connect to its later fulfilment.');
  assert.ok(review.intentions.some((point) => point.anchor_id === 'gta-wish' && point.status === 'open'), 'The separate GTA6 wish must not be marked completed when a PS6 was bought.');
  assert.ok(review.intentions.every((point) => point.deadline === null), 'Do not invent year-end deadlines.');
  assert.ok(review.progress.every((point) => point.takeaway && point.takeaway.length > 15), 'Every progress reflection must offer a takeaway beyond an activity label.');
  assert.ok(!/[?$]\s*\d/.test(JSON.stringify(review.intentions)), 'Do not invent prices or savings when none were recorded.');
  assert.ok(!review.progress.some((point) => point.source_ids.length === 1 && point.source_ids[0] === 'gta-wish'));
  console.log(JSON.stringify({ completedEffort: 'passed', experiencesHonoured: 'passed', oldWishConnectedToFulfilment: 'passed', differentWishesKeptSeparate: 'passed', inventedDeadlines: 0 }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
