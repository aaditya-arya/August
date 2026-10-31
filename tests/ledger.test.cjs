const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CATEGORIES, getClassification, normalizeStoredItem, parseExtraction, groupByTexture } = require('../.test-build/ledger.js');

const now = '2026-10-31T10:00:00.000Z';
const future = '2026-11-01T10:00:00.000Z';
const base = { category: 'Task', content: 'Pay rent tomorrow', tags: [], event_timestamp: future, calendar_action: { is_actionable: false } };
const parse = (item) => parseExtraction({ items: [item] }, now)[0];

test('incidental words, tags, stale texture and calendar flags cannot override a category', () => {
  for (const item of [
    { category: 'Milestone_HardWork', content: 'Hit my savings goal', tags: ['finance', 'trading'], life_texture: 'hard_truth', calendar_action: { is_actionable: true } },
    { category: 'Perspective_Lesson', content: 'An appointment taught me patience', tags: ['bills'] },
    { category: 'Media_Log', content: 'Listened to Lost', tags: ['loss'] },
    { category: 'Shaairi_Quote', content: 'I lost myself in the event of life', tags: ['finance'] },
    { category: 'Idea_Desire', content: 'Want to watch a movie', tags: ['watchlist', 'movies'] },
  ]) {
    assert.equal(getClassification(item).category, item.category);
    assert.equal(normalizeStoredItem(item).calendar_action?.is_actionable, false);
  }
});

test('old category names still appear in the current clusters and review', () => {
  for (const [old, current] of Object.entries({ Wishlist: 'Wishlist', Idea: 'Idea', Media: 'Media_Log', Learning: 'Perspective_Lesson', Done: 'Daily_Log' })) {
    assert.equal(getClassification({ category: old }).category, current);
  }
  for (const category of ['constructor', '__proto__', 'toString', '']) {
    assert.equal(getClassification({ category }).texture, 'unclassified');
  }
});

test('every category, including events, reminders, poems and unknown legacy items, has exactly one review group', () => {
  const items = [...CATEGORIES, 'unexpected'].map((category, id) => ({ category, id }));
  const groups = groupByTexture(items);
  const flattened = Object.values(groups).flat();
  assert.equal(flattened.length, items.length);
  assert.equal(new Set(flattened.map((i) => i.id)).size, items.length);
  assert.deepEqual(groups.actionable_obligation.map((i) => i.category), ['Task', 'Reminder', 'Event']);
  assert.equal(groups.shaairi_quote[0].category, 'Shaairi_Quote');
});

test('undated tasks and reminders retain their intent without a fabricated calendar event', () => {
  for (const category of ['Task', 'Reminder', 'Event']) {
    const item = parse({ ...base, category, event_timestamp: now });
    assert.equal(item.category, category);
    assert.equal(item.life_texture, 'actionable_obligation');
    assert.equal(item.calendar_action.is_actionable, false);
  }
});

test('future calendar events require an obligation category and a valid future start', () => {
  const action = { is_actionable: true, start_time: future };
  for (const category of CATEGORIES.filter((category) => category !== 'Idea_Desire')) {
    const item = parse({ ...base, category, calendar_action: action, life_texture: 'hard_truth' });
    const expected = ['Task', 'Reminder', 'Event'].includes(category);
    assert.equal(item.calendar_action.is_actionable, expected);
    assert.equal(item.is_future_actionable, expected);
    if (expected) assert.equal(item.calendar_action.end_time, '2026-11-01T10:30:00.000Z');
  }
  for (const start_time of [now, '2026-10-30T10:00:00Z', 'bad-date', '2026-11-01T10:00:00', undefined]) {
    assert.equal(parse({ ...base, calendar_action: { is_actionable: true, start_time } }).calendar_action.is_actionable, false);
  }
});

test('timestamps preserve offsets, normalize invalid event dates, and repair reversed end times', () => {
  const item = parse({ ...base, calendar_action: { is_actionable: true, start_time: '2026-11-01T15:30:00+05:30', end_time: now } });
  assert.equal(item.event_timestamp, future);
  assert.equal(item.calendar_action.end_time, '2026-11-01T10:30:00.000Z');
  assert.equal(parse({ ...base, event_timestamp: 'bad-date' }).event_timestamp, now);
});

test('malformed or empty model output fails visibly instead of becoming a successful empty note', () => {
  for (const response of [null, {}, { items: [] }, { items: [null] }, { items: [{ ...base, category: 'Made_Up' }] }, { items: [{ ...base, content: '' }] }, { items: [{ ...base, tags: [42] }] }]) {
    assert.throws(() => parseExtraction(response, now));
  }
});

test('mixed-intent extraction keeps independent entries and derives textures consistently', () => {
  const items = parseExtraction({ items: [
    { ...base, category: 'Hard_Truth', content: 'Paid rent', event_timestamp: now },
    { ...base, category: 'Reminder', content: 'Call Mom tomorrow', calendar_action: { is_actionable: true, start_time: future } },
  ] }, now);
  assert.equal(items.length, 2);
  assert.equal(items[0].life_texture, 'hard_truth');
  assert.equal(items[1].life_texture, 'actionable_obligation');
});
