import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { openSession, sealSession } from "./calendar-session";
import { errorMessage } from "./errors";
import type { CalendarAction } from "./ledger";

export type GoogleTokens = { access_token?: string; refresh_token?: string; expires_at?: number; token_type?: string; scope?: string };
const COOKIE = "august_calendar";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 30 * 24 * 60 * 60 };
const secret = () => process.env.CALENDAR_TOKEN_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";

export async function getStoredTokens(): Promise<GoogleTokens | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (value) {
    const data = openSession(value, secret());
    if (!data || typeof data !== "object") return null;
    if ("disconnected" in data) return null;
    if (("refresh_token" in data && typeof data.refresh_token === "string") || ("access_token" in data && typeof data.access_token === "string")) return data as GoogleTokens;
    return null;
  }
  return process.env.GOOGLE_REFRESH_TOKEN ? { refresh_token: process.env.GOOGLE_REFRESH_TOKEN } : null;
}

export async function saveStoredTokens(tokens: GoogleTokens): Promise<void> {
  const previous = await getStoredTokens();
  const value = sealSession({ ...previous, ...tokens, refresh_token: tokens.refresh_token || previous?.refresh_token }, secret());
  if (value.length > 3800) throw new Error("Calendar session is too large to store.");
  (await cookies()).set(COOKIE, value, cookieOptions);
}

export async function clearStoredTokens(): Promise<void> {
  // A tombstone also disconnects sessions when a deployment has a default refresh token.
  if (secret()) (await cookies()).set(COOKIE, sealSession({ disconnected: true }, secret()), cookieOptions);
  else (await cookies()).delete(COOKIE);
}

export async function isCalendarConnected(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return Boolean(tokens?.refresh_token || (tokens?.access_token && (tokens.expires_at || 0) > Date.now()));
}

function redirectUri() { return `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/auth/google/callback`; }

export function getGoogleAuthUrl(state: string): string {
  if (!process.env.GOOGLE_CLIENT_ID || !secret() || !state) throw new Error("Google Calendar OAuth is not configured.");
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri(), response_type: "code", scope: "https://www.googleapis.com/auth/calendar.events", access_type: "offline", prompt: "consent", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string; error_description?: string; error?: string };

export async function exchangeCodeForTokens(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", redirect_uri: redirectUri(), grant_type: "authorization_code" }), signal: AbortSignal.timeout(10000) });
    const data: TokenResponse = await response.json();
    if (!response.ok || !data.access_token) return { success: false, error: data.error_description || data.error || "Token exchange failed" };
    await saveStoredTokens({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000, token_type: data.token_type, scope: data.scope });
    return { success: true };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;
  if (tokens.access_token && (tokens.expires_at || 0) > Date.now() + 60000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: tokens.refresh_token, grant_type: "refresh_token" }), signal: AbortSignal.timeout(10000) });
  const data: TokenResponse = await response.json();
  if (!response.ok || !data.access_token) return null;
  await saveStoredTokens({ access_token: data.access_token, expires_at: Date.now() + (data.expires_in || 3600) * 1000 });
  return data.access_token;
}

export type CalendarResult = { success: boolean; eventId?: string; htmlLink?: string; error?: string };

export async function autoCreateGoogleCalendarEvent(action: CalendarAction, noteContent?: string, itemId?: string): Promise<CalendarResult> {
  try {
    if (!action.is_actionable || !action.start_time || !action.title || !Number.isFinite(Date.parse(action.start_time))) return { success: false, error: "A valid scheduled action is required." };
    const accessToken = await getValidAccessToken();
    if (!accessToken) return { success: false, error: "Google Calendar is not connected." };
    const id = itemId ? createHash("sha256").update(`august:${itemId}`).digest("hex") : undefined;
    const endpoint = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ id, summary: action.title, description: noteContent || "Created from August", start: { dateTime: action.start_time }, end: { dateTime: action.end_time || new Date(Date.parse(action.start_time) + 1800000).toISOString() }, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }, { method: "popup", minutes: 30 }] } }), signal: AbortSignal.timeout(15000) });
    // Deterministic IDs make a retry safe if creation succeeded but saving its status failed.
    const result = response.status === 409 && id ? await fetch(`${endpoint}/${id}`, { headers, signal: AbortSignal.timeout(10000) }) : response;
    const data: { id?: string; htmlLink?: string; error?: { message?: string } } = await result.json();
    if (!result.ok || !data.id) return { success: false, error: data.error?.message || "Calendar event creation failed." };
    return { success: true, eventId: data.id, htmlLink: data.htmlLink };
  } catch (error) { return { success: false, error: errorMessage(error) }; }
}
