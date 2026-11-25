import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { runWithAccount } from './account-context';

export const authConfiguration = () => ({
  url: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, ''),
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
});

export async function cookieAuthClient() {
  const jar = await cookies();
  const { url, key } = authConfiguration();
  return createServerClient(url, key, {
    cookies: { getAll: () => jar.getAll(), setAll: values => { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } },
  });
}

export async function verifiedAccount(request: Request) {
  const header = request.headers.get('authorization');
  if (header) {
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match) return null;
    const { url, key } = authConfiguration();
    const database = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${match[1]}` } } });
    const { data, error } = await database.auth.getUser(match[1]);
    return error || !data.user ? null : { userId: data.user.id, user: data.user, database };
  }
  const database = await cookieAuthClient();
  const { data, error } = await database.auth.getUser();
  return error || !data.user ? null : { userId: data.user.id, user: data.user, database };
}

type Handler = (request: Request) => Promise<Response>;
export function withAccount(handler: Handler, { storage = true }: { storage?: boolean } = {}): Handler {
  return async request => {
    if (!request.headers.has('authorization') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Open August to make this change.' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const account = await verifiedAccount(request).catch(() => null);
    if (!account) return NextResponse.json({ error: 'Sign in to access your journal.', code: 'AUTH_REQUIRED' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
    // The new client must never access an old database that still permits shared
    // anonymous access. This RPC exists only after the RLS migration commits.
    if (storage) {
      const { data, error } = await account.database.rpc('account_security_version').then(result => result, () => ({ data: null, error: true }));
      if (error || data !== 1) return NextResponse.json({ error: 'Account storage setup is not complete yet. Your draft is still on this device.', code: 'ACCOUNT_SETUP_REQUIRED' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
    }
    const response = await runWithAccount(account, () => handler(request));
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  };
}
