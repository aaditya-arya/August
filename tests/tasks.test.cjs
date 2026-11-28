const { test } = require('node:test');
const assert = require('node:assert/strict');
const { taskList, toTask, taskUpdate, detectedEvents } = require('../.test-build/tasks.js');
const { parseExtraction, normalizeStoredItem } = require('../.test-build/ledger.js');
const { zonedDateTimeToUtc } = require('../.test-build/time.js');
const { directIntentions } = require('../.test-build/review.js');
const now = '2026-11-26T10:00:00Z';
const entry = (extra = {}) => ({ id: '11111111-1111-4111-8111-111111111111', category: 'Task', content: 'I want to build a website.', tags: ['website'], created_at: now, event_timestamp: now, calendar_action: { is_actionable: false, kind: 'none' }, ...extra });
const metadata = (due_at = null) => ({ version: 1, title: 'Build my website', due_at });

test('undated tasks remain open without turning their creation timestamp into a deadline', () => {
  const task = toTask(entry());
  assert.equal(task.due_at, null);
  assert.equal(task.completed, false);
  assert.equal(toTask(entry({ category: 'Idea' })), null);
  assert.equal(toTask(entry({ category: 'Wishlist', content: 'I want a new keyboard.' })), null);
  assert.equal(toTask(entry({ category: 'Milestone_HardWork', content: 'I finished my website.' })), null);
  assert.equal(toTask(entry({ category: 'Product Work', calendar_action: { is_actionable: true, kind: 'task', start_time: '2026-12-01T10:00:00Z' } })).due_at, '2026-12-01T10:00:00.000Z');
  assert.equal(toTask(entry({ category: 'Wishlist', calendar_action: { is_actionable: true, kind: 'task', start_time: '2026-12-01T10:00:00Z' } })), null, 'stale Calendar flags cannot make a purchase wish a task');
});

test('explicit work intent survives a Wishlist or custom category and source normalization', () => {
  const item = entry({ category: 'Wishlist', calendar_action: { is_actionable: false, task: metadata() } });
  assert.equal(toTask(normalizeStoredItem(item)).title, 'Build my website');
  assert.equal(directIntentions([item])[0].kind, 'task');
});

test('completed state is shared with reviews, preserves scheduling, and is idempotent', () => {
  const original = entry({ calendar_action: { is_actionable: true, kind: 'task', title: 'Ship site', start_time: '2026-12-01T10:00:00Z', memory: { title: 'Original note' } } });
  const calendar = taskUpdate(original, { completed: true }, 'Asia/Kolkata', new Date('2026-11-26T12:00:00Z'));
  assert.equal(calendar.start_time, original.calendar_action.start_time);
  assert.deepEqual(calendar.memory, original.calendar_action.memory);
  const done = { ...original, calendar_action: calendar };
  assert.equal(toTask(done).completed, true);
  assert.equal(directIntentions([done])[0].status, 'completed');
  const repeated = taskUpdate(done, { completed: true }, 'Asia/Kolkata', new Date('2026-11-27T12:00:00Z'));
  assert.equal(repeated.review_state.updated_at, calendar.review_state.updated_at);
  const reopened = taskUpdate(done, { completed: false }, 'Asia/Kolkata');
  assert.equal(toTask({ ...done, calendar_action: reopened }).completed, false);
});

test('a deadline can be removed without resurrecting the earlier Calendar date', () => {
  const item = entry({ calendar_action: { is_actionable: true, kind: 'task', start_time: '2026-12-01T10:00:00Z' } });
  const calendar = taskUpdate(item, { due_at: null }, 'Asia/Kolkata');
  assert.equal(calendar.task.due_at, null);
  assert.equal(calendar.review_state.target_date, null);
  assert.equal(toTask({ ...item, calendar_action: calendar }).due_at, null);
});

test('deadline conversion respects local day, daylight savings, and rejects nonexistent wall times', () => {
  assert.equal(zonedDateTimeToUtc('2026-12-01T09:00', 'Asia/Kolkata'), '2026-12-01T03:30:00.000Z');
  assert.equal(zonedDateTimeToUtc('2026-07-01T09:00', 'America/New_York'), '2026-07-01T13:00:00.000Z');
  assert.throws(() => zonedDateTimeToUtc('2026-03-08T02:30', 'America/New_York'), /does not exist/);
  const saved = taskUpdate(entry(), { due_at: '2026-12-01T20:00:00Z' }, 'Asia/Kolkata');
  assert.equal(saved.review_state.target_date, '2026-12-02');
});

test('task edits reject invalid metadata and keep undated tasks after dated ones', () => {
  assert.throws(() => taskUpdate(entry(), { title: 'My stale edit', expected_updated_at: '2026-11-25T10:00:00Z' }, 'UTC'), /changed elsewhere/);
  assert.throws(() => taskUpdate(entry(), { due_at: 'tomorrow' }, 'UTC'), /valid deadline/);
  assert.throws(() => taskUpdate(entry(), { due_at: '2027-02-30T09:00:00Z' }, 'UTC'), /valid deadline/);
  assert.throws(() => taskUpdate(entry(), { completed: 'true' }, 'UTC'), /complete/);
  assert.throws(() => taskUpdate(entry(), { title: '' }, 'UTC'), /valid deadline/);
  const list = taskList([entry({ id: 'undated' }), entry({ id: 'dated', calendar_action: { is_actionable: false, task: metadata('2026-12-01T10:00:00Z') } })]);
  assert.deepEqual(list.map(item => item.id), ['dated', 'undated']);
});

test('new extraction stores work intent without inventing a Calendar event or deadline', () => {
  const parsed = parseExtraction({ items: [entry({ category: 'Wishlist', task_action: { is_task: true, title: 'Build my website', due_at: null } })] }, now)[0];
  assert.equal(parsed.calendar_action.is_actionable, false);
  assert.deepEqual(parsed.calendar_action.task, metadata());
  assert.equal(toTask({ ...parsed, id: 'new', created_at: now }).due_at, null);
  assert.throws(() => parseExtraction({ items: [entry({ task_action: { is_task: true, title: 'Build site', due_at: 'Friday' } })] }, now), /deadline/);
});

test('a reminder keeps its kind after edits, and an appointment appears only as an event', () => {
  const date = '2026-11-27T03:30:00Z';
  const reminder = entry({ id: 'call', category: 'Reminder', content: 'Remind me to call the bank tomorrow at 9am.',
    task_action: { is_task: true, kind: 'reminder', title: 'Call the bank', due_at: date },
    calendar_action: { is_actionable: true, kind: 'reminder', start_time: date } });
  const event = entry({ id: 'appointment', category: 'Event', content: 'My dentist appointment is Friday at 9am.',
    task_action: { is_task: true, kind: 'task', title: 'Dentist appointment', due_at: date },
    calendar_action: { is_actionable: true, kind: 'event', start_time: date } });
  const [savedReminder, savedEvent] = parseExtraction({ items: [reminder, event] }, now)
    .map((item, index) => ({ ...item, id: index === 0 ? 'call' : 'appointment', created_at: now }));
  assert.equal(taskList([savedReminder, savedEvent]).length, 1);
  assert.equal(toTask(savedReminder).kind, 'reminder');
  assert.equal(taskUpdate(savedReminder, { due_at: null }, 'UTC').task.kind, 'reminder');
  assert.equal(savedEvent.calendar_action.task, undefined);
  const events = detectedEvents([savedReminder, savedEvent, { ...savedEvent, category: 'Wishlist' }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].calendar_synced, false);
  assert.equal(detectedEvents([{ ...savedEvent, calendar_status: 'synced' }])[0].calendar_synced, true);
});
