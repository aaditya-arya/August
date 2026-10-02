"use client";

import { useState, useEffect } from "react";
import { CalendarDays, CheckCircle2, BookOpen, Loader2 } from "lucide-react";
import { format, subDays } from "date-fns";
import Link from "next/link";

type DigestItem = {
  id: string;
  category: "Done" | "Learning";
  content: string;
  tags?: string[];
  sentiment_or_mood?: string;
  event_timestamp: string;
  created_at: string;
};

/**
 * Calculates human-friendly relative time (e.g. "Yesterday", "2 days ago", "3 weeks ago", "3 months ago", "10 years ago")
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
        return `${diffMinutes} mins ago`;
      }
      return `Today (${diffHours}h ago)`;
    }
    if (diffDays === 1) {
      return "Yesterday";
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    if (diffWeeks < 4) {
      return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
    }
    if (diffMonths < 12) {
      return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
    }
    return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
  } catch {
    return "Recently";
  }
}

export default function WeeklyDigestPage() {
  const [period, setPeriod] = useState<"7" | "30" | "all">("7");
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDigest() {
      try {
        setLoading(true);
        const url =
          period === "all"
            ? "/api/items?categories=Done,Learning"
            : `/api/items?categories=Done,Learning&days=${period}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error("Failed to load digest:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDigest();
  }, [period]);

  const doneItems = items.filter((i) => i.category === "Done");
  const learningItems = items.filter((i) => i.category === "Learning");

  const today = new Date();
  const startDate = period === "7" ? subDays(today, 7) : period === "30" ? subDays(today, 30) : null;

  return (
    <div className="max-w-6xl mx-auto p-8 pt-16">
      {/* Header */}
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 mb-2 flex items-center gap-3 tracking-tight">
            Weekly Digest <CalendarDays className="text-pink-500" size={28} />
          </h1>
          <p className="text-zinc-600 text-sm font-semibold">
            {startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All Recorded Memories"} • Filtered by event occurrence date
          </p>
        </div>

        {/* Time Period Filter */}
        <div className="inline-flex rounded-xl border border-pink-200 bg-white p-1 shadow-2xs text-xs font-semibold">
          <button
            onClick={() => setPeriod("7")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === "7"
                ? "bg-pink-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setPeriod("30")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === "30"
                ? "bg-pink-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === "all"
                ? "bg-pink-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="animate-spin text-pink-500" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-pink-200/80 rounded-3xl bg-white/60 p-8">
          <p className="text-zinc-600 font-semibold mb-2">No accomplishments or learnings recorded for this period.</p>
          <p className="text-zinc-400 text-sm mb-6">
            Dump notes about things you've completed or insights you've gained, and they will automatically show up based on when they occurred.
          </p>
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            Dump a note
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Accomplishments Column */}
          <section className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                <CheckCircle2 className="text-emerald-500" size={22} /> What you accomplished
              </h2>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {doneItems.length}
              </span>
            </div>
            <div className="grid gap-3">
              {doneItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-emerald-100 rounded-2xl bg-white/50 p-4">
                  <p className="text-xs text-zinc-400 font-medium">No completed tasks recorded in this period.</p>
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
                        className="text-xs text-emerald-800 font-semibold bg-emerald-50/90 px-2.5 py-1 rounded-lg border border-emerald-200/60 shadow-2xs cursor-default flex items-center gap-1.5"
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

          {/* Learning Column */}
          <section className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-900">
                <BookOpen className="text-pink-500" size={22} /> What you learned
              </h2>
              <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-0.5 rounded-full border border-pink-200">
                {learningItems.length}
              </span>
            </div>
            <div className="grid gap-3">
              {learningItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-pink-100 rounded-2xl bg-white/50 p-4">
                  <p className="text-xs text-zinc-400 font-medium">No learning items recorded in this period.</p>
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
                        className="text-xs text-pink-800 font-semibold bg-pink-50/90 px-2.5 py-1 rounded-lg border border-pink-200/60 shadow-2xs cursor-default flex items-center gap-1.5"
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
      )}
    </div>
  );
}
