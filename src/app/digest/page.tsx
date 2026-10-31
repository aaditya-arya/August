"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, RefreshCw, Loader2, Sun } from "lucide-react";
import type { ReviewResponse } from "@/lib/review";
import { inReviewPeriod } from "@/lib/review";
import { ReviewInsight } from "@/components/ReviewInsight";
import { IntentionCard } from "@/components/IntentionPlan";
import { ReviewReflection } from "@/components/ReviewReflection";
import { refreshIntentions, useIntentions } from "@/lib/use-intentions";
import { reviewLoader } from "@/lib/review-client";

type Period = "7" | "30" | "all";
export default function SundayReviewPage() {
  const live = useIntentions();
  const [period, setPeriod] = useState<Period>("7"), [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null), [revision, setRevision] = useState(0);
  const [writing, setWriting] = useState(false);
  const refreshRequested = useRef(false);
  useEffect(() => {
    let observing = true;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone, refresh = refreshRequested.current;
    refreshRequested.current = false;
    let warmup: ReturnType<typeof setTimeout> | undefined;
    reviewLoader.load(period, zone, refresh).then(value => {
      if (!observing) return;
      setData(value); setError(null); void refreshIntentions();
      if (value.status === "ready" || value.selected_count === 0) warmup = setTimeout(() => {
        for (const days of ["7", "30", "all"] as const) if (days !== period) void reviewLoader.load(days, zone).catch(() => {});
      }, 250);
    }).catch(failure => { if (observing) setError(failure instanceof Error ? failure.message : "Could not prepare your review."); }).finally(() => { if (observing) setLoading(false); });
    return () => { observing = false; clearTimeout(warmup); };
  }, [period, revision]);
  useEffect(() => {
    const changed = () => { setLoading(true); setRevision(value => value + 1); };
    window.addEventListener("august-intentions-changed", changed); window.addEventListener("august-ledger-changed", changed);
    return () => { window.removeEventListener("august-intentions-changed", changed); window.removeEventListener("august-ledger-changed", changed); };
  }, []);
  function refresh() { refreshRequested.current = true; setLoading(true); setError(null); setRevision(value => value + 1); }
  function choose(value: Period) {
    if (value === period) return;
    const stored = reviewLoader.peek(value, Intl.DateTimeFormat().resolvedOptions().timeZone);
    setData(stored); setLoading(!stored); setError(null); setWriting(false); setPeriod(value);
  }
  const review = data?.review, intentions = live.loading || live.error ? data?.intentions || [] : live.intentions;
  const active = intentions.filter(item => !item.needs_confirmation && !["completed", "released", "paused"].includes(item.status));
  const historical = intentions.filter(item => item.needs_confirmation && !["completed", "released", "paused"].includes(item.status));
  const resolved = intentions.filter(item => ["completed", "released", "paused"].includes(item.status));
  const selected = data?.entries.filter(item => inReviewPeriod(item, data.period)) || [];
  const dates = [...new Set(selected.map(item => new Date(item.memory?.recorded_at || item.event_timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })))];
  const focus = review?.focus || review?.progress[0] || review?.lessons[0] || review?.experiences[0] || review?.patterns[0];
  const supporting = review ? [...review.progress.map(insight => ({ insight, tone: "progress" as const })), ...review.experiences.map(insight => ({ insight, tone: "experience" as const })), ...review.lessons.map(insight => ({ insight, tone: "plain" as const })), ...review.patterns.map(insight => ({ insight, tone: "plain" as const }))].filter(({ insight }) => insight !== focus && insight.title !== focus?.title && !(focus && insight.source_ids.every(id => focus.source_ids.includes(id)))).slice(0, 3) : [];
  return <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 lg:px-12">
    <header className="mb-8"><Link href="/" className="inline-flex items-center gap-1.5 text-[11px] text-muted"><ArrowLeft size={12} />Back to your ledger</Link><p className="mt-7 text-[10px] uppercase tracking-[.2em] text-accent">Your Sunday Review</p><h1 className="mt-3 font-serif text-4xl leading-tight tracking-[-.04em] sm:text-5xl">A little room to look back.</h1><p className="mt-3 text-sm leading-relaxed text-muted">What deserves to stay with you. What you can put down.</p>
      <div className="mt-6 flex flex-wrap items-center gap-2"><div className="inline-flex rounded-xl border border-border bg-surface p-1">{([["7", "This week"], ["30", "30 days"], ["all", "The bigger picture"]] as const).map(([value, label]) => <button key={value} onClick={() => choose(value)} aria-pressed={period === value} className={`rounded-lg px-3 py-2 text-xs ${period === value ? "bg-accent/10 text-accent" : "text-muted"}`}>{label}</button>)}</div><button onClick={refresh} disabled={loading} aria-label="Refresh your review" className="rounded-xl border border-border p-2.5 text-muted disabled:opacity-40"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button></div>
      {data && selected.length > 0 && <p className="mt-4 text-[11px] text-muted">{dates.length === 1 ? `One day recorded · ${dates[0]}` : `${dates.length} days recorded`}{period === "all" ? " · Looking back across your notes" : ""}</p>}
    </header>
    {loading && <p role="status" className="mb-7 flex items-center gap-3 rounded-2xl border border-border p-6 text-sm text-muted"><Loader2 size={16} className="shrink-0 animate-spin text-accent" />{review ? "Updating your reflection..." : "Finding what is worth carrying with you..."}</p>}
    {error && <div role="alert" className="mb-7 rounded-2xl border border-border p-6"><p className="text-sm">{error}</p><button onClick={refresh} className="mt-3 text-xs text-accent">Try again</button></div>}
    {!loading && data?.context_count === 0 && <div className="rounded-3xl border border-border p-9 text-center"><Sun size={25} className="mx-auto text-accent" /><h2 className="mt-5 font-serif text-2xl">A review grows out of a life recorded.</h2><p className="mt-3 text-sm text-muted">Start with something you did, felt, noticed, or still want.</p><Link href="/" className="mt-5 inline-flex items-center gap-1 text-sm text-accent">Write a moment<ArrowUpRight size={14} /></Link></div>}
    {!loading && data && data.context_count > 0 && data.selected_count === 0 && <div className="rounded-3xl border border-border bg-surface p-8"><p className="text-[10px] uppercase tracking-[.16em] text-muted">Nothing new in this period</p><h2 className="mt-4 font-serif text-2xl">Your earlier days are still here.</h2><p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">An older diary stays on its original date. Importing it today does not make it this week&apos;s experience or turn its plans into today&apos;s tasks.</p><button onClick={() => choose("all")} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent">Look at the bigger picture<ArrowUpRight size={14} /></button></div>}
    {review && <>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted">{review.opening}</p>
      {focus && <ReviewInsight insight={focus} entries={data!.entries} focus />}
      {supporting.length > 0 && <section className="mt-9"><h2 className="mb-4 font-serif text-2xl">Also worth keeping</h2><div className="grid gap-4 md:grid-cols-2">{supporting.map(({ insight, tone }, index) => <ReviewInsight key={index} insight={insight} entries={data!.entries} tone={tone} />)}</div></section>}
      <section className="mt-9 border-y border-border py-7"><p className="text-[10px] uppercase tracking-[.16em] text-accent">A question, if you want to sit with it</p><p className="mt-3 max-w-2xl font-serif text-xl leading-relaxed">{review.question}</p><button onClick={() => setWriting(!writing)} aria-expanded={writing} className="mt-4 text-xs text-accent">{writing ? "Close" : "Add a thought"}</button>{writing && <div className="mt-5"><ReviewReflection question={review.question} /></div>}</section>
    </>}
    {!loading && data?.status === "unavailable" && data.selected_count > 0 && <p className="rounded-2xl border border-border p-6 text-sm text-muted">{data.message}</p>}
    {active.length > 0 && <section className="mt-10"><div className="mb-4"><h2 className="font-serif text-2xl">Something you still want to move.</h2><p className="mt-2 text-xs leading-relaxed text-muted">Only the plans and wishes that are still in view. One next step is enough.</p></div><div className="grid gap-4 md:grid-cols-2">{active.slice(0, 2).map(item => <IntentionCard key={`${item.anchor_id}:${item.state?.updated_at || ""}`} intention={item} />)}</div>{active.length > 2 && <details className="mt-4 rounded-2xl border border-border p-5"><summary className="cursor-pointer text-xs text-muted">Other wishes and plans ({active.length - 2})</summary><div className="mt-5 grid gap-4 md:grid-cols-2">{active.slice(2).map(item => <IntentionCard key={item.anchor_id} intention={item} compact />)}</div></details>}</section>}
    {historical.length > 0 && <details className="mt-8 rounded-2xl border border-border p-5"><summary className="cursor-pointer text-sm text-muted">Earlier intentions · are any still relevant? ({historical.length})</summary><p className="mt-3 text-xs leading-relaxed text-muted">These come from older notes. Their outcome is unknown; they are not being treated as overdue work.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{historical.map(item => <IntentionCard key={item.anchor_id} intention={item} compact />)}</div></details>}
    {resolved.length > 0 && <details className="mt-6 rounded-2xl border border-border p-5"><summary className="cursor-pointer text-sm text-muted">Followed through, paused, or let go ({resolved.length})</summary><div className="mt-5 grid gap-4 md:grid-cols-2">{resolved.map(item => <IntentionCard key={item.anchor_id} intention={item} compact />)}</div></details>}
  </div>;
}
