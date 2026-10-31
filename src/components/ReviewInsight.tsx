"use client";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReviewInsight as Insight } from "@/lib/review";
import type { LedgerItem } from "@/lib/ledger";

export function ReviewInsight({ insight, entries, tone = "plain" }: { insight: Insight; entries: LedgerItem[]; tone?: "progress" | "experience" | "plain" }) {
  const [expanded, setExpanded] = useState(false);
  const sources = insight.source_ids.map((id) => entries.find((entry) => entry.id === id)).filter((entry): entry is LedgerItem => Boolean(entry));
  return <article className={`rounded-2xl border p-6 ${tone === "progress" ? "border-emerald-500/20 bg-emerald-500/[.035]" : tone === "experience" ? "border-amber-500/20 bg-amber-500/[.035]" : "border-border bg-surface"}`}>
    <h3 className="font-serif text-xl leading-snug tracking-[-.02em] text-foreground">{insight.title}</h3>
    <p className="mt-3 text-sm leading-[1.85] text-muted">{insight.takeaway}</p>
    {sources.length > 0 && <><button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-5 inline-flex items-center gap-1 text-[11px] font-medium text-accent">{expanded ? "Close the original moments" : "What this comes from"}{expanded ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}</button>{expanded && <div className="mt-4 space-y-3 border-t border-border pt-4"><p className="text-xs leading-relaxed text-muted">{insight.meaning}</p>{sources.map((entry) => <blockquote key={entry.id} className="border-l-2 border-accent/20 pl-3"><p className="font-serif text-sm leading-relaxed text-foreground">{entry.content}</p>{entry.review_state?.status === "completed" && <p className="mt-2 text-xs text-accent">You marked this as followed through on {new Date(entry.review_state.updated_at).toLocaleDateString()}.</p>}<footer className="mt-1 text-[10px] text-muted">{new Date(entry.event_timestamp || entry.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</footer></blockquote>)}</div>}</>}
  </article>;
}
