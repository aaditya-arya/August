import { withAccount } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import { isCalendarConnected, clearStoredTokens, calendarConfigured, verifyCalendarConnection } from "@/lib/calendar-server";

async function handleGET(request: Request) {
  const configured = calendarConfigured();
  if (!configured) return NextResponse.json({ configured, connected: false, reason: "setup" });
  if (new URL(request.url).searchParams.get("verify") === "1") {
    try {
      return NextResponse.json({ configured, ...await verifyCalendarConnection() });
    } catch {
      return NextResponse.json({ configured, connected: false, reason: "unavailable" });
    }
  }
  return NextResponse.json({ configured, connected: await isCalendarConnected() });
}
async function handleDELETE() { await clearStoredTokens(); return NextResponse.json({ success: true, connected: false }); }

export const GET = withAccount(handleGET, { storage: false });
export const DELETE = withAccount(handleDELETE, { storage: false });
