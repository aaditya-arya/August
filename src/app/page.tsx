"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, Flame, Compass, ArrowRight, Quote } from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import Link from "next/link";
import { WritingComposer } from "@/components/WritingComposer";

import { groupByCategory, getClassification, type LedgerItem } from "@/lib/ledger";
import { LedgerEntry } from "@/components/LedgerEntry";

import { getRelativeTimeLabel } from "@/lib/time";

export default function LifeLedgerPage() {
  const [period, setPeriod] = useState<"7" | "30" | "all">("7");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date());
  const pendingSubmission = useRef<{ content: string; key: string; currentTime: string } | null>(null);


  const fetchLedgerData = useCallback(async (signal?: AbortSignal): Promise<LedgerItem[]> => {
    const url = period === "all" ? "/api/items" : `/api/items?days=${period}`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error("Could not load ledger entries.");
    return (await response.json()).items || [];
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLedgerData(controller.signal).then((data) => {
      if (!controller.signal.aborted) setItems(data);
    }).catch((error) => {
      if (!controller.signal.aborted) console.error("Failed to load ledger items:", error);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [fetchLedgerData]);

  const saveMoment = async (content: string) => {
    if (!pendingSubmission.current) {
      try {
        const saved = JSON.parse(localStorage.getItem("august-pending-submission") || "null");
        if (saved && typeof saved.content === "string" && typeof saved.key === "string" && typeof saved.currentTime === "string") pendingSubmission.current = saved;
      } catch {}
    }
    if (pendingSubmission.current?.content !== content) pendingSubmission.current = { content, key: crypto.randomUUID(), currentTime: new Date().toISOString() };
    const submission = pendingSubmission.current!;
    try { localStorage.setItem("august-pending-submission", JSON.stringify(submission)); } catch {}

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": submission.key },
      body: JSON.stringify({
        content,
        currentTime: submission.currentTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to save moment");
    }
    await res.json();
    window.dispatchEvent(new Event("august-ledger-changed"));
    pendingSubmission.current = null;
    try { localStorage.removeItem("august-pending-submission"); } catch {}
    await fetchLedgerData().then(setItems).catch((error) => console.error("Ledger refresh failed:", error));
  };

  // Filter items by active texture filter if set
  const filteredItems = useMemo(() => {
    if (!activeCategoryFilter) return items;
    return items.filter((i) => getClassification(i).category === activeCategoryFilter);
  }, [items, activeCategoryFilter]);

  // Rotate the resurfaced memory daily, with a stable choice during rendering.
  const forgottenMemory = useMemo(() => {
    const oldOnes = items.filter((i) => {
      const d = new Date(i.event_timestamp || i.created_at);
      return differenceInDays(today, d) >= 4;
    });
    if (oldOnes.length === 0) return null;
    return oldOnes[Math.floor(today.getTime() / 86400000) % oldOnes.length];
  }, [items, today]);

  const categories = useMemo(() => groupByCategory(items), [items]);

  const startDate = period === "7" ? subDays(today, 7) : period === "30" ? subDays(today, 30) : null;

  return (
    <div className="mx-auto max-w-[1040px] px-5 pb-24 pt-9 sm:px-8 md:pt-12 lg:px-12">
      <header className="mb-9 flex items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[.22em] text-accent">The Life Ledger</p>
          <h1 className="font-serif text-[clamp(1.9rem,3.1vw,2.65rem)] font-medium leading-tight tracking-[-.035em] text-foreground">Your life, in your words.</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">For the ordinary days, the big feelings, and everything in between.</p>
        </div>
        <span className="hidden shrink-0 pb-1 text-xs text-muted lg:block">{format(today, "EEEE, MMMM d")}</span>
      </header>

      <WritingComposer onSave={saveMoment} />

      <div id="writing-background">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[.2em] text-accent">Pages from your life</p>
            <h2 className="font-serif text-2xl font-medium text-foreground">Your recent moments</h2>
            <p className="mt-2 text-xs text-muted">{startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All your moments, together"}</p>
          </div>
          <div className="inline-flex rounded-2xl border border-rose-200/80 dark:border-rose-500/20 bg-white dark:bg-surface p-1 shadow-xs text-xs font-semibold self-start md:self-auto">
            <button
              onClick={() => { if (period !== "7") { setLoading(true); setPeriod("7"); } }}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                period === "7"
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-muted hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => { if (period !== "30") { setLoading(true); setPeriod("30"); } }}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                period === "30"
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-muted hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => { if (period !== "all") { setLoading(true); setPeriod("all"); } }}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                period === "all"
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-muted hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              All Time
            </button>
          </div>
        </header>

        {/* 4. Surfacing Forgotten Memories (Serendipitous Recall) */}
        {forgottenMemory && (
          <div className="mb-8 bg-gradient-to-r from-purple-500/10 via-rose-500/10 to-amber-500/5 border border-purple-200/80 dark:border-purple-500/20 rounded-3xl p-6 shadow-xs relative overflow-hidden">
            <Quote className="absolute right-4 top-4 text-purple-200/50 -rotate-12 pointer-events-none" size={54} />
            <div className="flex items-center justify-between mb-2 relative z-10">
              <div className="flex items-center gap-2">
                <Compass className="text-purple-600 dark:text-purple-400" size={16} />
                <span className="text-xs font-bold text-purple-900 dark:text-purple-100 uppercase tracking-wider">
                  Memory From The Past
                </span>
              </div>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/15 px-2.5 py-0.5 rounded-full">
                {getRelativeTimeLabel(forgottenMemory.event_timestamp || forgottenMemory.created_at)}
              </span>
            </div>
            <p className="font-serif italic text-zinc-800 dark:text-zinc-200 text-base md:text-lg mt-2 leading-relaxed relative z-10">
              {forgottenMemory.content}
            </p>
          </div>
        )}

        {/* 5. Texture Filters & Link to Sunday Ritual */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveCategoryFilter(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeCategoryFilter === null
                ? "bg-accent/10 text-accent border border-accent/20"
                : "bg-white dark:bg-surface text-zinc-600 dark:text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
            }`}
          >
            All ({items.length})
          </button>
          {categories.map((group) => (
            <button key={group.category} onClick={() => setActiveCategoryFilter(activeCategoryFilter === group.category ? null : group.category)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${activeCategoryFilter === group.category ? "bg-accent/10 text-accent border-accent/30" : "bg-surface text-muted border-border hover:border-accent/30"}`}>
              {group.label} ({group.items.length})
            </button>
          ))}

          <Link
            href="/digest"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-1.5 rounded-xl border border-rose-200/80 dark:border-rose-500/20 shadow-xs"
          >
            <span>Sunday Review Ritual</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* 6. BESPOKE VISUAL TREATMENTS FOR DIFFERENT ITEM TEXTURES */}
        {loading ? (
          <div className="py-24 flex justify-center items-center">
            <Loader2 className="animate-spin text-rose-500" size={36} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-rose-200/80 dark:border-rose-500/20 rounded-3xl bg-white/60 dark:bg-surface/60 p-8">
            <Flame className="mx-auto text-rose-400 mb-2" size={32} />
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Your ledger is ready</h3>
            <p className="text-zinc-500 dark:text-muted text-xs mt-1">
              Log your daily micro-moments, tasks, expenses, or lessons in the box above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => <LedgerEntry key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
}


