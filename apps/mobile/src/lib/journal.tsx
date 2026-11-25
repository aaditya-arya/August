import 'react-native-url-polyfill/auto';
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { createAugustApi, normalizeServerUrl, type AuthConfig } from '@august/shared';
import { secureStorage } from './secure-storage';

type Api = ReturnType<typeof createAugustApi>;
type Connection = { server: string; config: AuthConfig; client: SupabaseClient; namespace: string };
type Journal = {
  api: Api | null; server: string; ready: boolean; user: User | null; namespace: string;
  googleEnabled: boolean; authError: string | null; revision: number; changed: () => void;
  setServer: (value: string) => Promise<void>; signInGoogle: (server?: string) => Promise<void>;
  signOut: () => Promise<void>; completeSignIn: (code: string) => Promise<void>;
};
const Context = createContext<Journal | null>(null);
const settingsKey = 'august-account-connection-v1';
export const redirectUri = makeRedirectUri({ scheme: 'august', path: 'auth/callback' });

function validateConfig(config: AuthConfig) {
  normalizeServerUrl(config.supabaseUrl, __DEV__);
  if (typeof config.supabaseAnonKey !== 'string' || !config.supabaseAnonKey || typeof config.googleEnabled !== 'boolean') throw new Error('This server does not support account sign-in yet.');
  return config;
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const generation = useRef({ value: 0 });
  const connectionRef = useRef<Connection | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const exchanges = useRef(new Map<string, Promise<void>>());

  async function connect(server: string, config: AuthConfig, persist = true, expected = ++generation.current.value) {
    const namespace = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${server}|${config.supabaseUrl}`);
    if (expected !== generation.current.value) return;
    const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: secureStorage, storageKey: `august-session-${namespace}`, flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.getSession();
    if (expected !== generation.current.value) { client.auth.stopAutoRefresh(); return; }
    if (error) { client.auth.stopAutoRefresh(); throw new Error('Your session could not be restored. Your writing has not been removed.'); }
    if (persist) await AsyncStorage.setItem(settingsKey, JSON.stringify({ server, config }));
    if (expected !== generation.current.value) { client.auth.stopAutoRefresh(); return; }
    unsubscribe.current?.();
    connectionRef.current?.client.auth.stopAutoRefresh();
    const next = { server, config, client, namespace };
    connectionRef.current = next;
    const listener = client.auth.onAuthStateChange((_event, nextSession) => {
      if (connectionRef.current?.client === client) setSession(nextSession);
    });
    unsubscribe.current = () => listener.data.subscription.unsubscribe();
    setConnection(next); setSession(data.session); setAuthError(null); setReady(true);
    if (AppState.currentState === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh();
  }

  useEffect(() => {
    const counter = generation.current;
    const expected = ++counter.value;
    async function restore() {
      try {
        const raw = await AsyncStorage.getItem(settingsKey);
        const saved = raw ? JSON.parse(raw) : null;
        const candidate = saved?.server || await AsyncStorage.getItem('august-server') || process.env.EXPO_PUBLIC_API_URL;
        if (!candidate) return;
        const server = normalizeServerUrl(candidate, __DEV__);
        const config = saved?.config ? validateConfig(saved.config) : validateConfig(await createAugustApi(server).authConfig());
        await connect(server, config, true, expected);
      } catch (e) {
        if (expected === counter.value) setAuthError(e instanceof Error ? e.message : 'Your connection could not be restored. Reconnect below.');
      } finally { if (expected === counter.value) setReady(true); }
    }
    void restore();
    const listener = AppState.addEventListener('change', state => {
      const auth = connectionRef.current?.client.auth;
      if (state === 'active') auth?.startAutoRefresh(); else auth?.stopAutoRefresh();
    });
    return () => { counter.value++; listener.remove(); unsubscribe.current?.(); connectionRef.current?.client.auth.stopAutoRefresh(); };
  }, []);

  const userId = session?.user.id;
  const api = useMemo(() => connection && userId ? createAugustApi(connection.server, fetch, {
    accessToken: async () => {
      const { data, error } = await connection.client.auth.getSession();
      if (error) throw new Error('Your session needs to be renewed. Sign in again; your draft is kept here.');
      return data.session?.user.id === userId ? data.session.access_token : null;
    },
  }) : null, [connection, userId]);

  async function setServer(value: string) {
    const server = normalizeServerUrl(value, __DEV__);
    const config = validateConfig(await createAugustApi(server).authConfig());
    if (connectionRef.current?.server === server && connectionRef.current.config.supabaseUrl === config.supabaseUrl && connectionRef.current.config.supabaseAnonKey === config.supabaseAnonKey) {
      await AsyncStorage.setItem(settingsKey, JSON.stringify({ server, config }));
      const next = { ...connectionRef.current, config };
      connectionRef.current = next; setConnection(next); setAuthError(null); return;
    }
    await connect(server, config);
  }

  const completeSignIn = useCallback(async (code: string) => {
    const current = connectionRef.current;
    if (!current) throw new Error('Connect your August server before signing in.');
    const key = `${current.namespace}:${code}`;
    let exchange = exchanges.current.get(key);
    if (!exchange) {
      exchange = (async () => {
        const { error } = await current.client.auth.exchangeCodeForSession(code);
        if (error) throw new Error('Sign-in could not be completed. Please start again from August.');
      })();
      exchanges.current.set(key, exchange);
      // Android linking and the browser can both deliver the same callback.
      void exchange.finally(() => setTimeout(() => exchanges.current.delete(key), 60_000)).catch(() => undefined);
    }
    await exchange;
  }, []);
  async function signInGoogle(value?: string) {
    const server = value || connectionRef.current?.server;
    if (!server) throw new Error('Enter your August server address before signing in.');
    // Provider settings may have changed since this device last connected.
    // Refresh them on the user's sign-in attempt rather than trusting disk state.
    await setServer(server);
    const current = connectionRef.current;
    if (!current?.config.googleEnabled) throw new Error('Google sign-in still needs to be enabled on your server.');
    const { data, error } = await current.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUri, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
    if (error || !data.url) throw new Error('Google sign-in could not start. Please try again.');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type !== 'success') return;
    const callback = new URL(result.url);
    if (`${callback.protocol}//${callback.host}${callback.pathname}` !== redirectUri) throw new Error('Sign-in returned an unexpected address.');
    const code = callback.searchParams.get('code');
    if (!code) throw new Error('Sign-in was not completed. Please try again.');
    await completeSignIn(code);
  }
  async function signOut() {
    const { error } = await connectionRef.current!.client.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Sign-out failed. Please try again.');
  }
  return <Context.Provider value={{ api, server: connection?.server || '', namespace: connection?.namespace || '', user: session?.user || null, ready, googleEnabled: !!connection?.config.googleEnabled, authError, revision, changed: () => setRevision(value => value + 1), setServer, signInGoogle, signOut, completeSignIn }}>{children}</Context.Provider>;
}

export function useJournal() {
  const journal = useContext(Context);
  if (!journal) throw new Error('JournalProvider is missing.');
  return journal;
}

export function useRemote<T>(load: (api: Api, signal: AbortSignal) => Promise<T>) {
  const { api, ready, revision } = useJournal();
  const [state, setState] = useState<{ api: Api; load: typeof load; revision: number; retry: number; data: T | null; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready || !api) return;
    const controller = new AbortController();
    load(api, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ api, load, revision, retry, data, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ api, load, revision, retry, data: null, error: error instanceof Error ? error.message : 'Your journal could not be loaded. Please try again.' });
    });
    return () => controller.abort();
  }, [api, ready, revision, load, retry]);
  const current = state?.api === api && state?.load === load && state?.revision === revision && state?.retry === retry ? state : null;
  return { data: current?.data || null, loading: !ready || Boolean(api && !current), error: ready && !api ? 'Sign in to see your saved moments.' : current?.error || null, reload: () => setRetry(value => value + 1) };
}
