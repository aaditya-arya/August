import { withAccount } from "@/lib/auth-server";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/calendar-server";
import { errorMessage } from "@/lib/errors";
import { currentAccount } from "@/lib/account-context";

async function handleGET() {
  try {
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(getGoogleAuthUrl(state));
    response.cookies.set("august_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google/callback", maxAge: 600 });
    response.cookies.set("august_oauth_user", currentAccount().userId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google/callback", maxAge: 600 });
    return response;
  } catch (error) { return NextResponse.json({ error: errorMessage(error) }, { status: 500 }); }
}

export const GET = withAccount(handleGET, { storage: false });
