"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  Loader2, 
  TrendingDown, 
  Coffee, 
  CalendarDays, 
  Hourglass,
  ArrowLeft
} from "lucide-react";
import { format, subDays } from "date-fns";
import { resolveLifeTexture } from "@/app/page";
import Link from "next/link";

type DigestItem = {
  id: string;
  category: string;
  life_texture?: string;
  content: string;
  tags?: string[];
  sentiment_or_mood?: string;
  event_timestamp: string;
  created_at: string;
};

function getRelativeTimeLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (isNaN(d.getTime())) return "Recently";

    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "Just now";

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return format(d, "MMM d");
  } catch {
    return "Recently";
  }
}

export default function SundayDigestPage() {
  const [period, setPeriod] = useState<"7" | "30" | "all">("7");
  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDigest() {
      try {
        setLoading(true);
        const url = period === "all" ? "/api/items" : `/api/items?days=${period}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error("Failed to load Sunday digest:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDigest();
  }, [period]);

  const hardWorkItems = items.filter((i) => resolveLifeTexture(i as any).key === "hard_work");
  const quietMomentItems = items.filter((i) => resolveLifeTexture(i as any).key === "quiet_moment");
  const hardTruthItems = items.filter((i) => resolveLifeTexture(i as any).key === "hard_truth");
  const perspectiveItems = items.filter((i) => resolveLifeTexture(i as any).key === "perspective");

  const today = new Date();
  const startDate = period === "7" ? subDays(today, 7) : period === "30" ? subDays(today, 30) : null;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 pt-12 md:pt-14">
      {/* Top Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pink-100/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-600 mb-1">
            <Link href="/" className="hover:underline flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Timeline
            </Link>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-3">
            The Sunday Review Ritual <CalendarDays className="text-pink-500" size={28} />
          </h1>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {startDate ? `${format(startDate, "MMM d")} – ${format(today, "MMM d, yyyy")}` : "All Recorded Timeline"} • A full recap of your week's life texture.
          </p>
        </div>

        {/* Filter */}
        <div className="inline-flex rounded-2xl border border-pink-200/80 bg-white p-1.5 shadow-xs text-xs font-bold self-start md:self-auto">
          <button
            onClick={() => setPeriod("7")}
            className={`px-4 py-2 rounded-xl transition-all ${
              period === "7"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod("30")}
            className={`px-4 py-2 rounded-xl transition-all ${
              period === "30"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-4 py-2 rounded-xl transition-all ${
              period === "all"
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      {loading ? (
        <div className="py-24 flex justify-center items-center">
          <Loader2 className="animate-spin text-pink-500" size={36} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-pink-200/80 rounded-3xl bg-white/60 p-10">
          <p className="text-zinc-700 font-semibold mb-2">No moments recorded for this review period.</p>
          <p className="text-zinc-400 text-xs mb-6">
            Dump your daily thoughts and moments on the timeline to populate your Sunday review.
          </p>
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:opacity-95 transition-all"
          >
            Go to Timeline
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Quadrant 1: The Hard Work */}
          <section className="bg-white border border-emerald-200/80 rounded-3xl p-6 shadow-[0_2px_12px_rgba(16,185,129,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
                <CheckCircle2 className="text-emerald-500" size={20} /> The Hard Work
              </h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {hardWorkItems.length}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-medium">
              Milestones, assignments, cleared PRs, and career progress.
            </p>
            <div className="space-y-3">
              {hardWorkItems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4">No hard work items recorded.</p>
              ) : (
                hardWorkItems.map((item) => (
                  <div key={item.id} className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl">
                    <p className="text-zinc-900 font-semibold text-sm">{item.content}</p>
                    <span className="text-[11px] text-emerald-700 font-medium mt-1 inline-block">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quadrant 2: The Quiet Moments */}
          <section className="bg-white border border-purple-200/80 rounded-3xl p-6 shadow-[0_2px_12px_rgba(168,85,247,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
                <Coffee className="text-purple-500" size={20} /> The Quiet Moments
              </h2>
              <span className="text-xs font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                {quietMomentItems.length}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-medium">
              Micro-moments, unquantifiable experiences, music, conversations, walks.
            </p>
            <div className="space-y-3">
              {quietMomentItems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4">No quiet moments recorded.</p>
              ) : (
                quietMomentItems.map((item) => (
                  <div key={item.id} className="p-3.5 bg-purple-50/40 border border-purple-100 rounded-xl">
                    <p className="text-zinc-900 font-semibold text-sm">{item.content}</p>
                    <span className="text-[11px] text-purple-700 font-medium mt-1 inline-block">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quadrant 3: The Cost & Hard Truths */}
          <section className="bg-white border border-amber-200/80 rounded-3xl p-6 shadow-[0_2px_12px_rgba(245,158,11,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
                <TrendingDown className="text-amber-500" size={20} /> The Cost & Hard Truths
              </h2>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                {hardTruthItems.length}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-medium">
              Trading losses, financial expenses, missteps to reflect on rationally.
            </p>
            <div className="space-y-3">
              {hardTruthItems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4">No financial or setback entries recorded.</p>
              ) : (
                hardTruthItems.map((item) => (
                  <div key={item.id} className="p-3.5 bg-amber-50/40 border border-amber-100 rounded-xl">
                    <p className="text-zinc-900 font-semibold text-sm">{item.content}</p>
                    <span className="text-[11px] text-amber-700 font-medium mt-1 inline-block">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quadrant 4: Perspectives & Lessons */}
          <section className="bg-white border border-pink-200/80 rounded-3xl p-6 shadow-[0_2px_12px_rgba(244,114,182,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900">
                <BookOpen className="text-pink-500" size={20} /> Perspectives & Insights
              </h2>
              <span className="text-xs font-bold text-pink-800 bg-pink-100 px-2.5 py-0.5 rounded-full border border-pink-200">
                {perspectiveItems.length}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4 font-medium">
              Books finished, mindset shifts, and philosophical reflections.
            </p>
            <div className="space-y-3">
              {perspectiveItems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4">No perspectives recorded.</p>
              ) : (
                perspectiveItems.map((item) => (
                  <div key={item.id} className="p-3.5 bg-pink-50/40 border border-pink-100 rounded-xl">
                    <p className="text-zinc-900 font-semibold text-sm">{item.content}</p>
                    <span className="text-[11px] text-pink-700 font-medium mt-1 inline-block">
                      {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                    </span>
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
