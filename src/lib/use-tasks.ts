'use client';
import { useEffect, useSyncExternalStore } from 'react';
import type { JournalTask } from './tasks';
import { refreshIntentions } from './use-intentions';

type Snapshot = { tasks: JournalTask[]; loading: boolean; error: string | null; updating: string[] };
const initial: Snapshot = { tasks: [], loading: true, error: null, updating: [] };
let snapshot = initial, generation = 0;
let requestVersion = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = (value: Snapshot) => { snapshot = value; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function resetTasks() { generation++; requestVersion++; pending = null; emit(initial); }
export async function refreshTasks() {
  if (pending || snapshot.updating.length) return pending;
  const request = generation;
  const version = ++requestVersion;
  emit({ ...snapshot, loading: true, error: null });
  pending = (async () => {
    try {
      const response = await fetch(`/api/tasks?timezone=${encodeURIComponent(timezone())}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load tasks.');
      if (request === generation && version === requestVersion) emit({ ...snapshot, tasks: result.tasks, loading: false, error: null });
    } catch (error) { if (request === generation && version === requestVersion) emit({ ...snapshot, loading: false, error: error instanceof Error ? error.message : 'Could not load tasks.' }); }
  })();
  try { await pending; } finally { if (request === generation && version === requestVersion) pending = null; }
}

export async function updateTask(id: string, patch: { completed?: boolean; title?: string; due_at?: string | null; expected_updated_at?: string }) {
  if (snapshot.updating.includes(id)) return;
  const request = generation;
  requestVersion++;
  pending = null; // Any older fetch must not overwrite this update.
  const previous = snapshot.tasks.find(task => task.id === id);
  emit({ ...snapshot, error: null, updating: [...snapshot.updating, id], tasks: snapshot.tasks.map(task => task.id === id ? { ...task, ...patch } : task) });
  try {
    const response = await fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: id, timezone: timezone(), ...patch }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save this task.');
    if (request === generation) {
      emit({ ...snapshot, tasks: snapshot.tasks.map(task => task.id === id ? result.task : task), updating: snapshot.updating.filter(value => value !== id) });
      void refreshIntentions();
      window.dispatchEvent(new Event('august-intentions-changed'));
    }
  } catch (error) {
    if (request === generation) emit({ ...snapshot, tasks: snapshot.tasks.map(task => task.id === id && previous ? previous : task), updating: snapshot.updating.filter(value => value !== id), error: error instanceof Error ? error.message : 'Could not save this task.' });
    throw error;
  }
}

export function useTasks() {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => initial);
  useEffect(() => {
    void refreshTasks();
    const refresh = () => { if (document.visibilityState === 'visible') void refreshTasks(); };
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, []);
  return value;
}
