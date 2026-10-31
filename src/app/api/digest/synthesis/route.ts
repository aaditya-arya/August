import { NextResponse } from "next/server";
import { buildSundayReview } from "@/lib/review-service";
import { errorMessage } from "@/lib/errors";
import { validTimezone } from "@/lib/time";

export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const days = params.get("days") || "7";
    if (days !== "7" && days !== "30" && days !== "all") return NextResponse.json({ error: "Choose 7, 30 or all days." }, { status: 400 });
    const timezone = validTimezone(params.get("timezone")) || "UTC";
    return NextResponse.json(await buildSundayReview(days, timezone, params.get("refresh") === "1"));
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}
