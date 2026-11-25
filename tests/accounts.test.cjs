const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runWithAccount, currentAccount, accountResource } = require('../.test-build/account-context.js');
const { supabase } = require('../.test-build/supabase.js');
const { createAugustApi } = require('../.test-build/shared/api.js');
const { createChunkedSecureStorage } = require('../.test-build/shared/secure-storage.js');

test('overlapping requests retain their verified database and separate account caches', async () => {
  assert.throws(() => supabase.from('notes'), /authenticated account/);
  const a = { userId: 'isolation-a', database: { from: table => `a:${table}` } };
  const b = { userId: 'isolation-b', database: { from: table => `b:${table}` } };
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const first = runWithAccount(a, async () => {
    accountResource('cache', () => ({ value: 'private-a' }));
    await barrier;
    assert.equal(currentAccount().userId, a.userId);
    assert.equal(supabase.from('notes'), 'a:notes');
    assert.equal(accountResource('cache', () => null).value, 'private-a');
  });
  await runWithAccount(b, async () => {
    await Promise.resolve();
    assert.equal(supabase.from('notes'), 'b:notes');
    assert.equal(accountResource('cache', () => ({ value: 'private-b' })).value, 'private-b');
    release();
  });
  await first;
  assert.throws(currentAccount, /authenticated account/);
});

test('native requests use the current token, preserve retry headers, and stop after sign-out', async () => {
  let token = 'first-session';
  const calls = [];
  const api = createAugustApi('https://august.example', async (url, options) => {
    calls.push({ url, headers: options.headers });
    return Response.json({ success: true });
  }, { accessToken: async () => token });
  await api.saveNote({ content: 'My private words', key: 'retry-key', currentTime: '2026-11-13T00:00:00Z', timezone: 'Asia/Kolkata' });
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer first-session');
  assert.equal(calls[0].headers.get('Idempotency-Key'), 'retry-key');
  token = 'renewed-session';
  await api.items();
  assert.equal(calls[1].headers.get('Authorization'), 'Bearer renewed-session');
  token = null;
  await assert.rejects(api.items(), /Sign in/);
  assert.equal(calls.length, 2);
});

function memoryStore() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
}

test('encrypted storage adapter chunks large Unicode sessions and serializes replacements', async () => {
  const backing = memoryStore(); let id = 0;
  const storage = createChunkedSecureStorage(backing, () => `version-${++id}`);
  const content = '🌻 नमस्ते journal '.repeat(500);
  await storage.setItem('session', content);
  assert.equal(await storage.getItem('session'), content);
  for (const [key, value] of backing.values) if (!key.endsWith('.index')) assert.ok(Buffer.byteLength(value) <= 1200);
  await Promise.all([storage.setItem('session', 'first edit'), storage.setItem('session', 'latest edit')]);
  assert.equal(await storage.getItem('session'), 'latest edit');
  assert.equal(backing.values.size, 2);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
  assert.equal(backing.values.size, 0);
});

test('an interrupted chunk write preserves the previous session without orphaning late writes', async () => {
  const backing = memoryStore(); let id = 0;
  const storage = createChunkedSecureStorage({ ...backing, setItem: async (key, value) => {
    if (key.includes('version-2.0')) throw new Error('disk unavailable');
    if (key.includes('version-2.1')) await new Promise(resolve => setTimeout(resolve, 10));
    await backing.setItem(key, value);
  } }, () => `version-${++id}`);
  await storage.setItem('session', 'previous session');
  await assert.rejects(storage.setItem('session', 'a'.repeat(3000)), /disk unavailable/);
  assert.equal(await storage.getItem('session'), 'previous session');
  assert.equal(backing.values.size, 2);
  await storage.setItem('session', 'recovered');
  assert.equal(await storage.getItem('session'), 'recovered');
});

test('missing encrypted chunks fail closed instead of returning a partial token or draft', async () => {
  const backing = memoryStore();
  const storage = createChunkedSecureStorage(backing, () => 'one');
  await storage.setItem('draft', 'a'.repeat(1500));
  backing.values.delete('draft.one.1');
  await assert.rejects(storage.getItem('draft'), /incomplete/);
});
