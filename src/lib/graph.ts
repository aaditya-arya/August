import { supabase } from "./supabase";
import { errorMessage } from "./errors";
import { SEMANTIC_SIMILARITY_THRESHOLD, MAX_SEMANTIC_EDGES_PER_NODE, EXPLICIT_TAG_BASE_WEIGHT } from "./graph-config";
import { parseEmbedding, normalizeEdgePair, enforceSemanticPruning, edgeKey, type ExtractedItemNode, type GraphEdge } from "./graph-math";
export { computeEdgesInMemory, parseEmbedding, cosineSimilarity } from "./graph-math";
export type { ExtractedItemNode, GraphEdge } from "./graph-math";

type SimilarNode = { id: string; similarity: number };

export async function computeAndStoreGraphEdges(newItems: ExtractedItemNode[]): Promise<{ edgesCreated: number; errors: string[] }> {
  let edgesCreated = 0;
  const errors: string[] = [];
  for (const item of newItems) {
    try {
      const tags = [...new Set((item.tags || []).map((tag) => tag.toLowerCase().trim()).filter(Boolean))];
      if (tags.length) {
        // Page matching metadata only, preserving every tag bond without loading the ledger.
        for (let offset = 0; ; offset += 200) {
          const { data, error } = await supabase.from("extracted_items").select("id, tags").neq("id", item.id).overlaps("tags", tags).order("id").range(offset, offset + 199);
          if (error) throw error;
          const edges = (data || []).map((other) => normalizeEdgePair(item.id, other.id,
            Math.min(1, EXPLICIT_TAG_BASE_WEIGHT + (tags.filter((tag) => (other.tags as string[]).map((t) => t.toLowerCase()).includes(tag)).length - 1) * .05), "explicit_tag"));
          if (edges.length) {
            const { data: inserted, error: insertError } = await supabase.from("graph_edges").upsert(edges, { onConflict: "source_node_id,target_node_id,link_type", ignoreDuplicates: true }).select("id");
            if (insertError) throw insertError;
            edgesCreated += inserted?.length || 0;
          }
          if (!data || data.length < 200) break;
        }
      }
      const embedding = parseEmbedding(item.embedding);
      if (!embedding) continue;
      const { data: neighbors, error } = await supabase.rpc("match_similar_nodes", { query_embedding: embedding, target_node_id: item.id, match_threshold: SEMANTIC_SIMILARITY_THRESHOLD, match_count: MAX_SEMANTIC_EDGES_PER_NODE * 2 });
      if (error) throw error;
      for (const neighbor of (neighbors || []) as SimilarNode[]) {
        const edge = normalizeEdgePair(item.id, neighbor.id, neighbor.similarity, "semantic");
        const ids = `${edge.source_node_id},${edge.target_node_id}`;
        const { data, error: readError } = await supabase.from("graph_edges").select("id, source_node_id, target_node_id, weight, link_type").eq("link_type", "semantic").or(`source_node_id.in.(${ids}),target_node_id.in.(${ids})`);
        if (readError) throw readError;
        const existing = (data || []) as GraphEdge[];
        if (existing.some((old) => edgeKey(old) === edgeKey(edge))) continue;
        const plan = enforceSemanticPruning(edge, existing);
        if (!plan.shouldInsert) continue;
        // Insert first so a rejected/failed write cannot discard valid old connections.
        const { error: insertError } = await supabase.from("graph_edges").upsert(edge, { onConflict: "source_node_id,target_node_id,link_type" });
        if (insertError) throw insertError;
        if (plan.edgesToDelete.length) {
          const { error: deleteError } = await supabase.from("graph_edges").delete().in("id", plan.edgesToDelete.map((old) => old.id!));
          if (deleteError) throw deleteError;
        }
        edgesCreated++;
      }
    } catch (error) { errors.push(errorMessage(error)); }
  }
  if (errors.length) console.error("Graph connection errors:", errors);
  return { edgesCreated, errors };
}

/** Explicit recomputation visits the ledger in bounded pages, using the same indexed pipeline. */
export async function backfillGraphEdges() {
  let totalNodes = 0, edgesCreated = 0;
  const errors: string[] = [];
  let cursor = "";
  for (;;) {
    let query = supabase.from("extracted_items").select("id, category, content, tags, embedding").order("id").limit(100);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) { errors.push(error.message); break; }
    if (!data?.length) break;
    const result = await computeAndStoreGraphEdges(data);
    totalNodes += data.length; edgesCreated += result.edgesCreated; errors.push(...result.errors);
    cursor = data[data.length - 1].id;
  }
  return { totalNodes, edgesCreated, errors };
}
