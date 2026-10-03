"use client";

import { useState, useEffect } from "react";
import { 
  CalendarDays, 
  CheckCircle2, 
  BookOpen, 
  Loader2, 
  Send, 
  Sparkles, 
  Calendar, 
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
  Flame,
  ArrowUpRight
} from "lucide-react";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import Link from "next/link";

type DigestItem = {
  id: string;
  category: "Done" | "Learning" | "Idea" | "Wishlist" | "Media" | "Shaairi_Quote";
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
 * Calculates human-friendly relative time (e.g. "Yesterday", "2 days ago", "3 weeks ago")
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

export default function CentralWeeklyReviewDashboard() {
  const [period, setPeriod] = useState<"7" | "30" | "all">("7");
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Dump state
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDumpExpanded, setIsDumpExpanded] = useState(true);
  const [justDumpedMessage, setJustDumpedMessage] = useState<string | null>(null);

  // Load Review Items
  const loadReviewData = async () => {
    try {
      setLoading(true);
      const url =
        period === "all"
          ? "/api/items"
          : `/api/items?days=${period}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to load review items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviewData();
  }, [period]);

  // Handle Quick Thought Ingestion
  const handleQuickDump = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    const dumpText = content.trim();
    setContent("");
    setIsSubmitting(true);
    setJustDumpedMessage(null);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: dumpText,
          currentTime: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      if (!res.ok) throw new Error("Failed to process note");
      
      const data = await res.json();
      setJustDumpedMessage(`Extracted ${data.extractedCount || 1} item(s) and updated your Weekly Review!`);
      
      // Reload review items to show fresh accomplishment or learning immediately
      await loadReviewData();
    } catch (error) {
      console.error("Quick Dump error:", error);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setJustDumpedMessage(null), 5000);
    }
  };

  const doneItems = items.filter((i) => i.category === "Done");
  const learningItems = items.filter((i) => i.category === "Learning");
  const actionableItems = items.filter(
    (i) => i.calendar_action && i.calendar_action.is_actionable
  );

  const today = new Date();
  const startDate = period === "7" ? subDays(today, 7) : period === "30" ? subDays(today, 30) : null;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 pt-12 md:pt-14">
      {/* Top Header & Context */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pink-100/70 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.25)]">
              <CalendarDays size={24} />
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight">
              Weekly Review
            </h1>
          </div>
          <p className="text-zinc-500 text-sm font-medium ml-1">
            {startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All Recorded Timeline"} • Your real wins, insights, and lessons at a glance.
          </p>
        </div>

        {/* Time Period Filter Tabs */}
        <div className="inline-flex rounded-2xl border border-pink-200/80 bg-white/90 backdrop-blur-md p-1.5 shadow-xs text-xs font-bold self-start md:self-auto">
          <button
            onClick={() => setPeriod("7")}
            className={`px-4 py-2 rounded-xl transition-all ${
              period === "7"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-pink-50/50"
            }`}
          >
            This Week (7d)
          </button>
          <button
            onClick={() => setPeriod("30")}
            className={`px-4 py-2 rounded-xl transition-all ${
              period === "30"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-pink-50/50"
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-4 py-2 rounded-xl transition-all ${
              period === "all"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-pink-50/50"
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      {/* Metrics Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Accomplishments</p>
            <p className="text-2xl font-black text-emerald-950 mt-0.5">{doneItems.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100/90 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-pink-800 uppercase tracking-wider">Learnings & Insights</p>
            <p className="text-2xl font-black text-pink-950 mt-0.5">{learningItems.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-pink-100/90 text-pink-700 flex items-center justify-center font-bold">
            <BookOpen size={20} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Upcoming Tasks</p>
            <p className="text-2xl font-black text-amber-950 mt-0.5">{actionableItems.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100/90 text-amber-700 flex items-center justify-center font-bold">
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Central Quick Capture Box (Integrated Directly into Dashboard) */}
      <div className="mb-10 bg-white/90 backdrop-blur-xl border border-pink-200/80 rounded-3xl p-5 shadow-[0_8px_30px_rgba(244,114,182,0.08)]">
        <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setIsDumpExpanded(!isDumpExpanded)}>
          <div className="flex items-center gap-2">
            <Sparkles className="text-pink-500" size={18} />
            <h2 className="text-sm font-bold text-zinc-800">
              Quick Capture <span className="text-xs font-normal text-zinc-400">— Log a win, insight, or task</span>
            </h2>
          </div>
          <button className="text-zinc-400 hover:text-zinc-600 p-1">
            {isDumpExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {isDumpExpanded && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleQuickDump}
              className="flex flex-col gap-3"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What did you complete or learn? (e.g. 'Finished the Next.js migration yesterday', 'Learned about vector embeddings', 'Call Rohan tomorrow at 4 PM')..."
                className="w-full bg-pink-50/40 text-zinc-900 border border-pink-100 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white transition-all resize-none min-h-[90px] placeholder:text-zinc-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleQuickDump(e);
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-medium">
                  Press <kbd className="font-mono bg-zinc-100 border px-1 rounded text-zinc-600">Cmd/Ctrl</kbd> + <kbd className="font-mono bg-zinc-100 border px-1 rounded text-zinc-600">Enter</kbd> to save
                </span>
                <button
                  type="submit"
                  disabled={!content.trim() || isSubmitting}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-95 shadow-xs disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  <span>Add to Review</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {justDumpedMessage && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>{justDumpedMessage}</span>
          </div>
        )}
      </div>

      {/* Main Review Content Columns */}
      {loading ? (
        <div className="py-24 flex justify-center items-center">
          <Loader2 className="animate-spin text-pink-500" size={36} />
        </div>
      ) : doneItems.length === 0 && learningItems.length === 0 && actionableItems.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-pink-200/80 rounded-3xl bg-white/60 p-10">
          <Flame className="mx-auto text-pink-400 mb-3" size={36} />
          <h3 className="text-lg font-bold text-zinc-800 mb-1">No activity logged for this timeframe</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
            Log what you've accomplished or insights you've gained in the Quick Capture box above, and they will automatically populate your review.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Actionable / Calendar Tasks Section (if any exists) */}
          {actionableItems.length > 0 && (
            <section className="bg-gradient-to-br from-rose-50/60 to-pink-50/40 border border-rose-200/70 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
                  <Calendar className="text-rose-500" size={20} /> Upcoming Deadlines & Tasks
                </h2>
                <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {actionableItems.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {actionableItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-rose-200/80 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60">
                        {item.calendar_action?.title || "Scheduled Action"}
                      </span>
                      <p className="text-zinc-900 font-semibold text-sm mt-2 leading-relaxed">{item.content}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-rose-100/60">
                      <span className="text-xs text-zinc-500 font-medium">
                        {item.calendar_action?.start_time
                          ? format(new Date(item.calendar_action.start_time), "MMM d • h:mm a")
                          : getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                      </span>
                      <a
                        href={generateGoogleCalendarUrl(item.calendar_action!, item.content)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 px-3 py-1.5 rounded-xl shadow-xs transition-all"
                      >
                        <Calendar size={12} />
                        Add to Calendar
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Two-Column Accomplishments & Learnings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Column 1: Accomplishments */}
            <section className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                  <CheckCircle2 className="text-emerald-500" size={22} /> What You Accomplished
                </h2>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {doneItems.length}
                </span>
              </div>
              <div className="grid gap-3">
                {doneItems.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-emerald-100 rounded-2xl bg-white/50 p-6">
                    <p className="text-xs text-zinc-400 font-medium">No completed tasks recorded for this timeframe.</p>
                  </div>
                ) : (
                  doneItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-emerald-200/80 p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-[0_2px_10px_rgba(16,185,129,0.06)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.12)] transition-all"
                    >
                      <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-2xl"></div>
                      <p className="text-zinc-900 leading-relaxed font-semibold ml-2 text-[15px]">{item.content}</p>
                      <div className="flex flex-wrap items-center gap-2 ml-2 mt-1">
                        <span
                          title={format(new Date(item.event_timestamp || item.created_at), "EEEE, MMMM d, yyyy • h:mm a")}
                          className="text-xs text-emerald-800 font-semibold bg-emerald-50/90 px-2.5 py-1 rounded-lg border border-emerald-200/60 shadow-2xs flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                        </span>
                        {item.tags?.map((t) => (
                          <span key={t} className="text-[11px] bg-zinc-100 text-zinc-700 font-medium px-2 py-0.5 rounded-md border border-zinc-200/60">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Column 2: What You Learned */}
            <section className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                  <BookOpen className="text-pink-500" size={22} /> What You Learned
                </h2>
                <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-0.5 rounded-full border border-pink-200">
                  {learningItems.length}
                </span>
              </div>
              <div className="grid gap-3">
                {learningItems.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-pink-100 rounded-2xl bg-white/50 p-6">
                    <p className="text-xs text-zinc-400 font-medium">No learning or insight items recorded for this timeframe.</p>
                  </div>
                ) : (
                  learningItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-pink-200/80 p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-[0_2px_10px_rgba(244,114,182,0.08)] hover:shadow-[0_4px_16px_rgba(244,114,182,0.14)] transition-all"
                    >
                      <div className="absolute top-0 left-0 w-2 h-full bg-pink-500 rounded-l-2xl"></div>
                      <p className="text-zinc-900 leading-relaxed font-semibold ml-2 text-[15px]">{item.content}</p>
                      <div className="flex flex-wrap items-center gap-2 ml-2 mt-1">
                        <span
                          title={format(new Date(item.event_timestamp || item.created_at), "EEEE, MMMM d, yyyy • h:mm a")}
                          className="text-xs text-pink-800 font-semibold bg-pink-50/90 px-2.5 py-1 rounded-lg border border-pink-200/60 shadow-2xs flex items-center gap-1.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                          {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                        </span>
                        {item.tags?.map((t) => (
                          <span key={t} className="text-[11px] bg-zinc-100 text-zinc-700 font-medium px-2 py-0.5 rounded-md border border-zinc-200/60">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
