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
      color: "bg-pink-50/80 border-pink-200 text-pink-900 hover:border-pink-300",
      badge: "bg-pink-100 text-pink-700",
    },
    {
      id: "Shaairi_Quote",
      name: "Shaairi & Quotes",
      count: shaairiCount,
      color: "bg-purple-50/80 border-purple-200 text-purple-900 hover:border-purple-300",
      badge: "bg-purple-100 text-purple-700",
    },
    {
      id: "Media",
      name: "Jukebox (Media)",
      count: mediaCount,
      color: "bg-blue-50/80 border-blue-200 text-blue-900 hover:border-blue-300",
      badge: "bg-blue-100 text-blue-700",
    },
    {
      id: "Idea",
      name: "Money & Ideas",
      count: ideaCount,
      color: "bg-amber-50/80 border-amber-200 text-amber-900 hover:border-amber-300",
      badge: "bg-amber-100 text-amber-700",
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
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold text-zinc-900 mb-2 flex items-center gap-3 tracking-tight">
          Clusters & Retrieval <Folders className="text-pink-500" size={28} />
        </h1>
        <p className="text-zinc-600 text-base">
          Browse by category or search through all extracted memories, items, and ideas.
        </p>
      </header>

      {/* Search Bar */}
      <div className="mb-12">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-pink-400 via-rose-300 to-pink-300 rounded-2xl blur-md opacity-30 group-hover:opacity-50 transition duration-500"></div>
          <div className="relative flex items-center bg-white border border-pink-200 rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(244,114,182,0.1)] focus-within:border-pink-400 focus-within:ring-4 focus-within:ring-pink-100/60 transition-all px-5 py-2">
            <Search className="text-pink-500 mr-3 shrink-0" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search by keyword, tag (e.g. "music", "shoes"), or concept...'
              className="w-full bg-transparent text-zinc-900 font-medium py-3 focus:outline-none text-base placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-zinc-400 hover:text-zinc-600 p-1"
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
              <h2 className="text-xl font-bold text-zinc-900">Your Categories</h2>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-xs font-semibold text-pink-600 hover:text-pink-700 underline"
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
                      <h3 className="text-lg font-bold text-zinc-900">{cluster.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${cluster.badge}`}>
                        {cluster.count} items
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-semibold text-zinc-500">
                      <span>{isSelected ? "Showing filtered" : "Click to view items"}</span>
                      <ArrowRight size={16} className={isSelected ? "text-pink-600" : ""} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Results List */}
          <div>
            <h2 className="text-xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
              {selectedCategory
                ? `Items in ${clusterCards.find((c) => c.id === selectedCategory)?.name}`
                : searchQuery
                ? `Search Results`
                : `All Extracted Items`}{" "}
              <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2.5 py-0.5 rounded-full">
                {filteredItems.length}
              </span>
            </h2>

            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-pink-200 rounded-2xl bg-white/50 p-6">
                  <p className="text-zinc-600 font-semibold mb-1">No items found.</p>
                  <p className="text-zinc-400 text-xs">
                    {items.length === 0
                      ? "Your database is empty. Use Quick Dump to add your first thought."
                      : "Try clearing your search query or selecting a different category."}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-pink-100/90 p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(244,114,182,0.1)] transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200/60">
                        {item.category}
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">
                        {format(new Date(item.event_timestamp || item.created_at), "MMM d, yyyy • h:mm a")}
                      </span>
                    </div>
                    <p className="text-zinc-900 font-semibold text-[15px] leading-relaxed">
                      {item.content}
                    </p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[11px] bg-zinc-100 text-zinc-700 font-medium px-2 py-0.5 rounded-md"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.calendar_action && item.calendar_action.is_actionable && (
                      <div className="mt-3 pt-3 border-t border-pink-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
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
