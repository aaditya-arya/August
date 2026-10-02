import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractItems, generateEmbedding } from "@/lib/gemini";
import { computeAndStoreGraphEdges } from "@/lib/graph";
import { autoCreateGoogleCalendarEvent } from "@/lib/calendar";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, currentTime, timezone } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const clientNow = currentTime || new Date().toISOString();
    const clientTz = timezone || "UTC";

    // 1. Save the raw note to Supabase (The Daily Feed)
    const { data: noteData, error: noteError } = await supabase
      .from("notes")
      .insert([{ content }])
      .select()
      .single();

    if (noteError) {
      console.error("Supabase note insertion error:", noteError);
      return NextResponse.json({ error: `Supabase error: ${noteError.message}` }, { status: 500 });
    }

    // 2. Extract structured data using Gemini with absolute temporal context
    const extractedItems = await extractItems(content, {
      currentTime: clientNow,
      timezone: clientTz,
    });

    // 3. Generate embeddings and prepare inserts
    const inserts = [];
    for (const item of extractedItems) {
      const embedding = await generateEmbedding(item.content);
      
      // Validate or fallback event_timestamp
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

    // 4. Save extracted items to Supabase
    let insertedNodes: any[] = [];
    if (inserts.length > 0) {
      const { data: insertedData, error: extractError } = await supabase
        .from("extracted_items")
        .insert(inserts)
        .select();

      if (extractError) {
        console.error("Supabase extracted_items insertion error:", extractError);
      } else {
        insertedNodes = insertedData || [];
      }
    }

    // 5. Compute graph connections on write (Semantic & Tag Edges + Pruning)
    if (insertedNodes.length > 0) {
      try {
        await computeAndStoreGraphEdges(insertedNodes);
      } catch (edgeErr) {
        console.error("Failed to compute graph edges on write:", edgeErr);
      }
    }

    // 6. Automatic Google Calendar Event Creation (Background, Zero-Click)
    const calendarEventsSynced: any[] = [];
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
            calendarEventsSynced.push({
              title: origItem.calendar_action.title,
              start_time: origItem.calendar_action.start_time,
              htmlLink: calResult.htmlLink,
              eventId: calResult.eventId,
            });

            // Update database status
            await supabase
              .from("extracted_items")
              .update({
                calendar_status: "synced",
              })
              .eq("id", node.id);
          }
        } catch (calErr) {
          console.error("Calendar auto-creation error:", calErr);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      noteId: noteData.id,
      extractedCount: inserts.length,
      items: extractedItems,
      calendarEventsSynced,
    });

  } catch (error: any) {
    console.error("Notes API Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
