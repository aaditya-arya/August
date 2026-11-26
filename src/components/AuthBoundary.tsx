'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Cloud, Feather, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { browserAuthClient } from '@/lib/auth-browser';
import { resetIntentions } from '@/lib/use-intentions';
import { resetTasks } from '@/lib/use-tasks';
import { AndroidDownload } from './AndroidDownload';

const Context = createContext<User | null>(null);
export function useAccount() {
  const user = useContext(Context);
  if (!user) throw new Error('Sign in to access this journal.');
  return user;
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const client = browserAuthClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(client !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(client ? null : false);
  const accountId = useRef<string | null>(null);
  useEffect(() => {
    if (!client) return;
    let active = true;
    const change = (next: User | null) => {
      if (!active) return;
      if (accountId.current !== (next?.id || null)) {
        accountId.current = next?.id || null;
        resetIntentions();
        resetTasks();
        window.dispatchEvent(new Event('august-account-changed'));
      }
      setUser(next); setLoading(false);
    };
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => change(session?.user || null));
    client.auth.getSession().then(({ data, error }) => { if (active) { if (error) setError('Your session could not be restored. Please sign in again.'); else if (new URL(location.href).searchParams.get('auth') === 'failed') setError('Sign-in could not be completed. Please try again.'); change(data.session?.user || null); } }).catch(() => { if (active) { setError('Your session could not be restored. Please sign in again.'); setLoading(false); } });
    fetch('/api/auth/config').then(response => response.json()).then(config => { if (active) setGoogleEnabled(Boolean(config.googleEnabled)); }).catch(() => { if (active) setGoogleEnabled(false); });
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, [client]);

  async function signIn() {
    if (!client) return;
    setBusy(true); setError(null);
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } } });
    if (error) { setError('Google sign-in could not start. Please try again once account setup is complete.'); setBusy(false); }
  }
  async function signOut() {
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) { setError('Sign-out failed. Please try again.'); setBusy(false); return; }
    // Reload to clear account-specific module caches as well as the route tree.
    location.reload();
  }
  if (loading) return <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-14"><div className="w-full max-w-md"><p role="status" className="mb-7 flex items-center justify-center gap-3 text-sm text-muted"><Loader2 className="animate-spin text-accent" size={18} /> Opening your journal…</p><AndroidDownload /></div></main>;
  if (!user) return <main className="flex min-h-dvh flex-1 items-center justify-center bg-background px-6 py-14">
    <div className="w-full max-w-md">
      <p className="mb-9 font-serif text-3xl italic text-accent">August</p>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Feather size={23} /></div>
      <h1 className="font-serif text-4xl leading-tight tracking-tight">Your words.<br /><em className="text-accent">Your little world.</em></h1>
      <p className="mb-8 mt-5 text-sm leading-7 text-muted">Keep your moments, ideas, and progress together. Sign in with the same Google account on your phone and the web.</p>
      <button type="button" onClick={() => void signIn()} disabled={busy || googleEnabled !== true} className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white disabled:opacity-45 dark:text-background">
        {busy ? <Loader2 size={17} className="animate-spin" /> : <span className="font-sans text-lg font-semibold" aria-hidden="true">G</span>} Continue with Google
      </button>
      {googleEnabled === false && <p role="status" className="mt-4 text-sm leading-6 text-muted">Google sign-in is being configured. Your existing local drafts are preserved.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="mt-7"><AndroidDownload /></div>
      <div className="mt-8 space-y-3 border-t border-border pt-6 text-xs leading-6 text-muted">
        <p className="flex items-center gap-2"><Cloud size={15} /> Saved progress follows your account across devices.</p>
        <p className="flex items-center gap-2"><ShieldCheck size={15} /> Sign-in uses your Google identity, without reading your Gmail inbox.</p>
      </div>
    </div>
  </main>;
  return <Context.Provider value={user}><div key={user.id} className="contents">
    {children}
    <div className="mx-5 mb-4 flex max-w-[min(90vw,320px)] self-end items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-sm md:fixed md:bottom-3 md:right-3 md:z-40 md:m-0">
      <span className="truncate text-[10px] text-muted">{user.email}</span>
      <button type="button" aria-label="Sign out" disabled={busy} onClick={() => void signOut()} className="rounded-full p-1.5 text-muted hover:text-accent"><LogOut size={14} /></button>
    </div>
    {error && <p role="alert" className="fixed bottom-16 right-4 z-40 rounded-xl bg-surface p-4 text-sm text-accent">{error}</p>}
  </div></Context.Provider>;
}
