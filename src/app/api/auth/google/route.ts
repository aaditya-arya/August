import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/calendar-server";
import { errorMessage } from "@/lib/errors";

export async function GET() {
  try {
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(getGoogleAuthUrl(state));
    response.cookies.set("august_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google/callback", maxAge: 600 });
    return response;
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}
