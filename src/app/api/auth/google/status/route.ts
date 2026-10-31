import { NextResponse } from "next/server";
import { isCalendarConnected, clearStoredTokens } from "@/lib/calendar-server";

export async function GET() { return NextResponse.json({ connected: await isCalendarConnected() }); }
export async function DELETE() { await clearStoredTokens(); return NextResponse.json({ success: true, connected: false }); }
