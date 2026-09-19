"use client";

import { useState } from "react";
import { Folders, Search, ArrowRight } from "lucide-react";

export default function ClustersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Mock data representing clusters
  const clusters = [
    { name: "Wishlist", count: 12, color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
    { name: "Shaairi & Quotes", count: 8, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
    { name: "Jukebox (Media)", count: 24, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    { name: "Money & Ideas", count: 15, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  ];

  // Mock semantic search result
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          Clusters & Retrieval <Folders className="text-orange-400" size={28} />
        </h1>
        <p className="text-zinc-400 text-lg">
          Browse by category or use AI Semantic Search to find conceptually similar thoughts.
        </p>
      </header>

      {/* Semantic Search Bar */}
      <form onSubmit={handleSearch} className="mb-16">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center bg-[#121214] border border-white/10 rounded-xl overflow-hidden focus-within:border-indigo-500/50 transition-colors px-4 py-2">
            <Search className="text-zinc-500 mr-3" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Try "sad poetry about time" or "business idea related to software"...'
              className="w-full bg-transparent text-white py-3 focus:outline-none text-lg placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="ml-3 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-3 ml-2">Powered by pgvector and Gemini text-embedding-004</p>
      </form>

      {/* Clusters Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white">
          Your Categories
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {clusters.map((cluster) => (
            <div
              key={cluster.name}
              className={`p-6 rounded-2xl border flex flex-col gap-4 cursor-pointer hover:scale-[1.02] transition-transform ${cluster.color}`}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{cluster.name}</h3>
                <span className="bg-black/20 px-2.5 py-1 rounded-full text-xs font-semibold">{cluster.count} items</span>
              </div>
              <div className="mt-auto flex items-center justify-end opacity-0 hover:opacity-100 transition-opacity">
                <ArrowRight size={18} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
