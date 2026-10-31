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
