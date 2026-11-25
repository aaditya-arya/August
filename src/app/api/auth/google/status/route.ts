import { withAccount } from "@/lib/auth-server";
import { NextResponse } from "next/server";
import { isCalendarConnected, clearStoredTokens } from "@/lib/calendar-server";

async function handleGET() { return NextResponse.json({ connected: await isCalendarConnected() }); }
async function handleDELETE() { await clearStoredTokens(); return NextResponse.json({ success: true, connected: false }); }

export const GET = withAccount(handleGET, { storage: false });
export const DELETE = withAccount(handleDELETE, { storage: false });
