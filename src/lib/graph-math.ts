import { MAX_SEMANTIC_EDGES_PER_NODE, SEMANTIC_SIMILARITY_THRESHOLD, EXPLICIT_TAG_BASE_WEIGHT } from "./graph-config";

export interface ExtractedItemNode {
  id: string; category: string; content: string; tags?: string[]; sentiment_or_mood?: string;
  embedding?: number[] | string | null; event_timestamp?: string; created_at?: string;
}
export interface GraphEdge {
  id?: string; source_node_id: string; target_node_id: string; weight: number;
  link_type: "semantic" | "explicit_tag"; created_at?: string;
}
export function parseEmbedding(value: unknown): number[] | null {
  let parsed = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { return null; } }
  return Array.isArray(parsed) && parsed.length > 0 && parsed.every((v) => typeof v === "number" && Number.isFinite(v)) ? parsed : null;
}
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] ** 2; normB += b[i] ** 2; }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}
export function normalizeEdgePair(a: string, b: string, weight: number, link_type: GraphEdge["link_type"]): GraphEdge {
  const [source_node_id, target_node_id] = a < b ? [a, b] : [b, a];
  return { source_node_id, target_node_id, weight: Math.round(weight * 1000) / 1000, link_type };
}
export function edgeKey(edge: GraphEdge): string { return `${edge.source_node_id}:${edge.target_node_id}:${edge.link_type}`; }

/** Plan ALL evictions before mutating anything; both endpoints must fit the cap. */
export function enforceSemanticPruning(candidate: GraphEdge, existing: GraphEdge[]): { shouldInsert: boolean; edgesToDelete: GraphEdge[] } {
  const evictions = new Map<string, GraphEdge>();
  for (const id of [candidate.source_node_id, candidate.target_node_id]) {
    const incident = existing.filter((edge) => edge.link_type === "semantic" && edgeKey(edge) !== edgeKey(candidate) &&
      (edge.source_node_id === id || edge.target_node_id === id)).sort((a, b) => a.weight - b.weight);
    const count = Math.max(0, incident.length - MAX_SEMANTIC_EDGES_PER_NODE + 1);
    if (count && candidate.weight <= incident[count - 1].weight) return { shouldInsert: false, edgesToDelete: [] };
    for (const edge of incident.slice(0, count)) evictions.set(edgeKey(edge), edge);
  }
  return { shouldInsert: true, edgesToDelete: [...evictions.values()] };
}

export function computeEdgesInMemory(items: ExtractedItemNode[]): GraphEdge[] {
  const tags: GraphEdge[] = [], candidates: GraphEdge[] = [];
  const parsed = items.map((item) => ({ ...item, embedding: parseEmbedding(item.embedding), tags: [...new Set((item.tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean))] }));
  for (let i = 0; i < parsed.length; i++) for (let j = i + 1; j < parsed.length; j++) {
    const a = parsed[i], b = parsed[j];
    const overlap = a.tags.filter((tag) => b.tags.includes(tag)).length;
    if (overlap) tags.push(normalizeEdgePair(a.id, b.id, Math.min(1, EXPLICIT_TAG_BASE_WEIGHT + (overlap - 1) * .05), "explicit_tag"));
    if (a.embedding && b.embedding) {
      const similarity = cosineSimilarity(a.embedding, b.embedding);
      if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) candidates.push(normalizeEdgePair(a.id, b.id, similarity, "semantic"));
    }
  }
  const degrees = new Map<string, number>();
  const semantic = candidates.sort((a, b) => b.weight - a.weight).filter((edge) => {
    if ([edge.source_node_id, edge.target_node_id].some((id) => (degrees.get(id) || 0) >= MAX_SEMANTIC_EDGES_PER_NODE)) return false;
    for (const id of [edge.source_node_id, edge.target_node_id]) degrees.set(id, (degrees.get(id) || 0) + 1);
    return true;
  });
  return [...tags, ...semantic];
}
