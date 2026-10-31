const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { categoryStorageValues } = require('../.test-build/ledger.js');
const { getRelativeTimeLabel, validTimezone } = require('../.test-build/time.js');
const { shareBridge } = require('../.test-build/share-bridge.js');

test('SQL category filters include historical aliases without treating Done as an idea', () => {
  assert.ok(categoryStorageValues('Wishlist').includes('Wishlist'));
  assert.ok(!categoryStorageValues('Idea').includes('Wishlist'));
  assert.ok(categoryStorageValues('Idea').includes('Idea'));
  assert.ok(!categoryStorageValues('Idea_Desire').includes('Done'));
  assert.ok(categoryStorageValues('Daily_Log').includes('Done'));
  assert.ok(categoryStorageValues('Media_Log').includes('Media'));
});

test('future dates show an upcoming date and time, and invalid timezones are rejected', () => {
  const now = new Date('2026-10-31T10:00:00Z');
  assert.match(getRelativeTimeLabel('2026-11-01T10:00:00Z', now), /at /);
  assert.notEqual(getRelativeTimeLabel('2026-11-01T10:00:00Z', now), 'Just now');
  assert.equal(getRelativeTimeLabel('bad-date', now), 'Recently');
  assert.equal(validTimezone('Asia/Kolkata'), 'Asia/Kolkata');
  assert.equal(validTimezone('Mars/Space'), null);
});

test('native share bridge resolves browser timezone and safely embeds hostile share text', async () => {
  const response = shareBridge({ title: '', text: '</script><script>alert(1)</script>', url: '' });
  const html = await response.text();
  assert.ok(!html.includes('</script><script>'));
  assert.ok(html.includes('Intl.DateTimeFormat().resolvedOptions().timeZone'));
  assert.ok(html.includes('Idempotency-Key'));
  assert.ok(response.headers.get('Content-Security-Policy').includes("script-src 'nonce-"));
});

test('Keep paragraph bodies stay paragraphs; actual checkbox state is preserved by the shared scraper', () => {
  const scraper = fs.readFileSync('extension/content.js', 'utf8');
  const paragraph = { innerText: 'A normal note', querySelector: () => ({ innerText: 'A normal note' }), querySelectorAll: (selector) => { assert.equal(selector, '[role="checkbox"]'); return []; } };
  const checkbox = (label, checked) => ({ innerText: label, closest: () => null, getAttribute: (name) => name === 'aria-checked' ? String(checked) : label });
  const list = { innerText: 'Checklist', querySelector: () => null, querySelectorAll: () => [checkbox('Buy milk', false), checkbox('Call Dad', true)] };
  // The minimal DOM fixtures represent the selectors used by the browser scraper.
  paragraph.querySelector = (selector) => selector.includes('Title') ? null : { innerText: 'A normal note' };
  const context = { document: { querySelectorAll: () => [paragraph, list] } };
  vm.runInNewContext(scraper, context);
  const notes = context.augustScrapeKeepNotes();
  assert.equal(notes[0].content, 'A normal note');
  assert.equal(notes[1].content, '[ ] Buy milk\n[x] Call Dad');
});
