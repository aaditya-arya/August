import { supabase } from "./supabase";
import { normalizeStoredItem, type LedgerItem } from "./ledger";
import { accountResource } from './account-context';

type State = { cached: { entries: LedgerItem[]; time: number } | null; pending: Promise<LedgerItem[]> | null; revision: number };
const state = () => accountResource<State>('review-data', () => ({ cached: null, pending: null, revision: 0 }));
export function invalidateReviewData() { const account = state(); account.cached = null; account.pending = null; account.revision++; }

export async function readReviewEntries(force = false): Promise<LedgerItem[]> {
  const account = state();
  const { cached, pending } = account;
  if (!force && cached && Date.now() - cached.time < 20_000) return cached.entries;
  if (pending) return pending;
  const revision = account.revision;
  const work = (async () => {
    const entries: LedgerItem[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("extracted_items")
        .select("id, note_id, category, content, tags, sentiment_or_mood, event_timestamp, created_at, calendar_action, calendar_status, google_event_id")
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw error;
      entries.push(...data.map((entry) => normalizeStoredItem(entry) as LedgerItem));
      if (data.length < 500) break;
    }
    if (revision === account.revision) account.cached = { entries, time: Date.now() };
    return entries;
  })();
  account.pending = work;
  try { return await work; } finally { if (account.pending === work) account.pending = null; }
}

export async function readReviewSources(entries: LedgerItem[]) {
  const ids = [...new Set(entries.map((entry) => entry.note_id).filter((id): id is string => Boolean(id)))].slice(0, 100);
  if (!ids.length) return [];
  const { data, error } = await supabase.from("notes").select("id, content").in("id", ids);
  if (error) throw error;
  return data;
}
