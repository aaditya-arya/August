const { test } = require('node:test');
const assert = require('node:assert/strict');

test('missing preview auth variables leave sign-in unavailable without constructing an invalid Supabase client', t => {
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    const previous = process.env[name];
    delete process.env[name];
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  const modulePath = require.resolve('@supabase/ssr');
  const previousModule = require.cache[modulePath];
  const calls = [];
  const configured = { auth: {} };
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: {
    createBrowserClient: (url, key) => { calls.push({ url, key }); return configured; },
  } };
  t.after(() => { if (previousModule) require.cache[modulePath] = previousModule; else delete require.cache[modulePath]; });
  const { browserAuthClient } = require('../.test-build/auth-browser.js');
  assert.equal(browserAuthClient(), null);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co/rest/v1/';
  assert.equal(browserAuthClient(), null);
  assert.equal(calls.length, 0);
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  assert.equal(browserAuthClient(), configured);
  assert.deepEqual(calls, [{ url: 'https://example.supabase.co', key: 'public-test-key' }]);
});
