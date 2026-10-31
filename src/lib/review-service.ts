import { createHash } from "node:crypto";
import { generateSundayReview } from "./gemini";
import { readReviewEntries } from "./review-data";
import { inReviewPeriod, mergeIntentions, reviewPeriod, type ReviewResponse, type ReviewPeriod, type ReviewIntention } from "./review";

const cache = new Map<string, { response: ReviewResponse; time: number }>();
const pending = new Map<string, Promise<ReviewResponse>>();
let lastIntentions: ReviewIntention[] = [];
export function lastReviewedIntentions() { return lastIntentions; }

export async function buildSundayReview(days: ReviewPeriod["days"], timezone: string, refresh = false): Promise<ReviewResponse> {
  const now = new Date(), entries = await readReviewEntries(refresh), period = reviewPeriod(days, now);
  const fingerprint = createHash("sha256").update(JSON.stringify({ days, timezone, day: now.toISOString().slice(0, 10), entries })).digest("hex");
  const stored = cache.get(fingerprint);
  if (!refresh && stored && Date.now() - stored.time < 300000) return stored.response;
  if (pending.has(fingerprint)) return pending.get(fingerprint)!;
  const work = (async (): Promise<ReviewResponse> => {
    const selected = entries.filter((entry) => inReviewPeriod(entry, period));
    const generated = await generateSundayReview(entries, period, timezone);
    if (generated) lastIntentions = generated.intentions;
    const response: ReviewResponse = {
      review: generated, status: generated ? "ready" : "unavailable", period,
      intentions: mergeIntentions(entries, generated?.intentions || lastIntentions),
      entries, selected_count: selected.length, context_count: entries.length, generated_at: now.toISOString(),
      ...(!generated ? { message: "Your reflection could not be prepared right now. Your plans and countdowns are still available." } : {}),
    };
    if (generated) { cache.set(fingerprint, { response, time: Date.now() }); if (cache.size > 12) cache.delete(cache.keys().next().value!); }
    return !generated && stored ? { ...stored.response, message: "Showing your last reflection. Refresh again in a little while." } : response;
  })();
  pending.set(fingerprint, work);
  try { return await work; } finally { pending.delete(fingerprint); }
}
