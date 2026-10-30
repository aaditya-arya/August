"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, 
  Calendar, 
  Flame, 
  BookOpen, 
  TrendingDown, 
  CheckCircle2, 
  Compass, 
  Coffee,
  Sparkle,
  ArrowRight,
  Quote,
  Headphones
} from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import Link from "next/link";
import { WritingComposer } from "@/components/WritingComposer";

export type LedgerItem = {
  id: string;
  category: string;
  life_texture?: string;
  content: string;
  tags?: string[];
  sentiment_or_mood?: string;
  event_timestamp: string;
  created_at: string;
  calendar_action?: {
    is_actionable: boolean;
    title?: string;
    start_time?: string;
    end_time?: string;
  } | null;
  calendar_status?: string;
  google_event_id?: string;
};

/**
 * Maps raw category or content into an authentic Life Texture
 */
export function resolveLifeTexture(item: LedgerItem): {
  key: "actionable_obligation" | "media_log" | "idea_spark" | "hard_truth" | "hard_work" | "perspective" | "quiet_moment";
  label: string;
  borderClass: string;
  bgAccent: string;
  textAccent: string;
  icon: any;
} {
  const c = (item.category || "").toLowerCase();
  const texture = (item.life_texture || "").toLowerCase();
  const content = (item.content || "").toLowerCase();
  const tags = (item.tags || []).map((t) => t.toLowerCase());
  const isActionable = Boolean(item.calendar_action?.is_actionable);

  // 1. TIME-FIRST EVALUATION: Actionable Obligations, Tasks, Reminders, and Scheduled Events
  if (
    isActionable ||
    texture === "actionable_obligation" ||
    c === "task" ||
    c === "reminder" ||
    c === "event" ||
    content.includes("call today") ||
    content.includes("call tomorrow") ||
    content.includes("appointment") ||
    content.includes("event on ") ||
    content.includes("orientation on ")
  ) {
    const isEvent = c === "event" || content.includes("event") || content.includes("orientation");
    const isReminder = c === "reminder" || content.includes("call") || content.includes("remind");
    return {
      key: "actionable_obligation",
      label: isEvent ? "Scheduled Event" : isReminder ? "Call & Reminder" : "Actionable Task",
      borderClass: "border-sky-300/80 dark:border-sky-500/35 hover:border-sky-400",
      bgAccent: "bg-sky-500",
      textAccent: "text-sky-900 dark:text-sky-100 bg-sky-100/90 dark:bg-sky-500/15 border-sky-300/60 dark:border-sky-500/35",
      icon: Calendar,
    };
  }

  // 2. Cost & Hard Truths (Trading losses, financial hits, bills, expenses, failures, tough days)
  const isFinancialOrSetback =
    texture === "hard_truth" ||
    c === "hard_truth" ||
    c.includes("truth") ||
    c === "loss" ||
    tags.includes("trading") ||
    tags.includes("finance") ||
    tags.includes("expense") ||
    tags.includes("bills") ||
    tags.includes("financial_loss") ||
    tags.includes("setback") ||
    content.includes("lost massively") ||
    content.includes("loose it all") ||
    content.includes("lost ") ||
    content.includes("worst day") ||
    content.includes("bought groceries") ||
    content.includes("paid bill") ||
    content.includes("pay the wifi bill") ||
    content.includes("wifi bill") ||
    content.includes("failed");

  if (isFinancialOrSetback) {
    return {
      key: "hard_truth",
      label: "Hard Truth & Cost",
      borderClass: "border-amber-300/80 dark:border-amber-500/35 hover:border-amber-400",
      bgAccent: "bg-amber-500",
      textAccent: "text-amber-900 dark:text-amber-100 bg-amber-100/90 dark:bg-amber-500/15 border-amber-300/60 dark:border-amber-500/35",
      icon: TrendingDown,
    };
  }

  // 3. Media Consumption (Music, cinema, anime, gaming, trailers, podcast)
  const isMedia =
    texture === "media_log" ||
    c === "media_log" ||
    c === "media" ||
    tags.includes("music") ||
    tags.includes("movies") ||
    tags.includes("gaming") ||
    tags.includes("song") ||
    tags.includes("radio") ||
    tags.includes("pop") ||
    tags.includes("bollywood") ||
    tags.includes("trailers") ||
    tags.includes("watchlist") ||
    content.includes("heard \"") ||
    content.includes("listening to") ||
    content.includes("movie trailer") ||
    content.includes("play the airbase") ||
    content.includes("walkthrough") ||
    content.includes("watched ");

  if (isMedia) {
    return {
      key: "media_log",
      label: "Media & Intake",
      borderClass: "border-indigo-400/60 hover:border-indigo-500",
      bgAccent: "bg-indigo-600",
      textAccent: "text-indigo-900 dark:text-indigo-100 bg-indigo-100/90 dark:bg-indigo-500/15 border-indigo-300/60 dark:border-indigo-500/35",
      icon: Headphones,
    };
  }

  // 4. Ideas, Wishlists & Desires (Timeless desires, things to buy/read/try, uncompleted goals)
  const isIdeaOrWishlist =
    texture === "idea_spark" ||
    c === "idea_desire" ||
    c === "idea" ||
    c === "wishlist" ||
    tags.includes("wishlist") ||
    tags.includes("shopping") ||
    content.startsWith("want to") ||
    content.startsWith("wish i") ||
    content.startsWith("idea for") ||
    content.startsWith("thinking of") ||
    content.startsWith("should add") ||
    content.startsWith("need to buy") ||
    content.startsWith("need to get") ||
    content.startsWith("need to call") ||
    content.startsWith("need to write") ||
    content.startsWith("need to renew");

  if (isIdeaOrWishlist) {
    return {
      key: "idea_spark",
      label: "Idea & Wishlist",
      borderClass: "border-violet-300/80 dark:border-violet-500/35 hover:border-violet-400",
      bgAccent: "bg-violet-500",
      textAccent: "text-violet-900 dark:text-violet-100 bg-violet-100/90 dark:bg-violet-500/15 border-violet-300/60 dark:border-violet-500/35",
      icon: Sparkle,
    };
  }

  // 5. Perspectives & Reflections (Books, wisdom, philosophy, lessons)
  const isPerspective =
    texture === "perspective" ||
    c === "perspective" ||
    c === "perspective_lesson" ||
    c === "learning" ||
    tags.includes("philosophy") ||
    tags.includes("wisdom") ||
    tags.includes("self-improvement") ||
    content.includes("reading \"deep work\"");

  if (isPerspective) {
    return {
      key: "perspective",
      label: "Perspective & Insight",
      borderClass: "border-rose-300/80 dark:border-rose-500/35 hover:border-rose-400",
      bgAccent: "bg-rose-500",
      textAccent: "text-rose-900 dark:text-rose-100 bg-rose-100/90 dark:bg-rose-500/15 border-rose-300/60 dark:border-rose-500/35",
      icon: BookOpen,
    };
  }

  // 6. Hard Work & Real Milestones (ONLY genuine completed past achievements)
  const isCompletedMilestone =
    texture === "hard_work" ||
    c === "milestone_hardwork" ||
    c === "hard_work" ||
    c === "milestone" ||
    (c === "done" && (
      content.includes("finished") ||
      content.includes("wrapped up") ||
      content.includes("cleared") ||
      content.includes("submitted") ||
      content.includes("shipped") ||
      content.includes("completed")
    ));

  if (isCompletedMilestone) {
    return {
      key: "hard_work",
      label: "Milestone & Achievement",
      borderClass: "border-emerald-300/80 dark:border-emerald-500/35 hover:border-emerald-400",
      bgAccent: "bg-emerald-500",
      textAccent: "text-emerald-900 dark:text-emerald-100 bg-emerald-100/90 dark:bg-emerald-500/15 border-emerald-300/60 dark:border-emerald-500/35",
      icon: CheckCircle2,
    };
  }

  // 7. Quiet Moments (Default fallback for reflections, poems, micro-moments)
  return {
    key: "quiet_moment",
    label: "Quiet Moment",
    borderClass: "border-purple-300/80 dark:border-purple-500/35 hover:border-purple-400",
    bgAccent: "bg-purple-500",
    textAccent: "text-purple-900 dark:text-purple-100 bg-purple-100/90 dark:bg-purple-500/15 border-purple-300/60 dark:border-purple-500/35",
    icon: Coffee,
  };
}

/**
 * Calculates human-friendly relative time
 */
export function getRelativeTimeLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (isNaN(d.getTime())) return "Recently";

    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "Just now";

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffDays === 0) {
      if (diffHours === 0) {
        if (diffMinutes < 5) return "Just now";
        return `${diffMinutes}m ago`;
      }
      return `Today (${diffHours}h ago)`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
    return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  } catch {
    return "Recently";
  }
}

export default function LifeLedgerPage() {
  const [period, setPeriod] = useState<"7" | "30" | "all">("7");
  const [activeTextureFilter, setActiveTextureFilter] = useState<string | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);


  // Track progress through the current half of the year.
  const horizonStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    // Cycle 1: Jan 1 - Jun 30, Cycle 2: Jul 1 - Dec 31
    const cycleStart = new Date(now.getFullYear(), currentMonth < 6 ? 0 : 6, 1);
    const cycleEnd = new Date(now.getFullYear(), currentMonth < 6 ? 5 : 11, currentMonth < 6 ? 30 : 31);
    const totalDays = differenceInDays(cycleEnd, cycleStart) + 1;
    const daysElapsed = Math.min(totalDays, Math.max(1, differenceInDays(now, cycleStart) + 1));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const percent = Math.round((daysElapsed / totalDays) * 100);
    const cycleLabel = currentMonth < 6 ? `H1 ${now.getFullYear()} (Jan – Jun)` : `H2 ${now.getFullYear()} (Jul – Dec)`;
    return { daysElapsed, totalDays, daysRemaining, percent, cycleLabel };
  }, []);

  const loadLedgerData = async () => {
    try {
      setLoading(true);
      const url = period === "all" ? "/api/items" : `/api/items?days=${period}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load ledger items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, [period]);

  const saveMoment = async (content: string) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        currentTime: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      }),
    });
    if (!res.ok) throw new Error("Failed to save moment");
    await res.json();
    await loadLedgerData();
  };

  // Filter items by active texture filter if set
  const filteredItems = useMemo(() => {
    if (!activeTextureFilter) return items;
    return items.filter((i) => resolveLifeTexture(i).key === activeTextureFilter);
  }, [items, activeTextureFilter]);

  // Pick a random past memory from > 5 days ago
  const forgottenMemory = useMemo(() => {
    const oldOnes = items.filter((i) => {
      const d = new Date(i.event_timestamp || i.created_at);
      return differenceInDays(new Date(), d) >= 4;
    });
    if (oldOnes.length === 0) return null;
    return oldOnes[Math.floor(Math.random() * oldOnes.length)];
  }, [items]);

  const countByTexture = useMemo(() => {
    const counts: Record<string, number> = {
      actionable_obligation: 0,
      media_log: 0,
      idea_spark: 0,
      hard_work: 0,
      quiet_moment: 0,
      hard_truth: 0,
      perspective: 0,
    };
    items.forEach((i) => {
      const t = resolveLifeTexture(i).key;
      if (counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [items]);

  const today = new Date();
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
        <section aria-label="Your six-month horizon" className="horizon-card mb-12 rounded-2xl border border-border px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.18em] text-muted">The 6-month horizon · {horizonStats.cycleLabel}</p>
              <p className="mt-2 font-serif text-lg text-foreground">Day {horizonStats.daysElapsed}<span className="ml-1 text-sm text-muted">of {horizonStats.totalDays}</span></p>
            </div>
            <p className="max-w-[260px] font-serif text-sm italic leading-relaxed text-muted">There’s still room for a story worth remembering.</p>
            <span className="rounded-full border border-accent/15 bg-accent/5 px-3 py-1.5 text-xs text-accent">{horizonStats.daysRemaining} days ahead</span>
          </div>
          <div role="progressbar" aria-label="Six-month cycle elapsed" aria-valuenow={horizonStats.percent} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-1 overflow-hidden rounded-full bg-accent/10">
            <div className="h-full rounded-full bg-accent/60" style={{ width: `${horizonStats.percent}%` }} />
          </div>
        </section>

        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[.2em] text-accent">Pages from your life</p>
            <h2 className="font-serif text-2xl font-medium text-foreground">Your recent moments</h2>
            <p className="mt-2 text-xs text-muted">{startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All your moments, together"}</p>
          </div>
          <div className="inline-flex rounded-2xl border border-rose-200/80 dark:border-rose-500/20 bg-white dark:bg-surface p-1 shadow-xs text-xs font-semibold self-start md:self-auto">
            <button
              onClick={() => setPeriod("7")}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                period === "7"
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-muted hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod("30")}
              className={`px-3.5 py-1.5 rounded-xl transition-all ${
                period === "30"
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                  : "text-zinc-600 dark:text-muted hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setPeriod("all")}
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
            onClick={() => setActiveTextureFilter(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTextureFilter === null
                ? "bg-accent/10 text-accent border border-accent/20"
                : "bg-white dark:bg-surface text-zinc-600 dark:text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800"
            }`}
          >
            All ({items.length})
          </button>
          {countByTexture.actionable_obligation > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "actionable_obligation" ? null : "actionable_obligation")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "actionable_obligation"
                  ? "bg-sky-600 text-white"
                  : "bg-white dark:bg-surface text-sky-800 dark:text-sky-200 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20"
              }`}
            >
              📅 Tasks & Events ({countByTexture.actionable_obligation})
            </button>
          )}
          {countByTexture.media_log > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "media_log" ? null : "media_log")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "media_log"
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-surface text-indigo-800 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20"
              }`}
            >
              🎧 Media & Intake ({countByTexture.media_log})
            </button>
          )}
          {countByTexture.idea_spark > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "idea_spark" ? null : "idea_spark")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "idea_spark"
                  ? "bg-violet-600 text-white"
                  : "bg-white dark:bg-surface text-violet-800 dark:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20"
              }`}
            >
              ✨ Ideas & Wishlist ({countByTexture.idea_spark})
            </button>
          )}
          {countByTexture.quiet_moment > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "quiet_moment" ? null : "quiet_moment")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "quiet_moment"
                  ? "bg-purple-600 text-white"
                  : "bg-white dark:bg-surface text-purple-800 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20"
              }`}
            >
              🍃 Quiet Moments ({countByTexture.quiet_moment})
            </button>
          )}
          {countByTexture.hard_truth > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "hard_truth" ? null : "hard_truth")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "hard_truth"
                  ? "bg-amber-600 text-white"
                  : "bg-white dark:bg-surface text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
              }`}
            >
              ⚖️ Costs & Truths ({countByTexture.hard_truth})
            </button>
          )}
          {countByTexture.hard_work > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "hard_work" ? null : "hard_work")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "hard_work"
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-surface text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"
              }`}
            >
              🔨 Milestones ({countByTexture.hard_work})
            </button>
          )}
          {countByTexture.perspective > 0 && (
            <button
              onClick={() => setActiveTextureFilter(activeTextureFilter === "perspective" ? null : "perspective")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTextureFilter === "perspective"
                  ? "bg-rose-600 text-white"
                  : "bg-white dark:bg-surface text-rose-800 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20"
              }`}
            >
              🧠 Perspectives ({countByTexture.perspective})
            </button>
          )}

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
            {filteredItems.map((item) => {
              const texture = resolveLifeTexture(item);

              // TREATMENT 0: ACTIONABLE OBLIGATIONS (Tasks, Calls, Reminders, Calendar Events)
              if (texture.key === "actionable_obligation") {
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-surface border-l-4 border-l-sky-500 border border-sky-100 dark:border-sky-500/20 p-5 md:p-6 rounded-2xl flex flex-col gap-2 shadow-[0_2px_12px_rgba(14,165,233,0.05)] hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-500/20 flex items-center gap-1.5">
                        <Calendar size={12} className="text-sky-600 dark:text-sky-400" /> {texture.label}
                      </span>
                      <span className="text-xs font-sans font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 px-2.5 py-0.5 rounded-md border border-sky-100 dark:border-sky-500/20">
                        {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                    </div>
                    <p className="entry-copy text-foreground">
                      {item.content}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.tags?.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium px-2 py-0.5 rounded-md border border-sky-200/50 dark:border-sky-500/20"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      {item.calendar_action && item.calendar_action.is_actionable && (
                        <a
                          href={generateGoogleCalendarUrl(item.calendar_action, item.content)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 px-3.5 py-1.5 rounded-xl shadow-xs transition-all"
                        >
                          <Calendar size={12} />
                          Add to Google Calendar
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              // TREATMENT: MEDIA LOG (Songs, movies, trailers, gaming, media consumption)
              if (texture.key === "media_log") {
                return (
                  <div
                    key={item.id}
                    className="p-5 md:p-6 rounded-2xl media-card text-indigo-950 dark:text-indigo-100 border border-indigo-500/25 shadow-md hover:border-indigo-400/50 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-indigo-500/20">
                      <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-md border border-indigo-400/30 flex items-center gap-1.5">
                        <Headphones size={12} className="text-indigo-600 dark:text-indigo-400" /> Media & Intake
                      </span>
                      <span className="text-xs text-indigo-700/80 dark:text-indigo-300/80 font-sans">
                        {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                    </div>
                    <p className="entry-copy text-indigo-950 dark:text-indigo-100 mb-3">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-indigo-500/15">
                        {item.tags.map((t) => (
                          <span key={t} className="text-[10px] font-sans bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // TREATMENT: IDEA & DESIRE (Wishlists, uncompleted intentions, creative concepts)
              if (texture.key === "idea_spark") {
                return (
                  <div
                    key={item.id}
                    className="p-6 rounded-2xl bg-gradient-to-br from-violet-50/80 dark:from-violet-950/40 via-white dark:via-surface to-pink-50/40 dark:to-pink-950/40 border border-violet-200/80 dark:border-violet-500/20 shadow-xs hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-500/20 flex items-center gap-1.5">
                        <Sparkle size={12} className="text-violet-600 dark:text-violet-400" /> Idea & Wishlist
                      </span>
                      <span className="text-xs text-muted font-medium">
                        {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                    </div>
                    <p className="entry-copy text-violet-950 dark:text-violet-100">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.tags.map((t) => (
                          <span key={t} className="text-[11px] bg-violet-100/60 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // TREATMENT 1: QUIET MOMENT (Spacious, isolated, elegant serif typography)
              if (texture.key === "quiet_moment") {
                return (
                  <div
                    key={item.id}
                    className="relative p-6 md:p-7 rounded-3xl bg-gradient-to-br from-purple-50/80 dark:from-purple-950/40 via-white dark:via-surface to-pink-50/40 dark:to-pink-950/40 border border-purple-200/80 dark:border-purple-500/20 shadow-[0_4px_16px_rgba(168,85,247,0.06)] hover:shadow-[0_6px_22px_rgba(168,85,247,0.12)] transition-all group overflow-hidden"
                  >
                    <Quote className="absolute top-4 right-4 text-purple-200/50 group-hover:text-purple-300/70 transition-colors pointer-events-none" size={36} />
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-500/20 flex items-center gap-1.5">
                        <Coffee size={12} /> Quiet Moment
                      </span>
                      <span className="text-xs text-muted font-medium">
                        {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                    </div>
                    <p className="entry-copy italic text-purple-950 dark:text-purple-100">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {item.tags.map((t) => (
                          <span key={t} className="text-[11px] bg-purple-100/60 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // TREATMENT 2: HARD TRUTH & COST (Stark, grounded, solemn stone aesthetic)
              if (texture.key === "hard_truth") {
                return (
                  <div
                    key={item.id}
                    className="p-5 md:p-6 rounded-2xl cost-card text-foreground border border-border shadow-md hover:border-amber-500/40 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                      <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1.5">
                        <TrendingDown size={12} /> Hard Truth & Cost
                      </span>
                      <span className="text-xs text-muted font-sans">
                        {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                    </div>
                    <p className="entry-copy text-foreground mb-3">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                        {item.tags.map((t) => (
                          <span key={t} className="text-[10px] font-sans bg-accent/5 text-muted px-2 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // TREATMENT 3: PERSPECTIVE & INSIGHT (Literary bookplate aesthetic)
              if (texture.key === "perspective") {
                return (
                  <div
                    key={item.id}
                    className="p-6 rounded-2xl bg-gradient-to-br from-rose-50/70 dark:from-rose-950/40 via-white dark:via-surface to-pink-50/50 dark:to-pink-950/40 border border-rose-200/80 dark:border-rose-500/20 shadow-xs hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-500/20 flex items-center gap-1.5">
                        <BookOpen size={12} /> Perspective & Lesson
                      </span>
                      <span className="text-xs text-muted font-medium">
                        {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                    </div>
                    <p className="entry-copy text-foreground">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.tags.map((t) => (
                          <span key={t} className="text-[11px] bg-rose-100/60 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // TREATMENT 4: HARD WORK & MILESTONES (Crisp, momentum-driven)
              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-surface border-l-4 border-l-emerald-500 border border-emerald-100/80 dark:border-emerald-500/20 p-5 rounded-2xl flex flex-col gap-2 shadow-[0_2px_12px_rgba(16,185,129,0.04)] hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" /> Milestone
                    </span>
                    <span className="text-xs text-muted font-medium">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                  <p className="entry-copy text-foreground">
                    {item.content}
                  </p>

                  {/* Tags & Actionable Google Calendar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-1 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.tags?.map((t) => (
                        <span
                          key={t}
                          className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-muted font-medium px-2 py-0.5 rounded-md border border-zinc-200/60"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>

                    {item.calendar_action && item.calendar_action.is_actionable && (
                      <a
                        href={generateGoogleCalendarUrl(item.calendar_action, item.content)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 px-3 py-1 rounded-lg shadow-xs transition-all"
                      >
                        <Calendar size={12} />
                        Add to Google Calendar
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


