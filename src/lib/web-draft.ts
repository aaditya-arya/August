import { randomUUID } from "node:crypto";
import { currentAccount } from "./account-context";
import { noteIdForKey } from "./ingestion-core";
import { ingestNote } from "./ingestion";
import { supabase } from "./supabase";
import { detectedEvents, taskList } from "./tasks";
import { getClassification } from "./ledger";
import { memorySource } from "./memory-source";
import { validTimezone } from "./time";
import { canResumeDraft, MAX_DRAFT_LENGTH, type WebDraft } from "./web-draft-model";

export const webDraftId = (accountId: string) => noteIdForKey("august:web-draft:v1", accountId);
type StoredDraft = { id: string; modified: string; draft: WebDraft };

export async function readWebDraft(): Promise<StoredDraft | null> {
  const id = webDraftId(currentAccount().userId);
  const { data, error } = await supabase.from("notes").select("content, created_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { version, ...draft } = JSON.parse(data.content);
  if (version !== 1 || typeof draft.revision !== "string" || typeof draft.content !== "string") {
    throw new Error("The cloud draft could not be read.");
  }
  return { id, modified: data.created_at, draft };
}

async function replaceDraft(previous: StoredDraft | null, draft: WebDraft): Promise<StoredDraft | null> {
  const id = previous?.id ?? webDraftId(currentAccount().userId);
  const modified = new Date(Math.max(Date.now(), previous ? Date.parse(previous.modified) + 1 : 0)).toISOString();
  // The timestamp is the compare-and-swap token. Journal text never goes in a query string.
  const fields = { content: JSON.stringify({ version: 1, ...draft }), created_at: modified };
  if (!previous) {
    const { error } = await supabase.from("notes").insert({ id, ...fields });
    if (error?.code === "23505") return null;
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("notes").update(fields)
      .eq("id", id).eq("created_at", previous.modified).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return null;
  }
  return { id, modified, draft };
}

export class DraftConflict extends Error {}
export class DraftInputError extends Error {}

export async function saveWebDraft(body: Record<string, unknown>): Promise<WebDraft> {
  const { content, expected, reset } = body;
  if (typeof content !== "string" || content.length > MAX_DRAFT_LENGTH ||
    (expected !== null && typeof expected !== "string") || (reset !== undefined && reset !== true)) {
    throw new DraftInputError(`Enter up to ${MAX_DRAFT_LENGTH.toLocaleString("en-US")} characters per entry.`);
  }
  const previous = await readWebDraft();
  const current = previous?.draft;
  if (expected !== (current?.revision ?? null)) throw new DraftConflict();
  if (reset === true && (current?.status !== "filed" || content !== "")) throw new DraftConflict();
  if (!reset && current && current.status !== "editing") throw new DraftConflict();
  if (!reset && current?.content === content) return current;
  const timezone = validTimezone(body.timezone) || current?.timezone || "UTC";
  const draft: WebDraft = {
    revision: randomUUID(), content, timezone, status: "editing",
    currentTime: current?.content.trim() && !reset ? current.currentTime : new Date().toISOString(),
  };
  if (!(await replaceDraft(previous, draft))) throw new DraftConflict();
  return draft;
}

export async function organizeWebDraft(revision: unknown): Promise<WebDraft> {
  if (typeof revision !== "string") throw new DraftInputError("A draft revision is required.");
  const previous = await readWebDraft();
  if (!previous || previous.draft.revision !== revision || !previous.draft.content.trim()) throw new DraftConflict();
  const current = previous.draft;
  if (current.status === "filed" || (current.status === "organizing" && !canResumeDraft(current))) return current;
  const locked = await replaceDraft(previous, { ...current, status: "organizing", startedAt: Date.now() });
  if (!locked) throw new DraftConflict();
  let receipt;
  try {
    const result = await ingestNote(current.content.trim(), {
      key: `web-draft:${current.revision}`, timezone: current.timezone,
      currentTime: current.currentTime, syncCalendar: true,
    });
    const actions = taskList(result.items, current.timezone);
    const leading = current.content.length - current.content.trimStart().length;
    const passages = result.items.flatMap(item => {
      const action = actions.find(task => task.id === item.id);
      const category = getClassification(item);
      const kind = action ? "work" as const : category.category === "Event" ? "event" as const
        : ["quiet_moment", "perspective", "hard_truth", "shaairi_quote"].includes(category.texture) ||
          /emotion|feeling|gratitude|anxiety|grief|joy/i.test(category.label) ? "feeling" as const : "memory" as const;
      return (memorySource(item.calendar_action?.memory)?.spans ?? []).map(span => ({
        start: leading + span.start, end: leading + span.end, kind, label: category.label,
        dated: Boolean(action?.due_at || item.calendar_action?.start_time), synced: item.calendar_status === "synced",
      }));
    }).sort((a, b) => a.start - b.start);
    receipt = {
      noteId: result.noteId, moments: result.extractedCount, passages,
      tasks: actions.filter(action => action.kind === "task").length,
      reminders: actions.filter(action => action.kind === "reminder").length,
      events: detectedEvents(result.items).length,
      calendarEvents: result.items.filter(item => item.calendar_status === "synced" && item.google_event_id).length,
    };
  } catch (error) {
    await replaceDraft(locked, { ...current, status: "editing", startedAt: undefined });
    throw error;
  }
  const finished = await replaceDraft(locked, { ...current, status: "filed", startedAt: undefined, receipt });
  if (!finished) throw new DraftConflict();
  return finished.draft;
}
