import type { CalendarAction } from "./ledger";
export type { CalendarAction } from "./ledger";

export function shouldOfferCalendarAdd(item: { calendar_action?: CalendarAction | null; calendar_status?: string; google_event_id?: string | null }): boolean {
  return Boolean(item.calendar_action?.is_actionable && item.calendar_action.start_time && item.calendar_action.title &&
    Number.isFinite(Date.parse(item.calendar_action.start_time)) &&
    !item.google_event_id && item.calendar_status !== "synced" && item.calendar_status !== "pending");
}

/**
 * Generates a direct 1-click Google Calendar Web URL as a fallback
 */
export function generateGoogleCalendarUrl(action: CalendarAction, noteContent?: string): string {
  if (!action.title || !action.start_time) return "";

  const title = encodeURIComponent(action.title);
  const details = encodeURIComponent(noteContent ? `Created from Write Note:\n"${noteContent}"` : "Auto-extracted from Write note");
  
  const formatGCalDate = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    } catch {
      return "";
    }
  };

  const startFormatted = formatGCalDate(action.start_time);
  let endFormatted = action.end_time ? formatGCalDate(action.end_time) : "";

  if (!endFormatted && startFormatted) {
    const startDate = new Date(action.start_time);
    startDate.setMinutes(startDate.getMinutes() + 30);
    endFormatted = formatGCalDate(startDate.toISOString());
  }

  const datesParam = `${startFormatted}/${endFormatted}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}`;
}
