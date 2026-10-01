import { NextResponse } from "next/server";
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
      query = query.eq("category", category);
    } else if (categories) {
      const catList = categories.split(",").map((c) => c.trim());
      query = query.in("category", catList);
    }

    if (days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(days, 10));
      query = query.gte("event_timestamp", cutoff.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
