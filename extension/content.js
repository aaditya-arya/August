// Injected by popup.js. The scraper is defined once here so paragraph and checklist rules cannot drift.
globalThis.augustScrapeKeepNotes = function (root = document) {
  const notes = [];
  const seen = new Set();
  const cards = root.querySelectorAll('div.IZ65Rd-TBnAttached, div.IZ65Rd-n0tgOf-ibnC6b, div[role="listitem"], .gKe0He-bN97ce');
  for (const card of cards) {
    const title = card.querySelector('.IZ65Rd-rymPhb, div[aria-label="Title"], .h1U9Be-rymPhb, .notetitle')?.innerText.trim() || "";
    const rows = new Set();
    const checklist = [];
    // A body class is not evidence of a checkbox. Only real checkbox controls qualify.
    for (const checkbox of card.querySelectorAll('[role="checkbox"]')) {
      const row = checkbox.closest('.L97FXe-bN97ce') || checkbox;
      if (rows.has(row)) continue;
      rows.add(row);
      const label = (row.innerText || checkbox.getAttribute('aria-label') || '').trim();
      if (label) checklist.push(`${checkbox.getAttribute('aria-checked') === 'true' ? '[x]' : '[ ]'} ${label}`);
    }
    const body = card.querySelector('.IZ65Rd-haAclf, div[aria-label="Note"], .notetext, .XQLv7d')?.innerText.trim();
    const content = checklist.length ? checklist.join('\n') : body || card.innerText.replace(title, '').trim();
    const key = `${title}\0${content}`;
    if ((content || title) && !seen.has(key)) { seen.add(key); notes.push({ title: title || undefined, content, source: 'google_keep_dom_sync' }); }
  }
  return notes;
};
