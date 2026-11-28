import { cookies } from 'next/headers';
import { cookieAuthClient } from '@/lib/auth-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const jar = await cookies();
  const calendar = jar.get('august_connect_calendar')?.value === 'yes';
  jar.set('august_connect_calendar', '', { path: '/auth/callback', maxAge: 0 });
  let destination = '/?auth=failed';
  if (code) {
    const client = await cookieAuthClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) destination = calendar ? '/api/auth/google' : '/';
  }
  return new Response(null, { status: 303, headers: { Location: destination, 'Cache-Control': 'no-store' } });
}
