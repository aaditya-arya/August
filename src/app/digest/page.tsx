"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, RefreshCw, MoveUpRight, Sun, Sprout, Repeat2, Clock3, Loader2 } from "lucide-react";
import type { ReviewResponse } from "@/lib/review";
import { ReviewInsight } from "@/components/ReviewInsight";
import { IntentionCard } from "@/components/IntentionPlan";
import { ReviewReflection } from "@/components/ReviewReflection";
import { canonicalCategory } from "@/lib/ledger";
import { inReviewPeriod } from "@/lib/review";
import { refreshIntentions, useIntentions } from "@/lib/use-intentions";

type Period = "7" | "30" | "all";

export default function SundayReviewPage() {
  const live = useIntentions();
  const [period, setPeriod] = useState<Period>("7");
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/digest/synthesis?days=${period}&timezone=${encodeURIComponent(zone)}${revision ? "&refresh=1" : ""}`, { signal: controller.signal })
      .then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error || "Could not prepare your review."); return value as ReviewResponse; })
      .then((value) => { if (!controller.signal.aborted) { setData(value); setError(null); void refreshIntentions(); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not prepare your review."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, revision]);

  useEffect(() => {
    const changed = () => { setLoading(true); setRevision((value) => value + 1); };
    window.addEventListener("august-intentions-changed", changed);
    return () => window.removeEventListener("august-intentions-changed", changed);
  }, []);

  function refresh() { setLoading(true); setError(null); setRevision((value) => value + 1); }
  function choose(value: Period) { if (value !== period) { setLoading(true); setData(null); setError(null); setPeriod(value); } }
  const review = data?.review;
  const finishes = data?.entries.filter((entry) => inReviewPeriod(entry, data.period) && (canonicalCategory(entry.category) === "Milestone_HardWork" || entry.review_state?.status === "completed")).length || 0;
  const active = (live.loading ? data?.intentions || [] : live.intentions).filter((item) => !["completed", "released", "paused"].includes(item.status));
  const resolved = (live.loading ? data?.intentions || [] : live.intentions).filter((item) => ["completed", "released", "paused"].includes(item.status));
  const range = data ? `${data.period.start ? new Date(data.period.start).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "The beginning"} to ${new Date(data.period.end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "A little distance. A clearer view.";
  return <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-8 lg:px-12">
    <header className="mb-10 border-b border-border pb-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted"><ArrowLeft size={12} />Back to your ledger</Link>
      <div className="mt-7 flex flex-wrap items-end justify-between gap-6"><div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-accent">Your Sunday Review</p><h1 className="mt-3 font-serif text-[clamp(2rem,4vw,3.2rem)] font-medium leading-tight tracking-[-.045em]">What moved. What mattered.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">The effort you made, the life you experienced, and what you want to do with what comes next.</p></div><div className="flex items-center gap-2"><div className="inline-flex rounded-xl border border-border bg-surface p-1">{([["7", "This week"], ["30", "30 days"], ["all", "The bigger picture"]] as const).map(([value, label]) => <button key={value} onClick={() => choose(value)} aria-pressed={period === value} className={`rounded-lg px-3 py-2 text-[11px] font-medium ${period === value ? "bg-accent/10 text-accent" : "text-muted"}`}>{label}</button>)}</div><button onClick={refresh} disabled={loading} aria-label="Refresh your review" className="rounded-xl border border-border p-2.5 text-muted disabled:opacity-40"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button></div></div>
      <p className="mt-5 text-[11px] text-muted">{range}{data ? ` | ${data.selected_count} ${data.selected_count === 1 ? "entry" : "entries"} in view, with earlier moments for context` : ""}</p>
    </header>

    {loading && <div role="status" className="mb-9 rounded-2xl border border-border bg-surface p-7"><div className="flex items-center gap-3"><Loader2 size={17} className="animate-spin text-accent" /><p className="text-sm text-foreground">Looking for movement and meaning across your moments...</p></div><p className="mt-2 pl-7 text-xs text-muted">An older wish can connect to something you did later. Good experiences have room of their own.</p></div>}
    {error && <div role="alert" className="mb-8 rounded-2xl border border-amber-500/20 p-6"><p className="text-sm">{error}</p><button onClick={refresh} className="mt-3 text-xs font-semibold text-accent">Try again</button></div>}
    {!loading && data?.context_count === 0 && <div className="rounded-3xl border border-border bg-surface p-10 text-center"><Sun size={26} className="mx-auto text-accent" /><h2 className="mt-5 font-serif text-2xl">A review grows out of a life recorded.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">Start with something you did, something you felt, or something you still want. It does not have to be an achievement.</p><Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">Write a moment<ArrowUpRight size={14} /></Link></div>}

    {review && <div className="space-y-12">
      <p className="max-w-3xl font-serif text-lg sm:text-xl leading-[1.8] tracking-[-.015em] text-foreground">{review.opening}</p>
      {review.progress.length > 0 && <section><div className="mb-6 flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.04] px-5 py-4"><span className="font-serif text-4xl text-emerald-700 dark:text-emerald-300">{finishes || review.progress.length}</span><div><p className="text-sm font-medium">{finishes === 1 ? "A concrete finish" : "Concrete finishes"} recorded.</p><p className="mt-1 text-xs text-muted">Let that register before you look at what comes next.</p></div></div><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><MoveUpRight size={17} /></span><div><h2 className="font-serif text-2xl tracking-[-.025em]">You moved something forward.</h2><p className="mt-1 text-xs text-muted">Real effort and follow-through. These deserve to register.</p></div></div><div className="grid gap-4 md:grid-cols-2">{review.progress.map((insight, index) => <ReviewInsight key={index} insight={insight} entries={data!.entries} tone="progress" />)}</div></section>}
      {review.experiences.length > 0 && <section><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><Sun size={17} /></span><div><h2 className="font-serif text-2xl tracking-[-.025em]">This was life, too.</h2><p className="mt-1 text-xs text-muted">What you enjoyed, noticed, and might want to remember.</p></div></div><div className="grid gap-4 md:grid-cols-2">{review.experiences.map((insight, index) => <ReviewInsight key={index} insight={insight} entries={data!.entries} tone="experience" />)}</div></section>}
      {review.lessons.length > 0 && <section><div className="mb-5 flex items-center gap-3"><Sprout size={20} className="text-accent" /><div><h2 className="font-serif text-2xl tracking-[-.025em]">What you can take from it.</h2><p className="mt-1 text-xs text-muted">Lessons and honest questions. A setback does not erase earlier progress.</p></div></div><div className="grid gap-4 md:grid-cols-2">{review.lessons.map((insight, index) => <ReviewInsight key={index} insight={insight} entries={data!.entries} />)}</div></section>}
      {review.patterns.length > 0 && <section><div className="mb-5 flex items-center gap-3"><Repeat2 size={20} className="text-accent" /><div><h2 className="font-serif text-2xl tracking-[-.025em]">The thread between the moments.</h2><p className="mt-1 text-xs text-muted">Connections that become visible with a little distance.</p></div></div><div className="grid gap-4 md:grid-cols-2">{review.patterns.map((insight, index) => <ReviewInsight key={index} insight={insight} entries={data!.entries} />)}</div></section>}
    </div>}

    {!loading && data?.status === "unavailable" && data.context_count > 0 && <div className="mb-8 rounded-2xl border border-border bg-surface p-6"><p className="text-sm text-muted">{data.message}</p><button onClick={refresh} className="mt-3 text-xs font-semibold text-accent">Try preparing the reflection again</button></div>}
    {data?.message && data.status === "ready" && <p className="mt-5 text-xs text-muted">{data.message}</p>}

    {active.length > 0 && <section className="mt-12"><div className="mb-5 flex items-center gap-3"><Clock3 size={20} className="text-accent" /><div><h2 className="font-serif text-2xl tracking-[-.025em]">What still matters enough to choose.</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">A wish can become a plan, stay a wish, or be something you let go. Older intentions stay here even when you did not write about them this week.</p></div></div><div className="grid gap-4 md:grid-cols-2">{active.slice(0, 3).map((intention) => <IntentionCard key={`${intention.anchor_id}:${intention.state?.updated_at || ""}`} intention={intention} />)}</div></section>}
    {active.length > 3 && <details className="mt-5 rounded-2xl border border-border p-5"><summary className="cursor-pointer text-sm font-medium text-muted">The rest can wait here ({active.length - 3})</summary><p className="mt-3 text-xs leading-relaxed text-muted">You do not have to turn every interest into a project. These wishes can simply stay available.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{active.slice(3).map((intention) => <IntentionCard key={`${intention.anchor_id}:${intention.state?.updated_at || ""}`} intention={intention} compact />)}</div></details>}
    {resolved.length > 0 && <details className="mt-8 rounded-2xl border border-border p-5"><summary className="cursor-pointer text-sm font-medium text-muted">The things you followed through on, paused, or let go ({resolved.length})</summary><div className="mt-5 grid gap-4 md:grid-cols-2">{resolved.map((intention) => <IntentionCard key={`${intention.anchor_id}:${intention.state?.updated_at || ""}`} intention={intention} compact />)}</div></details>}
    {review?.next_step && <section className="mt-12 border-y border-border py-8"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-accent">One thing for the week ahead</p><h2 className="mt-3 font-serif text-2xl leading-relaxed">{review.next_step.title}</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{review.next_step.takeaway}</p></section>}
    {review && <div className="mt-12"><ReviewReflection question={review.question} onSaved={() => { setLoading(true); setRevision((value) => value + 1); }} /></div>}
  </div>;
}
