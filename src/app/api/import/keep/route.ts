import { NextResponse } from "next/server";
import { ingestNote } from "@/lib/ingestion";
import { mapConcurrent } from "@/lib/async";
import { errorMessage } from "@/lib/errors";
import { validTimezone } from "@/lib/time";

export const maxDuration = 300;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" };
export async function OPTIONS() { return NextResponse.json({}, { headers: corsHeaders }); }

type ImportNote = string | { title?: string; content: string };
function validNote(value: unknown): value is ImportNote {
  return typeof value === "string" || (typeof value === "object" && value !== null && "content" in value && typeof value.content === "string" && (!("title" in value) || typeof value.title === "string"));
}

export async function POST(request: Request) {
  try {
    const { notes, timezone } = await request.json();
    const zone = validTimezone(timezone);
    if (!Array.isArray(notes) || !notes.length || !notes.every(validNote) || !zone) return NextResponse.json({ error: "Notes and a valid timezone are required." }, { status: 400, headers: corsHeaders });
    const currentTime = new Date().toISOString();
    const results = await mapConcurrent(notes as ImportNote[], 3, async (note) => {
      const title = typeof note === "string" ? undefined : note.title;
      const content = (typeof note === "string" ? note : [title ? `[${title}]` : "", note.content].filter(Boolean).join("\n")).trim();
      try {
        const saved = await ingestNote(content, { namespace: "keep", key: content, currentTime, timezone: zone, syncCalendar: false });
        return { success: true as const, noteId: saved.noteId, title, itemsCount: saved.extractedCount, reused: saved.reused };
      } catch (error) { return { success: false as const, title, itemsCount: 0, error: errorMessage(error) }; }
    });
    const failedCount = results.filter((result) => !result.success).length;
    return NextResponse.json({ success: failedCount === 0, notesReceived: notes.length, failedCount, itemsExtracted: results.reduce((sum, result) => sum + result.itemsCount, 0), results }, { status: failedCount ? 207 : 200, headers: corsHeaders });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500, headers: corsHeaders }); }
}
