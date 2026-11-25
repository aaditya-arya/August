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
      const apiUrl = new URL(apiUrlInput.value.trim() || "http://localhost:3000/api/import/keep");
      if ((apiUrl.protocol !== 'https:' && !(apiUrl.protocol === 'http:' && apiUrl.hostname === 'localhost')) || apiUrl.username || apiUrl.password || apiUrl.pathname !== '/api/import/keep' || apiUrl.search || apiUrl.hash) throw new Error('Use your August HTTPS address followed by /api/import/keep.');
      const originPattern = `${apiUrl.origin}/*`;
      // Request only the destination selected by the user; no session tokens are copied.
      if (!await chrome.permissions.request({ origins: [originPattern] })) throw new Error('Allow access to your August server to import notes.');
      // 1. Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url || new URL(tab.url).hostname !== "keep.google.com") {
        statusSpinner.classList.add("hidden");
        statusText.innerText = "⚠️ Please open https://keep.google.com in your active tab before clicking sync.";
        syncBtn.disabled = false;
        return;
      }

      statusText.innerText = "Reading DOM and extracting Keep cards...";

      // 2. Execute scraping script in active tab
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => globalThis.augustScrapeKeepNotes(),
      });

      const notes = results?.[0]?.result || [];

      if (notes.length === 0) {
        statusSpinner.classList.add("hidden");
        statusText.innerText = "No Keep cards found on the screen. Make sure your notes are visible.";
        syncBtn.disabled = false;
        return;
      }

      statusText.innerText = `Scraped ${notes.length} notes! Processing AI extraction & embeddings...`;

      // Run in the signed-in August tab so its same-origin session stays there.
      const augustTabs = await chrome.tabs.query({ url: originPattern });
      const augustTab = augustTabs.find(candidate => candidate.id && new URL(candidate.url).origin === apiUrl.origin);
      if (!augustTab) throw new Error('Open August in another tab and sign in, then return to Keep and retry.');
      const imported = await chrome.scripting.executeScript({
        target: { tabId: augustTab.id }, world: 'MAIN',
        args: [apiUrl.origin, { notes, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }],
        func: async (expectedOrigin, body) => {
          if (location.origin !== expectedOrigin) return { ok: false, status: 0, data: { error: 'The August tab changed. Please retry.' } };
          try {
            const response = await fetch('/api/import/keep', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            return { ok: response.ok, status: response.status, data: await response.json() };
          } catch { return { ok: false, status: 0, data: { error: 'Could not reach August. Please retry.' } }; }
        },
      });
      const response = imported?.[0]?.result;
      if (!response?.ok) throw new Error(response?.status === 401 ? 'Sign in to August in its browser tab, then retry.' : response?.data?.error || 'The import failed. Please retry.');
      const data = response.data;

      statusSpinner.classList.add("hidden");
      statusText.innerText = data.failedCount ? `Saved ${notes.length - data.failedCount} notes; ${data.failedCount} failed. Retry to save the remaining notes without duplicating successful imports.` : "Successfully synced to Write!";
      
      scrapedCount.innerText = notes.length;
      extractedCount.innerText = data.itemsExtracted ?? 0;
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
