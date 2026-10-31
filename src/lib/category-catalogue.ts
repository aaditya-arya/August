import { supabase } from "./supabase";
import { mergeCategoryCatalogue } from "./taxonomy";
import type { CategoryDefinition } from "./ledger";

let cache: { entries: CategoryDefinition[]; loadedAt: number; watermark: string | null } | null = null;
let pending: Promise<CategoryDefinition[]> | null = null;

/** Names persist in the existing category column; representative entries supply their scope. */
export async function loadCategoryCatalogue(force = false): Promise<CategoryDefinition[]> {
  if (!force && cache && Date.now() - cache.loadedAt < 60_000) return cache.entries;
  if (pending) return pending;
  pending = (async () => {
    let entries = mergeCategoryCatalogue([], cache?.entries);
    const since = cache?.watermark;
    let watermark = since || null;
    for (let offset = 0; ; offset += 500) {
      let query = supabase.from("extracted_items").select("category, content, created_at").order("created_at").order("id");
      if (since) query = query.gte("created_at", since);
      const { data, error } = await query.range(offset, offset + 499);
      if (error) throw error;
      entries = mergeCategoryCatalogue(data, entries);
      if (data.length) watermark = data[data.length - 1].created_at;
      if (data.length < 500) break;
    }
    cache = { entries, loadedAt: Date.now(), watermark };
    return entries;
  })();
  try { return await pending; } finally { pending = null; }
}

export function rememberCategoryCatalogue(entries: CategoryDefinition[]) { cache = { entries, loadedAt: Date.now(), watermark: cache?.watermark || null }; }
