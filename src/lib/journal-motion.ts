export function flyPassage(from: DOMRect, selector: string, text: string, color: string, delay = 0) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !Element.prototype.animate) return;
  try { if (JSON.parse(localStorage.getItem("august-editor-preferences") || "{}").still) return; } catch {}
  const bounds = [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.getClientRects().length && getComputedStyle(el).visibility === "visible")?.getBoundingClientRect();
  if (!bounds || from.bottom < 0 || from.top > innerHeight || bounds.bottom < 0 || bounds.top > innerHeight) return;
  const token = document.createElement("span");
  token.setAttribute("aria-hidden", "true");
  token.textContent = text;
  Object.assign(token.style, { position: "fixed", left: from.left+"px", top: from.top+"px", zIndex: "99",
    pointerEvents: "none", padding: "4px 11px", borderRadius: "2em", maxWidth: "18em", whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis", background: color, color: "#172033", fontSize: "14px", transformOrigin: "left center" });
  document.body.append(token);
  const x = bounds.left + bounds.width / 2 - from.left;
  const y = bounds.top + bounds.height / 2 - from.top;
  const flight = token.animate([
    { transform: "scale(.94)", opacity: 0 },
    { transform: "translateY(-12px)", opacity: 1, offset: .16 },
    { transform: `translate(${x*.48}px,${y*.48-42}px) rotate(-5deg) scale(.85)`, opacity: .9, offset: .55 },
    { transform: `translate(${x}px,${y}px) scale(.12)`, opacity: 0, filter: "blur(3px)" },
  ], { duration: 1150, delay, easing: "ease-in-out", fill: "both" });
  flight.finished.catch(() => {}).finally(() => token.remove());
  return () => flight.cancel();
}
