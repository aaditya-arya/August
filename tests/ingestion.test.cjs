const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createIngestor, noteIdForKey } = require('../.test-build/ingestion-core.js');

const context = { key: 'submission-one', currentTime: '2026-10-31T10:00:00.000Z', timezone: 'Asia/Kolkata', syncCalendar: true };
function fixture(count = 1) {
  const notes = new Map(), updates = [], calls = { extract: 0, embed: 0, calendar: 0, create: 0 };
  const extracted = Array.from({ length: count }, (_, i) => ({ category: 'Task', content: `Task ${i}`, tags: [' Finance ', 'finance'], event_timestamp: '2026-11-01T10:00:00.000Z', calendar_action: { is_actionable: true, title: `Task ${i}`, start_time: '2026-11-01T10:00:00.000Z' } }));
  const deps = {
    findNote: async (id) => notes.get(id) || null,
    createNote: async (note) => { calls.create++; if (notes.has(note.id)) return false; notes.set(note.id, { ...note, items: [] }); return true; },
    insertItems: async (rows) => { const saved = rows.map((row) => ({ ...row, created_at: context.currentTime })); notes.get(rows[0].note_id).items = saved; return saved; },
    deleteNote: async (id) => { notes.delete(id); },
    updateItem: async (id, update) => { updates.push({ id, ...update }); },
    extract: async () => { calls.extract++; return extracted; },
    embed: async () => { calls.embed++; return [1, 0]; },
    connectGraph: async () => {},
    createCalendarEvent: async (_, __, id) => { calls.calendar++; return { success: true, eventId: `event-${id}` }; },
  };
  return { deps, notes, updates, calls };
}

test('provider failure creates no raw notes, items, or calendar events', async () => {
  const { deps, notes, calls } = fixture();
  deps.extract = async () => { throw new Error('503 overloaded'); };
  await assert.rejects(createIngestor(deps)('draft', context), /503/);
  assert.equal(notes.size, 0); assert.equal(calls.create, 0); assert.equal(calls.embed, 0); assert.equal(calls.calendar, 0);
});

test('failed item persistence compensates only the raw note created by this request', async () => {
  const { deps, notes } = fixture();
  notes.set('unrelated', { id: 'unrelated', content: 'keep me', items: [] });
  deps.insertItems = async () => { throw new Error('database unavailable'); };
  await assert.rejects(createIngestor(deps)('draft', context), /database/);
  assert.equal(notes.size, 1); assert.equal(notes.get('unrelated').content, 'keep me');
});

test('retry after a lost response reuses the saved note and does not repeat AI or calendar writes', async () => {
  const { deps, calls, notes } = fixture(); const ingest = createIngestor(deps);
  const first = await ingest('draft', context); const second = await ingest('draft', context);
  assert.equal(second.noteId, first.noteId); assert.equal(second.reused, true); assert.equal(notes.size, 1);
  assert.deepEqual(calls, { extract: 1, embed: 1, calendar: 1, create: 1 });
  await assert.rejects(ingest('different draft', context), /different content/);
});

test('concurrent submissions with the same key cannot duplicate persisted items', async () => {
  const { deps, notes } = fixture(); const ingest = createIngestor(deps);
  const outcomes = await Promise.allSettled([ingest('draft', context), ingest('draft', context)]);
  assert.ok(outcomes.some((result) => result.status === 'fulfilled'));
  assert.equal(notes.size, 1); assert.equal([...notes.values()][0].items.length, 1);
});

test('embeddings use at most three workers, preserve order, and normalize tags', async () => {
  const { deps } = fixture(9); let active = 0, peak = 0;
  deps.embed = async (content) => { active++; peak = Math.max(peak, active); await new Promise((resolve) => setTimeout(resolve, 5)); active--; return [Number(content.split(' ')[1]), 1]; };
  const saved = await createIngestor(deps)('draft', { ...context, syncCalendar: false });
  assert.equal(peak, 3);
  assert.deepEqual(saved.items.map((item) => item.embedding[0]), Array.from({ length: 9 }, (_, i) => i));
  assert.deepEqual(saved.items[0].tags, ['finance']);
  assert.ok(saved.items.every((item) => item.calendar_status === 'none'));
});

test('calendar success stores the event ID; failure and exceptions become failed, never pending', async () => {
  const { deps, updates } = fixture(3);
  let call = 0;
  deps.createCalendarEvent = async () => { call++; if (call === 1) return { success: true, eventId: 'google-123' }; if (call === 2) return { success: false, error: 'denied' }; throw new Error('timeout'); };
  const saved = await createIngestor(deps)('draft', context);
  assert.deepEqual(saved.items.map((item) => item.calendar_status), ['synced', 'failed', 'failed']);
  assert.equal(saved.items[0].google_event_id, 'google-123');
  assert.equal(updates.length, 3); assert.equal(saved.calendarEventsSynced.length, 1);
});

test('submission keys are stable and namespaces isolate imports from composer submissions', () => {
  assert.equal(noteIdForKey('keep', 'a'), noteIdForKey('keep', 'a'));
  assert.notEqual(noteIdForKey('keep', 'a'), noteIdForKey('ledger', 'a'));
  assert.match(noteIdForKey('keep', 'a'), /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-8[a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('submission retries recover pending calendar status without re-extracting or duplicating notes', async () => {
  const { deps, notes, calls } = fixture();
  const id = noteIdForKey('ledger', context.key);
  notes.set(id, { id, content: 'draft', items: [{ id: 'already-saved', note_id: id, category: 'Reminder', content: 'Call Mom', event_timestamp: context.currentTime, created_at: context.currentTime, calendar_status: 'pending', calendar_action: { is_actionable: true, title: 'Call Mom', start_time: '2026-11-01T10:00:00Z' } }] });
  let attempts = 0;
  const update = deps.updateItem;
  deps.updateItem = async (...args) => { attempts++; if (attempts === 1) throw new Error('transient database failure'); return update(...args); };
  const result = await createIngestor(deps)('draft', context);
  assert.equal(result.reused, true); assert.equal(result.items[0].calendar_status, 'synced');
  assert.equal(result.items[0].google_event_id, 'event-already-saved');
  assert.equal(attempts, 2); assert.equal(calls.extract, 0); assert.equal(calls.create, 0);
});
