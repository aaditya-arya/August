export interface CalendarAction {
  is_actionable: boolean;
  title?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
}

export interface GoogleTokens {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

function getTokenFilePath(): string {
  if (typeof window === "undefined") {
    const path = require("path");
    return path.join(process.cwd(), ".calendar_token.json");
  }
  return "";
}

/**
 * Reads stored OAuth tokens from local storage or environment
 */
export function getStoredTokens(): GoogleTokens | null {
  if (typeof window !== "undefined") return null;

  try {
    // 1. Check if refresh token is in environment
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      return { refresh_token: process.env.GOOGLE_REFRESH_TOKEN };
    }

    // 2. Check local token file
    const fs = require("fs");
    const filePath = getTokenFilePath();
    if (filePath && fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading stored Google tokens:", err);
  }
  return null;
}

/**
 * Saves Google OAuth tokens
 */
export function saveStoredTokens(tokens: GoogleTokens): void {
  if (typeof window !== "undefined") return;

  try {
    const existing = getStoredTokens() || {};
    const updated: GoogleTokens = {
      ...existing,
      ...tokens,
      // Retain existing refresh_token if the new payload doesn't contain one
      refresh_token: tokens.refresh_token || existing.refresh_token,
    };
    const fs = require("fs");
    const filePath = getTokenFilePath();
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
    }
  } catch (err) {
    console.error("Error saving Google tokens:", err);
  }
}

/**
 * Clears stored Google OAuth tokens (Disconnect)
 */
export function clearStoredTokens(): void {
  if (typeof window !== "undefined") return;

  try {
    const fs = require("fs");
    const filePath = getTokenFilePath();
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Error clearing Google tokens:", err);
  }
}

/**
 * Checks if Google Calendar is connected
 */
export function isCalendarConnected(): boolean {
  const tokens = getStoredTokens();
  return Boolean(tokens?.refresh_token || tokens?.access_token);
}

/**
 * Builds Google OAuth 2.0 Authorization URL
 */
export function getGoogleAuthUrl(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges OAuth authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ success: boolean; tokens?: GoogleTokens; error?: string }> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error_description || data.error || "Token exchange failed" };
    }

    const tokens: GoogleTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      token_type: data.token_type,
      scope: data.scope,
    };

    saveStoredTokens(tokens);
    return { success: true, tokens };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Retrieves a valid Google Access Token, refreshing it automatically if expired
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  // If access token is still valid (with 60s buffer), use it
  if (tokens.access_token && tokens.expires_at && tokens.expires_at > Date.now() + 60000) {
    return tokens.access_token;
  }

  // If we have a refresh_token, get a fresh access_token
  if (tokens.refresh_token) {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const data = await res.json();
      if (res.ok && data.access_token) {
        saveStoredTokens({
          access_token: data.access_token,
          expires_at: Date.now() + (data.expires_in || 3600) * 1000,
          token_type: data.token_type,
        });
        return data.access_token;
      } else {
        console.error("Failed to refresh Google access token:", data);
      }
    } catch (err) {
      console.error("Error refreshing Google token:", err);
    }
  }

  return tokens.access_token || null;
}

/**
 * Automatically creates a Google Calendar Event in the background with reminders
 */
export async function autoCreateGoogleCalendarEvent(
  action: CalendarAction,
  noteContent?: string
): Promise<{ success: boolean; eventId?: string; htmlLink?: string; error?: string }> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return { success: false, error: "Google Calendar not connected. Connect via OAuth." };
    }

    const startTime = action.start_time || new Date().toISOString();
    let endTime = action.end_time;
    if (!endTime) {
      const d = new Date(startTime);
      d.setMinutes(d.getMinutes() + 30);
      endTime = d.toISOString();
    }

    const eventPayload = {
      summary: action.title || "Note Reminder",
      description: noteContent ? `Created from Write Note:\n"${noteContent}"` : "Auto-created from Write note.",
      start: { dateTime: startTime },
      end: { dateTime: endTime },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 10 },
          { method: "popup", minutes: 30 },
        ],
      },
    };

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Google Calendar API Event Creation Error:", data);
      return { success: false, error: data?.error?.message || "Failed to create event in Google Calendar" };
    }

    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (error: any) {
    console.error("Calendar Auto-Sync Exception:", error);
    return { success: false, error: error.message };
  }
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
