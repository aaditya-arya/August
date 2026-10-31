"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReviewInsight as Insight } from "@/lib/review";
import type { LedgerItem } from "@/lib/ledger";
import { OriginalNote } from "./MemoryCard";

export function ReviewInsight({ insight, entries, tone = "plain", focus = false }: { insight: Insight; entries: LedgerItem[]; tone?: "progress" | "experience" | "plain"; focus?: boolean }) {
  const [expanded, setExpanded] = useState(false), [original, setOriginal] = useState<LedgerItem | null>(null);
  const sources = insight.source_ids.map(id => entries.find(entry => entry.id === id)).filter((entry): entry is LedgerItem => Boolean(entry));
  const surface = focus ? "p-7 sm:p-10 border-accent/20 bg-accent/[.035]" : tone === "progress" ? "p-6 border-emerald-500/20 bg-emerald-500/[.035]" : tone === "experience" ? "p-6 border-amber-500/20 bg-amber-500/[.035]" : "p-6 border-border bg-surface";
  return <article className={`rounded-2xl border ${surface}`}>
    {focus && <p className="mb-4 text-[10px] uppercase tracking-[.18em] text-accent">Something to carry with you</p>}
    <h3 className={`font-serif leading-snug tracking-[-.02em] text-foreground ${focus ? "text-2xl sm:text-3xl" : "text-xl"}`}>{insight.title}</h3>
    <p className={`mt-3 leading-[1.85] ${focus ? "max-w-2xl text-base text-foreground" : "text-sm text-muted"}`}>{insight.takeaway}</p>
    {sources.length > 0 && <><button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-5 inline-flex items-center gap-1 text-[11px] text-accent">{expanded ? "Close the original moments" : "What this comes from"}{expanded ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}</button>{expanded && <div className="mt-4 space-y-4 border-t border-border pt-4"><p className="text-xs leading-relaxed text-muted">{insight.meaning}</p>{sources.map(entry => <blockquote key={entry.id} className="border-l-2 border-accent/20 pl-3"><p className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed">{entry.content}</p>{entry.review_state?.status === "completed" && <p className="mt-2 text-xs text-accent">You marked this as followed through on {new Date(entry.review_state.updated_at).toLocaleDateString()}.</p>}<footer className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted"><span>{new Date(entry.event_timestamp || entry.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>{entry.note_id && <button onClick={() => setOriginal(entry)} className="text-accent">Open original note ↗</button>}</footer></blockquote>)}</div>}</>}
    {original && <OriginalNote item={original} onClose={() => setOriginal(null)} />}
  </article>;
}
