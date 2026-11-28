import { invalidateReviewData } from "./review-data";
import { loadCategoryCatalogue, rememberCategoryCatalogue } from "./category-catalogue";
import { supabase } from "./supabase";
import { createIngestor, type IngestionDependencies, type ItemInsert, type StoredItem } from "./ingestion-core";
import { extractItems, generateEmbedding } from "./gemini";
import { computeAndStoreGraphEdges } from "./graph";
import { autoCreateGoogleCalendarEvent } from "./calendar-server";
import { currentAccount } from './account-context';
import type { TaskMetadata } from './task-state';
import { getClassification, type ExtractedItem } from './ledger';

const storage = {
  async findNote(id: string) {
    const { data, error } = await supabase.from("notes").select("id, content, extracted_items(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, content: data.content, items: data.extracted_items as StoredItem[] } : null;
  },
  async createNote(note: { id: string; content: string }) {
    const { error } = await supabase.from("notes").insert(note);
    if (error?.code === "23505") return false;
    if (error) throw error;
    return true;
  },
  async insertItems(items: ItemInsert[]) {
    const { data, error } = await supabase.from("extracted_items").insert(items).select();
    if (error) throw error;
    invalidateReviewData();
    return data as StoredItem[];
  },
  async deleteNote(id: string) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
  },
  async updateItem(id: string, update: { calendar_status: string; google_event_id?: string }) {
    let query = supabase.from("extracted_items").update(update).eq("id", id);
    if (update.calendar_status === "failed") query = query.is("google_event_id", null);
    const { error } = await query;
    if (error) throw error;
  },
} satisfies Omit<IngestionDependencies, 'extract' | 'embed' | 'connectGraph' | 'createCalendarEvent'>;

const ingest = createIngestor({
  ...storage,
  extract: async (content, context) => extractItems(content, { ...context, categories: await loadCategoryCatalogue(),
    refreshCategories: () => loadCategoryCatalogue(true), onCategoriesReviewed: rememberCategoryCatalogue }),
  embed: generateEmbedding, connectGraph: computeAndStoreGraphEdges,
  createCalendarEvent: autoCreateGoogleCalendarEvent,
});

export const ingestNote: typeof ingest = (content, options) => ingest(content, {
  ...options, namespace: `${currentAccount().userId}:${options.namespace || 'ledger'}`,
});

export async function saveManualTask(task: TaskMetadata, key: string, timezone: string) {
  // Include the deadline in the retry identity and keep manually entered tasks independent of Gemini and Calendar.
  const ingestTask = createIngestor({
    ...storage,
    extract: async (content, { currentTime }): Promise<ExtractedItem[]> => [{
      category: 'Task', life_texture: getClassification({ category: 'Task' }).texture,
      content, tags: [], sentiment_or_mood: '', event_timestamp: currentTime, is_future_actionable: false,
      calendar_action: { is_actionable: false, kind: 'none', task },
    }],
    embed: async () => [],
    connectGraph: async () => {},
    createCalendarEvent: async () => ({ success: false }),
  });
  const result = await ingestTask(task.title, {
    key: JSON.stringify([key, task.title, task.due_at]),
    namespace: `${currentAccount().userId}:manual-task`, currentTime: new Date().toISOString(), timezone,
  });
  return result.items[0];
}
