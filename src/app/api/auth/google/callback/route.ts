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
  const base = new URL(request.url).origin;
  const redirectError = (reason: string) => NextResponse.redirect(`${base}/?calendar=error&reason=${encodeURIComponent(reason)}`);
  if (!valid) return redirectError("invalid_state");
  if (params.get("error")) return redirectError(params.get("error") === "access_denied" ? "denied" : "exchange");
  const code = params.get("code");
  if (!code) return redirectError("no_code");
  const result = await exchangeCodeForTokens(code, base);
  if (!result.success) return redirectError("exchange");
  return NextResponse.redirect(`${base}/?calendar=connected`);
}

const callback = withAccount(handleGET, { storage: false });
export async function GET(request: Request) {
  const result = await callback(request);
  if (result.status === 401) return NextResponse.redirect(new URL("/?calendar=error&reason=session", request.url));
  return result;
}
