import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { extractItems, generateEmbedding } from "@/lib/gemini";

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
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
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
        embedding,
      });
    }

    // 4. Save extracted items to Supabase
    if (inserts.length > 0) {
      const { error: extractError } = await supabase
        .from("extracted_items")
        .insert(inserts);

      if (extractError) {
        console.error("Supabase extracted_items insertion error:", extractError);
        // Continue anyway since the raw note is saved
      }
    }

    return NextResponse.json({ 
      success: true, 
      noteId: noteData.id,
      extractedCount: inserts.length
    });

  } catch (error) {
    console.error("Notes API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
