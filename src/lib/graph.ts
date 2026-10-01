import { supabase } from "@/lib/supabase";

export interface ExtractedItemNode {
  id: string;
  category: string;
  content: string;
  tags?: string[];
  sentiment_or_mood?: string;
  embedding?: number[] | string | null;
  event_timestamp?: string;
  created_at?: string;
}

export interface GraphEdge {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  weight: number;
  link_type: "semantic" | "explicit_tag";
  created_at?: string;
}

const SEMANTIC_SIMILARITY_THRESHOLD = 0.62;
const MAX_SEMANTIC_EDGES_PER_NODE = 5;
const EXPLICIT_TAG_BASE_WEIGHT = 0.85;

/**
 * Calculates cosine similarity between two vector arrays
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Parses vector representation from Supabase pgvector (which may be a string or array)
 */
export function parseEmbedding(embedding: any): number[] | null {
  if (!embedding) return null;
  if (Array.isArray(embedding)) return embedding;
  if (typeof embedding === "string") {
    try {
      // Handles '[0.123, -0.456, ...]'
      const clean = embedding.trim().replace(/^\[/, "").replace(/\]$/, "");
      return clean.split(",").map((v) => parseFloat(v.trim()));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Normalizes node pair IDs so that source_node_id < target_node_id
 * to ensure bidirectional uniqueness.
 */
function normalizeEdgePair(
  nodeIdA: string,
  nodeIdB: string,
  weight: number,
  linkType: "semantic" | "explicit_tag"
): GraphEdge {
  const [source_node_id, target_node_id] =
    nodeIdA < nodeIdB ? [nodeIdA, nodeIdB] : [nodeIdB, nodeIdA];
  return {
    source_node_id,
    target_node_id,
    weight: Math.round(weight * 1000) / 1000,
    link_type: linkType,
  };
}

/**
 * Prunes and manages semantic edges for a node to keep degree <= MAX_SEMANTIC_EDGES_PER_NODE
 */
async function enforceSemanticPruning(
  candidateEdge: GraphEdge,
  allExistingEdges: GraphEdge[]
): Promise<{ shouldInsert: boolean; edgeToDelete?: GraphEdge }> {
  const { source_node_id, target_node_id, weight } = candidateEdge;

  // Check edges connected to source_node_id
  const sourceSemanticEdges = allExistingEdges.filter(
    (e) =>
      e.link_type === "semantic" &&
      (e.source_node_id === source_node_id || e.target_node_id === source_node_id)
  );

  // Check edges connected to target_node_id
  const targetSemanticEdges = allExistingEdges.filter(
    (e) =>
      e.link_type === "semantic" &&
      (e.source_node_id === target_node_id || e.target_node_id === target_node_id)
  );

  let edgeToDelete: GraphEdge | undefined;

  if (sourceSemanticEdges.length >= MAX_SEMANTIC_EDGES_PER_NODE) {
    sourceSemanticEdges.sort((a, b) => a.weight - b.weight);
    const weakest = sourceSemanticEdges[0];
    if (weight > weakest.weight) {
      edgeToDelete = weakest;
    } else {
      return { shouldInsert: false };
    }
  }

  if (targetSemanticEdges.length >= MAX_SEMANTIC_EDGES_PER_NODE) {
    targetSemanticEdges.sort((a, b) => a.weight - b.weight);
    const weakest = targetSemanticEdges[0];
    if (weight > weakest.weight) {
      edgeToDelete = edgeToDelete || weakest;
    } else {
      return { shouldInsert: false };
    }
  }

  return { shouldInsert: true, edgeToDelete };
}

/**
 * Main write-time pipeline: computes similarity & tag overlaps for newly inserted nodes,
 * applies pruning, and writes connections into graph_edges table.
 */
export async function computeAndStoreGraphEdges(
  newItems: ExtractedItemNode[]
): Promise<{ edgesCreated: number; errors: any[] }> {
  if (!newItems || newItems.length === 0) {
    return { edgesCreated: 0, errors: [] };
  }

  const errors: any[] = [];
  let edgesCreated = 0;

  try {
    // 1. Fetch all existing items with tags & embeddings for comparison
    const { data: allItemsData, error: fetchErr } = await supabase
      .from("extracted_items")
      .select("id, category, content, tags, embedding");

    if (fetchErr || !allItemsData) {
      console.error("Failed to fetch items for graph edge computation:", fetchErr);
      return { edgesCreated: 0, errors: [fetchErr] };
    }

    const allItems: ExtractedItemNode[] = allItemsData.map((item) => ({
      ...item,
      embedding: parseEmbedding(item.embedding),
    }));

    // 2. Fetch all existing edges
    const { data: existingEdgesData } = await supabase
      .from("graph_edges")
      .select("id, source_node_id, target_node_id, weight, link_type");

    let currentEdges: GraphEdge[] = (existingEdgesData || []) as GraphEdge[];

    // 3. For each newly inserted item, compare with existing nodes
    for (const newItem of newItems) {
      const newEmbedding = parseEmbedding(newItem.embedding);
      const newTags = (newItem.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);

      for (const existingItem of allItems) {
        if (existingItem.id === newItem.id) continue;

        // --- A. Explicit Tag Connections ---
        const existingTags = (existingItem.tags || [])
          .map((t) => t.toLowerCase().trim())
          .filter(Boolean);
        const commonTags = newTags.filter((t) => existingTags.includes(t));

        if (commonTags.length > 0) {
          const tagWeight = Math.min(
            1.0,
            EXPLICIT_TAG_BASE_WEIGHT + (commonTags.length - 1) * 0.05
          );
          const tagEdge = normalizeEdgePair(
            newItem.id,
            existingItem.id,
            tagWeight,
            "explicit_tag"
          );

          // Check if this tag edge already exists
          const exists = currentEdges.some(
            (e) =>
              e.source_node_id === tagEdge.source_node_id &&
              e.target_node_id === tagEdge.target_node_id &&
              e.link_type === "explicit_tag"
          );

          if (!exists) {
            const { error: insErr } = await supabase
              .from("graph_edges")
              .upsert([tagEdge], {
                onConflict: "source_node_id,target_node_id,link_type",
              });

            if (insErr) {
              errors.push(insErr);
            } else {
              currentEdges.push(tagEdge);
              edgesCreated++;
            }
          }
        }

        // --- B. Semantic Similarity Connections ---
        const existingEmbedding = parseEmbedding(existingItem.embedding);
        if (newEmbedding && existingEmbedding) {
          const similarity = cosineSimilarity(newEmbedding, existingEmbedding);

          if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
            const semanticEdge = normalizeEdgePair(
              newItem.id,
              existingItem.id,
              similarity,
              "semantic"
            );

            // Check if this semantic edge already exists
            const alreadyExists = currentEdges.some(
              (e) =>
                e.source_node_id === semanticEdge.source_node_id &&
                e.target_node_id === semanticEdge.target_node_id &&
                e.link_type === "semantic"
            );

            if (!alreadyExists) {
              // Apply pruning: cap maximum semantic edges per node at 5
              const pruning = await enforceSemanticPruning(semanticEdge, currentEdges);

              if (pruning.shouldInsert) {
                if (pruning.edgeToDelete) {
                  // Delete the weaker edge
                  await supabase
                    .from("graph_edges")
                    .delete()
                    .eq("source_node_id", pruning.edgeToDelete.source_node_id)
                    .eq("target_node_id", pruning.edgeToDelete.target_node_id)
                    .eq("link_type", "semantic");

                  currentEdges = currentEdges.filter(
                    (e) =>
                      !(
                        e.source_node_id === pruning.edgeToDelete!.source_node_id &&
                        e.target_node_id === pruning.edgeToDelete!.target_node_id &&
                        e.link_type === "semantic"
                      )
                  );
                }

                const { error: insErr } = await supabase
                  .from("graph_edges")
                  .upsert([semanticEdge], {
                    onConflict: "source_node_id,target_node_id,link_type",
                  });

                if (insErr) {
                  errors.push(insErr);
                } else {
                  currentEdges.push(semanticEdge);
                  edgesCreated++;
                }
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Error in computeAndStoreGraphEdges:", err);
    errors.push(err);
  }

  return { edgesCreated, errors };
}

/**
 * Computes graph edges entirely in memory from a given list of items.
 * Useful as a fallback when graph_edges table is not yet migrated, or for instant preview.
 */
export function computeEdgesInMemory(
  items: ExtractedItemNode[]
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const parsedItems = items.map((i) => ({
    ...i,
    embedding: parseEmbedding(i.embedding),
  }));

  for (let i = 0; i < parsedItems.length; i++) {
    const itemA = parsedItems[i];
    const tagsA = (itemA.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);

    for (let j = i + 1; j < parsedItems.length; j++) {
      const itemB = parsedItems[j];
      const tagsB = (itemB.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean);

      // Explicit Tag Overlap
      const commonTags = tagsA.filter((t) => tagsB.includes(t));
      if (commonTags.length > 0) {
        const tagWeight = Math.min(1.0, EXPLICIT_TAG_BASE_WEIGHT + (commonTags.length - 1) * 0.05);
        edges.push(normalizeEdgePair(itemA.id, itemB.id, tagWeight, "explicit_tag"));
      }

      // Semantic Vector Similarity
      if (itemA.embedding && itemB.embedding) {
        const sim = cosineSimilarity(itemA.embedding as number[], itemB.embedding as number[]);
        if (sim >= SEMANTIC_SIMILARITY_THRESHOLD) {
          const semanticEdge = normalizeEdgePair(itemA.id, itemB.id, sim, "semantic");
          
          // Enforce max 5 semantic edges
          const sourceCount = edges.filter(
            (e) => e.link_type === "semantic" && (e.source_node_id === itemA.id || e.target_node_id === itemA.id)
          ).length;
          const targetCount = edges.filter(
            (e) => e.link_type === "semantic" && (e.source_node_id === itemB.id || e.target_node_id === itemB.id)
          ).length;

          if (sourceCount < MAX_SEMANTIC_EDGES_PER_NODE && targetCount < MAX_SEMANTIC_EDGES_PER_NODE) {
            edges.push(semanticEdge);
          }
        }
      }
    }
  }

  return edges;
}

/**
 * Backfills and recomputes all graph edges across the entire database
 */
export async function backfillGraphEdges(): Promise<{
  totalNodes: number;
  edgesCreated: number;
  errors: any[];
}> {
  const { data: allItems, error } = await supabase
    .from("extracted_items")
    .select("id, category, content, tags, embedding, created_at");

  if (error || !allItems) {
    return { totalNodes: 0, edgesCreated: 0, errors: [error] };
  }

  // Clear existing edges for a clean recalculation if needed or upsert
  const res = await computeAndStoreGraphEdges(allItems);
  return {
    totalNodes: allItems.length,
    edgesCreated: res.edgesCreated,
    errors: res.errors,
  };
}

