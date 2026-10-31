import { localDay } from "./intention-state";
import type { ReviewPeriod, ReviewResponse } from "./review";

type Period = ReviewPeriod["days"];
type FetchReview = (days: Period, timezone: string, refresh: boolean) => Promise<ReviewResponse>;

// A period change stops observing a request; it must not cancel useful work.
export function createReviewLoader(fetchReview: FetchReview, now = Date.now) {
  const cache = new Map<string, { data: ReviewResponse; time: number }>();
  const pending = new Map<string, Promise<ReviewResponse>>();
  let generation = 0;
  const key = (days: Period, timezone: string) => `${timezone}:${localDay(new Date(now()), timezone)}:${days}`;
  function peek(days: Period, timezone: string) {
    const value = cache.get(key(days, timezone));
    return value && now() - value.time < 300_000 ? value.data : null;
  }
  function load(days: Period, timezone: string, refresh = false): Promise<ReviewResponse> {
    const id = key(days, timezone), stored = !refresh && peek(days, timezone);
    if (stored) return Promise.resolve(stored);
    const running = pending.get(id);
    if (running) return running;
    const started = generation;
    const work = fetchReview(days, timezone, refresh).then((data) => {
      if (generation === started && (data.status === "ready" || data.context_count === 0 || data.selected_count === 0)) {
        cache.set(id, { data, time: now() });
        if (cache.size > 12) cache.delete(cache.keys().next().value!);
      }
      return data;
    }).finally(() => { if (pending.get(id) === work) pending.delete(id); });
    pending.set(id, work);
    return work;
  }
  return { peek, load, invalidate() { generation++; cache.clear(); pending.clear(); } };
}

export const reviewLoader = createReviewLoader(async (days, timezone, refresh) => {
  const response = await fetch(`/api/digest/synthesis?days=${days}&timezone=${encodeURIComponent(timezone)}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Could not prepare your review.");
  return value as ReviewResponse;
});

if (typeof window !== "undefined") {
  window.addEventListener("august-intentions-changed", () => reviewLoader.invalidate());
  window.addEventListener("august-ledger-changed", () => reviewLoader.invalidate());
}
