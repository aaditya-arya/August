const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSundayReview, parseReviewFocus, reviewPeriod, inReviewPeriod, directIntentions, mergeIntentions } = require('../.test-build/review.js');
const { parseIntentionState, moneyProgress, deadlineLabel, yearHorizon, validDay } = require('../.test-build/intention-state.js');
const { normalizeStoredItem, parseExtraction } = require('../.test-build/ledger.js');

const now = new Date('2026-10-31T10:00:00Z');
const period = reviewPeriod('7', now);
const entry = (id, category, content, date = '2026-10-30T10:00:00Z') => ({ id, category, content, tags: [], created_at: date, event_timestamp: date, calendar_action: { is_actionable: false } });
const entries = [
  entry('wish', 'Wishlist', 'I want a PS6', '2026-09-01T10:00:00Z'),
  entry('work', 'Milestone_HardWork', 'Shipped the auth module'),
  entry('song', 'Media_Log', 'Listened to a song while cooking'),
  entry('bought', 'Hard_Truth', 'Finally bought the PS6 I wanted'),
  entry('old-work', 'Milestone_HardWork', 'Finished my resume', '2026-09-02T10:00:00Z'),
  entry('other-wish', 'Wishlist', 'Want to play GTA6'),
  { ...entry('future', 'Task', 'Submit report next month'), event_timestamp: '2026-11-02T10:00:00Z', calendar_action: { is_actionable: true, kind: 'task', start_time: '2026-11-02T10:00:00Z' } },
];
const insight = (ids) => ({ title: 'The effort became a finished thing', meaning: 'You took work through to a shipped result. That is a concrete change, rather than another intention.', takeaway: 'This finished piece of work is evidence of follow-through, even while other ambitions remain open.', source_ids: ids });
const intention = (overrides = {}) => ({ anchor_id: 'wish', title: 'A PS6', kind: 'wish', status: 'open', reflection: 'You wanted this earlier.', gap: 'There is no plan recorded.', next_step: 'Decide whether it matters enough to plan for.', source_ids: ['wish'], deadline: null, ...overrides });
const report = (overrides = {}) => ({ opening: 'A piece of work became real, while some wishes still need a decision.', progress: [insight(['work'])], experiences: [insight(['song'])], lessons: [], patterns: [], intentions: [intention()], next_step: insight(['wish']), question: 'Which wish would you actually like to give a plan?', ...overrides });
const state = (overrides = {}) => ({ version: 1, status: 'active', title: 'A PS6', next_step: 'Set aside the first amount', target_date: null, target_amount: null, saved_amount: null, currency: 'INR', updated_at: now.toISOString(), ...overrides });

test('review connects an old desire to actual later follow-through without dropping older intentions', () => {
  const parsed = parseSundayReview(report({ intentions: [intention({ status: 'completed', source_ids: ['wish', 'bought'] })] }), entries, period, 'Asia/Kolkata');
  assert.equal(parsed.intentions[0].status, 'completed');
  assert.deepEqual(parsed.intentions[0].source_ids, ['wish', 'bought']);
  assert.equal(parsed.progress.length, 1); assert.equal(parsed.experiences.length, 1);
  assert.ok(directIntentions(entries).some((item) => item.anchor_id === 'wish'));
});

test('a future task, a wish, or an old achievement cannot be passed off as this week’s completed progress', () => {
  const parsed = parseSundayReview(report({ progress: [insight(['future']), insight(['other-wish']), insight(['old-work']), insight(['work'])] }), entries, period, 'UTC');
  assert.equal(parsed.progress.length, 1); assert.deepEqual(parsed.progress[0].source_ids, ['work']);
  assert.ok(inReviewPeriod(entries.find((item) => item.id === 'future'), period));
});

test('experiences remain lived experiences and a single entry cannot masquerade as a recurring pattern', () => {
  const parsed = parseSundayReview(report({ experiences: [insight(['other-wish']), insight(['song'])], patterns: [insight(['work']), insight(['work', 'song'])] }), entries, period, 'UTC');
  assert.equal(parsed.experiences.length, 1); assert.equal(parsed.experiences[0].source_ids[0], 'song');
  assert.equal(parsed.patterns.length, 0, 'Several fragments from one day are not a recurring pattern.');
});

test('fabricated sources and duplicate intention anchors are rejected', () => {
  assert.throws(() => parseSundayReview(report({ progress: [insight(['not-a-real-id'])] }), entries, period, 'UTC'));
  assert.throws(() => parseSundayReview(report({ intentions: [intention(), intention()] }), entries, period, 'UTC'));
});

test('a review cannot silently erase real completed work by returning only open wishes', () => {
  assert.throws(() => parseSundayReview(report({ progress: [] }), entries, period, 'UTC'), /omitted the completed work/);
  const allTime = parseSundayReview(report({ progress: [insight(['old-work'])] }), entries, reviewPeriod('all', now), 'UTC');
  assert.deepEqual(allTime.progress[0].source_ids, ['old-work']);
});

test('old imported same-day plans need confirmation and cannot be prescribed as this week’s next action', () => {
  const source = { ...entry('old-plan', 'Task', 'Aaj lab me problem solve karuga', '2026-10-31T08:00:00Z'), event_timestamp: '2026-07-07T04:00:00Z' };
  const parsed = parseSundayReview(report({ progress: [], experiences: [], intentions: [intention({ anchor_id:'old-plan',kind:'task',source_ids:['old-plan'] })], next_step:insight(['old-plan']) }), [source], reviewPeriod('all',now),'Asia/Kolkata');
  assert.equal(parsed.next_step,null);
  const merged = mergeIntentions([source],parsed.intentions,now);
  assert.equal(merged[0].last_movement_at,source.event_timestamp);
  assert.equal(merged[0].needs_confirmation,true);
});

test('recurring patterns require different original days rather than fragments imported together', () => {
  const parsed = parseSundayReview(report({ patterns:[insight(['work','old-work'])] }),entries,reviewPeriod('all',now),'UTC');
  assert.equal(parsed.patterns.length,1);
});

test('the primary reflection must ground both sides in exact quotes; invented connections cannot pass as evidence', () => {
  const value = {before:{source_id:'wish',quote:'I want a PS6'},after:{source_id:'bought',quote:'Finally bought the PS6 I wanted'},focus:insight(['wish','bought']),question:'How does following through feel?'};
  assert.ok(parseReviewFocus(value,entries,period));
  assert.throws(()=>parseReviewFocus({...value,after:{source_id:'bought',quote:'Bought it with my bonus'}},entries,period),/changed its quoted evidence/);
  assert.equal(parseReviewFocus({focus:null},entries,period),null);
});

test('missing evidence is not completion and an unsupported year-end deadline is dropped', () => {
  const parsed = parseSundayReview(report({ intentions: [intention({ status: 'completed', deadline: '2026-12-31' })] }), entries, period, 'UTC');
  assert.equal(parsed.intentions[0].status, 'open'); assert.equal(parsed.intentions[0].deadline, null);
});

test('manual dates are respected, and clearing a date does not resurrect an inferred deadline', () => {
  const tracked = [{ ...entries[0], review_state: state({ target_date: '2026-12-15' }) }, ...entries.slice(1)];
  assert.equal(parseSundayReview(report(), tracked, period, 'UTC').intentions[0].deadline, '2026-12-15');
  const scheduled = [{ ...entries[0], calendar_action: { is_actionable: true, start_time: '2026-12-31T10:00:00Z' }, review_state: state() }, ...entries.slice(1)];
  assert.equal(parseSundayReview(report({ intentions: [intention({ deadline: '2026-12-31' })] }), scheduled, period, 'UTC').intentions[0].deadline, null);
});

test('manual completion is real review activity, even when the original wish is old', () => {
  const tracked = [{ ...entries[0], review_state: state({ status: 'completed' }) }, ...entries.slice(1)];
  const parsed = parseSundayReview(report({ progress: [insight(['wish'])] }), tracked, period, 'UTC');
  assert.equal(parsed.progress.length, 1); assert.equal(parsed.intentions[0].status, 'completed');
  assert.ok(inReviewPeriod(tracked[0], period));
});

test('pausing or releasing an ambition stops it from remaining an open obligation', () => {
  for (const status of ['paused', 'released']) {
    const tracked = [{ ...entries[0], review_state: state({ status }) }, ...entries.slice(1)];
    const inferred = parseSundayReview(report(), tracked, period, 'UTC').intentions;
    assert.equal(mergeIntentions(tracked, inferred).find((item) => item.anchor_id === 'wish').status, status);
  }
  assert.equal(mergeIntentions([], [intention()]).length, 0);
});

test('an AI-linked repeated wish is not re-added as a second unfinished goal', () => {
  const repeated = [...entries, entry('wish-again', 'Wishlist', 'Still want that PS6')];
  const inferred = parseSundayReview(report({ intentions: [intention({ source_ids: ['wish', 'wish-again'] })] }), repeated, period, 'UTC').intentions;
  assert.equal(mergeIntentions(repeated, inferred).filter((item) => ['wish', 'wish-again'].includes(item.anchor_id)).length, 1);
});

test('plan metadata survives normalization without making a Wishlist item a calendar action', () => {
  const goal = state({ target_date: '2026-12-31', target_amount: 60000, saved_amount: 10000 });
  const item = normalizeStoredItem({ ...entries[0], calendar_action: { is_actionable: false, review_state: goal } });
  assert.deepEqual(item.review_state, goal); assert.deepEqual(item.calendar_action.review_state, goal);
  assert.equal(item.calendar_action.is_actionable, false);
  const extracted = parseExtraction({ items: [{ category: 'Wishlist', content: 'Want a PS6', tags: [], event_timestamp: now.toISOString(), calendar_action: { is_actionable: false, review_state: goal } }] }, now.toISOString());
  assert.equal(extracted[0].calendar_action.review_state, undefined, 'AI extraction must not create user-authored plan state.');
});

test('money gaps use user-entered amounts and never turn missing data into zero savings', () => {
  assert.deepEqual(moneyProgress(state({ target_amount: 50000, saved_amount: 10000 })), { remaining: 40000, percent: 20 });
  assert.equal(moneyProgress(state({ target_amount: 50000 })), null);
  assert.equal(moneyProgress(state({ saved_amount: 10000 })), null);
  assert.deepEqual(moneyProgress(state({ target_amount: 50000, saved_amount: 60000 })), { remaining: 0, percent: 100 });
  for (const status of ['completed', 'paused', 'released']) assert.equal(moneyProgress(state({ status, target_amount: 50000, saved_amount: 10000 })), null, 'A closed or paused intention must not keep presenting a funding deficit.');
});

test('dates and countdowns respect local midnight, leap years and year rollover', () => {
  assert.equal(validDay('2026-02-30'), false); assert.equal(validDay('2028-02-29'), true);
  assert.equal(deadlineLabel('2026-11-01', new Date('2026-10-31T20:00:00Z'), 'Asia/Kolkata').days, 0);
  assert.equal(deadlineLabel('2026-11-01', new Date('2026-10-31T20:00:00Z'), 'UTC').days, 1);
  assert.equal(deadlineLabel(null, now, 'UTC').days, null);
  assert.equal(deadlineLabel('2026-10-30', now, 'UTC').overdue, true);
  assert.equal(yearHorizon(new Date('2026-12-31T12:00:00Z'), 'UTC').days_left, 1);
  assert.equal(yearHorizon(new Date('2027-01-01T00:01:00Z'), 'UTC').days_left, 365);
});

test('plan edits reject invalid dates, negative amounts, non-finite values and unknown statuses', () => {
  assert.ok(parseIntentionState(state()));
  for (const invalid of [state({ target_date: '2026-02-30' }), state({ saved_amount: -1 }), state({ saved_amount: Infinity }), state({ target_amount: 0 }), state({ status: 'failed' }), state({ currency: 'money' }), state({ title: '' })]) assert.equal(parseIntentionState(invalid), null);
});
