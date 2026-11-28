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

const PLAYED_STORAGE_KEY = "august-played-flights";
const playedReceipts = new Set<string>();

function hasPlayedFlight(noteId: string): boolean {
  if (playedReceipts.has(noteId)) return true;
  try {
    const raw = sessionStorage.getItem(PLAYED_STORAGE_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw);
    return Array.isArray(ids) && ids.includes(noteId);
  } catch {
    return false;
  }
}

function markFlightPlayed(noteId: string) {
  playedReceipts.add(noteId);
  try {
    const raw = sessionStorage.getItem(PLAYED_STORAGE_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(ids) ? [...ids.filter(id => id !== noteId), noteId].slice(-25) : [noteId];
    sessionStorage.setItem(PLAYED_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

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
  const receiptRef = useRef(receipt);
  const noteId = receipt?.noteId;

  useEffect(() => {
    receiptRef.current = receipt;
  }, [receipt]);

  useEffect(() => {
    const active = receiptRef.current;
    if (!active || still || !ink.current || hasPlayedFlight(active.noteId)) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled || !ink.current) return;
      const marks = [...ink.current.querySelectorAll("mark")];
      if (!marks.length) return;
      markFlightPlayed(active.noteId);
      marks.slice(0, 8).forEach((mark, i) => {
        const passage = active.passages?.[Number(mark.dataset.index)];
        if (!passage) return;
        const rect = mark.getClientRects()[0] ?? mark.getBoundingClientRect();
        const delay = 650 + i * 260;
        const title = mark.textContent?.trim().slice(0, 50) || passage.label;
        mark.animate?.([
          { filter: "brightness(1)" },
          { filter: `brightness(1.12) drop-shadow(0 0 8px ${glows[passage.kind]})`, offset: 0.45 },
          { filter: "brightness(1)" },
        ], { duration: 700, delay, easing: "ease-out" });
        if (passage.kind === "work") {
          flyPassage(rect, 'nav a[href="/tasks"]', title, colors.work, delay, {
            glow: glows.work, kind: "work", fallbackSelector: '[aria-label="Expand Sidebar"]',
          });
          if (passage.dated || passage.synced) {
            flyPassage(rect, "[data-calendar-target]", title, colors.event, delay + 220, {
              glow: glows.event, kind: "event", fallbackSelector: 'nav a[href="/tasks"]',
            });
          }
        } else if (passage.kind === "event") {
          flyPassage(rect, "[data-calendar-target]", title, colors.event, delay, {
            glow: glows.event, kind: "event", fallbackSelector: 'nav a[href="/tasks"]',
          });
        } else {
          flyPassage(rect, 'nav a[href="/clusters"]', title, colors[passage.kind], delay, {
            glow: glows[passage.kind], kind: passage.kind, fallbackSelector: '[aria-label="Expand Sidebar"]',
          });
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [noteId, still]);

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
