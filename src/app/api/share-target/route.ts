import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractItems, generateEmbedding } from "@/lib/gemini";
import { computeAndStoreGraphEdges } from "@/lib/graph";
import { autoCreateGoogleCalendarEvent } from "@/lib/calendar";

async function processSharedText(title?: string, text?: string, url?: string) {
  const parts = [
    title ? title.trim() : "",
    text ? text.trim() : "",
    url ? url.trim() : "",
  ].filter(Boolean);

  const rawContent = parts.join("\n\n").trim();
  if (!rawContent) return null;

  const clientNow = new Date().toISOString();
  const clientTz = "UTC";

  // 1. Save raw note
  const { data: noteData, error: noteError } = await supabase
    .from("notes")
    .insert([{ content: rawContent }])
    .select()
    .single();

  if (noteError || !noteData) {
    console.error("Share target note insert error:", noteError);
    return null;
  }

  // 2. Extract items via Gemini (using Bulk Paste & Split Protocol)
  const extractedItems = await extractItems(rawContent, {
    currentTime: clientNow,
    timezone: clientTz,
  });

  // 3. Generate embeddings
  const inserts = [];
  for (const item of extractedItems) {
    const embedding = await generateEmbedding(item.content);
    
    let resolvedTimestamp = clientNow;
    if (item.event_timestamp && !isNaN(Date.parse(item.event_timestamp))) {
      resolvedTimestamp = new Date(item.event_timestamp).toISOString();
    }

    inserts.push({
      note_id: noteData.id,
      category: item.category,
      content: item.content,
      tags: item.tags || [],
      sentiment_or_mood: item.sentiment_or_mood || null,
      event_timestamp: resolvedTimestamp,
      calendar_action: item.calendar_action || null,
      calendar_status: item.calendar_action?.is_actionable ? "pending" : "none",
      embedding: embedding.length > 0 ? embedding : null,
    });
  }

  // 4. Save nodes
  let insertedNodes: any[] = [];
  if (inserts.length > 0) {
    const { data: insertedData, error: extractError } = await supabase
      .from("extracted_items")
      .insert(inserts)
      .select();

    if (!extractError && insertedData) {
      insertedNodes = insertedData;
    }
  }

  // 5. Compute graph edges on write
  if (insertedNodes.length > 0) {
    try {
      await computeAndStoreGraphEdges(insertedNodes);
    } catch (edgeErr) {
      console.error("Failed to compute graph edges for share target:", edgeErr);
    }
  }

  // 6. Auto-sync calendar if actionable
  for (let i = 0; i < insertedNodes.length; i++) {
    const node = insertedNodes[i];
    const origItem = extractedItems[i];
    if (origItem?.calendar_action?.is_actionable) {
      try {
        const calResult = await autoCreateGoogleCalendarEvent(
          origItem.calendar_action,
          origItem.content
        );
        if (calResult.success) {
          await supabase
            .from("extracted_items")
            .update({ calendar_status: "synced" })
            .eq("id", node.id);
        }
      } catch (calErr) {
        console.error("Share target calendar sync error:", calErr);
      }
    }
  }

  return { noteId: noteData.id, count: insertedNodes.length };
}

// POST handler for form-urlencoded or multipart share target
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let title = "";
    let text = "";
    let url = "";

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      title = (formData.get("title") as string) || "";
      text = (formData.get("text") as string) || "";
      url = (formData.get("url") as string) || "";
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      title = body.title || "";
      text = body.text || "";
      url = body.url || "";
    }

    await processSharedText(title, text, url);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?shared=true`, 303);
  } catch (error: any) {
    console.error("Share target POST error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?shared=error`, 303);
  }
}

// GET handler for query parameter shares (e.g. /api/share-target?text=...)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || "";
    const text = searchParams.get("text") || "";
    const url = searchParams.get("url") || "";

    await processSharedText(title, text, url);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?shared=true`, 303);
  } catch (error: any) {
    console.error("Share target GET error:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?shared=error`, 303);
  }
}
