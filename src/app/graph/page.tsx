"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Sparkles, Loader2, Network } from "lucide-react";
import Link from "next/link";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const CATEGORY_COLORS: Record<string, string> = {
  Done: "#10b981", // Emerald
  Idea: "#f59e0b", // Amber
  Wishlist: "#ec4899", // Pink
  Media: "#3b82f6", // Blue
  Shaairi_Quote: "#8b5cf6", // Purple
  Learning: "#06b6d4", // Cyan
};

export default function BrainGraphPage() {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function updateDimensions() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        });
      }
    }

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    async function loadGraphData() {
      try {
        setLoading(true);
        const res = await fetch("/api/items");
        if (!res.ok) throw new Error("Failed to fetch items");
        const data = await res.json();
        const items = data.items || [];

        // Build nodes from actual extracted items
        const nodes = items.map((item: any) => ({
          id: item.id,
          name: item.content,
          group: item.category,
          color: CATEGORY_COLORS[item.category] || "#ec4899",
          val: (item.tags?.length || 1) + 2,
          tags: item.tags || [],
        }));

        // Automatically build links between nodes that share tags
        const links: any[] = [];
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const tagsA: string[] = items[i].tags || [];
            const tagsB: string[] = items[j].tags || [];
            const commonTags = tagsA.filter((t) => tagsB.includes(t));
            if (commonTags.length > 0) {
              links.push({
                source: items[i].id,
                target: items[j].id,
                name: commonTags.join(", "),
              });
            }
          }
        }

        setGraphData({ nodes, links });
      } catch (err) {
        console.error("Error loading graph data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadGraphData();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[#fdfbfb]">
      <header className="p-8 pb-4 border-b border-pink-100 bg-white/70 backdrop-blur-md shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-900 mb-1 flex items-center gap-3 tracking-tight">
              Brain Graph <Sparkles className="text-pink-500" size={26} />
            </h1>
            <p className="text-zinc-500 text-sm">
              Live visual node tree connected automatically by shared tags and categories.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
              <span key={cat} className="flex items-center gap-1.5 text-zinc-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col }} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div ref={containerRef} className="flex-1 relative w-full h-full bg-[#faf7f8] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-pink-100 text-pink-500 flex items-center justify-center mb-4">
              <Network size={32} />
            </div>
            <h3 className="text-lg font-bold text-zinc-800 mb-1">No nodes in the Brain Graph yet</h3>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">
              When you submit thoughts in Quick Dump, Gemini categorizes and tags them, and nodes will automatically connect here.
            </p>
            <Link
              href="/"
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-opacity"
            >
              Write your first note
            </Link>
          </div>
        ) : (
          <ForceGraph2D
            graphData={graphData}
            nodeLabel="name"
            nodeColor="color"
            nodeRelSize={7}
            linkColor={() => "rgba(244, 114, 182, 0.4)"}
            linkWidth={1.5}
            backgroundColor="#faf7f8"
            width={dimensions.width}
            height={dimensions.height}
          />
        )}
      </div>
    </div>
  );
}
