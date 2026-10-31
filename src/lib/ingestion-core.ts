import { createHash, randomUUID } from "node:crypto";
import { mapConcurrent } from "./async";
import { errorMessage } from "./errors";
import type { CalendarAction, ExtractedItem, LedgerItem } from "./ledger";

export type StoredItem = LedgerItem & { note_id: string; embedding?: number[] | string | null };
export type ItemInsert = Omit<StoredItem, "created_at">;
export type SavedNote = { id: string; content: string; items: StoredItem[] };
export type CalendarSync = { success: boolean; eventId?: string; htmlLink?: string; error?: string };
export type IngestionDependencies = {
  findNote: (id: string) => Promise<SavedNote | null>;
  createNote: (note: { id: string; content: string }) => Promise<boolean>;
  insertItems: (items: ItemInsert[]) => Promise<StoredItem[]>;
  deleteNote: (id: string) => Promise<void>;
  updateItem: (id: string, update: { calendar_status: string; google_event_id?: string }) => Promise<void>;
  extract: (content: string, context: { currentTime: string; timezone: string }) => Promise<ExtractedItem[]>;
  embed: (text: string) => Promise<number[]>;
  connectGraph: (items: StoredItem[]) => Promise<unknown>;
  createCalendarEvent: (action: CalendarAction, content: string, itemId: string) => Promise<CalendarSync>;
};

export function noteIdForKey(namespace: string, key: string): string {
  const hex = createHash("sha256").update(`${namespace}\0${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function createIngestor(deps: IngestionDependencies) {
  async function syncCalendar(items: StoredItem[], enabled?: boolean) {
    return (await mapConcurrent(items, 3, async (item) => {
      if (!enabled || !item.calendar_action?.is_actionable || item.calendar_status === "synced" || Boolean(item.google_event_id)) return null;
      let result: CalendarSync;
      try { result = await deps.createCalendarEvent(item.calendar_action, item.content, item.id); }
      catch (error) { result = { success: false, error: errorMessage(error) }; }
      const synced = result.success && Boolean(result.eventId);
      const update = { calendar_status: synced ? "synced" : "failed", ...(synced ? { google_event_id: result.eventId! } : {}) };
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await deps.updateItem(item.id, update);
          Object.assign(item, update);
          break;
        } catch (error) {
          if (attempt === 2) console.error("Calendar status update failed:", errorMessage(error));
          else await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
      return synced ? { title: item.calendar_action.title, start_time: item.calendar_action.start_time, eventId: result.eventId, htmlLink: result.htmlLink } : null;
    })).filter((event) => event !== null);
  }

  return async function ingest(content: string, options: { key?: string; namespace?: string; currentTime: string; timezone: string; syncCalendar?: boolean }) {
    if (!content.trim()) throw new Error("Content is required.");
    const noteId = options.key ? noteIdForKey(options.namespace || "ledger", options.key) : randomUUID();
    const existing = await deps.findNote(noteId);
    if (existing) {
      if (existing.content !== content) throw new Error("This submission key was already used for different content.");
      if (existing.items.length === 0) throw new Error("This submission is still being saved. Please retry shortly.");
      return { success: true, noteId, extractedCount: existing.items.length, items: existing.items, reused: true, calendarEventsSynced: await syncCalendar(existing.items, options.syncCalendar) };
    }

    // Do all fallible AI work first. Provider failures leave no raw notes to duplicate on retry.
    const extracted = await deps.extract(content, options);
    if (!extracted.length) throw new Error("No classified items were returned; no note was saved.");
    const rows = await mapConcurrent(extracted, 3, async (item): Promise<ItemInsert> => {
      const embedding = await deps.embed(item.content);
      return { id: randomUUID(), note_id: noteId, category: item.category, content: item.content,
        tags: [...new Set(item.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))],
        sentiment_or_mood: item.sentiment_or_mood || undefined, event_timestamp: item.event_timestamp,
        calendar_action: item.calendar_action, calendar_status: item.calendar_action.is_actionable && options.syncCalendar ? "pending" : "none",
        embedding: embedding.length ? embedding : null };
    });
    const created = await deps.createNote({ id: noteId, content });
    if (!created) {
      const winner = await deps.findNote(noteId);
      if (winner?.content === content && winner.items.length) return { success: true, noteId, extractedCount: winner.items.length, items: winner.items, reused: true, calendarEventsSynced: await syncCalendar(winner.items, options.syncCalendar) };
      throw new Error("This submission is already being saved. Please retry shortly.");
    }

    let inserted: StoredItem[];
    try {
      inserted = await deps.insertItems(rows);
      if (inserted.length !== rows.length) throw new Error("Not all classified items were saved.");
    } catch (error) {
      // Delete only the note created by this request; ON DELETE CASCADE also removes partial items.
      try { await deps.deleteNote(noteId); }
      catch (cleanupError) { throw new Error(`Saving failed and cleanup could not finish: ${errorMessage(cleanupError)}`); }
      throw error;
    }
    try { await deps.connectGraph(inserted); } catch (error) { console.error("Graph connection failed:", errorMessage(error)); }

    const calendarEventsSynced = await syncCalendar(inserted, options.syncCalendar);

    return { success: true, noteId, extractedCount: inserted.length, items: inserted, reused: false, calendarEventsSynced };
  };
}
