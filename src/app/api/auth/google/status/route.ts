import { NextResponse } from "next/server";
import { isCalendarConnected, clearStoredTokens } from "@/lib/calendar";

export async function GET() {
  const connected = isCalendarConnected();
  return NextResponse.json({ connected });
}

export async function DELETE() {
  clearStoredTokens();
  return NextResponse.json({ success: true, connected: false });
}
