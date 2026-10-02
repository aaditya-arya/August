import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/calendar";

export async function GET() {
  try {
    const authUrl = getGoogleAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
