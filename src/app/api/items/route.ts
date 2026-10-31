import { errorMessage } from "@/lib/errors";
import { NextResponse } from "next/server";
import { normalizeStoredItem, categoryStorageValues, type LedgerItem } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const categories = searchParams.get("categories"); // comma separated
    const days = searchParams.get("days");

    let query = supabase
      .from("extracted_items")
      .select("id, note_id, category, content, tags, sentiment_or_mood, event_timestamp, created_at, calendar_action, calendar_status, google_event_id")
      .order("event_timestamp", { ascending: false }).order("id");

    if (category) {
      query = query.in("category", categoryStorageValues(category));
    } else if (categories) {
      const catList = categories.split(",").flatMap((c) => categoryStorageValues(c.trim()));
      query = query.in("category", catList);
    }

    if (days && days !== "all") {
      if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 36500) return NextResponse.json({ error: "Invalid days parameter." }, { status: 400 });
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(days, 10));
      query = query.gte("event_timestamp", cutoff.toISOString());
    }

    const items: LedgerItem[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await query.range(offset, offset + 499);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      items.push(...(data || []).map(entry => normalizeStoredItem(entry) as LedgerItem));
      if (!data || data.length < 500) break;
    }
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
