"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { ReviewIntention } from "./review";
import type { IntentionState } from "./intention-state";

type Snapshot = { intentions: ReviewIntention[]; loading: boolean; error: string | null };
const initial: Snapshot = { intentions: [], loading: true, error: null };
let snapshot = initial;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
function emit(value: Snapshot) { snapshot = value; for (const listener of listeners) listener(); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const getSnapshot = () => snapshot;
const serverSnapshot = () => initial;

export async function refreshIntentions() {
  if (pending) return pending;
  pending = (async () => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch(`/api/intentions?timezone=${encodeURIComponent(zone)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your plans.");
      emit({ intentions: data.intentions || [], loading: false, error: null });
    } catch (error) { emit({ ...snapshot, loading: false, error: error instanceof Error ? error.message : "Could not load your plans." }); }
  })();
  try { await pending; } finally { pending = null; }
}

export function useIntentions() {
  const value = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  useEffect(() => { void refreshIntentions(); }, []);
  return value;
}

export async function saveIntention(itemId: string, state: Omit<IntentionState, "version" | "updated_at">) {
  const response = await fetch("/api/intentions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: itemId, state }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save your plan.");
  await refreshIntentions();
  window.dispatchEvent(new Event("august-intentions-changed"));
  return result.state as IntentionState;
}

const subscribeClock = (callback: () => void) => {
  const timer = window.setInterval(callback, 1000);
  return () => window.clearInterval(timer);
};
const clockSnapshot = () => Math.floor(Date.now() / 60000);
export function useReviewClock() { return useSyncExternalStore(subscribeClock, clockSnapshot, () => 0) * 60000; }
