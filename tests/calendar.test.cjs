const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sealSession, openSession, matchesOAuthState } = require('../.test-build/calendar-session.js');
const { shouldOfferCalendarAdd } = require('../.test-build/calendar.js');

test('calendar sessions are encrypted, authenticated, and rejected after tampering or key changes', () => {
  const tokens = { refresh_token: 'private-token', expires_at: 123 };
  const sealed = sealSession(tokens, 'test-secret');
  assert.ok(!sealed.includes('private-token'));
  assert.deepEqual(openSession(sealed, 'test-secret'), tokens);
  assert.equal(openSession(sealed, 'other-secret'), null);
  const bytes = Buffer.from(sealed, 'base64url'); bytes[15] ^= 1;
  assert.equal(openSession(bytes.toString('base64url'), 'test-secret'), null);
  assert.equal(openSession('malformed', 'test-secret'), null);
});

test('OAuth callbacks require an exact, nonempty state match', () => {
  assert.equal(matchesOAuthState('nonce', 'nonce'), true);
  for (const [received, expected] of [[null, 'nonce'], ['nonce', undefined], ['wrong', 'nonce'], ['', ''], ['longer-nonce', 'nonce']]) assert.equal(matchesOAuthState(received, expected), false);
});

test('manual calendar controls are available for failures but not synced or pending events', () => {
  const item = { calendar_action: { is_actionable: true, title: 'Call Mom', start_time: '2026-11-01T10:00:00Z' } };
  assert.equal(shouldOfferCalendarAdd({ ...item, calendar_status: 'failed' }), true);
  assert.equal(shouldOfferCalendarAdd({ ...item, calendar_status: 'none' }), true);
  for (const status of ['synced', 'pending']) assert.equal(shouldOfferCalendarAdd({ ...item, calendar_status: status }), false);
  assert.equal(shouldOfferCalendarAdd({ ...item, google_event_id: 'already-created' }), false);
});

test('cookie token storage and deterministic Calendar IDs work without filesystem writes', async (t) => {
  const modulePath = require.resolve('next/headers');
  const previous = require.cache[modulePath];
  const jar = new Map();
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: { cookies: async () => ({ get: (name) => jar.has(name) ? { value: jar.get(name).value } : undefined, set: (name, value, options) => jar.set(name, { value, options }), delete: (name) => jar.delete(name) }) } };
  const oldSecret = process.env.CALENDAR_TOKEN_SECRET;
  process.env.CALENDAR_TOKEN_SECRET = 'test-cookie-secret';
  t.after(() => { if (previous) require.cache[modulePath] = previous; else delete require.cache[modulePath]; if (oldSecret === undefined) delete process.env.CALENDAR_TOKEN_SECRET; else process.env.CALENDAR_TOKEN_SECRET = oldSecret; });
  const calendar = require('../.test-build/calendar-server.js');
  await calendar.saveStoredTokens({ refresh_token: 'refresh', access_token: 'access', expires_at: Date.now() + 3600000 });
  assert.equal((await calendar.getStoredTokens()).refresh_token, 'refresh');
  assert.equal(jar.get('august_calendar').options.httpOnly, true);
  assert.equal(jar.get('august_calendar').options.sameSite, 'lax');
  const payloads = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'POST') { payloads.push(JSON.parse(options.body)); return Response.json({ error: {} }, { status: 409 }); }
    return Response.json({ id: url.split('/').at(-1), htmlLink: 'https://calendar.google.com/test' });
  });
  const action = { is_actionable: true, title: 'Meeting', start_time: '2030-01-01T10:00:00Z' };
  const first = await calendar.autoCreateGoogleCalendarEvent(action, 'note', 'item-123');
  const retry = await calendar.autoCreateGoogleCalendarEvent(action, 'note', 'item-123');
  assert.equal(first.success, true); assert.equal(first.eventId, retry.eventId);
  assert.match(payloads[0].id, /^[a-f0-9]{64}$/); assert.equal(payloads[0].id, payloads[1].id);
  await calendar.clearStoredTokens();
  assert.equal(await calendar.isCalendarConnected(), false);
});
