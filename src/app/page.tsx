"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Loader2, BookOpen, Compass, ArrowRight, Quote, Sun } from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import Link from "next/link";
import { WritingComposer } from "@/components/WritingComposer";

import { groupByCategory, getClassification, type LedgerItem } from "@/lib/ledger";
import { LedgerEntry } from "@/components/LedgerEntry";

import { getRelativeTimeLabel } from "@/lib/time";
import styles from "./page.module.css";
import { createAugustApi } from "@august/shared";
import { useAccount } from '@/components/AuthBoundary';

const api = createAugustApi();

export default function LifeLedgerPage() {
  const account = useAccount();
  const pendingKey = `august-pending-submission:${account.id}`;
  const [period, setPeriod] = useState<"7" | "30" | "all">("7");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
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
      if (!controller.signal.aborted) { setItems(data); setLoadError(null); }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        console.error("Failed to load ledger items:", error);
        setLoadError("Your moments couldn’t be loaded. Your writing is safe; please try again.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [fetchLedgerData, retry]);

  const saveMoment = async (content: string) => {
    if (!pendingSubmission.current) {
      try {
        const saved = JSON.parse(localStorage.getItem(pendingKey) || "null");
        if (saved && typeof saved.content === "string" && typeof saved.key === "string" && typeof saved.currentTime === "string") pendingSubmission.current = saved;
      } catch {}
    }
    if (pendingSubmission.current?.content !== content) pendingSubmission.current = { content, key: crypto.randomUUID(), currentTime: new Date().toISOString() };
    const submission = pendingSubmission.current!;
    try { localStorage.setItem(pendingKey, JSON.stringify(submission)); } catch {}

    await api.saveNote({
      ...submission,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    window.dispatchEvent(new Event("august-ledger-changed"));
    pendingSubmission.current = null;
    try { if (JSON.parse(localStorage.getItem(pendingKey) || 'null')?.key === submission.key) localStorage.removeItem(pendingKey); } catch {}
    await fetchLedgerData().then((data) => { setItems(data); setLoadError(null); }).catch(() => setLoadError("Your moment was saved, but the ledger couldn’t refresh. Try loading it again."));
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
    <div className={styles.journal}>
      <header className={styles.welcome}>
        <div>
          <p className={styles.eyebrow}><span /> YOUR LIFE, IN YOUR WORDS</p>
          <h1>Make a little room<br />for <em>yourself.</em></h1>
          <p className={styles.introduction}>A thought, a feeling, a small thing worth remembering.<br className="hidden sm:block" /> Whatever today holds, there’s a place for it here.</p>
        </div>
        <div className={styles.dateCard}>
          <Sun size={23} strokeWidth={1.2} aria-hidden="true" />
          <span>{format(today, "EEEE")}</span>
          <strong>{format(today, "MMMM d")}</strong>
          <span className={styles.dateCaption}>One day. A thousand little things.</span>
        </div>
      </header>

      <WritingComposer onSave={saveMoment} />

      <div id="writing-background" className={styles.moments}>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={styles.eyebrow}>THE THINGS YOU’VE KEPT</p>
            <h2 className="font-serif text-2xl font-medium text-foreground">A life in little moments</h2>
            <p className="mt-2 text-xs text-muted">{startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All your moments, together"}</p>
          </div>
          <div className={styles.periods} role="group" aria-label="Filter moments by time">
            <button
              onClick={() => { if (period !== "7") { setLoadError(null); setLoading(true); setPeriod("7"); } }}
              aria-pressed={period === "7"}
            >
              This Week
            </button>
            <button
              onClick={() => { if (period !== "30") { setLoadError(null); setLoading(true); setPeriod("30"); } }}
              aria-pressed={period === "30"}
            >
              30 Days
            </button>
            <button
              onClick={() => { if (period !== "all") { setLoadError(null); setLoading(true); setPeriod("all"); } }}
              aria-pressed={period === "all"}
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
        {loadError ? (
          <div role="alert" className="rounded-xl border border-border bg-surface p-6 text-sm">
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoadError(null); setLoading(true); setRetry((value) => value + 1); }} className="mt-3 rounded-lg bg-accent px-4 py-2 text-white dark:text-background">Try again</button>
          </div>
        ) : loading ? (
          <div className="py-24 flex justify-center items-center">
            <Loader2 className="animate-spin text-rose-500" size={36} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className={styles.emptyMoments}>
            <BookOpen size={25} strokeWidth={1.3} aria-hidden="true" />
            <h3>{activeCategoryFilter ? "A quiet corner, for now." : "Your story starts with a small moment."}</h3>
            <p>
              {activeCategoryFilter ? "No moments in this category yet. Try another filter, or write something new." : "The words you keep will find a home here. There’s no right place to begin."}
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


