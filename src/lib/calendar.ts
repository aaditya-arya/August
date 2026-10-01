export interface CalendarAction {
  is_actionable: boolean;
  title?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
}

/**
 * Generates a direct 1-click Google Calendar Web URL with prefilled title, dates, and details.
 * Dates format for Google Calendar URL: YYYYMMDDTHHmmssZ
 */
export function generateGoogleCalendarUrl(action: CalendarAction, noteContent?: string): string {
  if (!action.title || !action.start_time) return "";

  const title = encodeURIComponent(action.title);
  const details = encodeURIComponent(noteContent ? `Created from Write Note:\n"${noteContent}"` : "Auto-extracted from Write note");
  
  // Format ISO timestamp to Google Calendar URL format (YYYYMMDDTHHmmssZ)
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
    // Default 30 min duration
    const startDate = new Date(action.start_time);
    startDate.setMinutes(startDate.getMinutes() + 30);
    endFormatted = formatGCalDate(startDate.toISOString());
  }

  const datesParam = `${startFormatted}/${endFormatted}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}`;
}

/**
 * Direct API sync using Google OAuth Access Token
 */
export async function syncToGoogleCalendarApi(
  accessToken: string,
  action: CalendarAction,
  noteContent?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const startTime = action.start_time || new Date().toISOString();
    let endTime = action.end_time;
    if (!endTime) {
      const d = new Date(startTime);
      d.setMinutes(d.getMinutes() + 30);
      endTime = d.toISOString();
    }

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: action.title || "Note Reminder",
        description: noteContent || "Auto-created from Write note dump.",
        start: { dateTime: startTime },
        end: { dateTime: endTime },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err?.error?.message || "Google API error" };
    }

    const data = await res.json();
    return { success: true, eventId: data.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
