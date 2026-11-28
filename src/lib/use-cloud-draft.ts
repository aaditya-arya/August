"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canResumeDraft, MAX_DRAFT_LENGTH, type WebDraft } from "./web-draft-model";

type View = {
  ready: boolean;
  content: string;
  cloud: WebDraft | null;
  busy: "save" | "organize" | null;
  problem: "load" | "save" | "organize" | null;
  conflict: boolean;
  offline: boolean;
  earlier: string;
};

const initial: View = { ready: false, content: "", cloud: null, busy: null, problem: null, conflict: false, offline: false, earlier: "" };
const legacyDraftKey = "august-writing-draft";
const saveDelay = 450;
const organizeDelay = 2_500;
const draftFlushers = new Map<string, () => Promise<boolean>>();

export async function flushCloudDraft(account: string) {
  return await draftFlushers.get(account)?.() ?? true;
}

async function requestDraft(method: "GET" | "PUT" | "POST", body?: object, keepalive = false) {
  const response = await fetch("/api/draft", {
    method, cache: "no-store", keepalive,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok && response.status !== 409) throw new Error("Draft request failed");
  const data: { draft: WebDraft | null } = await response.json();
  return { draft: data.draft, conflict: response.status === 409 };
}

function legacyValue(key: string) {
  try { return localStorage.getItem(key) || ""; } catch { return ""; }
}

export function useCloudDraft(account: string, editorActive: boolean, onFiled: () => void, immediateOrganize = false) {
  const [view, setView] = useState(initial);
  const live = useRef(initial);
  const mounted = useRef(false);
  const saving = useRef<Promise<void> | null>(null);
  const imported = useRef<{ key: string; content: string } | null>(null);
  const accountKey = `${legacyDraftKey}:${account}`;
  const update = useCallback((patch: Partial<View>) => {
    live.current = { ...live.current, ...patch };
    if (mounted.current) setView(live.current);
  }, []);

  const applyCloud = useCallback((draft: WebDraft | null, keepLocalText: boolean) => {
    const previous = live.current.cloud;
    update({ cloud: draft, ...(keepLocalText ? {} : { content: draft?.content || "" }) });
    if (mounted.current && draft?.status === "filed" && draft.receipt?.noteId !== previous?.receipt?.noteId) onFiled();
  }, [onFiled, update]);

  const load = useCallback(async (recoverLocal = false) => {
    update({ problem: null });
    try {
      const { draft } = await requestDraft("GET");
      if (!mounted.current) return;
      applyCloud(draft, false);
      if (recoverLocal) {
        const previous = legacyValue(accountKey);
        if (previous && !draft?.content && (!draft || draft.status === "editing") && previous.length <= MAX_DRAFT_LENGTH) {
          imported.current = { key: accountKey, content: previous };
          update({ content: previous });
        } else {
          update({ earlier: previous && previous !== draft?.content ? previous : legacyValue(legacyDraftKey) });
        }
        if (!live.current.earlier && !live.current.content) update({ earlier: legacyValue(legacyDraftKey) });
      }
      update({ ready: true, conflict: false });
    } catch {
      update({ problem: "load" });
    }
  }, [accountKey, applyCloud, update]);

  const write = useCallback((reset = false, keepalive = false): Promise<void> => {
    if (saving.current) return saving.current;
    const now = live.current;
    if (!now.ready || now.busy || now.conflict || (!reset && now.content === (now.cloud?.content ?? ""))) return Promise.resolve();
    const next = reset ? "" : now.content;
    const body = { account, content: next, expected: now.cloud?.revision ?? null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", ...(reset ? { reset: true } : {}) };
    update({ busy: "save", problem: null });
    const work = requestDraft("PUT", body, keepalive).then(({ draft, conflict }) => {
      if (conflict && !(reset && draft?.status === "editing" && draft.content === "")) {
        applyCloud(draft, true);
        update({ conflict: (draft?.content ?? "") !== next && (draft?.content ?? "") !== live.current.content });
        return;
      }
      applyCloud(draft, !reset);
      const recovery = imported.current;
      if (recovery && draft?.content === recovery.content) {
        try { if (localStorage.getItem(recovery.key) === recovery.content) localStorage.removeItem(recovery.key); } catch {}
        imported.current = null;
        update({ earlier: "" });
      }
    }).catch(() => update({ problem: "save" })).finally(() => {
      saving.current = null;
      update({ busy: null });
    });
    saving.current = work;
    return work;
  }, [account, applyCloud, update]);

  const organize = useCallback(async () => {
    const now = live.current;
    if (!now.cloud || !now.cloud.content.trim() || now.cloud.content !== now.content ||
      now.busy || now.conflict || now.cloud.status === "filed") return;
    update({ busy: "organize", problem: null });
    try {
      const { draft, conflict } = await requestDraft("POST", { account, revision: now.cloud.revision });
      applyCloud(draft, conflict && draft?.content !== now.content);
      if (conflict && draft?.content !== now.content) update({ conflict: true });
    } catch {
      // Check whether the request reached storage before retrying the same revision.
      const current = await requestDraft("GET").catch(() => null);
      if (current) {
        const changed = current.draft?.revision !== now.cloud.revision;
        const conflict = changed && (current.draft?.content ?? "") !== live.current.content;
        applyCloud(current.draft, conflict);
        if (conflict) update({ conflict: true });
      }
      if (!current?.draft || current.draft.status === "editing") update({ problem: "organize" });
    } finally {
      update({ busy: null });
    }
  }, [account, applyCloud, update]);

  useEffect(() => {
    mounted.current = true;
    void load(true);
    const reconnect = () => {
      update({ offline: !navigator.onLine });
      if (!navigator.onLine) return;
      if (!live.current.ready) void load(true);
      else if (live.current.problem === "save") update({ problem: null });
    };
    const flush = async () => {
      await saving.current;
      await write(false, true);
      return live.current.content === (live.current.cloud?.content ?? "");
    };
    draftFlushers.set(account, flush);
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (live.current.content === (live.current.cloud?.content ?? "")) return;
      event.preventDefault();
      event.returnValue = "";
    };
    update({ offline: !navigator.onLine });
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", reconnect);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", preventLoss);
    return () => {
      mounted.current = false;
      if (draftFlushers.get(account) === flush) draftFlushers.delete(account);
      void flush();
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", reconnect);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", preventLoss);
    };
  }, [account, load, update, write]);

  const dirty = view.content !== (view.cloud?.content ?? "");
  useEffect(() => {
    if (view.ready && dirty && !view.busy && !view.conflict && !view.problem && !view.offline) {
      if (immediateOrganize) {
        void write();
        return;
      }
      const timer = window.setTimeout(() => void write(), saveDelay);
      return () => window.clearTimeout(timer);
    }
  }, [dirty, immediateOrganize, view, write]);

  useEffect(() => {
    if (view.offline || !view.cloud || view.busy || view.conflict || view.problem) return;
    if (view.cloud.status === "organizing") {
      const timer = window.setTimeout(() => {
        if (live.current.cloud && canResumeDraft(live.current.cloud)) void organize();
        else void load();
      }, 2_500);
      return () => window.clearTimeout(timer);
    }
    if (!dirty && !editorActive && view.cloud.status === "editing" && view.cloud.content.trim()) {
      if (immediateOrganize) {
        void organize();
        return;
      }
      const timer = window.setTimeout(() => void organize(), organizeDelay);
      return () => window.clearTimeout(timer);
    }
  }, [dirty, editorActive, immediateOrganize, load, organize, view]);

  const organizeNow = useCallback(async () => {
    if (live.current.offline || live.current.conflict || !live.current.ready) return;
    if (saving.current) await saving.current;
    if (live.current.content !== (live.current.cloud?.content ?? "")) {
      await write();
    }
    await organize();
  }, [organize, write]);

  function recoverEarlier() {
    if (!view.earlier || view.earlier.length > MAX_DRAFT_LENGTH || view.content || view.busy) return;
    const key = legacyValue(accountKey) === view.earlier ? accountKey : legacyDraftKey;
    imported.current = { key, content: view.earlier };
    update({ content: view.earlier, problem: null });
  }

  return {
    view, dirty,
    edit: (content: string) => update({ content, problem: null }),
    recoverEarlier,
    organizeNow,
    retry: () => view.problem === "load" ? void load(!view.ready) : view.problem === "organize"
      ? void organize() : void write(view.cloud?.status === "filed"),
    newEntry: () => void write(true),
    useCloud: () => update({ content: view.cloud?.content || "", conflict: false, problem: null }),
    keepMine: () => update({ conflict: false, problem: null }),
  };
}
