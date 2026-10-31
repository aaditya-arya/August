export type IntentionState = {
  version: 1;
  status: "active" | "completed" | "released" | "paused";
  title: string;
  next_step: string;
  target_date: string | null;
  target_amount: number | null;
  saved_amount: number | null;
  currency: string;
  updated_at: string;
};

export function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function localDay(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function yearHorizon(now: Date, timezone: string) {
  const day = localDay(now, timezone), year = Number(day.slice(0, 4));
  const total = daysBetween(`${year}-01-01`, `${year + 1}-01-01`);
  const remaining = daysBetween(day, `${year + 1}-01-01`);
  return { year, days_left: remaining, percent_elapsed: Math.round((total - remaining) / total * 100) };
}

export function deadlineLabel(target: string | null, now: Date, timezone: string): { label: string; days: number | null; overdue: boolean } {
  if (!target || !validDay(target)) return { label: "No date set", days: null, overdue: false };
  const days = daysBetween(localDay(now, timezone), target);
  return { label: days === 0 ? "Today is the day" : days > 0 ? `${days} ${days === 1 ? "day" : "days"} left` : `${-days} ${days === -1 ? "day" : "days"} past your date`, days, overdue: days < 0 };
}

export function moneyProgress(state: Pick<IntentionState, "target_amount" | "saved_amount"> & { status?: IntentionState["status"] }) {
  if (state.status && state.status !== "active") return null;
  if (state.target_amount === null || state.saved_amount === null || state.target_amount <= 0) return null;
  return { remaining: Math.max(0, state.target_amount - state.saved_amount), percent: Math.max(0, Math.min(100, Math.round(state.saved_amount / state.target_amount * 100))) };
}

export function parseIntentionState(value: unknown): IntentionState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || !["active", "completed", "released", "paused"].includes(String(raw.status)) ||
      typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 140 ||
      typeof raw.next_step !== "string" || raw.next_step.length > 300 ||
      (raw.target_date !== null && !validDay(raw.target_date)) ||
      (raw.target_amount !== null && (typeof raw.target_amount !== "number" || !Number.isFinite(raw.target_amount) || raw.target_amount <= 0 || raw.target_amount > 1e12)) ||
      (raw.saved_amount !== null && (typeof raw.saved_amount !== "number" || !Number.isFinite(raw.saved_amount) || raw.saved_amount < 0 || raw.saved_amount > 1e12)) ||
      typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency) ||
      typeof raw.updated_at !== "string" || !Number.isFinite(Date.parse(raw.updated_at))) return null;
  return { version: 1, status: raw.status as IntentionState["status"], title: raw.title.trim(), next_step: raw.next_step.trim(), target_date: raw.target_date as string | null, target_amount: raw.target_amount as number | null, saved_amount: raw.saved_amount as number | null, currency: raw.currency, updated_at: raw.updated_at };
}

export function intentionState(item: { review_state?: unknown; calendar_action?: { review_state?: unknown } | null }): IntentionState | null {
  return parseIntentionState(item.review_state) || parseIntentionState(item.calendar_action?.review_state);
}
