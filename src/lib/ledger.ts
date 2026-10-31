/** Category is the stored source of truth. Textures are derived, never guessed from keywords or tags. */
export const CATEGORY_DEFINITIONS = {
  Task: { label: "Tasks", texture: "actionable_obligation", color: "#0ea5e9" },
  Reminder: { label: "Reminders", texture: "actionable_obligation", color: "#0284c7" },
  Event: { label: "Events", texture: "actionable_obligation", color: "#0369a1" },
  Milestone_HardWork: { label: "Milestones & Hard Work", texture: "hard_work", color: "#10b981" },
  Idea_Desire: { label: "Ideas & Wishlist", texture: "idea_spark", color: "#8b5cf6" },
  Hard_Truth: { label: "Hard Truths & Costs", texture: "hard_truth", color: "#f59e0b" },
  Perspective_Lesson: { label: "Perspectives & Lessons", texture: "perspective", color: "#f43f5e" },
  Quiet_Moment: { label: "Quiet Moments", texture: "quiet_moment", color: "#a855f7" },
  Media_Log: { label: "Media & Intake", texture: "media_log", color: "#6366f1" },
  Shaairi_Quote: { label: "Shaairi & Quotes", texture: "shaairi_quote", color: "#c084fc" },
  Daily_Log: { label: "Daily Life", texture: "daily_log", color: "#71717a" },
} as const;

export type Category = keyof typeof CATEGORY_DEFINITIONS;
export type LifeTexture = (typeof CATEGORY_DEFINITIONS)[Category]["texture"] | "unclassified";
export const CATEGORIES = Object.keys(CATEGORY_DEFINITIONS) as Category[];

const LEGACY_CATEGORIES: Record<string, Category> = {
  idea: "Idea_Desire", wishlist: "Idea_Desire", media: "Media_Log",
  learning: "Perspective_Lesson", perspective: "Perspective_Lesson",
  milestone: "Milestone_HardWork", hard_work: "Milestone_HardWork",
  loss: "Hard_Truth",
  // The old Done bucket included routine activities as well as achievements.
  done: "Daily_Log",
};

export function canonicalCategory(value: unknown): Category | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return CATEGORIES.find((category) => category.toLowerCase() === key) ||
    (Object.prototype.hasOwnProperty.call(LEGACY_CATEGORIES, key) ? LEGACY_CATEGORIES[key] : null);
}

export function getClassification(item: { category?: string | null }) {
  const category = canonicalCategory(item.category);
  return category
    ? { category, ...CATEGORY_DEFINITIONS[category] }
    : { category: "Unclassified" as const, label: "Unclassified", texture: "unclassified" as const, color: "#a1a1aa" };
}

export function isObligation(category: string): boolean {
  return category === "Task" || category === "Reminder" || category === "Event";
}

export type CalendarAction = {
  is_actionable: boolean;
  title?: string;
  start_time?: string;
  end_time?: string;
};

export type LedgerItem = {
  id: string;
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
};

export function normalizeStoredItem<T extends { category: string; calendar_action?: CalendarAction | null }>(item: T) {
  const classification = getClassification(item);
  return {
    ...item,
    category: classification.category,
    life_texture: classification.texture,
    // Stale calendar metadata cannot turn a reflection or expense into an obligation.
    calendar_action: isObligation(classification.category) ? item.calendar_action : { is_actionable: false },
  };
}

export function groupByTexture<T extends { category: string }>(items: T[]): Record<LifeTexture, T[]> {
  const groups: Record<LifeTexture, T[]> = {
    actionable_obligation: [], hard_work: [], idea_spark: [], hard_truth: [],
    perspective: [], quiet_moment: [], media_log: [], shaairi_quote: [], daily_log: [], unclassified: [],
  };
  for (const item of items) groups[getClassification(item).texture].push(item);
  return groups;
}

export type ExtractedItem = {
  category: Category;
  life_texture: LifeTexture;
  content: string;
  tags: string[];
  sentiment_or_mood: string | null;
  event_timestamp: string;
  is_future_actionable: boolean;
  calendar_action: CalendarAction;
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
export function parseExtraction(value: unknown, referenceTime: string): ExtractedItem[] {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length === 0) {
    throw new Error("Extraction returned no items. Your note has not been classified.");
  }
  const reference = isoDate(referenceTime);
  if (!reference) throw new Error("Invalid extraction reference time.");
  return value.items.map((raw) => {
    if (!isRecord(raw) || typeof raw.category !== "string" || !CATEGORIES.includes(raw.category as Category) ||
        typeof raw.content !== "string" || !raw.content.trim() || !Array.isArray(raw.tags) ||
        !raw.tags.every((tag) => typeof tag === "string") || !isRecord(raw.calendar_action) ||
        typeof raw.calendar_action.is_actionable !== "boolean") {
      throw new Error("Extraction returned an invalid item or category.");
    }
    const category = raw.category as Category;
    const start = isoDate(raw.calendar_action.start_time);
    const end = isoDate(raw.calendar_action.end_time);
    const actionable = isObligation(category) && raw.calendar_action.is_actionable === true &&
      start !== null && Date.parse(start) > Date.parse(reference);
    const calendar_action: CalendarAction = actionable ? {
      is_actionable: true,
      title: typeof raw.calendar_action.title === "string" && raw.calendar_action.title.trim()
        ? raw.calendar_action.title.trim() : raw.content.trim(),
      start_time: start!,
      end_time: end && Date.parse(end) > Date.parse(start!)
        ? end : new Date(Date.parse(start!) + 30 * 60 * 1000).toISOString(),
    } : { is_actionable: false };
    return {
      category,
      life_texture: CATEGORY_DEFINITIONS[category].texture,
      content: raw.content.trim(),
      tags: [...new Set(raw.tags as string[])],
      sentiment_or_mood: typeof raw.sentiment_or_mood === "string" ? raw.sentiment_or_mood : null,
      event_timestamp: actionable ? start! : isoDate(raw.event_timestamp) || reference,
      is_future_actionable: actionable,
      calendar_action,
    };
  });
}
