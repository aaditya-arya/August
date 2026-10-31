import { NextResponse } from "next/server";
import { getClassification } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";
import { backfillGraphEdges } from "@/lib/graph";
import type { GraphEdge, ExtractedItemNode } from "@/lib/graph-math";
import { errorMessage } from "@/lib/errors";

export const maxDuration = 300;
export async function GET() {
  try {
    const items: ExtractedItemNode[] = [];
    const edges: GraphEdge[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("extracted_items").select("id, category, content, tags, sentiment_or_mood, created_at").order("id").range(offset, offset + 499);
      if (error) throw error;
      items.push(...data);
      if (data.length < 500) break;
    }
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("graph_edges").select("id, source_node_id, target_node_id, weight, link_type").order("id").range(offset, offset + 499);
      if (error) throw error;
      edges.push(...data as GraphEdge[]);
      if (data.length < 500) break;
    }
    const nodes = items.map((item) => ({ id: item.id, name: item.content, group: getClassification(item).category, color: getClassification(item).color, tags: item.tags || [], sentiment_or_mood: item.sentiment_or_mood, created_at: item.created_at, val: Math.max(3, (item.tags?.length || 1) * 2) }));
    const ids = new Set(nodes.map((node) => node.id));
    const links = edges.filter((edge) => ids.has(edge.source_node_id) && ids.has(edge.target_node_id)).map((edge) => ({ id: edge.id, source: edge.source_node_id, target: edge.target_node_id, weight: Number(edge.weight), link_type: edge.link_type, value: Number(edge.weight) }));
    return NextResponse.json({ nodes, links, stats: { nodeCount: nodes.length, edgeCount: links.length, semanticCount: links.filter((link) => link.link_type === "semantic").length, tagCount: links.filter((link) => link.link_type === "explicit_tag").length } });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}
export async function POST() {
  try {
    const result = await backfillGraphEdges();
    return NextResponse.json({ success: result.errors.length === 0, ...result }, { status: result.errors.length ? 500 : 200 });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}
