import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { backfillGraphEdges, computeEdgesInMemory } from "@/lib/graph";

export async function GET() {
  try {
    // 1. Fetch nodes from extracted_items
    const { data: items, error: itemsError } = await supabase
      .from("extracted_items")
      .select("id, category, content, tags, sentiment_or_mood, embedding, created_at")
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Error fetching graph nodes:", itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const allItems = items || [];

    // 2. Fetch edges from graph_edges
    let { data: edges, error: edgesError } = await supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id, weight, link_type, created_at");

    if (edgesError) {
      console.warn("graph_edges table query warning (fallback to in-memory):", edgesError.message);
      // Fallback: compute edges in-memory from embeddings and tags
      edges = computeEdgesInMemory(allItems) as any[];
    } else if ((!edges || edges.length === 0) && allItems.length > 1) {
      console.log("No edges found in database. Initiating automatic edge computation...");
      await backfillGraphEdges();
      const { data: refreshedEdges } = await supabase
        .from("graph_edges")
        .select("id, source_node_id, target_node_id, weight, link_type, created_at");
      edges = refreshedEdges || computeEdgesInMemory(allItems) as any[];
    }

    const allEdges = edges || [];

    // 3. Format response for react-force-graph-2d
    const nodes = allItems.map((item) => ({
      id: item.id,
      name: item.content,
      group: item.category,
      tags: item.tags || [],
      sentiment_or_mood: item.sentiment_or_mood,
      created_at: item.created_at,
      val: Math.max(3, (item.tags?.length || 1) * 2),
    }));

    const validNodeIds = new Set(nodes.map((n) => n.id));

    // Only include edges where both source and target exist in current node set
    const links = allEdges
      .filter(
        (e) =>
          validNodeIds.has(e.source_node_id) && validNodeIds.has(e.target_node_id)
      )
      .map((e) => ({
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        weight: Number(e.weight) || 0.5,
        link_type: e.link_type,
        value: Number(e.weight) || 0.5,
      }));

    return NextResponse.json({
      nodes,
      links,
      stats: {
        nodeCount: nodes.length,
        edgeCount: links.length,
        semanticCount: links.filter((l) => l.link_type === "semantic").length,
        tagCount: links.filter((l) => l.link_type === "explicit_tag").length,
      },
    });
  } catch (error: any) {
    console.error("Graph API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await backfillGraphEdges();
    return NextResponse.json({
      success: true,
      message: "Graph edges recomputed successfully",
      ...result,
    });
  } catch (error: any) {
    console.error("Graph Recompute Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
