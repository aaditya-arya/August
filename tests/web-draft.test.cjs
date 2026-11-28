const assert = require('node:assert/strict');
const test = require('node:test');
const { runWithAccount } = require('../.test-build/account-context.js');
const { DraftConflict, readWebDraft, saveWebDraft, organizeWebDraft } = require('../.test-build/web-draft.js');
const ingestion = require('../.test-build/ingestion.js');

function storage() {
  const rows = new Map();
  return {
    as(userId, work) {
      const matches = id => rows.get(id)?.user === userId;
      const database = {
        from(table) {
          assert.equal(table, 'notes');
          return {
            select: () => ({ eq: (_field, id) => ({
              maybeSingle: async () => ({ data: matches(id) ? rows.get(id) : null }),
            }) }),
            insert: async row => {
              if (rows.has(row.id)) return { error: { code: '23505' } };
              rows.set(row.id, { ...row, user: userId });
              return {};
            },
            update: fields => ({ eq: (_field, id) => ({ eq: (_tokenField, modified) => ({
              select: () => ({ maybeSingle: async () => {
                if (!matches(id) || rows.get(id).created_at !== modified) return { data: null };
                rows.set(id, { ...rows.get(id), ...fields });
                return { data: { id } };
              } }),
            }) }) }),
          };
        },
      };
      return runWithAccount({ userId, database }, work);
    },
  };
}

test('Web draft autosaves raw text, isolates accounts, and rejects stale edits', async () => {
  const db = storage();
  const alice = work => db.as('alice', work);
  const first = await alice(() => saveWebDraft({ content: 'First line', expected: null }));
  assert.equal(first.status, 'editing');
  assert.equal(await db.as('bob', readWebDraft), null);
  await db.as('bob', () => saveWebDraft({ content: 'Independent draft', expected: null }));
  const drafts = await alice(() => Promise.allSettled([
    saveWebDraft({ content: 'One tab', expected: first.revision }),
    saveWebDraft({ content: 'Another tab', expected: first.revision }),
  ]));
  const [winner] = drafts.filter(result => result.status === 'fulfilled');
  const [loser] = drafts.filter(result => result.status === 'rejected');
  assert.ok(loser.reason instanceof DraftConflict);
  assert.equal((await alice(readWebDraft)).draft.content, winner.value.content);
  assert.equal(winner.value.currentTime, first.currentTime);
  assert.equal((await db.as('bob', readWebDraft)).draft.content, 'Independent draft');
});

test('Organizing locks the revision, preserves text after failure, and reuses filed results', async t => {
  const db = storage();
  const asUser = work => db.as('writer', work);
  const content = 'A whole entry.';
  let start, fail;
  const started = new Promise(resolve => { start = resolve; });
  const firstAttempt = new Promise((_resolve, reject) => { fail = reject; });
  const calls = [];
  t.mock.method(ingestion, 'ingestNote', (text, options) => {
    assert.equal(text, content);
    calls.push(options);
    if (calls.length === 1) {
      start();
      return firstAttempt;
    }
    return Promise.resolve({ noteId: 'saved-note', extractedCount: 1, items: [] });
  });
  const saved = await asUser(() => saveWebDraft({ content, expected: null, timezone: 'Asia/Kolkata' }));
  const filing = asUser(() => organizeWebDraft(saved.revision));
  await started;
  assert.equal((await asUser(() => organizeWebDraft(saved.revision))).status, 'organizing');
  await assert.rejects(asUser(() => saveWebDraft({ content: 'New words', expected: saved.revision })), DraftConflict);
  const failed = assert.rejects(filing, /Gemini unavailable/);
  fail(new Error('Gemini unavailable'));
  await failed;
  assert.equal((await asUser(readWebDraft)).draft.content, content);
  assert.equal((await asUser(readWebDraft)).draft.status, 'editing');
  const filed = await asUser(() => organizeWebDraft(saved.revision));
  assert.equal(filed.status, 'filed');
  assert.equal(filed.receipt.noteId, 'saved-note');
  assert.deepEqual(await asUser(() => organizeWebDraft(saved.revision)), JSON.parse(JSON.stringify(filed)));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].key, calls[1].key);
  assert.equal(calls[0].timezone, 'Asia/Kolkata');
  const next = await asUser(() => saveWebDraft({ content: '', expected: filed.revision, reset: true }));
  assert.equal(next.content, '');
  assert.equal(next.status, 'editing');
  assert.notEqual(next.revision, filed.revision);
});
