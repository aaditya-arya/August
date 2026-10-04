import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateWeeklySynthesis } from "@/lib/gemini";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get("days"); // "7", "30", or null for all

    let query = supabase
      .from("extracted_items")
      .select("id, content, category, life_texture, tags, sentiment_or_mood, event_timestamp, created_at")
      .order("event_timestamp", { ascending: false });

    let periodLabel = "All Time";
    if (days && days !== "all") {
      const daysNum = parseInt(days, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysNum);
      query = query.gte("event_timestamp", cutoff.toISOString());
      periodLabel = daysNum === 7 ? "This Past Week" : `The Past ${daysNum} Days`;
    }

    const { data: items, error } = await query;

    if (error) {
      console.error("Error fetching items for synthesis:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const synthesis = await generateWeeklySynthesis(items || [], periodLabel);

    return NextResponse.json({
      synthesis,
      itemCount: items?.length || 0,
      periodLabel,
    });
  } catch (error: any) {
    console.error("Synthesis API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, periodLabel } = body;

    const synthesis = await generateWeeklySynthesis(items || [], periodLabel || "This Week");

    return NextResponse.json({ synthesis });
  } catch (error: any) {
    console.error("Synthesis POST API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
