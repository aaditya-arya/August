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
  ArrowRight
} from "lucide-react";
import { format, subDays, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import Link from "next/link";

type LedgerItem = {
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
      borderClass: "border-amber-200/80 hover:border-amber-300",
      bgAccent: "bg-amber-500",
      textAccent: "text-amber-800 bg-amber-50/90 border-amber-200/60",
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
      label: "Perspective & Lesson",
      borderClass: "border-rose-200/80 hover:border-rose-300",
      bgAccent: "bg-pink-500",
      textAccent: "text-pink-800 bg-pink-50/90 border-pink-200/60",
      icon: BookOpen,
    };
  }

  // 3. Quiet Moments (Conversations, walks, small joys, music, poetry)
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
      borderClass: "border-purple-200/80 hover:border-purple-300",
      bgAccent: "bg-purple-500",
      textAccent: "text-purple-800 bg-purple-50/90 border-purple-200/60",
      icon: Coffee,
    };
  }

  // 4. Ideas & Sparks
  if (texture === "idea_spark" || c === "idea" || c === "wishlist" || c === "idea_desire") {
    return {
      key: "idea_spark",
      label: "Idea & Desire",
      borderClass: "border-blue-200/80 hover:border-blue-300",
      bgAccent: "bg-blue-500",
      textAccent: "text-blue-800 bg-blue-50/90 border-blue-200/60",
      icon: Sparkle,
    };
  }

  // 5. Default: Hard Work & Milestones
  return {
    key: "hard_work",
    label: "Milestone & Hard Work",
    borderClass: "border-emerald-200/80 hover:border-emerald-300",
    bgAccent: "bg-emerald-500",
    textAccent: "text-emerald-800 bg-emerald-50/90 border-emerald-200/60",
    icon: CheckCircle2,
  };
}

/**
 * Calculates human-friendly relative time
 */
function getRelativeTimeLabel(dateStr: string): string {
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

  // 6-Month Horizon Calculation
  const horizonStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    // Cycle 1: Jan 1 - Jun 30, Cycle 2: Jul 1 - Dec 31
    const cycleStart = new Date(now.getFullYear(), currentMonth < 6 ? 0 : 6, 1);
    const cycleEnd = new Date(now.getFullYear(), currentMonth < 6 ? 5 : 11, currentMonth < 6 ? 30 : 31);
    const totalDays = differenceInDays(cycleEnd, cycleStart) + 1;
    const daysElapsed = Math.min(totalDays, Math.max(1, differenceInDays(now, cycleStart) + 1));
    const percent = Math.round((daysElapsed / totalDays) * 100);
    const cycleLabel = currentMonth < 6 ? "H1 (Jan – Jun)" : "H2 (Jul – Dec)";
    return { daysElapsed, totalDays, percent, cycleLabel };
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

  // Pick a random past memory from > 7 days ago
  const forgottenMemory = useMemo(() => {
    const oldOnes = items.filter((i) => {
      const d = new Date(i.event_timestamp || i.created_at);
      return differenceInDays(new Date(), d) >= 5;
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
    <div className="max-w-4xl mx-auto p-6 md:p-8 pt-10 md:pt-12">
      {/* 6-Month Horizon Progress Bar (The Urgency & Perspective Engine) */}
      <div className="mb-8 p-5 bg-white/90 backdrop-blur-md border border-pink-200/70 rounded-3xl shadow-[0_4px_20px_rgba(244,114,182,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Hourglass size={16} className="text-pink-500 animate-pulse" />
            <span className="text-xs font-extrabold text-zinc-900 tracking-tight">
              6-Month Horizon ({horizonStats.cycleLabel})
            </span>
            <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200/50">
              Day {horizonStats.daysElapsed} of {horizonStats.totalDays} • {horizonStats.percent}% elapsed
            </span>
          </div>
          <span className="text-[11px] font-medium text-zinc-400 italic">
            "How much of this week was spent on things that actually matter?"
          </span>
        </div>
        {/* Progress Track */}
        <div className="w-full bg-pink-100/60 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${horizonStats.percent}%` }}
          />
        </div>
      </div>

      {/* Header & Sunday Ritual Anchor */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-3">
            The Life Ledger <Sparkles className="text-pink-500" size={28} />
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All Moments & Events"} • An unfiltered mirror of your life being lived.
          </p>
        </div>

        {/* Time Period Filter */}
        <div className="inline-flex rounded-2xl border border-pink-200/80 bg-white p-1 shadow-2xs text-xs font-bold self-start md:self-auto">
          <button
            onClick={() => setPeriod("7")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              period === "7"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod("30")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              period === "30"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-3.5 py-1.5 rounded-xl transition-all ${
              period === "all"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      {/* Unified Input Bar: "What happened today worth remembering?" */}
      <div className="mb-10">
        <form
          onSubmit={handleQuickDump}
          className="relative bg-white/95 backdrop-blur-xl border border-pink-200 rounded-3xl p-5 shadow-[0_10px_35px_rgba(244,114,182,0.12)] focus-within:ring-4 focus-within:ring-pink-100/70 transition-all"
        >
          <label className="block text-xs font-extrabold uppercase tracking-wider text-pink-700 mb-2">
            What happened today worth remembering?
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Log a win, a hard day, an expense, a conversation, or a lesson (e.g. 'Met Rohan for coffee', 'Lost 1.5k trading today', 'Finished the Django assignment')..."
            className="w-full bg-pink-50/30 text-zinc-900 border border-pink-100/70 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:bg-white transition-all resize-none min-h-[90px] placeholder:text-zinc-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleQuickDump(e);
              }
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] text-zinc-400 font-medium">
              Zero syntax required • AI classifies life texture automatically
            </span>
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-95 shadow-xs disabled:opacity-50 transition-all active:scale-[0.98]"
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

      {/* Surfacing the Forgotten: Randomized Recall Memory Card */}
      {forgottenMemory && (
        <div className="mb-8 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/5 border border-purple-200/80 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
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
          <p className="text-zinc-800 text-sm font-semibold italic mt-2 leading-relaxed">
            "{forgottenMemory.content}"
          </p>
        </div>
      )}

      {/* Texture Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTextureFilter(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === null
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
          }`}
        >
          All Textures ({items.length})
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
          onClick={() => setActiveTextureFilter(activeTextureFilter === "perspective" ? null : "perspective")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTextureFilter === "perspective"
              ? "bg-pink-600 text-white"
              : "bg-white text-pink-800 hover:bg-pink-50 border border-pink-200"
          }`}
        >
          🧠 Perspectives ({countByTexture.perspective})
        </button>

        <Link
          href="/digest"
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-700 bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-200/80"
        >
          <span>Sunday Digest Ritual</span>
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* The Ambient Life Ledger Feed */}
      {loading ? (
        <div className="py-24 flex justify-center items-center">
          <Loader2 className="animate-spin text-pink-500" size={36} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-pink-200/80 rounded-3xl bg-white/60 p-8">
          <Flame className="mx-auto text-pink-400 mb-2" size={32} />
          <h3 className="text-base font-bold text-zinc-800">Your ledger is waiting</h3>
          <p className="text-zinc-500 text-xs mt-1">
            Log your daily micro-moments, wins, or lessons in the box above.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredItems.map((item) => {
            const texture = resolveLifeTexture(item);
            const Icon = texture.icon;
            return (
              <div
                key={item.id}
                className={`bg-white border ${texture.borderClass} p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_18px_rgba(244,114,182,0.1)] transition-all`}
              >
                {/* Texture Left Accent Bar */}
                <div className={`absolute top-0 left-0 w-2 h-full ${texture.bgAccent} rounded-l-2xl`}></div>

                {/* Top Row: Texture Label + Time */}
                <div className="flex items-center justify-between ml-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${texture.textAccent}`}
                  >
                    <Icon size={12} />
                    {texture.label}
                  </span>
                  <span className="text-xs text-zinc-400 font-semibold">
                    {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                  </span>
                </div>

                {/* Content */}
                <p className="text-zinc-900 font-semibold text-[15px] leading-relaxed ml-2">
                  {item.content}
                </p>

                {/* Bottom Row: Tags & Google Calendar (if actionable) */}
                <div className="flex flex-wrap items-center justify-between gap-2 ml-2 mt-1 pt-2 border-t border-zinc-100">
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
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 px-3 py-1 rounded-lg shadow-2xs transition-all"
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
