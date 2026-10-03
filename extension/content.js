// Google Keep DOM Scraper Content Script for Write
(() => {
  function scrapeKeepNotes() {
    const notes = [];

    // Selectors for Google Keep note cards
    const cardElements = document.querySelectorAll(
      'div.IZ65Rd-TBnAttached, div.IZ65Rd-n0tgOf-ibnC6b, div[role="listitem"], .gKe0He-bN97ce'
    );

    const processedTexts = new Set();

    cardElements.forEach((card) => {
      // 1. Extract Title
      const titleEl = card.querySelector(
        '.IZ65Rd-rymPhb, div[aria-label="Title"], .h1U9Be-rymPhb, .notetitle'
      );
      const title = titleEl ? titleEl.innerText.trim() : "";

      // 2. Extract Checklist items or Paragraph text
      const listItems = Array.from(
        card.querySelectorAll('div[role="checkbox"], .L97FXe-bN97ce, .IZ65Rd-haAclf')
      ).map((el) => {
        // Check if checked
        const isChecked = el.getAttribute("aria-checked") === "true";
        const label = el.innerText.trim();
        return isChecked ? `[x] ${label}` : `[ ] ${label}`;
      }).filter((item) => item.length > 4);

      // 3. Extract General Text
      const bodyEl = card.querySelector(
        '.IZ65Rd-haAclf, div[aria-label="Note"], .notetext, .XQLv7d'
      );
      let bodyText = bodyEl ? bodyEl.innerText.trim() : "";

      // If checklists found, use formatted checklist; otherwise fallback to body or card text
      let content = "";
      if (listItems.length > 0) {
        content = listItems.join("\n");
      } else if (bodyText) {
        content = bodyText;
      } else {
        // Fallback: grab all text inside card excluding title
        content = card.innerText.replace(title, "").trim();
      }

      if (content && !processedTexts.has(title + content)) {
        processedTexts.add(title + content);
        notes.push({
          title: title || undefined,
          content: content,
          source: "google_keep_dom_sync",
        });
      }
    });

    return notes;
  }

  // Listen for trigger message from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE_KEEP_NOTES") {
      const notes = scrapeKeepNotes();
      sendResponse({ success: true, count: notes.length, notes });
    }
    return true;
  });
})();
