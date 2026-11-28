type Point = { x: number; y: number };

function cubic(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

export function flyPassage(
  from: DOMRect,
  selector: string,
  text: string,
  color: string,
  delay = 0,
  options?: { glow?: string; kind?: string },
) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !Element.prototype.animate) return;
  try { if (JSON.parse(localStorage.getItem("august-editor-preferences") || "{}").still) return; } catch {}
  const targetEl = [...document.querySelectorAll<HTMLElement>(selector)].find(
    el => el.getClientRects().length && getComputedStyle(el).visibility === "visible",
  );
  const bounds = targetEl?.getBoundingClientRect();
  if (!targetEl || !bounds || from.bottom < 0 || from.top > innerHeight || bounds.bottom < 0 || bounds.top > innerHeight) return;

  const glow = options?.glow ?? "rgba(136, 146, 210, 0.45)";
  const p0: Point = { x: from.left, y: from.top };
  const p3: Point = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  const p1: Point = { x: p0.x + (p3.x - p0.x) * 0.28, y: p0.y - 78 };
  const p2: Point = { x: p0.x + (p3.x - p0.x) * 0.72, y: p3.y - 46 };
  const duration = 1480;

  const nodes: HTMLElement[] = [];
  const anims: Animation[] = [];

  const token = document.createElement("span");
  token.setAttribute("aria-hidden", "true");
  token.textContent = text;
  Object.assign(token.style, {
    position: "fixed", left: `${p0.x}px`, top: `${p0.y}px`, zIndex: "99",
    pointerEvents: "none", padding: "5px 13px", borderRadius: "2em", maxWidth: "18em",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    background: color, color: "#172033", fontSize: "14px",
    fontFamily: "var(--font-lora), Georgia, serif", fontStyle: "italic",
    boxShadow: `0 8px 28px ${glow}`, backdropFilter: "blur(8px)",
    border: "1px solid rgba(255, 255, 255, 0.65)", transformOrigin: "left center",
  });
  document.body.append(token);
  nodes.push(token);

  const steps = 15;
  const keyframes: Keyframe[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const pt = cubic(t, p0, p1, p2, p3);
    const dx = pt.x - p0.x;
    const dy = pt.y - p0.y;
    const sway = Math.sin(t * Math.PI * 1.4) * -5;
    const scale = t < 0.14 ? 0.92 + (t / 0.14) * 0.12 : 1.04 - Math.pow((t - 0.14) / 0.86, 1.5) * 0.9;
    const opacity = t < 0.12 ? t / 0.12 : t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
    const blur = t > 0.78 ? `blur(${((t - 0.78) / 0.22 * 5).toFixed(1)}px)` : "blur(0px)";
    keyframes.push({
      offset: t,
      transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${sway.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
      opacity: Number(opacity.toFixed(3)),
      filter: blur,
    });
  }
  const flight = token.animate(keyframes, { duration, delay, easing: "linear", fill: "both" });
  anims.push(flight);
  flight.finished.catch(() => {}).finally(() => token.remove());

  for (const [idx, t] of [0.08, 0.2, 0.34, 0.48, 0.62, 0.76, 0.88].entries()) {
    const pt = cubic(t, p0, p1, p2, p3);
    const size = 22 + (idx % 3) * 8;
    const driftX = (idx % 2 === 0 ? 1 : -1) * (10 + idx * 3);
    const driftY = -22 - (idx % 3) * 10;
    const wisp = document.createElement("span");
    wisp.setAttribute("aria-hidden", "true");
    Object.assign(wisp.style, {
      position: "fixed", left: `${(pt.x - size / 2).toFixed(1)}px`, top: `${(pt.y - size / 2).toFixed(1)}px`,
      width: `${size}px`, height: `${size}px`, borderRadius: "50%", zIndex: "98",
      pointerEvents: "none", background: `radial-gradient(circle, ${color} 0%, transparent 72%)`,
      filter: "blur(7px)",
    });
    document.body.append(wisp);
    nodes.push(wisp);
    const wispAnim = wisp.animate([
      { transform: "translate(0, 0) scale(0.45)", opacity: 0 },
      { transform: `translate(${(driftX * 0.5).toFixed(1)}px, ${(driftY * 0.5).toFixed(1)}px) scale(1.85)`, opacity: 0.58, offset: 0.38 },
      { transform: `translate(${driftX}px, ${driftY}px) scale(2.35)`, opacity: 0 },
    ], { duration: 920, delay: delay + Math.round(t * duration * 0.82), easing: "ease-out", fill: "both" });
    anims.push(wispAnim);
    wispAnim.finished.catch(() => {}).finally(() => wisp.remove());
  }

  for (let m = 0; m < 8; m++) {
    const t = 0.1 + m * 0.105;
    const pt = cubic(t, p0, p1, p2, p3);
    const offsetX = Math.sin(m * 2.3) * 20;
    const offsetY = Math.cos(m * 1.9) * 16 - 10;
    const size = 5 + (m % 3);
    const mote = document.createElement("span");
    mote.setAttribute("aria-hidden", "true");
    Object.assign(mote.style, {
      position: "fixed", left: `${(pt.x + offsetX).toFixed(1)}px`, top: `${(pt.y + offsetY).toFixed(1)}px`,
      width: `${size}px`, height: `${size}px`, borderRadius: "50%", zIndex: "99",
      pointerEvents: "none", background: color, boxShadow: `0 0 10px ${color}`,
    });
    document.body.append(mote);
    nodes.push(mote);
    const moteAnim = mote.animate([
      { transform: "translate(0, 0) scale(0)", opacity: 0 },
      { transform: `translate(${(offsetX * 0.3).toFixed(1)}px, -12px) scale(1.2)`, opacity: 0.9, offset: 0.35 },
      { transform: `translate(${(offsetX * 0.7).toFixed(1)}px, -28px) scale(0)`, opacity: 0 },
    ], { duration: 780, delay: delay + Math.round(t * duration * 0.85), easing: "ease-out", fill: "both" });
    anims.push(moteAnim);
    moteAnim.finished.catch(() => {}).finally(() => mote.remove());
  }

  const arrivalDelay = delay + duration - 220;
  const dockAnim = targetEl.animate([
    { transform: "scale(1)", boxShadow: "0 0 0 transparent" },
    { transform: "scale(1.05)", boxShadow: `0 0 22px ${glow}`, offset: 0.4 },
    { transform: "scale(1)", boxShadow: "0 0 0 transparent" },
  ], { duration: 520, delay: arrivalDelay, easing: "ease-out" });
  anims.push(dockAnim);

  const halo = document.createElement("span");
  halo.setAttribute("aria-hidden", "true");
  Object.assign(halo.style, {
    position: "fixed", left: `${(p3.x - 9).toFixed(1)}px`, top: `${(p3.y - 9).toFixed(1)}px`,
    width: "18px", height: "18px", borderRadius: "50%", zIndex: "98",
    pointerEvents: "none", border: `2px solid ${color}`,
  });
  document.body.append(halo);
  nodes.push(halo);
  const haloAnim = halo.animate([
    { transform: "scale(1)", opacity: 0.85 },
    { transform: "scale(3.55)", opacity: 0 },
  ], { duration: 560, delay: arrivalDelay, easing: "ease-out", fill: "both" });
  anims.push(haloAnim);
  haloAnim.finished.catch(() => {}).finally(() => halo.remove());

  return () => {
    anims.forEach(a => a.cancel());
    nodes.forEach(n => n.remove());
  };
}
