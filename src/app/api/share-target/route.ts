import { NextResponse } from "next/server";
import { ingestNote } from "@/lib/ingestion";
import { errorMessage } from "@/lib/errors";
import { validTimezone } from "@/lib/time";
import { shareBridge } from "@/lib/share-bridge";

export const maxDuration = 300;
const string = (value: unknown) => typeof value === "string" ? value : "";

export async function POST(request: Request) {
  const json = (request.headers.get("content-type") || "").includes("application/json");
  try {
    const body = json ? await request.json() : Object.fromEntries(await request.formData());
    const payload = { title: string(body.title), text: string(body.text), url: string(body.url) };
    const content = [payload.title, payload.text, payload.url].map((part) => part.trim()).filter(Boolean).join("\n\n");
    if (!content) return NextResponse.json({ error: "Shared content is required." }, { status: 400 });
    if (!json) return shareBridge(payload);
    const zone = validTimezone(body.timezone);
    if (!zone) return NextResponse.json({ error: "A valid local timezone is required." }, { status: 400 });
    const currentTime = string(body.currentTime) || new Date().toISOString();
    if (!Number.isFinite(Date.parse(currentTime))) return NextResponse.json({ error: "Invalid reference time." }, { status: 400 });
    const result = await ingestNote(content, { key: request.headers.get("Idempotency-Key") || string(body.idempotencyKey) || undefined, namespace: "share", currentTime, timezone: zone, syncCalendar: true });
    return json ? NextResponse.json(result) : NextResponse.redirect(new URL("/?shared=true", request.url), 303);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const payload = { title: params.get("title") || "", text: params.get("text") || "", url: params.get("url") || "" };
  return Object.values(payload).some(Boolean) ? shareBridge(payload) : NextResponse.json({ error: "Shared content is required." }, { status: 400 });
}
