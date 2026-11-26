import { createHash } from "node:crypto";
import { generateSundayReview } from "./gemini";
import { readReviewEntries, readReviewSources } from "./review-data";
import { localDay } from "./intention-state";
import { inReviewPeriod, mergeIntentions, reviewPeriod, type ReviewResponse, type ReviewPeriod, type ReviewIntention } from "./review";
import { accountResource } from './account-context';

const state = () => accountResource('review-service', () => ({
  cache: new Map<string, { response: ReviewResponse; time: number }>(),
  pending: new Map<string, Promise<ReviewResponse>>(),
  lastIntentions: [] as ReviewIntention[],
}));
export function lastReviewedIntentions() { return state().lastIntentions; }

export async function buildSundayReview(days: ReviewPeriod["days"], timezone: string, refresh = false): Promise<ReviewResponse> {
  const account = state();
  const { cache, pending } = account;
  const now = new Date(), entries = await readReviewEntries(refresh), period = reviewPeriod(days, now);
  const fingerprint = createHash("sha256").update(JSON.stringify({ days, timezone, day: localDay(now, timezone), entries })).digest("hex");
  const stored = cache.get(fingerprint);
  if (!refresh && stored && Date.now() - stored.time < 300000) return stored.response;
  if (pending.has(fingerprint)) return pending.get(fingerprint)!;
  const work = (async (): Promise<ReviewResponse> => {
    const selected = entries.filter((entry) => inReviewPeriod(entry, period));
    const missingAiKey = selected.length > 0 && !process.env.GEMINI_API_KEY?.trim();
    const generated = selected.length && !missingAiKey ? await generateSundayReview(entries, period, timezone, await readReviewSources(entries)) : null;
    if (generated) account.lastIntentions = generated.intentions;
    const response: ReviewResponse = {
      review: generated, status: generated ? "ready" : "unavailable", period,
      intentions: mergeIntentions(entries, generated?.intentions || account.lastIntentions),
      entries, selected_count: selected.length, context_count: entries.length, generated_at: now.toISOString(),
      ...(!generated ? { message: missingAiKey
        ? "Reflections need GEMINI_API_KEY in the August Vercel project's Production environment. Add it and redeploy; your saved moments are safe."
        : !selected.length ? "No saved moments fall in this period. Choose All time or save a new moment."
        : "The AI reflection is temporarily unavailable. Your saved moments and plans are still available below. Try again shortly; if this continues, check the Gemini model, quota, and deployment logs." } : {}),
    };
    if (generated || !selected.length) { cache.set(fingerprint, { response, time: Date.now() }); if (cache.size > 12) cache.delete(cache.keys().next().value!); }
    return !generated && stored ? { ...stored.response, message: "Showing your last reflection. Refresh again in a little while." } : response;
  })();
  pending.set(fingerprint, work);
  try { return await work; } finally { pending.delete(fingerprint); }
}
