"use client";

import { Fragment, useEffect, useRef, type CSSProperties } from "react";
import type { DraftReceipt } from "@/lib/web-draft-model";
import { flyPassage } from "@/lib/journal-motion";

const colors = { work: "#c3e5f8", event: "#bcd9ff", feeling: "#ffd0df", memory: "#ded8fc" };
const glows = {
  work: "rgba(56, 189, 248, 0.45)",
  event: "rgba(96, 165, 250, 0.50)",
  feeling: "rgba(244, 114, 182, 0.48)",
  memory: "rgba(167, 139, 250, 0.45)",
};
type Passage = NonNullable<DraftReceipt["passages"]>[number];

function preview(text: string): Passage[] {
  return [...text.matchAll(/[^.!?\n]+(?:[.!?]+|\n)/gu)].flatMap(match => {
    const raw = match[0];
    const line = raw.trim();
    const trimmedEnd = match.index + raw.replace(/\n+$/, "").length;
    if (!line || trimmedEnd <= match.index) return [];
    const cancelled = /\b(cancelled|canceled|skipped|skipping|someday|might buy|wish i had)\b/i.test(line);
    const kind = !cancelled && (
        /\b(meeting|appointment|conference|dentist|doctor|interview|flight|dinner with)\b/i.test(line) ||
        /\b(tomorrow|next\s+(?:mon|tue|wed|thu|fri|sat|sun)\w*)\b.*\b(\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|at\s+\d)/i.test(line)
      ) ? "event"
      : !cancelled && /\b(remind me|need to|have to|must|working on|building a|finish|submit|pay the|call the|deadline|due\s+(?:by|on|tomorrow))\b/i.test(line) ? "work"
      : /\b(feel|felt|feeling|happy|sad|grateful|anxious|lonely|proud|overwhelmed|calm|peaceful|rushed|stressed|relieved|excited|angry|hurt|loved|missed|quiet walk|heart)\b/i.test(line) ? "feeling"
      : null;
    return kind ? [{ start: match.index, end: trimmedEnd, kind, label: "", dated: false, synced: false }] : [];
  });
}

export function PassageInk({ text, receipt, still, shift }: {
  text: string; receipt?: DraftReceipt; still: boolean; shift: number;
}) {
  const ink = useRef<HTMLDivElement>(null);
  const previous = useRef(receipt?.noteId);
  useEffect(() => {
    if (!receipt || receipt.noteId === previous.current || still) { previous.current = receipt?.noteId; return; }
    previous.current = receipt.noteId;
    const cleanups = [...ink.current!.querySelectorAll("mark")].slice(0, 8).flatMap((mark, i) => {
      const passage = receipt.passages?.[Number(mark.dataset.index)];
      if (!passage) return [];
      const rect = mark.getClientRects()[0] ?? mark.getBoundingClientRect();
      const delay = 420 + i * 240;
      const title = mark.textContent?.trim().slice(0, 50) || passage.label;
      if (passage.kind === "work") {
        const effects = [flyPassage(rect, 'nav a[href="/tasks"]', title, colors.work, delay, { glow: glows.work, kind: "work" })];
        if (passage.dated || passage.synced) {
          effects.push(flyPassage(rect, '[data-calendar-target]', title, colors.event, delay + 220, { glow: glows.event, kind: "event" }));
        }
        return effects;
      }
      if (passage.kind === "event") {
        const hasCal = [...document.querySelectorAll<HTMLElement>('[data-calendar-target]')].some(el => el.getClientRects().length && getComputedStyle(el).visibility === "visible");
        const target = hasCal ? '[data-calendar-target]' : 'nav a[href="/tasks"]';
        return [flyPassage(rect, target, title, colors.event, delay, { glow: glows.event, kind: "event" })];
      }
      return [flyPassage(rect, 'nav a[href="/clusters"]', title, colors[passage.kind], delay, { glow: glows[passage.kind], kind: passage.kind })];
    });
    return () => cleanups.forEach(cancel => cancel?.());
  }, [receipt, still]);
  let end = 0;
  const parts = [];
  for (const [i, p] of (receipt ? receipt.passages ?? [] : preview(text)).entries()) {
    const start = Math.max(end, p.start);
    if (start >= p.end || p.end > text.length) continue;
    const gap = text.slice(end, start);
    end = p.end;
    parts.push(<Fragment key={`${receipt ? "filed" : "preview"}-${start}-${p.kind}`}>{gap}<mark data-index={i} data-kind={p.kind} style={{
      color: "transparent",
      "--hl-color": colors[p.kind],
      "--hl-glow": glows[p.kind],
      "--stagger": `${i * 150}ms`,
      borderRadius: ".24em",
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
    } as CSSProperties}>{text.slice(start, end)}</mark></Fragment>);
  }
  return <div ref={ink} data-filed={Boolean(receipt)} aria-hidden="true" style={{ transform: `translateY(-${shift}px)` }}>{parts}{text.slice(end)}</div>;
}
