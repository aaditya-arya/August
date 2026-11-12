import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAugustApi, normalizeServerUrl } from '@august/shared';

type Api = ReturnType<typeof createAugustApi>;
type Journal = { api: Api | null; server: string; ready: boolean; revision: number; changed: () => void; setServer: (value: string) => Promise<void> };
const Context = createContext<Journal | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [server, updateServer] = useState('');
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('august-server').then(value => {
      if (!active) return;
      const candidate = value || process.env.EXPO_PUBLIC_API_URL;
      if (candidate) updateServer(normalizeServerUrl(candidate, __DEV__));
    }).catch(() => { /* Settings remains available if configuration cannot be restored. */ })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const api = useMemo(() => server ? createAugustApi(server) : null, [server]);
  async function setServer(value: string) {
    const normalized = normalizeServerUrl(value, __DEV__);
    await createAugustApi(normalized).items('7');
    await AsyncStorage.setItem('august-server', normalized);
    updateServer(normalized);
    setRevision(value => value + 1);
  }
  return <Context.Provider value={{ api, server, ready, revision, changed: () => setRevision(value => value + 1), setServer }}>{children}</Context.Provider>;
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
  return {
    data: current?.data || null,
    loading: !ready || Boolean(api && !current),
    error: ready && !api ? 'Connect your journal in Settings to see your saved moments.' : current?.error || null,
    reload: () => setRetry(value => value + 1),
  };
}
