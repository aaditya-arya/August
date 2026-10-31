import { invalidateReviewData } from "./review-data";
import { loadCategoryCatalogue, rememberCategoryCatalogue } from "./category-catalogue";
import { supabase } from "./supabase";
import { createIngestor, type StoredItem } from "./ingestion-core";
import { extractItems, generateEmbedding } from "./gemini";
import { computeAndStoreGraphEdges } from "./graph";
import { autoCreateGoogleCalendarEvent } from "./calendar-server";

export const ingestNote = createIngestor({
  async findNote(id) {
    const { data, error } = await supabase.from("notes").select("id, content, extracted_items(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, content: data.content, items: data.extracted_items as StoredItem[] } : null;
  },
  async createNote(note) {
    const { error } = await supabase.from("notes").insert(note);
    if (error?.code === "23505") return false;
    if (error) throw error;
    return true;
  },
  async insertItems(items) {
    const { data, error } = await supabase.from("extracted_items").insert(items).select();
    if (error) throw error;
    invalidateReviewData();
    return data as StoredItem[];
  },
  async deleteNote(id) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
  },
  async updateItem(id, update) {
    let query = supabase.from("extracted_items").update(update).eq("id", id);
    if (update.calendar_status === "failed") query = query.is("google_event_id", null);
    const { error } = await query;
    if (error) throw error;
  },
  extract: async (content, context) => extractItems(content, { ...context, categories: await loadCategoryCatalogue(),
    refreshCategories: () => loadCategoryCatalogue(true), onCategoriesReviewed: rememberCategoryCatalogue }),
  embed: generateEmbedding, connectGraph: computeAndStoreGraphEdges,
  createCalendarEvent: autoCreateGoogleCalendarEvent,
});
