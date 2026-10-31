import { canonicalCategory, type LedgerItem } from "./ledger";
import { intentionState, localDay, validDay, type IntentionState } from "./intention-state";

export type ReviewInsight = { title: string; meaning: string; takeaway: string; source_ids: string[] };
export type ReviewIntention = {
  anchor_id: string; title: string; kind: "wish" | "goal" | "task";
  status: "open" | "progress" | "completed" | "released" | "paused";
  reflection: string; gap: string; next_step: string; source_ids: string[];
  deadline: string | null; last_movement_at: string; state: IntentionState | null;
};
export type SundayReview = {
  opening: string;
  progress: ReviewInsight[];
  experiences: ReviewInsight[];
  lessons: ReviewInsight[];
  patterns: ReviewInsight[];
  intentions: ReviewIntention[];
  next_step: ReviewInsight | null;
  question: string;
};
export type ReviewPeriod = { days: "7" | "30" | "all"; start: string | null; end: string; label: string };
export type ReviewResponse = {
  review: SundayReview | null; status: "ready" | "unavailable"; period: ReviewPeriod;
  intentions: ReviewIntention[]; entries: LedgerItem[]; selected_count: number;
  context_count: number; generated_at: string; message?: string;
};

export function reviewPeriod(days: ReviewPeriod["days"], now: Date): ReviewPeriod {
  return { days, start: days === "all" ? null : new Date(now.getTime() - Number(days) * 86400000).toISOString(), end: now.toISOString(), label: days === "all" ? "Across your ledger" : days === "7" ? "The last seven days" : "The last thirty days" };
}

export function inReviewPeriod(item: LedgerItem, period: ReviewPeriod): boolean {
  const event = Date.parse(item.event_timestamp), created = Date.parse(item.created_at);
  // A future plan belongs to when it was expressed, not to an imaginary completed future.
  const time = Number.isFinite(event) && event <= Date.parse(period.end) ? event : created;
  const changed = intentionState(item)?.updated_at;
  const inWindow = (value: number) => value <= Date.parse(period.end) && (!period.start || value >= Date.parse(period.start));
  return inWindow(time) || Boolean(changed && inWindow(Date.parse(changed)));
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Review returned invalid text.");
  return value.trim();
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid review object.");
  return value as Record<string, unknown>;
}
function sources(value: unknown, entries: Map<string, LedgerItem>): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 12 || value.some((id) => typeof id !== "string" || !entries.has(id))) throw new Error("Review referred to missing source entries.");
  return [...new Set(value as string[])];
}

export function parseSundayReview(value: unknown, allEntries: LedgerItem[], period: ReviewPeriod, timezone: string): SundayReview {
  const raw = object(value), entries = new Map(allEntries.map((entry) => [entry.id, entry]));
  const selected = new Set(allEntries.filter((entry) => inReviewPeriod(entry, period)).map((entry) => entry.id));
  const insight = (value: unknown): ReviewInsight => {
    const row = object(value);
    return { title: text(row.title, 120), meaning: text(row.meaning, 900), takeaway: text(row.takeaway, 700), source_ids: sources(row.source_ids, entries) };
  };
  const section = (key: string): ReviewInsight[] => {
    if (!Array.isArray(raw[key]) || raw[key].length > 5) throw new Error("Invalid review section.");
    return raw[key].map(insight).filter((item) => item.source_ids.some((id) => selected.has(id)));
  };
  const progress = section("progress").filter((item) => item.source_ids.some((id) => {
    const source = entries.get(id)!;
    const state = intentionState(source);
    if (selected.has(id) && state && (state.status === "completed" || (state.status === "active" && Boolean(state.next_step || state.target_date || state.target_amount)))) return true;
    return selected.has(id) && Date.parse(source.event_timestamp) <= Date.parse(period.end) &&
      !["Wishlist", "Idea", "Task", "Reminder", "Media_Log"].includes(canonicalCategory(source.category) || "") &&
      !(canonicalCategory(source.category) === "Event" && source.calendar_action?.is_actionable);
  }));
  if (!Array.isArray(raw.intentions) || raw.intentions.length > 20) throw new Error("Invalid intentions.");
  const used = new Set<string>();
  const intentions = raw.intentions.map((value): ReviewIntention => {
    const row = object(value), anchor = text(row.anchor_id, 100);
    if (!entries.has(anchor) || used.has(anchor) || !["wish", "goal", "task"].includes(String(row.kind)) || !["open", "progress", "completed", "released", "paused"].includes(String(row.status))) throw new Error("Invalid intention reference or status.");
    used.add(anchor);
    const ids = sources(row.source_ids, entries);
    if (!ids.includes(anchor)) throw new Error("Intention must reference its original entry.");
    const state = intentionState(entries.get(anchor)!);
    const supporting = ids.filter((id) => id !== anchor && Date.parse(entries.get(id)!.created_at) >= Date.parse(entries.get(anchor)!.created_at) && Date.parse(entries.get(id)!.event_timestamp) <= Date.parse(period.end));
    let status = row.status as ReviewIntention["status"];
    if (["completed", "progress", "released"].includes(status) && !supporting.length) status = "open";
    if (state) status = state.status === "active" ? (status === "completed" || status === "progress" ? status : "open") : state.status;
    let deadline: string | null = null;
    if (validDay(row.deadline)) {
      // Model dates must correspond to an actually scheduled source, never a made-up year-end deadline.
      const grounded = ids.some((id) => {
        const action = entries.get(id)!.calendar_action;
        return action?.is_actionable && action.start_time && localDay(new Date(action.start_time), timezone) === row.deadline;
      });
      if (grounded) deadline = row.deadline;
    }
    if (state) deadline = state.target_date;
    const movement = supporting.map((id) => entries.get(id)!.event_timestamp).sort().slice(-1)[0] || entries.get(anchor)!.created_at;
    const uncommittedWish = !state && !supporting.length && canonicalCategory(entries.get(anchor)!.category) === "Wishlist";
    return { anchor_id: anchor, title: state?.title || text(row.title, 140), kind: state ? "goal" : uncommittedWish ? "wish" : row.kind as ReviewIntention["kind"], status,
      reflection: text(row.reflection, 700), gap: !state && !supporting.length ? "No linked follow-through is recorded yet. You can keep this, plan it, or decide it no longer matters." : text(row.gap, 400),
      next_step: state?.next_step || (deadline && deadline < localDay(new Date(period.end), timezone) && !supporting.length ? "Confirm whether this happened, then mark it done, choose a new date, or let it go." : text(row.next_step, 300)),
      source_ids: ids, deadline, last_movement_at: movement, state };
  });
  const proposedNext = raw.next_step === null ? null : insight(raw.next_step);
  const next = proposedNext?.source_ids.some((id) => {
    const source = entries.get(id)!;
    return ["Wishlist", "Task", "Reminder", "Event"].includes(canonicalCategory(source.category) || "") || intentionState(source)?.status === "active";
  }) ? proposedNext : null;
  const experiences = section("experiences").filter((item) => item.source_ids.some((id) => {
    const source = entries.get(id)!;
    return selected.has(id) && Date.parse(source.event_timestamp) <= Date.parse(period.end) && !["Wishlist", "Idea", "Task", "Reminder"].includes(canonicalCategory(source.category) || "");
  }));
  const validIntentions = intentions.filter((item) => item.state || canonicalCategory(entries.get(item.anchor_id)!.category) !== "Idea" || item.source_ids.length > 1);
  const recordedCompletions = allEntries.filter((item) => selected.has(item.id) && (canonicalCategory(item.category) === "Milestone_HardWork" || intentionState(item)?.status === "completed"));
  if (recordedCompletions.length && !progress.some((item) => item.source_ids.some((id) => recordedCompletions.some((source) => source.id === id)))) throw new Error("The review omitted the completed work recorded in this period.");
  return { opening: text(raw.opening, 600), progress, experiences, lessons: section("lessons"), patterns: section("patterns").filter((item) => item.source_ids.length > 1), intentions: validIntentions,
    next_step: next, question: text(raw.question, 400) };
}

/** Honest fallback/carry-forward candidates; absence of a log is never asserted as failure. */
export function directIntentions(entries: LedgerItem[]): ReviewIntention[] {
  return entries.filter((item) => intentionState(item) || canonicalCategory(item.category) === "Wishlist").map((item) => {
    const state = intentionState(item);
    return { anchor_id: item.id, title: state?.title || item.content, kind: state ? "goal" as const : "wish" as const,
      status: state ? state.status === "active" ? "open" as const : state.status : "open" as const,
      reflection: state ? "A plan you chose to keep in view." : "You mentioned wanting this. Is it still something you want to make room for?",
      gap: state ? state.next_step ? "Your next step is saved below." : "Choose one next step." : "There is no plan saved for this wish yet.",
      next_step: state?.next_step || "Decide whether to give this a date, keep it as a wish, or let it go.",
      source_ids: [item.id], deadline: state?.target_date || null, last_movement_at: state?.updated_at || item.created_at, state };
  });
}

export function mergeIntentions(entries: LedgerItem[], inferred: ReviewIntention[]): ReviewIntention[] {
  const ids = new Set(entries.map((entry) => entry.id));
  const byAnchor = new Map(inferred.filter((item) => ids.has(item.anchor_id) && item.source_ids.every((id) => ids.has(id))).map((item) => [item.anchor_id, item]));
  const covered = new Set([...byAnchor.values()].flatMap((item) => item.source_ids));
  for (const item of directIntentions(entries)) {
    const previous = byAnchor.get(item.anchor_id);
    if (!previous && !item.state && covered.has(item.anchor_id)) continue;
    if (!previous || item.state) byAnchor.set(item.anchor_id, { ...previous, ...item,
      status: item.state?.status === "active" && previous?.status === "completed" && previous.last_movement_at >= item.state.updated_at ? "completed" : item.status,
      reflection: previous?.reflection || item.reflection, gap: item.state ? item.gap : previous?.gap || item.gap });
  }
  return [...byAnchor.values()].sort((a, b) => Number(Boolean(b.state)) - Number(Boolean(a.state)) || (a.deadline || "9999").localeCompare(b.deadline || "9999") || b.last_movement_at.localeCompare(a.last_movement_at));
}
