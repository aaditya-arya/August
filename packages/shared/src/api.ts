/** The HTTP contract consumed by both Next.js and the native app. No server secrets. */
export type Period = "7" | "30" | "all";
export type Moment = {
  id: string; note_id?: string; category: string; content: string; tags?: string[];
  event_timestamp: string; created_at: string;
  memory?: { title: string } | null;
};
export type ItemsResponse = { items: Moment[] };
export type NoteSubmission = { content: string; key: string; currentTime: string; timezone: string };
export type SaveNoteResponse = { success: boolean; noteId: string; extractedCount: number; items: Moment[] };
export type Insight = { title: string; meaning: string; takeaway: string; source_ids: string[] };
export type ReviewData = {
  status: "ready" | "unavailable"; message?: string; context_count: number; selected_count: number;
  review: null | {
    opening: string; focus: Insight | null; progress: Insight[]; experiences: Insight[];
    lessons: Insight[]; patterns: Insight[]; next_step: Insight | null; question: string;
  };
};
export type GraphData = {
  nodes: { id: string; name: string; group: string; color: string; tags: string[] }[];
  links: { source: string; target: string; weight: number; link_type: string }[];
};

export function normalizeServerUrl(value: string, allowInsecure = false) {
  const parsed = new URL(value.trim());
  if (!['https:', ...(allowInsecure ? ['http:'] : [])].includes(parsed.protocol)) {
    throw new Error(allowInsecure ? "Use an http:// or https:// server address." : "A production server must use HTTPS.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new Error("Use the server origin only, without credentials, a path, or query parameters.");
  }
  return parsed.origin;
}

export function createAugustApi(baseUrl = "", fetcher: typeof fetch = fetch) {
  const origin = baseUrl.replace(/\/$/, "");
  async function request<T>(path: string, options: RequestInit = {}, timeout = 300_000): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout);
    try {
      const response = await fetcher(`${origin}${path}`, { ...options, signal: controller.signal });
      let body: unknown;
      try { body = await response.json(); }
      catch { throw new Error("The server returned an unreadable response. Please try again."); }
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The request could not be completed.";
        throw new Error(message);
      }
      return body as T;
    } catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) throw new Error("The server took too long to respond. Your draft is still on this device; try again.");
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  return {
    items: (period: Period = "7", signal?: AbortSignal) => request<ItemsResponse>(`/api/items?days=${period}`, { signal }, 30_000),
    saveNote: ({ key, ...body }: NoteSubmission) => request<SaveNoteResponse>("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body),
    }),
    review: (period: Period, timezone: string, refresh = false, signal?: AbortSignal) => request<ReviewData>(`/api/digest/synthesis?days=${period}&timezone=${encodeURIComponent(timezone)}${refresh ? '&refresh=1' : ''}`, { signal }),
    graph: (signal?: AbortSignal) => request<GraphData>("/api/graph", { signal }, 30_000),
  };
}
