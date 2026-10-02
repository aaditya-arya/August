import { NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/calendar";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (error) {
      console.error("Google OAuth error from callback:", error);
      return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?calendar=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?calendar=error&reason=no_code`);
    }

    const result = await exchangeCodeForTokens(code);

    if (!result.success) {
      console.error("Token exchange failure:", result.error);
      return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?calendar=error&reason=${encodeURIComponent(result.error || "exchange_failed")}`);
    }

    return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?calendar=connected`);
  } catch (err: any) {
    console.error("OAuth callback exception:", err);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/?calendar=error`);
  }
}
