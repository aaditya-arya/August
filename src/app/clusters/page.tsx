"use client";

import { useState, useEffect } from "react";
import { Folders, Search, ArrowRight, Loader2, Sparkles, X, Calendar } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { generateGoogleCalendarUrl } from "@/lib/calendar";

type Item = {
  id: string;
  category: string;
  content: string;
  tags?: string[];
  sentiment_or_mood?: string;
  event_timestamp?: string;
  calendar_action?: {
    is_actionable: boolean;
    title?: string;
    start_time?: string;
    end_time?: string;
  } | null;
  calendar_status?: string;
  google_event_id?: string;
  created_at: string;
};

export default function ClustersPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        const res = await fetch("/api/items");
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (err) {
        console.error("Failed to load items:", err);
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, []);

  const wishlistCount = items.filter((i) => i.category === "Wishlist").length;
  const shaairiCount = items.filter((i) => i.category === "Shaairi_Quote").length;
  const mediaCount = items.filter((i) => i.category === "Media").length;
  const ideaCount = items.filter((i) => i.category === "Idea").length;

  const clusterCards = [
    {
      id: "Wishlist",
      name: "Wishlist",
      count: wishlistCount,
      color: "bg-pink-50/80 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20 text-pink-900 dark:text-pink-100 hover:border-pink-300 dark:hover:border-pink-500/35",
      badge: "bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300",
    },
    {
      id: "Shaairi_Quote",
      name: "Shaairi & Quotes",
      count: shaairiCount,
      color: "bg-purple-50/80 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-900 dark:text-purple-100 hover:border-purple-300 dark:hover:border-purple-500/35",
      badge: "bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300",
    },
    {
      id: "Media",
      name: "Jukebox (Media)",
      count: mediaCount,
      color: "bg-blue-50/80 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-900 dark:text-blue-100 hover:border-blue-300 dark:hover:border-blue-500/35",
      badge: "bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300",
    },
    {
      id: "Idea",
      name: "Money & Ideas",
      count: ideaCount,
      color: "bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-900 dark:text-amber-100 hover:border-amber-300 dark:hover:border-amber-500/35",
      badge: "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
  ];

  // Filter items based on active search or active cluster selection
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory ? item.category === selectedCategory : true;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query
      ? item.content.toLowerCase().includes(query) ||
        item.tags?.some((t) => t.toLowerCase().includes(query)) ||
        item.category.toLowerCase().includes(query)
      : true;
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-4xl mx-auto px-5 py-9 sm:p-8 md:pt-16">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-3 tracking-tight">
          Clusters & Retrieval <Folders className="text-pink-500" size={28} />
        </h1>
        <p className="text-zinc-600 dark:text-muted text-base">
          Browse by category or search through all extracted memories, items, and ideas.
        </p>
      </header>

      {/* Search Bar */}
      <div className="mb-12">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-pink-400 via-rose-300 to-pink-300 rounded-2xl blur-md opacity-30 group-hover:opacity-50 transition duration-500"></div>
          <div className="relative flex items-center bg-white dark:bg-surface border border-pink-200 dark:border-pink-500/20 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(244,114,182,0.1)] focus-within:border-pink-400 focus-within:ring-4 focus-within:ring-pink-100/60 dark:focus-within:ring-pink-500/20 transition-all px-5 py-2">
            <Search className="text-pink-500 mr-3 shrink-0" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by keyword, tag (e.g. "music", "shoes"), or concept...'
              className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 font-medium py-3 focus:outline-none text-base placeholder:text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted hover:text-zinc-600 dark:hover:text-muted p-1"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="animate-spin text-pink-500" size={32} />
        </div>
      ) : (
        <>
          {/* Clusters Grid */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Your Categories</h2>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {clusterCards.map((cluster) => {
                const isSelected = selectedCategory === cluster.id;
                return (
                  <div
                    key={cluster.id}
                    onClick={() =>
                      setSelectedCategory(isSelected ? null : cluster.id)
                    }
                    className={`p-6 rounded-2xl border transition-all cursor-pointer shadow-xs ${cluster.color} ${
                      isSelected
                        ? "ring-2 ring-pink-500 shadow-md scale-[1.01]"
                        : "hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{cluster.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${cluster.badge}`}>
                        {cluster.count} items
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-muted">
                      <span>{isSelected ? "Showing filtered" : "Click to view items"}</span>
                      <ArrowRight size={16} className={isSelected ? "text-pink-600 dark:text-pink-400" : ""} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results List */}
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              {selectedCategory
                ? `Items in ${clusterCards.find((c) => c.id === selectedCategory)?.name}`
                : searchQuery
                ? `Search Results`
                : `All Extracted Items`}{" "}
              <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-500/15 px-2.5 py-0.5 rounded-full">
                {filteredItems.length}
              </span>
            </h2>

            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-pink-200 dark:border-pink-500/20 rounded-2xl bg-white/50 dark:bg-surface/50 p-6">
                  <p className="text-zinc-600 dark:text-muted font-semibold mb-1">No items found.</p>
                  <p className="text-muted text-xs">
                    {items.length === 0
                      ? "Your collection begins with a thought. Write your first moment in the Life Ledger."
                      : "Try clearing your search query or selecting a different category."}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-surface border border-pink-100/90 dark:border-pink-500/20 p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(244,114,182,0.1)] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-200/60 dark:border-pink-500/20">
                        {item.category}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-muted font-medium">
                        {format(new Date(item.event_timestamp || item.created_at), "MMM d, yyyy • h:mm a")}
                      </span>
                    </div>
                    <p className="entry-copy text-foreground">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium px-2 py-0.5 rounded-md"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.calendar_action && item.calendar_action.is_actionable && (
                      <div className="mt-3 pt-3 border-t border-pink-100 dark:border-pink-500/20 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
                          <Calendar size={14} className="text-pink-500 shrink-0" />
                          <span>Event: {item.calendar_action.title || "Scheduled Task"}</span>
                        </div>
                        <a
                          href={generateGoogleCalendarUrl(item.calendar_action, item.content)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 px-3 py-1.5 rounded-lg shadow-xs hover:shadow-sm transition-all"
                        >
                          <Calendar size={13} />
                          Add to Google Calendar
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
