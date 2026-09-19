"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Sparkles, Loader2 } from "lucide-react";

// Dynamically import the graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export default function BrainGraphPage() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  // Note: For a real app, we would fetch data from our Supabase DB via an API route.
  // Here we use mock data to demonstrate the visual tree connecting ideas based on tags.
  useEffect(() => {
    // Simulated fetch
    setTimeout(() => {
      const mockData = {
        nodes: [
          { id: "1", name: "Django Assignment", group: "Done", val: 2, color: "#10b981" }, // Emerald
          { id: "2", name: "Habit Tracker App", group: "Idea", val: 3, color: "#f59e0b" }, // Amber
          { id: "3", name: "Atomic Habits", group: "Media", val: 2, color: "#3b82f6" },    // Blue
          { id: "4", name: "Learn Next.js", group: "Learning", val: 4, color: "#8b5cf6" }, // Purple
          { id: "5", name: "Keychron K2", group: "Wishlist", val: 2, color: "#ec4899" },   // Pink
          { id: "6", name: "Patience Poem", group: "Shaairi_Quote", val: 2, color: "#6366f1" }, // Indigo
        ],
        links: [
          { source: "2", target: "4", name: "tech stack" },
          { source: "2", target: "3", name: "habits" },
        ]
      };
      setGraphData(mockData as any);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <header className="p-8 pb-4">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          Brain Graph <Sparkles className="text-blue-400" size={24} />
        </h1>
        <p className="text-zinc-400">
          Visual node tree connecting your ideas automatically via tags and semantics.
        </p>
      </header>

      <div className="flex-1 relative bg-[#09090b] border-t border-white/5">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-zinc-500" size={32} />
          </div>
        ) : (
          <div className="w-full h-full">
            <ForceGraph2D
              graphData={graphData}
              nodeLabel="name"
              nodeColor="color"
              nodeRelSize={6}
              linkColor={() => "rgba(255,255,255,0.1)"}
              backgroundColor="#09090b"
              width={800} // ideally window width, but static for prototype
              height={600}
            />
          </div>
        )}
      </div>
    </div>
  );
}
