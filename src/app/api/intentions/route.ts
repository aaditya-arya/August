import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseIntentionState, yearHorizon } from "@/lib/intention-state";
import { mergeIntentions } from "@/lib/review";
import { lastReviewedIntentions } from "@/lib/review-service";
import { invalidateReviewData, readReviewEntries } from "@/lib/review-data";
import { validTimezone } from "@/lib/time";
import { errorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const zone = validTimezone(new URL(request.url).searchParams.get("timezone")) || "UTC";
    const entries = await readReviewEntries();
    return NextResponse.json({ intentions: mergeIntentions(entries, lastReviewedIntentions()), horizon: yearHorizon(new Date(), zone) });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (typeof body.item_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.item_id)) return NextResponse.json({ error: "A valid entry is required." }, { status: 400 });
    const state = parseIntentionState({ ...body.state, version: 1, updated_at: new Date().toISOString() });
    if (!state) return NextResponse.json({ error: "Check the title, date, status and amounts in your plan." }, { status: 400 });
    // Preserve all scheduling metadata, and retry if another editor changed this JSON document.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: item, error } = await supabase.from("extracted_items").select("id, calendar_action").eq("id", body.item_id).maybeSingle();
      if (error) throw error;
      if (!item) return NextResponse.json({ error: "This entry no longer exists." }, { status: 404 });
      const previous = item.calendar_action;
      const calendar = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : { is_actionable: false };
      let update = supabase.from("extracted_items").update({ calendar_action: { ...calendar, review_state: state } }).eq("id", item.id);
      update = previous === null ? update.is("calendar_action", null) : update.eq("calendar_action", JSON.stringify(previous));
      const { data, error: saveError } = await update.select("id");
      if (saveError) throw saveError;
      if (data?.length) { invalidateReviewData(); return NextResponse.json({ success: true, state }); }
    }
    return NextResponse.json({ error: "This plan changed while you were editing. Please try again." }, { status: 409 });
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}
