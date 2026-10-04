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
  ArrowLeft,
  Quote,
  Sparkle,
  Compass,
  RefreshCw,
  Headphones
} from "lucide-react";
import { format, subDays } from "date-fns";
import { resolveLifeTexture } from "@/app/page";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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

type SynthesisData = {
  headline: string;
  narrative: string;
  dominant_texture: string;
  reflection_prompt: string;
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
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesisLoading, setSynthesisLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setSynthesisLoading(true);
        
        // 1. Fetch Items
        const url = period === "all" ? "/api/items" : `/api/items?days=${period}`;
        const res = await fetch(url);
        let loadedItems: DigestItem[] = [];
        if (res.ok) {
          const data = await res.json();
          loadedItems = data.items || [];
          setItems(loadedItems);
        }

        // 2. Fetch AI Narrative Synthesis
        const synthUrl = period === "all" ? "/api/digest/synthesis" : `/api/digest/synthesis?days=${period}`;
        const synthRes = await fetch(synthUrl);
        if (synthRes.ok) {
          const synthData = await synthRes.json();
          if (synthData.synthesis) {
            setSynthesis(synthData.synthesis);
          }
        }
      } catch (err) {
        console.error("Failed to load Sunday Review:", err);
      } finally {
        setLoading(false);
        setSynthesisLoading(false);
      }
    }
    loadData();
  }, [period]);

  const handleRefreshSynthesis = async () => {
    if (synthesisLoading) return;
    try {
      setSynthesisLoading(true);
      const synthUrl = period === "all" ? "/api/digest/synthesis" : `/api/digest/synthesis?days=${period}`;
      const synthRes = await fetch(synthUrl);
      if (synthRes.ok) {
        const synthData = await synthRes.json();
        if (synthData.synthesis) {
          setSynthesis(synthData.synthesis);
        }
      }
    } catch (err) {
      console.error("Failed to refresh synthesis:", err);
    } finally {
      setSynthesisLoading(false);
    }
  };

  // Group items by life texture
  const hardWorkItems = items.filter((i) => resolveLifeTexture(i as any).key === "hard_work");
  const quietMomentItems = items.filter((i) => resolveLifeTexture(i as any).key === "quiet_moment");
  const hardTruthItems = items.filter((i) => resolveLifeTexture(i as any).key === "hard_truth");
  const perspectiveItems = items.filter((i) => resolveLifeTexture(i as any).key === "perspective");
  const ideaSparkItems = items.filter((i) => resolveLifeTexture(i as any).key === "idea_spark");
  const mediaLogItems = items.filter((i) => resolveLifeTexture(i as any).key === "media_log");

  const today = new Date();
  const startDate = period === "7" ? subDays(today, 7) : period === "30" ? subDays(today, 30) : null;
  const periodLabelText = period === "7" ? "This Week" : period === "30" ? "Past 30 Days" : "All Time";

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 selection:bg-rose-500/30 selection:text-rose-200">
      {/* Ambient Atmospheric Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 md:px-10 pt-12 md:pt-16 pb-24">
        {/* Navigation & Period Filter Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors uppercase tracking-widest mb-3"
            >
              <ArrowLeft size={14} /> Back to Daily Ledger
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">
                The Sunday Review
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Ritual
              </span>
            </div>
            <p className="text-zinc-400 text-sm font-normal mt-1.5">
              {startDate ? `${format(startDate, "MMMM d")} — ${format(today, "MMMM d, yyyy")}` : "Complete Life History"} • A synthesized reflection of your lived experience.
            </p>
          </div>

          {/* Time Filter Buttons */}
          <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-1.5 shadow-xl text-xs font-medium self-start md:self-auto">
            <button
              onClick={() => setPeriod("7")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 ${
                period === "7"
                  ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-900/40 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod("30")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 ${
                period === "30"
                  ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-900/40 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPeriod("all")}
              className={`px-4 py-2 rounded-xl transition-all duration-300 ${
                period === "all"
                  ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-900/40 font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All Time
            </button>
          </div>
        </header>

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-rose-500" size={38} />
            <p className="text-sm font-serif italic text-zinc-400">Synthesizing your moments into a story...</p>
          </div>
        ) : items.length === 0 ? (
          /* Empty Ledger State */
          <div className="text-center py-24 border border-dashed border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-xl p-10 max-w-xl mx-auto">
            <Compass className="mx-auto text-rose-400 mb-4 animate-pulse" size={36} />
            <h2 className="text-2xl font-serif font-bold text-white mb-2">No moments recorded for {periodLabelText.toLowerCase()}</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-8">
              The Sunday Review is born from your raw daily entries. Log your quiet walks, financial wins or losses, and lessons on the timeline.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white px-6 py-3 rounded-2xl text-xs font-semibold shadow-lg shadow-rose-900/30 hover:opacity-95 transition-all"
            >
              <span>Write in Daily Ledger</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {/* 1. Spotify-Wrapped Style AI Synthesis & Headline Hero */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/15 p-8 md:p-12 shadow-2xl backdrop-blur-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-rose-500/20 via-purple-500/10 to-transparent rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />

              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-rose-400" size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest text-rose-300/90">
                      Editorial Narrative Synthesis
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {synthesis?.dominant_texture && (
                      <span className="text-xs font-medium text-purple-200 bg-purple-500/20 border border-purple-400/30 px-3 py-1 rounded-full">
                        Rhythm: {synthesis.dominant_texture}
                      </span>
                    )}
                    <button
                      onClick={handleRefreshSynthesis}
                      disabled={synthesisLoading}
                      title="Regenerate Reflection"
                      className="text-zinc-400 hover:text-white transition-colors p-1"
                    >
                      <RefreshCw size={14} className={synthesisLoading ? "animate-spin text-rose-400" : ""} />
                    </button>
                  </div>
                </div>

                {synthesisLoading ? (
                  <div className="py-8 space-y-4">
                    <div className="h-10 bg-white/10 rounded-xl animate-pulse w-3/4" />
                    <div className="h-5 bg-white/5 rounded-lg animate-pulse w-full" />
                    <div className="h-5 bg-white/5 rounded-lg animate-pulse w-4/5" />
                  </div>
                ) : (
                  <>
                    {/* Massive Bold Headline */}
                    <h2 className="text-3xl md:text-5xl font-serif font-medium tracking-tight text-white mb-6 leading-tight">
                      "{synthesis?.headline || "A Week of Lived Truths"}"
                    </h2>

                    {/* Editorial Synthesis Prose */}
                    <p className="text-base md:text-lg text-zinc-300 font-normal leading-relaxed mb-8 max-w-3xl">
                      {synthesis?.narrative}
                    </p>

                    {/* Deep Reflection Prompt Anchor */}
                    {synthesis?.reflection_prompt && (
                      <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/[0.02] -mx-8 -mb-12 md:-mx-12 md:-mb-12 p-6 md:p-8 rounded-b-3xl">
                        <Quote className="text-rose-400 shrink-0 rotate-180 opacity-80" size={24} />
                        <div className="flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">
                            Sunday Contemplation
                          </p>
                          <p className="text-sm md:text-base font-serif italic text-zinc-200">
                            "{synthesis.reflection_prompt}"
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* 2. THE ANTI-DEFICIT TEXTURE SECTIONS
                RULE: NEVER RENDER AN EMPTY STATE CARD WITH "0 ITEMS".
                Only render categories that actually happened! */}
            <div className="space-y-10">
              
              {/* SECTION: The Quiet Moments (Large, isolated, expansive serif typography) */}
              {quietMomentItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-gradient-to-b from-purple-950/20 via-purple-900/10 to-transparent border border-purple-500/20 p-8 md:p-10 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-purple-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                        <Coffee size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-purple-100">
                          The Quiet Moments
                        </h3>
                        <p className="text-xs text-purple-300/70">
                          Micro-moments, conversations, evening walks, unquantifiable warmth
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-purple-200 bg-purple-500/20 px-3 py-1 rounded-full border border-purple-400/30">
                      {quietMomentItems.length} {quietMomentItems.length === 1 ? "moment" : "moments"}
                    </span>
                  </div>

                  {/* Editorial Flow for Quiet Moments: Large typography, forcing the user to pause and savor */}
                  <div className="grid grid-cols-1 gap-6">
                    {quietMomentItems.map((item) => (
                      <div
                        key={item.id}
                        className="relative p-6 md:p-8 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-purple-400/15 transition-all duration-300 group"
                      >
                        <Quote className="absolute top-6 left-6 text-purple-400/20 group-hover:text-purple-400/40 transition-colors" size={32} />
                        <div className="relative z-10 pl-6 md:pl-8">
                          <p className="font-serif italic text-lg md:text-2xl text-purple-100 leading-relaxed tracking-wide">
                            "{item.content}"
                          </p>
                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-medium text-purple-300/60">
                              {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                            </span>
                            {item.sentiment_or_mood && (
                              <span className="text-[11px] font-medium text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-400/20">
                                {item.sentiment_or_mood}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* SECTION: The Costs & Hard Truths (Stark, grounded, solemn stone aesthetic) */}
              {hardTruthItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-gradient-to-b from-amber-950/20 via-stone-900/30 to-transparent border border-amber-500/20 p-8 md:p-10 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-amber-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                        <TrendingDown size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-amber-100">
                          The Costs & Hard Truths
                        </h3>
                        <p className="text-xs text-amber-300/70">
                          Financial expenses, trading losses, hard lessons to face with composure
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-200 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/30">
                      {hardTruthItems.length} {hardTruthItems.length === 1 ? "truth" : "truths"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hardTruthItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-stone-900/60 border border-amber-500/20 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                      >
                        <p className="text-zinc-100 font-medium text-sm md:text-base leading-relaxed mb-3">
                          {item.content}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
                          <span className="text-amber-400/80 font-mono font-semibold">
                            Facing Reality
                          </span>
                          <span className="text-zinc-400">
                            {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* SECTION: The Hard Work & Milestones (Punchy, energetic, momentum-driven) */}
              {hardWorkItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-gradient-to-b from-emerald-950/20 via-emerald-900/10 to-transparent border border-emerald-500/20 p-8 md:p-10 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-emerald-100">
                          The Hard Work & Milestones
                        </h3>
                        <p className="text-xs text-emerald-300/70">
                          PRs cleared, assignments submitted, code shipped, discipline honored
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-200 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/30">
                      {hardWorkItems.length} {hardWorkItems.length === 1 ? "win" : "wins"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hardWorkItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                      >
                        <p className="text-emerald-100 font-semibold text-sm md:text-base leading-relaxed mb-3">
                          {item.content}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-emerald-500/10 text-xs">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Milestone
                          </span>
                          <span className="text-zinc-400">
                            {getRelativeTimeLabel(item.event_timestamp || item.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* SECTION: Perspectives & Insights (Literary bookplate aesthetic) */}
              {perspectiveItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-gradient-to-b from-rose-950/20 via-pink-900/10 to-transparent border border-rose-500/20 p-8 md:p-10 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-rose-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-rose-100">
                          Perspectives & Insights
                        </h3>
                        <p className="text-xs text-rose-300/70">
                          Book reflections, philosophical shifts, wisdom harvested
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-rose-200 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-400/30">
                      {perspectiveItems.length} {perspectiveItems.length === 1 ? "insight" : "insights"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {perspectiveItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-6 rounded-2xl bg-white/[0.03] border border-rose-500/20 hover:border-rose-500/40 transition-all flex flex-col justify-between"
                      >
                        <p className="font-serif text-rose-100 text-base md:text-lg leading-relaxed mb-3">
                          "{item.content}"
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-rose-500/10 text-xs text-rose-300/70">
                          <span>Wisdom & Perspective</span>
                          <span>{getRelativeTimeLabel(item.event_timestamp || item.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* SECTION: Ideas & Sparks */}
              {ideaSparkItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-gradient-to-b from-blue-950/20 via-indigo-900/10 to-transparent border border-blue-500/20 p-8 md:p-10 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                        <Sparkle size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-blue-100">
                          Ideas & Sparks
                        </h3>
                        <p className="text-xs text-blue-300/70">
                          Concepts, future desires, product seeds
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-blue-200 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-400/30">
                      {ideaSparkItems.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ideaSparkItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-blue-950/30 border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col justify-between"
                      >
                        <p className="text-blue-100 font-medium text-sm md:text-base leading-relaxed mb-3">
                          {item.content}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-blue-500/10 text-xs text-blue-300/70">
                          <span>Spark</span>
                          <span>{getRelativeTimeLabel(item.event_timestamp || item.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* SECTION: Media & Cultural Intake */}
              {mediaLogItems.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl bg-gradient-to-b from-indigo-950/20 via-slate-900/20 to-transparent border border-indigo-500/20 p-8 md:p-10 shadow-xl"
                >
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-indigo-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                        <Headphones size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-indigo-100">
                          Media & Cultural Intake
                        </h3>
                        <p className="text-xs text-indigo-300/70">
                          Music, cinema, anime, gaming & cultural resonance
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-indigo-200 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/30">
                      {mediaLogItems.length} {mediaLogItems.length === 1 ? "piece" : "pieces"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mediaLogItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
                      >
                        <p className="text-indigo-100 font-medium text-sm md:text-base leading-relaxed mb-3">
                          {item.content}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-indigo-500/10 text-xs text-indigo-300/70">
                          <span className="flex items-center gap-1 font-medium">
                            <Headphones size={12} /> Intake
                          </span>
                          <span>{getRelativeTimeLabel(item.event_timestamp || item.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
