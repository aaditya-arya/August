export const MAX_DRAFT_LENGTH = 12_000;
export const DRAFT_LEASE_MS = 6 * 60_000;

export type DraftReceipt = {
  noteId: string;
  moments: number;
  tasks: number;
  reminders: number;
  events: number;
  calendarEvents: number;
};

export type WebDraft = {
  revision: string;
  content: string;
  currentTime: string;
  timezone: string;
  status: "editing" | "organizing" | "filed";
  startedAt?: number;
  receipt?: DraftReceipt;
};

export function canResumeDraft(draft: WebDraft, now = Date.now()) {
  return draft.status === "organizing" && (draft.startedAt ?? 0) + DRAFT_LEASE_MS <= now;
}
