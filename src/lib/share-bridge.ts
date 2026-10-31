import { randomBytes, randomUUID } from "node:crypto";

/** Native share forms cannot supply a timezone. Resolve it in the receiving browser before saving. */
export function shareBridge(payload: { title: string; text: string; url: string }): Response {
  const nonce = randomBytes(16).toString("base64");
  const data = JSON.stringify({ ...payload, idempotencyKey: randomUUID(), currentTime: new Date().toISOString() }).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Save shared note</title><body><main><h1>Saving your shared note…</h1><p id="status" role="status">Resolving your local time.</p><button id="retry" hidden>Try again</button></main><script nonce="${nonce}">
const payload = ${data};
const button = document.getElementById('retry');
async function save() {
  button.hidden = true;
  try {
    const response = await fetch('/api/share-target', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': payload.idempotencyKey }, body: JSON.stringify({ ...payload, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save your note.');
    location.replace('/?shared=true');
  } catch (error) { document.getElementById('status').textContent = error.message; button.hidden = false; }
}
button.addEventListener('click', save); save();
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'` } });
}
