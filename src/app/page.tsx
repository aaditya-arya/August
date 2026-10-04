"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Calendar, 
  Flame, 
  Hourglass, 
  BookOpen, 
  Clock, 
  TrendingDown, 
  CheckCircle2, 
  Compass, 
  Coffee,
  Sparkle,
  ArrowRight,
  Quote
} from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import Link from "next/link";

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
  key: "hard_work" | "quiet_moment" | "hard_truth" | "perspective" | "idea_spark";
  label: string;
  borderClass: string;
  bgAccent: string;
  textAccent: string;
  icon: any;
} {
  const c = (item.category || "").toLowerCase();
  const text = (item.content || "").toLowerCase();
  const texture = (item.life_texture || "").toLowerCase();

  // 1. Cost & Hard Truths (Financial hits, losses, grocery expenses, tough emotional days)
  if (
    texture === "hard_truth" ||
    c === "hard_truth" ||
    text.includes("loss") ||
    text.includes("lost") ||
    text.includes("worst day") ||
    text.includes("spent") ||
    text.includes("expense") ||
    text.includes("bought groceries") ||
    text.includes("rupees") ||
    text.includes("bill")
  ) {
    return {
      key: "hard_truth",
      label: "Hard Truth & Cost",
      borderClass: "border-amber-300/80 hover:border-amber-400",
      bgAccent: "bg-amber-500",
      textAccent: "text-amber-900 bg-amber-100/90 border-amber-300/60",
      icon: TrendingDown,
    };
  }

  // 2. Perspectives & Reflections (Books, wisdom, philosophy, lessons)
  if (
    texture === "perspective" ||
    c === "perspective" ||
    c === "learning" ||
    text.includes("reading") ||
    text.includes("book") ||
    text.includes("realized") ||
    text.includes("learned") ||
    text.includes("lesson")
  ) {
    return {
      key: "perspective",
      label: "Perspective & Insight",
      borderClass: "border-rose-300/80 hover:border-rose-400",
      bgAccent: "bg-rose-500",
      textAccent: "text-rose-900 bg-rose-100/90 border-rose-300/60",
      icon: BookOpen,
    };
  }

  // 3. Quiet Moments (Conversations, walks, small joys, music, poetry, serendipity)
  if (
    texture === "quiet_moment" ||
    c === "quiet_moment" ||
    c === "media" ||
    c === "shaairi_quote" ||
    text.includes("walk") ||
    text.includes("song") ||
    text.includes("met") ||
    text.includes("conversation") ||
    text.includes("quiet") ||
    text.includes("coffee")
  ) {
    return {
      key: "quiet_moment",
      label: "Quiet Moment",
      borderClass: "border-purple-300/80 hover:border-purple-400",
      bgAccent: "bg-purple-500",
      textAccent: "text-purple-900 bg-purple-100/90 border-purple-300/60",
      icon: Coffee,
    };
  }

  // 4. Ideas & Sparks
  if (texture === "idea_spark" || c === "idea" || c === "wishlist" || c === "idea_desire") {
    return {
      key: "idea_spark",
      label: "Idea & Desire",
      borderClass: "border-blue-300/80 hover:border-blue-400",
      bgAccent: "bg-blue-500",
      textAccent: "text-blue-900 bg-blue-100/90 border-blue-300/60",
      icon: Sparkle,
    };
  }

  // 5. Default: Hard Work & Milestones
  return {
    key: "hard_work",
    label: "Milestone & Hard Work",
    borderClass: "border-emerald-300/80 hover:border-emerald-400",
    bgAccent: "bg-emerald-500",
    textAccent: "text-emerald-900 bg-emerald-100/90 border-emerald-300/60",
    icon: CheckCircle2,
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

  // Quick Input state
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justLoggedMessage, setJustLoggedMessage] = useState<string | null>(null);

  // 6-Month Horizon Calculation: Imposing & Visceral
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

  const handleQuickDump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    const raw = content.trim();
    setContent("");
    setIsSubmitting(true);
    setJustLoggedMessage(null);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: raw,
          currentTime: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      if (!res.ok) throw new Error("Failed to log entry");
      const data = await res.json();
      setJustLoggedMessage(`Captured to your Life Ledger!`);
      await loadLedgerData();
    } catch (error) {
      console.error("Failed to capture:", error);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setJustLoggedMessage(null), 4000);
    }
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
    <div className="max-w-4xl mx-auto p-6 md:p-10 pt-10 md:pt-14 pb-24">
      {/* 1. VISCERAL 6-MONTH HORIZON COUNTDOWN
          Designed to make the user feel the authentic weight of time passing */}
      <section className="mb-12 relative overflow-hidden rounded-3xl bg-[#12131a] text-zinc-100 p-7 md:p-9 shadow-2xl border border-white/10">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-rose-500/15 via-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Hourglass size={14} className="animate-pulse" />
              </div>
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-zinc-400">
                The 6-Month Horizon • {horizonStats.cycleLabel}
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
              {horizonStats.daysRemaining} days remaining
            </span>
          </div>

          {/* Imposing Bold Typography */}
          <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 mb-5">
            <div>
              <div className="text-4xl md:text-6xl font-extrabold tracking-tight font-sans text-white">
                Day {horizonStats.daysElapsed}
                <span className="text-zinc-500 font-light text-2xl md:text-3xl ml-2">
                  / {horizonStats.totalDays}
                </span>
              </div>
              <p className="text-sm font-medium text-rose-300/90 mt-1">
                {horizonStats.percent}% of this 6-month cycle has slipped into memory.
              </p>
            </div>

            {/* Existential Reflection Prompt */}
            <div className="max-w-xs md:text-right">
              <p className="text-xs font-serif italic text-zinc-400 leading-relaxed">
                "Time is the only non-renewable asset. How much of this week went to things that will matter in five years?"
              </p>
            </div>
          </div>

          {/* Heavy Visceral Progress Meter */}
          <div className="w-full bg-white/10 rounded-full h-3 p-0.5 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(244,63,94,0.6)]"
              style={{ width: `${horizonStats.percent}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. Header & Time Period Filters */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-zinc-900 tracking-tight flex items-center gap-3">
            The Life Ledger <Sparkles className="text-rose-500" size={26} />
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All Moments & Events"} • An unfiltered mirror of your life being lived.
          </p>
        </div>

        {/* Time Filter Selector */}
        <div className="inline-flex rounded-2xl border border-rose-200/80 bg-white p-1 shadow-xs text-xs font-semibold self-start md:self-auto">
          <button
            onClick={() => setPeriod("7")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              period === "7"
                ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod("30")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              period === "30"
                ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              period === "all"
                ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      {/* 3. Fast, Tactile Input Box: "What happened today worth remembering?" */}
      <div className="mb-10">
        <form
          onSubmit={handleQuickDump}
          className="relative bg-white border border-rose-200/80 rounded-3xl p-6 shadow-[0_10px_30px_rgba(244,114,182,0.08)] focus-within:ring-4 focus-within:ring-rose-100 transition-all"
        >
          <label className="block text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">
            What happened today worth remembering?
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Log a win, a hard day, an expense, a quiet conversation, or a lesson (e.g. 'Met a new friend for coffee', 'Lost 1.5k trading today', 'Shipped the auth refactor')..."
            className="w-full bg-rose-50/20 text-zinc-900 border border-rose-100 rounded-2xl p-4 text-sm md:text-base font-normal focus:outline-none focus:bg-white transition-all resize-none min-h-[95px] placeholder:text-zinc-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleQuickDump(e);
              }
            }}
          />
          <div className="flex items-center justify-between mt-3 pt-2">
            <span className="text-[11px] text-zinc-400 font-medium">
              Press <kbd className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-700">Cmd/Ctrl + Enter</kbd> to log
            </span>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-95 shadow-md shadow-rose-500/20 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              <span>Log Moment</span>
            </button>
          </div>
        </form>

        {justLoggedMessage && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>{justLoggedMessage}</span>
          </div>
        )}
      </div>

      {/* 4. Surfacing Forgotten Memories (Serendipitous Recall) */}
      {forgottenMemory && (
        <div className="mb-8 bg-gradient-to-r from-purple-500/10 via-rose-500/10 to-amber-500/5 border border-purple-200/80 rounded-3xl p-6 shadow-xs relative overflow-hidden">
          <Quote className="absolute right-4 top-4 text-purple-200/50 -rotate-12 pointer-events-none" size={54} />
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <Compass className="text-purple-600" size={16} />
              <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                Memory From The Past
              </span>
            </div>
            <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
              {getRelativeTimeLabel(forgottenMemory.event_timestamp || forgottenMemory.created_at)}
            </span>
          </div>
          <p className="font-serif italic text-zinc-800 text-base md:text-lg mt-2 leading-relaxed relative z-10">
            "{forgottenMemory.content}"
          </p>
        </div>
      )}

      {/* 5. Texture Filters & Link to Sunday Ritual */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTextureFilter(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === null
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setActiveTextureFilter(activeTextureFilter === "quiet_moment" ? null : "quiet_moment")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === "quiet_moment"
              ? "bg-purple-600 text-white"
              : "bg-white text-purple-800 hover:bg-purple-50 border border-purple-200"
          }`}
        >
          🍃 Quiet Moments ({countByTexture.quiet_moment})
        </button>
        <button
          onClick={() => setActiveTextureFilter(activeTextureFilter === "hard_truth" ? null : "hard_truth")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === "hard_truth"
              ? "bg-amber-600 text-white"
              : "bg-white text-amber-800 hover:bg-amber-50 border border-amber-200"
          }`}
        >
          ⚖️ Costs & Truths ({countByTexture.hard_truth})
        </button>
        <button
          onClick={() => setActiveTextureFilter(activeTextureFilter === "hard_work" ? null : "hard_work")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === "hard_work"
              ? "bg-emerald-600 text-white"
              : "bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200"
          }`}
        >
          🔨 Hard Work ({countByTexture.hard_work})
        </button>
        <button
          onClick={() => setActiveTextureFilter(activeTextureFilter === "perspective" ? null : "perspective")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === "perspective"
              ? "bg-rose-600 text-white"
              : "bg-white text-rose-800 hover:bg-rose-50 border border-rose-200"
          }`}
        >
          🧠 Perspectives ({countByTexture.perspective})
        </button>

        <Link
          href="/digest"
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3.5 py-1.5 rounded-xl border border-rose-200/80 shadow-xs"
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
        <div className="text-center py-20 border-2 border-dashed border-rose-200/80 rounded-3xl bg-white/60 p-8">
          <Flame className="mx-auto text-rose-400 mb-2" size={32} />
          <h3 className="text-base font-bold text-zinc-800">Your ledger is ready</h3>
          <p className="text-zinc-500 text-xs mt-1">
            Log your daily micro-moments, wins, expenses, or lessons in the box above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const texture = resolveLifeTexture(item);
            const Icon = texture.icon;

            // TREATMENT 1: QUIET MOMENT (Spacious, isolated, elegant serif typography)
            if (texture.key === "quiet_moment") {
              return (
                <div
                  key={item.id}
                  className="relative p-6 md:p-7 rounded-3xl bg-gradient-to-br from-purple-50/80 via-white to-pink-50/40 border border-purple-200/80 shadow-[0_4px_16px_rgba(168,85,247,0.06)] hover:shadow-[0_6px_22px_rgba(168,85,247,0.12)] transition-all group overflow-hidden"
                >
                  <Quote className="absolute top-4 right-4 text-purple-200/50 group-hover:text-purple-300/70 transition-colors pointer-events-none" size={36} />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1.5">
                      <Coffee size={12} /> Quiet Moment
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                  <p className="font-serif italic text-lg md:text-xl text-purple-950 leading-relaxed">
                    "{item.content}"
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[11px] bg-purple-100/60 text-purple-700 px-2 py-0.5 rounded-md">
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
                  className="p-5 md:p-6 rounded-2xl bg-stone-900 text-stone-100 border border-stone-800 shadow-md hover:border-amber-500/40 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-stone-800">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1.5">
                      <TrendingDown size={12} /> Hard Truth & Cost
                    </span>
                    <span className="text-xs text-stone-400 font-mono">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                  <p className="text-stone-100 font-medium text-base leading-relaxed mb-3">
                    {item.content}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-800">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[10px] font-mono bg-stone-800 text-stone-300 px-2 py-0.5 rounded">
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
                  className="p-6 rounded-2xl bg-gradient-to-br from-rose-50/70 via-white to-pink-50/50 border border-rose-200/80 shadow-xs hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1.5">
                      <BookOpen size={12} /> Perspective & Lesson
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                  <p className="font-serif text-zinc-800 text-base md:text-lg leading-relaxed">
                    "{item.content}"
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.tags.map((t) => (
                        <span key={t} className="text-[11px] bg-rose-100/60 text-rose-700 px-2 py-0.5 rounded-md">
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
                className="bg-white border-l-4 border-l-emerald-500 border border-emerald-100/80 p-5 rounded-2xl flex flex-col gap-2 shadow-[0_2px_12px_rgba(16,185,129,0.04)] hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 size={12} className="text-emerald-600" /> Milestone
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                  </span>
                </div>
                <p className="text-zinc-900 font-semibold text-[15px] leading-relaxed">
                  {item.content}
                </p>

                {/* Tags & Actionable Google Calendar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-1 pt-2 border-t border-zinc-100">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.tags?.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] bg-zinc-100 text-zinc-600 font-medium px-2 py-0.5 rounded-md border border-zinc-200/60"
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
  );
}
