import { withAccount } from "@/lib/auth-server";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/calendar-server";
import { currentAccount } from "@/lib/account-context";

async function handleGET(request: Request) {
  try {
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(getGoogleAuthUrl(state, new URL(request.url).origin));
    response.cookies.set("august_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google/callback", maxAge: 600 });
    response.cookies.set("august_oauth_user", currentAccount().userId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google/callback", maxAge: 600 });
    return response;
  } catch { return NextResponse.redirect(new URL("/?calendar=error&reason=setup", request.url)); }
}

export const GET = withAccount(handleGET, { storage: false });
