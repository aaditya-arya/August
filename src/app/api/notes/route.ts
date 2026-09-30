import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractItems, generateEmbedding } from "@/lib/gemini";
import { computeAndStoreGraphEdges } from "@/lib/graph";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

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

    // 2. Extract structured data using Gemini
    const extractedItems = await extractItems(content);

    // 3. Generate embeddings and prepare inserts
    const inserts = [];
    for (const item of extractedItems) {
      const embedding = await generateEmbedding(item.content);
      
      inserts.push({
        note_id: noteData.id,
        category: item.category,
        content: item.content,
        tags: item.tags,
        sentiment_or_mood: item.sentiment_or_mood,
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

    return NextResponse.json({ 
      success: true, 
      noteId: noteData.id,
      extractedCount: inserts.length,
      items: extractedItems
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
