// Optional integration check against the configured Gemini account; no database/calendar writes.
const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const { extractItems } = require('../.test-build/gemini.js');

const fixtures = [
  ['Remind me to pay rent tomorrow at 10am.', 'Reminder'],
  ['Dentist appointment tomorrow at 11am.', 'Event'],
  ['Need to renew my gym membership before Friday.', 'Task'],
  ['Need to clean the kitchen.', 'Task'],
  ['Paid wifi bill 800.', 'Hard_Truth'],
  ['Pay the wifi bill tomorrow.', 'Task'],
  ['Hit my savings goal after six months of hard work.', 'Milestone_HardWork'],
  ['Wish I had a Keychron keyboard when the sale starts.', 'Idea_Desire'],
  ['Want to watch Batman someday.', 'Idea_Desire'],
  ['Listened to the song Lost on the radio.', 'Media_Log'],
  ['Launched my music app after a year of development.', 'Milestone_HardWork'],
  ['Learned that rest matters more than constant productivity.', 'Perspective_Lesson'],
  ['Felt at peace on a quiet walk with Dad.', 'Quiet_Moment'],
  ['Quote: "Not all those who wander are lost."', 'Shaairi_Quote'],
  ['Washed the dishes after lunch.', 'Daily_Log'],
  ['Attended the conference yesterday.', 'Event'],
  ['The dentist appointment was cancelled; I will stay home.', 'Daily_Log'],
  ['Need to write the feature list tonight.', 'Task'],
  ['Need to call the bank about my debit card tomorrow.', 'Reminder'],
  ['Should add Mirzapur to my watchlist since Arjun recommended it.', 'Idea_Desire'],
  ['Finished reading Deep Work.', 'Media_Log'],
];

(async () => {
  const items = await extractItems(fixtures.map(([text], i) => `${i + 1}. ${text}`).join('\n'), {
    currentTime: '2026-10-31T10:00:00.000Z', timezone: 'Asia/Kolkata',
  });
  assert.equal(items.length, fixtures.length, 'Each independent fixture must remain an atomic item.');
  for (const [index, item] of items.entries()) {
    assert.equal(item.category, fixtures[index][1], `Wrong category for: ${fixtures[index][0]} (AI returned: ${item.content})`);
  }
  assert.equal(items[0].calendar_action.is_actionable, true);
  assert.equal(items[0].calendar_action.start_time, '2026-11-01T04:30:00.000Z');
  assert.equal(items[3].calendar_action.is_actionable, false);
  assert.equal(items[15].calendar_action.is_actionable, false);
  assert.equal(items[16].calendar_action.is_actionable, false);
  const mixed = await extractItems('Paid rent 1200 and remind me to call Mom tomorrow at 6pm.', {
    currentTime: '2026-10-31T10:00:00.000Z', timezone: 'Asia/Kolkata',
  });
  assert.deepEqual(mixed.map((item) => item.category).sort(), ['Hard_Truth', 'Reminder']);
  console.log(`Live extraction passed: ${fixtures.length} category fixtures, timezone calculation, and mixed-intent splitting.`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
