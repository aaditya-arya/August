import { intentionState, type IntentionState } from "./intention-state";
import { memorySource, type MemorySource } from "./memory-source";

/** Starter categories provide vocabulary and presentation, not a closed classification enum. */
export const CATEGORY_DEFINITIONS = {
  Task: { label: "Tasks", texture: "actionable_obligation", color: "#0ea5e9" },
  Reminder: { label: "Reminders", texture: "actionable_obligation", color: "#0284c7" },
  Event: { label: "Events", texture: "actionable_obligation", color: "#0369a1" },
  Milestone_HardWork: { label: "Milestones & Hard Work", texture: "hard_work", color: "#10b981" },
  Idea: { label: "Ideas", texture: "idea_spark", color: "#8b5cf6" },
  Wishlist: { label: "Wishlist", texture: "wishlist", color: "#a855f7" },
  Idea_Desire: { label: "Unsorted Intentions", texture: "unclassified", color: "#a1a1aa" },
  Hard_Truth: { label: "Hard Truths & Costs", texture: "hard_truth", color: "#f59e0b" },
  Perspective_Lesson: { label: "Perspectives & Lessons", texture: "perspective", color: "#f43f5e" },
  Quiet_Moment: { label: "Quiet Moments", texture: "quiet_moment", color: "#a855f7" },
  Media_Log: { label: "Media & Intake", texture: "media_log", color: "#6366f1" },
  Shaairi_Quote: { label: "Shaairi & Quotes", texture: "shaairi_quote", color: "#c084fc" },
  Daily_Log: { label: "Daily Life", texture: "daily_log", color: "#71717a" },
} as const;

export type BuiltinCategory = keyof typeof CATEGORY_DEFINITIONS;
export type Category = string;
export type LifeTexture = (typeof CATEGORY_DEFINITIONS)[BuiltinCategory]["texture"] | "unclassified" | "custom";
export const CATEGORIES = Object.keys(CATEGORY_DEFINITIONS) as BuiltinCategory[];

const LEGACY_CATEGORIES: Record<string, Category> = {
  ideas: "Idea", concepts: "Idea", wishlists: "Wishlist", wishes: "Wishlist", desires: "Wishlist", "wish list": "Wishlist", media: "Media_Log",
  learning: "Perspective_Lesson", perspective: "Perspective_Lesson",
  milestone: "Milestone_HardWork", hard_work: "Milestone_HardWork",
  loss: "Hard_Truth",
  // The old Done bucket included routine activities as well as achievements.
  done: "Daily_Log",
};

const RESERVED_NAMES = new Set(["constructor", "prototype", "proto", "tostring", "valueof", "undefined", "null", "other", "misc", "miscellaneous", "things", "stuff", "unclassified", "uncategorized", "unsorted"]);

export function categoryIdentity(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[_-]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim().replace(/\s+/g, " ");
}

export function validCategoryName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const name = value.normalize("NFKC").trim();
  return name.length > 0 && name.length <= 48 && name.split(/[\s_-]+/).length <= 5 &&
    /^[\p{L}][\p{L}\p{N} _'-]*$/u.test(name) && !RESERVED_NAMES.has(categoryIdentity(name));
}

export function canonicalCategory(value: unknown): Category | null {
  if (!validCategoryName(value)) return null;
  const key = value.trim().toLowerCase();
  const builtin = CATEGORIES.find((category) => category.toLowerCase() === key);
  if (builtin) return builtin;
  if (Object.prototype.hasOwnProperty.call(LEGACY_CATEGORIES, key)) return LEGACY_CATEGORIES[key];
  const identity = categoryIdentity(value);
  const normalizedBuiltin = CATEGORIES.find((category) => categoryIdentity(category) === identity);
  if (normalizedBuiltin) return normalizedBuiltin;
  return identity.split(" ").map((word) => word[0].toLocaleUpperCase() + word.slice(1)).join(" ");
}

export function categoryColor(category: string): string {
  const colors = ["#0d9488", "#8b5cf6", "#e11d48", "#0284c7", "#d97706", "#4f46e5", "#16a34a"];
  let hash = 0;
  for (const character of categoryIdentity(category)) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

/** SQL filters need the same alias resolution as display normalization. */
export function categoryStorageValues(value: string): string[] {
  const canonical = canonicalCategory(value);
  if (!canonical) return [value];
  return [...new Set([canonical, canonical.toLowerCase(), canonical.toUpperCase(), ...Object.entries(LEGACY_CATEGORIES).filter(([, category]) => category === canonical)
    .flatMap(([alias]) => [alias, alias.toUpperCase(), alias[0].toUpperCase() + alias.slice(1)])])];
}

export function getClassification(item: { category?: string | null }) {
  const category = canonicalCategory(item.category);
  if (!category || category === "Unclassified") return { category: "Unclassified", label: "Unclassified", texture: "unclassified" as const, color: "#a1a1aa" };
  if (Object.prototype.hasOwnProperty.call(CATEGORY_DEFINITIONS, category)) return { category, ...CATEGORY_DEFINITIONS[category as BuiltinCategory] };
  return { category, label: category, texture: "custom" as const, color: categoryColor(category) };
}

export type CalendarKind = "task" | "reminder" | "event" | "none";
export function isObligation(category: string, action?: { kind?: unknown } | null): boolean {
  const canonical = canonicalCategory(category);
  if (canonical === "Task" || canonical === "Reminder" || canonical === "Event") return true;
  if (!canonical || Object.prototype.hasOwnProperty.call(CATEGORY_DEFINITIONS, canonical)) return false;
  return action?.kind === "task" || action?.kind === "reminder" || action?.kind === "event";
}

export type CalendarAction = {
  memory?: MemorySource;
  is_actionable: boolean;
  kind?: CalendarKind;
  title?: string;
  start_time?: string;
  end_time?: string;
  /** Versioned, user-authored intention metadata; never interpreted as a Calendar action. */
  review_state?: IntentionState;
};

export type LedgerItem = {
  id: string;
  note_id?: string;
  memory?: MemorySource | null;
  category: string;
  life_texture?: string;
  content: string;
  tags?: string[];
  sentiment_or_mood?: string;
  event_timestamp: string;
  created_at: string;
  calendar_action?: CalendarAction | null;
  calendar_status?: string;
  google_event_id?: string;
  review_state?: IntentionState | null;
};

export function normalizeStoredItem<T extends { category: string; calendar_action?: CalendarAction | null }>(item: T) {
  const classification = getClassification(item);
  const state = intentionState(item);
  const memory = memorySource(item.calendar_action?.memory);
  return {
    ...item,
    category: classification.category,
    life_texture: classification.texture,
    review_state: state,
    memory,
    // Stale calendar metadata cannot turn a reflection or expense into an obligation.
    calendar_action: isObligation(classification.category, item.calendar_action) ? item.calendar_action : { is_actionable: false, ...(state ? { review_state: state } : {}), ...(memory ? { memory } : {}) },
  };
}

export function groupByTexture<T extends { category: string }>(items: T[]): Record<LifeTexture, T[]> {
  const groups: Record<LifeTexture, T[]> = {
    actionable_obligation: [], hard_work: [], idea_spark: [], hard_truth: [],
    perspective: [], quiet_moment: [], media_log: [], shaairi_quote: [], daily_log: [], unclassified: [], wishlist: [], custom: [],
  };
  for (const item of items) groups[getClassification(item).texture].push(item);
  return groups;
}

/** UI grouping follows stored category meaning; presentation textures never merge categories. */
export function groupByCategory<T extends { category: string }>(items: T[]) {
  const groups = new Map<string, ReturnType<typeof getClassification> & { items: T[] }>();
  for (const item of items) {
    const classification = getClassification(item);
    if (!groups.has(classification.category)) groups.set(classification.category, { ...classification, items: [] });
    groups.get(classification.category)!.items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
}

export type CategoryDefinition = { category: string; label: string; description: string; examples?: string[] };

export type ExtractedItem = {
  category: Category;
  life_texture: LifeTexture;
  content: string;
  tags: string[];
  sentiment_or_mood: string | null;
  event_timestamp: string;
  is_future_actionable: boolean;
  calendar_action: CalendarAction;
  category_description?: string;
  category_reason?: string;
  category_confidence?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Validate AI output before anything reaches storage or Google Calendar. */
export function parseExtraction(value: unknown, referenceTime: string, catalogue: CategoryDefinition[] = []): ExtractedItem[] {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length === 0) {
    throw new Error("Extraction returned no items. Your note has not been classified.");
  }
  const reference = isoDate(referenceTime);
  if (!reference) throw new Error("Invalid extraction reference time.");
  return value.items.map((raw) => {
    if (!isRecord(raw) || typeof raw.category !== "string" || !validCategoryName(raw.category) ||
        typeof raw.content !== "string" || !raw.content.trim() || !Array.isArray(raw.tags) ||
        !raw.tags.every((tag) => typeof tag === "string") || !isRecord(raw.calendar_action) ||
        typeof raw.calendar_action.is_actionable !== "boolean") {
      throw new Error("Extraction returned an invalid item or category.");
    }
    const category = canonicalCategory(raw.category)!;
    if (category === "Idea_Desire") throw new Error("Ideas and Wishlist must be classified separately.");
    if (raw.calendar_action.kind !== undefined && !["task", "reminder", "event", "none"].includes(String(raw.calendar_action.kind))) throw new Error("Invalid scheduling intent.");
    const existing = catalogue.find((entry) => categoryIdentity(entry.category) === categoryIdentity(category));
    const known = Object.prototype.hasOwnProperty.call(CATEGORY_DEFINITIONS, category) || existing;
    if (!known && (typeof raw.category_confidence !== "number" || raw.category_confidence < 0.9 || raw.category_confidence > 1 ||
        typeof raw.category_description !== "string" || raw.category_description.trim().length < 12 || raw.category_description.length > 240 ||
        typeof raw.category_reason !== "string" || raw.category_reason.trim().length < 12)) {
      throw new Error("A new category needs a clear definition, high confidence, and a reason existing categories do not fit.");
    }
    const start = isoDate(raw.calendar_action.start_time);
    const end = isoDate(raw.calendar_action.end_time);
    const actionable = isObligation(category, raw.calendar_action) && raw.calendar_action.kind !== "none" && raw.calendar_action.is_actionable === true &&
      start !== null && Date.parse(start) > Date.parse(reference);
    const calendar_action: CalendarAction = actionable ? {
      is_actionable: true,
      kind: (raw.calendar_action.kind || category.toLowerCase()) as CalendarKind,
      title: typeof raw.calendar_action.title === "string" && raw.calendar_action.title.trim()
        ? raw.calendar_action.title.trim() : raw.content.trim(),
      start_time: start!,
      end_time: end && Date.parse(end) > Date.parse(start!)
        ? end : new Date(Date.parse(start!) + 30 * 60 * 1000).toISOString(),
    } : { is_actionable: false, kind: "none" };
    return {
      category,
      life_texture: getClassification({ category }).texture,
      content: raw.content.trim(),
      tags: [...new Set(raw.tags as string[])],
      sentiment_or_mood: typeof raw.sentiment_or_mood === "string" ? raw.sentiment_or_mood : null,
      event_timestamp: actionable ? start! : isoDate(raw.event_timestamp) || reference,
      is_future_actionable: actionable,
      calendar_action,
      category_description: typeof raw.category_description === "string" ? raw.category_description.trim() : undefined,
      category_reason: typeof raw.category_reason === "string" ? raw.category_reason.trim() : undefined,
      category_confidence: typeof raw.category_confidence === "number" ? raw.category_confidence : undefined,
    };
  });
}
