import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ingestNote } from "@/lib/ingestion";
import { errorMessage } from "@/lib/errors";
import { validTimezone } from "@/lib/time";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { content, currentTime, timezone } = await request.json();
    if (typeof content !== "string" || !content.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 });
    const zone = validTimezone(timezone);
    if (!zone || (currentTime && !Number.isFinite(Date.parse(currentTime)))) return NextResponse.json({ error: "A valid timezone and reference time are required." }, { status: 400 });
    const result = await ingestNote(content.trim(), { key: request.headers.get("Idempotency-Key") || undefined, currentTime: currentTime || new Date().toISOString(), timezone: zone, syncCalendar: true });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Notes API error:", errorMessage(error));
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function GET() {
  const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ notes: data || [] });
}
