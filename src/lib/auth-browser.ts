'use client';
import { createBrowserClient } from '@supabase/ssr';

export function browserAuthClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  // Client Components are also prerendered during builds. An unconfigured
  // Preview should show unavailable sign-in rather than fail every route.
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
