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
  created_at: string;
};

export default function WeeklyDigestPage() {
  const today = new Date();
  const lastWeek = subDays(today, 7);

  const [items, setItems] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDigest() {
      try {
        setLoading(true);
        const res = await fetch("/api/items?categories=Done,Learning&days=7");
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
  }, []);

  const doneItems = items.filter((i) => i.category === "Done");
  const learningItems = items.filter((i) => i.category === "Learning");

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold text-zinc-900 mb-2 flex items-center gap-3 tracking-tight">
          Weekly Digest <CalendarDays className="text-pink-500" size={28} />
        </h1>
        <p className="text-zinc-600 text-sm font-semibold">
          {format(lastWeek, "MMM d")} – {format(today, "MMM d, yyyy")}
        </p>
      </header>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="animate-spin text-pink-500" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-pink-200/80 rounded-3xl bg-white/60 p-8">
          <p className="text-zinc-600 font-semibold mb-2">No accomplishments or learnings recorded this week.</p>
          <p className="text-zinc-400 text-sm mb-6">
            Dump notes about things you've completed or insights you've gained, and they will automatically show up here.
          </p>
          <Link
            href="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            Dump a note
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Accomplishments Section */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-zinc-900">
              <CheckCircle2 className="text-emerald-500" size={22} /> What you accomplished ({doneItems.length})
            </h2>
            <div className="grid gap-3">
              {doneItems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic bg-white/50 p-4 rounded-xl border border-pink-100">
                  No completed tasks detected in the last 7 days.
                </p>
              ) : (
                doneItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-emerald-200/80 p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-[0_2px_10px_rgba(16,185,129,0.06)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.12)] transition-all"
                  >
                    <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-2xl"></div>
                    <p className="text-zinc-900 leading-relaxed font-semibold ml-2 text-[15px]">{item.content}</p>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-zinc-500 font-medium">
                        {format(new Date(item.created_at), "EEEE, h:mm a")}
                      </span>
                      {item.tags?.map((t) => (
                        <span key={t} className="text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-md border border-emerald-200/60">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Learning Section */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-zinc-900">
              <BookOpen className="text-pink-500" size={22} /> What you learned ({learningItems.length})
            </h2>
            <div className="grid gap-3">
              {learningItems.length === 0 ? (
                <p className="text-xs text-zinc-400 italic bg-white/50 p-4 rounded-xl border border-pink-100">
                  No learning or insight items detected in the last 7 days.
                </p>
              ) : (
                learningItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-pink-200/80 p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden shadow-[0_2px_10px_rgba(244,114,182,0.08)] hover:shadow-[0_4px_16px_rgba(244,114,182,0.14)] transition-all"
                  >
                    <div className="absolute top-0 left-0 w-2 h-full bg-pink-500 rounded-l-2xl"></div>
                    <p className="text-zinc-900 leading-relaxed font-semibold ml-2 text-[15px]">{item.content}</p>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs text-zinc-500 font-medium">
                        {format(new Date(item.created_at), "EEEE, h:mm a")}
                      </span>
                      {item.tags?.map((t) => (
                        <span key={t} className="text-[11px] bg-pink-50 text-pink-700 font-medium px-2 py-0.5 rounded-md border border-pink-200/60">
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
