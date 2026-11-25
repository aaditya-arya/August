import { NextResponse } from 'next/server';
import { authConfiguration } from '@/lib/auth-server';

export async function GET() {
  const { url, key } = authConfiguration();
  if (!url || !key) return NextResponse.json({ error: 'Account sign-in is not configured yet.' }, { status: 503 });
  let googleEnabled = false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (!response.ok) throw new Error('Provider lookup failed');
    googleEnabled = Boolean((await response.json()).external?.google);
  } catch {
    return NextResponse.json({ error: 'Sign-in settings could not be checked. Please check your connection and try again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  // This is the public/publishable app key, never a service-role credential.
  return NextResponse.json({ supabaseUrl: url, supabaseAnonKey: key, googleEnabled }, { headers: { 'Cache-Control': 'no-store' } });
}
