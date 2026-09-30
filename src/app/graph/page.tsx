"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Sparkles, Loader2, Network, RefreshCw, Layers, SlidersHorizontal } from "lucide-react";
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

type Node = {
  id: string;
  name: string;
  group: string;
  color?: string;
  val?: number;
  tags?: string[];
  sentiment_or_mood?: string;
};

type LinkItem = {
  id?: string;
  source: any;
  target: any;
  weight: number;
  link_type: "semantic" | "explicit_tag";
  value?: number;
};

export default function BrainGraphPage() {
  const [rawNodes, setRawNodes] = useState<Node[]>([]);
  const [rawLinks, setRawLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [linkFilter, setLinkFilter] = useState<"all" | "semantic" | "explicit_tag">("all");
  const [minWeight, setMinWeight] = useState<number>(0.70);
  const [showControls, setShowControls] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
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

  async function loadGraphData() {
    try {
      setLoading(true);
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error("Failed to fetch graph data");
      const data = await res.json();

      const nodes = (data.nodes || []).map((n: any) => ({
        ...n,
        color: CATEGORY_COLORS[n.group] || "#ec4899",
      }));

      setRawNodes(nodes);
      setRawLinks(data.links || []);
    } catch (err) {
      console.error("Error loading graph data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGraphData();
  }, []);

  // Filter links based on user controls
  const filteredGraphData = useMemo(() => {
    const links = rawLinks.filter((link) => {
      if (linkFilter !== "all" && link.link_type !== linkFilter) return false;
      if (link.link_type === "semantic" && (link.weight || 0) < minWeight) return false;
      return true;
    });

    return {
      nodes: rawNodes,
      links,
    };
  }, [rawNodes, rawLinks, linkFilter, minWeight]);

  // Configure D3 force simulation based on link weights
  useEffect(() => {
    if (fgRef.current && filteredGraphData.nodes.length > 0) {
      const linkForce = fgRef.current.d3Force("link");
      if (linkForce) {
        linkForce
          .distance((link: any) => {
            // Heavier weight = shorter distance (pulls tightly together)
            const w = link.weight || 0.5;
            return Math.max(35, (1 - w) * 160 + 35);
          })
          .strength((link: any) => {
            // Heavier weight = stronger spring pull
            const w = link.weight || 0.5;
            return link.link_type === "explicit_tag" ? 0.75 : Math.max(0.2, w * 0.6);
          });
      }

      const chargeForce = fgRef.current.d3Force("charge");
      if (chargeForce) {
        chargeForce.strength(-130);
      }

      fgRef.current.d3ReheatSimulation();
    }
  }, [filteredGraphData]);

  async function handleRecompute() {
    try {
      setIsRecomputing(true);
      const res = await fetch("/api/graph", { method: "POST" });
      if (res.ok) {
        await loadGraphData();
      }
    } catch (err) {
      console.error("Failed to recompute edges:", err);
    } finally {
      setIsRecomputing(false);
    }
  }

  const semanticCount = filteredGraphData.links.filter((l) => l.link_type === "semantic").length;
  const tagCount = filteredGraphData.links.filter((l) => l.link_type === "explicit_tag").length;

  return (
    <div className="h-screen flex flex-col bg-[#fdfbfb]">
      {/* Header */}
      <header className="p-6 pb-4 border-b border-pink-100 bg-white/80 backdrop-blur-md shrink-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 mb-0.5 flex items-center gap-2.5 tracking-tight">
              Brain Graph <Sparkles className="text-pink-500" size={22} />
            </h1>
            <p className="text-zinc-500 text-xs">
              Live neural map connected by semantic embeddings and shared tags computed on write.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Category Pills */}
            <div className="hidden lg:flex items-center gap-3 text-xs font-semibold px-3 py-1.5 bg-pink-50/50 rounded-xl border border-pink-100">
              {Object.entries(CATEGORY_COLORS).map(([cat, col]) => (
                <span key={cat} className="flex items-center gap-1 text-zinc-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />
                  {cat}
                </span>
              ))}
            </div>

            {/* Controls Button */}
            <button
              onClick={() => setShowControls(!showControls)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showControls
                  ? "bg-pink-100 border-pink-300 text-pink-700"
                  : "bg-white border-pink-200 text-zinc-700 hover:bg-pink-50"
              }`}
            >
              <SlidersHorizontal size={14} />
              Filters
            </button>

            {/* Recompute Button */}
            <button
              onClick={handleRecompute}
              disabled={isRecomputing || loading}
              title="Recompute all vector similarity and tag edges across the database"
              className="bg-white border border-pink-200 text-zinc-700 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-pink-50 disabled:opacity-50 transition-all shadow-xs"
            >
              <RefreshCw size={13} className={isRecomputing ? "animate-spin text-pink-500" : ""} />
              {isRecomputing ? "Recomputing..." : "Recompute Edges"}
            </button>
          </div>
        </div>

        {/* Filter Drawer */}
        {showControls && (
          <div className="mt-4 pt-4 border-t border-pink-100/70 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-semibold">Link Type:</span>
              <div className="inline-flex rounded-lg border border-pink-200 bg-white p-0.5">
                <button
                  onClick={() => setLinkFilter("all")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    linkFilter === "all"
                      ? "bg-pink-500 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  All ({filteredGraphData.links.length})
                </button>
                <button
                  onClick={() => setLinkFilter("explicit_tag")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    linkFilter === "explicit_tag"
                      ? "bg-pink-500 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Tag Bonds ({tagCount})
                </button>
                <button
                  onClick={() => setLinkFilter("semantic")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    linkFilter === "semantic"
                      ? "bg-pink-500 text-white shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Semantic ({semanticCount})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500 font-semibold">Min Similarity:</span>
              <input
                type="range"
                min="0.65"
                max="0.95"
                step="0.05"
                value={minWeight}
                onChange={(e) => setMinWeight(parseFloat(e.target.value))}
                className="w-24 accent-pink-500"
              />
              <span className="font-mono text-zinc-700 bg-white px-2 py-0.5 rounded border border-pink-200">
                {Math.round(minWeight * 100)}%
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Main Canvas */}
      <div ref={containerRef} className="flex-1 relative w-full h-full bg-[#faf7f8] overflow-hidden">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : filteredGraphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-pink-100 text-pink-500 flex items-center justify-center mb-4">
              <Network size={32} />
            </div>
            <h3 className="text-lg font-bold text-zinc-800 mb-1">No nodes in the Brain Graph yet</h3>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">
              When you submit thoughts in Quick Dump, Gemini creates embeddings and nodes connect automatically.
            </p>
            <Link
              href="/"
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-opacity"
            >
              Write your first note
            </Link>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={fgRef}
              graphData={filteredGraphData}
              nodeLabel="name"
              nodeColor="color"
              nodeRelSize={6}
              linkColor={(link: any) =>
                link.link_type === "explicit_tag"
                  ? "rgba(244, 114, 182, 0.75)"
                  : "rgba(148, 163, 184, 0.45)"
              }
              linkWidth={(link: any) =>
                link.link_type === "explicit_tag"
                  ? 2.5
                  : Math.max(1, (link.weight || 0.5) * 2.2)
              }
              linkDirectionalParticles={(link: any) =>
                link.link_type === "explicit_tag" ? 2 : 0
              }
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={2}
              linkLabel={(link: any) =>
                link.link_type === "explicit_tag"
                  ? `Explicit Tag Bond (Weight: ${link.weight})`
                  : `Semantic Similarity: ${Math.round((link.weight || 0) * 100)}%`
              }
              backgroundColor="#faf7f8"
              width={dimensions.width}
              height={dimensions.height}
            />

            {/* Bottom Legend Overlay */}
            <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-pink-100 shadow-md flex items-center gap-5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-pink-500 rounded-full" />
                <span className="text-zinc-700 font-semibold">Tag Bond (Structural)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-slate-400 rounded-full" />
                <span className="text-zinc-700 font-semibold">Semantic Link (pgvector)</span>
              </div>
              <div className="text-zinc-400 border-l border-zinc-200 pl-4 font-mono">
                {filteredGraphData.nodes.length} nodes · {filteredGraphData.links.length} edges
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
