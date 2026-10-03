import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractItems, generateEmbedding } from "@/lib/gemini";
import { computeAndStoreGraphEdges } from "@/lib/graph";

// CORS headers for Chrome extension requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { notes, timezone } = body;

    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return NextResponse.json(
        { error: "An array of notes is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const clientTz = timezone || "UTC";
    const clientNow = new Date().toISOString();

    let totalExtracted = 0;
    const allInsertedNodes: any[] = [];
    const results: any[] = [];

    // Process in concurrency chunks of 3 to respect Gemini API throughput
    const CHUNK_SIZE = 3;
    for (let i = 0; i < notes.length; i += CHUNK_SIZE) {
      const chunk = notes.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (noteItem: any) => {
          const rawContent = typeof noteItem === "string" 
            ? noteItem 
            : [noteItem.title ? `[${noteItem.title}]` : "", noteItem.content].filter(Boolean).join("\n");

          if (!rawContent.trim()) return;

          // 1. Insert raw note into Supabase
          const { data: noteRow, error: noteErr } = await supabase
            .from("notes")
            .insert([{ content: rawContent.trim() }])
            .select()
            .single();

          if (noteErr || !noteRow) {
            console.error("Failed to insert imported note:", noteErr);
            return;
          }

          // 2. Extract structured thoughts & calendar actions via Gemini
          const extracted = await extractItems(rawContent, {
            currentTime: clientNow,
            timezone: clientTz,
          });

          // 3. Generate embeddings & build inserts
          const inserts = [];
          for (const item of extracted) {
            const embedding = await generateEmbedding(item.content);

            let resolvedTimestamp = clientNow;
            if (item.event_timestamp && !isNaN(Date.parse(item.event_timestamp))) {
              resolvedTimestamp = new Date(item.event_timestamp).toISOString();
            }

            inserts.push({
              note_id: noteRow.id,
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

          // 4. Save to extracted_items
          if (inserts.length > 0) {
            const { data: insertedData, error: extractErr } = await supabase
              .from("extracted_items")
              .insert(inserts)
              .select();

            if (!extractErr && insertedData) {
              allInsertedNodes.push(...insertedData);
              totalExtracted += insertedData.length;
              results.push({
                noteId: noteRow.id,
                title: noteItem.title || null,
                itemsCount: insertedData.length,
              });
            }
          }
        })
      );
    }

    // 5. Connect all newly imported notes into the Brain Graph
    if (allInsertedNodes.length > 0) {
      try {
        await computeAndStoreGraphEdges(allInsertedNodes);
      } catch (graphErr) {
        console.error("Failed to compute graph edges for imported notes:", graphErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        notesReceived: notes.length,
        itemsExtracted: totalExtracted,
        results,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("Keep Import API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
