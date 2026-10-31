import { supabase } from "./supabase";
import { normalizeStoredItem, type LedgerItem } from "./ledger";

let cached: { entries: LedgerItem[]; time: number } | null = null;
let pending: Promise<LedgerItem[]> | null = null;
export function invalidateReviewData() { cached = null; }

export async function readReviewEntries(force = false): Promise<LedgerItem[]> {
  if (!force && cached && Date.now() - cached.time < 20_000) return cached.entries;
  if (pending) return pending;
  pending = (async () => {
    const entries: LedgerItem[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("extracted_items")
        .select("id, note_id, category, content, tags, sentiment_or_mood, event_timestamp, created_at, calendar_action, calendar_status, google_event_id")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw error;
      entries.push(...data.map((entry) => normalizeStoredItem(entry) as LedgerItem));
      if (data.length < 500) break;
    }
    cached = { entries, time: Date.now() };
    return entries;
  })();
  try { return await pending; } finally { pending = null; }
}

export async function readReviewSources(entries: LedgerItem[]) {
  const ids = [...new Set(entries.map((entry) => entry.note_id).filter((id): id is string => Boolean(id)))].slice(0, 100);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("notes").select("id, content").in("id", ids);
  if (error) throw error;
  return data;
}
