import { withAccount } from "@/lib/auth-server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/calendar-server";
import { matchesOAuthState } from "@/lib/calendar-session";
import { currentAccount } from "@/lib/account-context";

async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get("august_oauth_state")?.value;
  const valid = matchesOAuthState(params.get("state"), expected) && jar.get("august_oauth_user")?.value === currentAccount().userId;
  jar.set("august_oauth_user", "", { path: "/api/auth/google/callback", maxAge: 0 });
  jar.set("august_oauth_state", "", { path: "/api/auth/google/callback", maxAge: 0 });
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const redirectError = (reason: string) => NextResponse.redirect(`${base}/?calendar=error&reason=${encodeURIComponent(reason)}`);
  if (!valid) return redirectError("invalid_state");
  if (params.get("error")) return redirectError(params.get("error")!);
  const code = params.get("code");
  if (!code) return redirectError("no_code");
  const result = await exchangeCodeForTokens(code);
  if (!result.success) return redirectError(result.error || "exchange_failed");
  return NextResponse.redirect(`${base}/?calendar=connected`);
}

export const GET = withAccount(handleGET, { storage: false });
