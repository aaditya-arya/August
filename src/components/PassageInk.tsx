"use client";

import { Fragment, useEffect, useRef } from "react";
import type { DraftReceipt } from "@/lib/web-draft-model";
import { flyPassage } from "@/lib/journal-motion";

const colors = { work: "#c3e5f8", event: "#bcd9ff", feeling: "#ffd0df", memory: "#ded8fc" };
type Passage = NonNullable<DraftReceipt["passages"]>[number];

function preview(text: string): Passage[] {
  return [...text.matchAll(/[^.!?\n]+/gu)].flatMap(match => {
    const line = match[0];
    const kind = /\b(meeting|appointment|conference)\b/i.test(line) ? "event"
      : /\b(feel|felt|happy|sad|grateful|anxious|lonely|proud|overwhelmed)\b/i.test(line) ? "feeling"
      : /\b(remind me|need to|working on|have to finish)\b/i.test(line) ? "work" : null;
    return kind ? [{ start: match.index, end: match.index + line.length, kind, label: "", dated: false, synced: false }] : [];
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
      const target = passage.kind === "work" ? 'nav a[href="/tasks"]' : passage.synced ? '[data-calendar-target]' : 'nav a[href="/clusters"]';
      const title = mark.textContent?.trim().slice(0, 50) || passage.label;
      const effects = [flyPassage(mark.getBoundingClientRect(), target, title, colors[passage.kind], i * 150)];
      if (passage.kind === "work" && passage.synced) effects.push(flyPassage(mark.getBoundingClientRect(), '[data-calendar-target]', title, colors.event, i * 150 + 260));
      return effects;
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
    parts.push(<Fragment key={i}>{gap}<mark data-index={i} style={{ color: "transparent", background: colors[p.kind], borderRadius: ".22em",
      boxDecorationBreak: "clone" }}>{text.slice(start, end)}</mark></Fragment>);
  }
  return <div ref={ink} data-filed={Boolean(receipt)} aria-hidden="true" style={{ transform: `translateY(-${shift}px)` }}>{parts}{text.slice(end)}</div>;
}
