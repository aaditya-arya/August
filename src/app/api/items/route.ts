import { errorMessage } from "@/lib/errors";
import { NextResponse } from "next/server";
import { normalizeStoredItem, categoryStorageValues } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const categories = searchParams.get("categories"); // comma separated
    const days = searchParams.get("days");

    let query = supabase
      .from("extracted_items")
      .select("*")
      .order("event_timestamp", { ascending: false });

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

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: (data || []).map(normalizeStoredItem) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
