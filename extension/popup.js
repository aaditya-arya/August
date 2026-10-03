document.addEventListener("DOMContentLoaded", () => {
  const syncBtn = document.getElementById("syncBtn");
  const apiUrlInput = document.getElementById("apiUrl");
  const statusBox = document.getElementById("statusBox");
  const statusText = document.getElementById("statusText");
  const statusSpinner = document.getElementById("statusSpinner");
  const resultBox = document.getElementById("resultBox");
  const scrapedCount = document.getElementById("scrapedCount");
  const extractedCount = document.getElementById("extractedCount");

  syncBtn.addEventListener("click", async () => {
    statusBox.classList.remove("hidden");
    resultBox.classList.add("hidden");
    statusSpinner.classList.remove("hidden");
    statusText.innerText = "Accessing Google Keep tab...";
    syncBtn.disabled = true;

    try {
      // 1. Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url || !tab.url.includes("keep.google.com")) {
        statusSpinner.classList.add("hidden");
        statusText.innerText = "⚠️ Please open https://keep.google.com in your active tab before clicking sync.";
        syncBtn.disabled = false;
        return;
      }

      statusText.innerText = "Reading DOM and extracting Keep cards...";

      // 2. Execute scraping script in active tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const notes = [];
          const cardElements = document.querySelectorAll(
            'div.IZ65Rd-TBnAttached, div.IZ65Rd-n0tgOf-ibnC6b, div[role="listitem"], .gKe0He-bN97ce'
          );

          const processedTexts = new Set();

          cardElements.forEach((card) => {
            const titleEl = card.querySelector(
              '.IZ65Rd-rymPhb, div[aria-label="Title"], .h1U9Be-rymPhb, .notetitle'
            );
            const title = titleEl ? titleEl.innerText.trim() : "";

            const listItems = Array.from(
              card.querySelectorAll('div[role="checkbox"], .L97FXe-bN97ce, .IZ65Rd-haAclf')
            )
              .map((el) => {
                const isChecked = el.getAttribute("aria-checked") === "true";
                const label = el.innerText.trim();
                return isChecked ? `[x] ${label}` : `[ ] ${label}`;
              })
              .filter((item) => item.length > 4);

            const bodyEl = card.querySelector(
              '.IZ65Rd-haAclf, div[aria-label="Note"], .notetext, .XQLv7d'
            );
            let bodyText = bodyEl ? bodyEl.innerText.trim() : "";

            let content = "";
            if (listItems.length > 0) {
              content = listItems.join("\n");
            } else if (bodyText) {
              content = bodyText;
            } else {
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
        },
      });

      const notes = results?.[0]?.result || [];

      if (notes.length === 0) {
        statusSpinner.classList.add("hidden");
        statusText.innerText = "No Keep cards found on the screen. Make sure your notes are visible.";
        syncBtn.disabled = false;
        return;
      }

      statusText.innerText = `Scraped ${notes.length} notes! Processing AI extraction & embeddings...`;

      // 3. Send to Write Backend
      const apiUrl = apiUrlInput.value.trim() || "http://localhost:3000/api/import/keep";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      statusSpinner.classList.add("hidden");
      statusText.innerText = `✅ Successfully synced to Write!`;
      
      scrapedCount.innerText = notes.length;
      extractedCount.innerText = data.itemsExtracted || notes.length;
      resultBox.classList.remove("hidden");

    } catch (err) {
      console.error(err);
      statusSpinner.classList.add("hidden");
      statusText.innerText = `❌ Error: ${err.message || "Failed to sync"}. Ensure Write dev server is running on localhost:3000.`;
    } finally {
      syncBtn.disabled = false;
    }
  });
});
