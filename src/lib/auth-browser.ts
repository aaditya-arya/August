'use client';
import { createBrowserClient } from '@supabase/ssr';

export function browserAuthClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  );
}
