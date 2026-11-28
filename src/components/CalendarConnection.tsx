"use client";

import { Calendar, CheckCircle2, CircleAlert, Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Status = "checking" | "connected" | "disconnected" | "problem";
type Notice = { tone: "status" | "error"; text: string } | null;
const messages: Record<string, string> = {
  denied: "Google Calendar permission wasn’t granted. You can connect again whenever you’re ready.",
  invalid_state: "The connection request expired. Start again from August.",
  no_code: "Google didn’t complete the connection. Try connecting again.",
  exchange: "August couldn’t finish connecting to Google Calendar. Try again.",
  setup: "Google Calendar hasn’t been configured on this deployment.",
  session: "Your August session expired. Sign in, then connect Calendar again.",
  reconnect: "Google Calendar access couldn’t be confirmed. Reconnect your Calendar and try again.",
  access: "Google Calendar denied access. Check the permissions for the Google account you connected.",
  unavailable: "Google Calendar couldn’t be checked right now. Try again shortly.",
};
function messageFor(reason: unknown, fallback: string) {
  return typeof reason === "string" && Object.hasOwn(messages, reason) ? messages[reason] : messages[fallback];
}

const CalendarContext = createContext<{
  status: Status; notice: Notice; check: () => void; dismiss: () => void;
} | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [notice, setNotice] = useState<Notice>(null);
  const check = useCallback(async (verify: boolean, signal?: AbortSignal) => {
    if (verify) {
      setStatus("checking");
      setNotice({ tone: "status", text: "Checking your Google Calendar connection…" });
    }
    try {
      const response = await fetch(`/api/auth/google/status${verify ? "?verify=1" : ""}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Status unavailable");
      const result = await response.json();
      if (signal?.aborted) return;
      setStatus(result.connected ? "connected" : ["setup", "unavailable"].includes(result.reason) ? "problem" : "disconnected");
      if (verify) setNotice(result.connected
        ? { tone: "status", text: "Google Calendar connected. August can access your calendar." }
        : { tone: "error", text: messageFor(result.reason, "reconnect") });
    } catch {
      if (signal?.aborted) return;
      setStatus("problem");
      if (verify) setNotice({ tone: "error", text: messages.unavailable });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const url = new URL(location.href);
    const returned = url.searchParams.get("calendar");
    const reason = url.searchParams.get("reason");
    // Defer the callback notice until after mount. Keep it visible after removing the query.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (returned === "error") setNotice({ tone: "error", text: messageFor(reason, "exchange") });
      if (returned) {
        url.searchParams.delete("calendar");
        url.searchParams.delete("reason");
        history.replaceState(history.state, "", url);
      }
      void check(returned === "connected", controller.signal);
    });
    return () => controller.abort();
  }, [check]);

  return <CalendarContext.Provider value={{ status, notice, check: () => void check(true), dismiss: () => setNotice(null) }}>{children}</CalendarContext.Provider>;
}

export function CalendarNotice() {
  const connection = useContext(CalendarContext);
  const notice = connection?.notice;
  if (!connection || !notice) return null;
  return <div className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-5xl items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-sm" role={notice.tone === "error" ? "alert" : "status"}>
    {notice.tone === "error" ? <CircleAlert size={18} className="mt-0.5 shrink-0 text-accent" /> : <Calendar size={18} className="mt-0.5 shrink-0 text-accent" />}
    <p className="flex-1 leading-6">{notice.text}</p>
    <button type="button" onClick={connection.dismiss} aria-label="Dismiss Calendar notice" className="rounded-lg p-1.5 text-muted hover:bg-background"><X size={16} /></button>
  </div>;
}

export function CalendarControl({ compact = false }: { compact?: boolean }) {
  const connection = useContext(CalendarContext);
  const status = connection?.status ?? "checking";
  const icon = status === "connected" ? <CheckCircle2 size={17} /> : status === "checking" ? <Loader2 size={17} className="motion-safe:animate-spin" /> : <Calendar size={17} />;
  const label = status === "connected" ? "Google Calendar connected" : status === "checking" ? "Checking Google Calendar" : "Connect Google Calendar";
  if (compact) return status === "connected" || status === "checking"
    ? <button type="button" aria-label={label} title={label} disabled={status === "checking"} onClick={connection?.check} className="rounded-xl border border-border p-2.5 text-accent">{icon}</button>
    : <a href="/api/auth/google" aria-label={label} title={label} className="rounded-xl border border-border p-2.5 text-accent">{icon}</a>;
  return <div className="rounded-2xl border border-border bg-surface p-3.5">
    <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-accent">{icon}</span> Google Calendar</div>
    <p className="mt-1.5 text-xs leading-5 text-muted">{status === "connected" ? "Connected" : status === "checking" ? "Checking connection…" : status === "problem" ? "Connection unavailable" : "Not connected"}</p>
    {status === "connected" || status === "problem" ? (
      <button type="button" onClick={connection?.check} className="mt-2 rounded-lg px-1 py-1.5 text-xs font-semibold text-accent hover:underline">Check connection</button>
    ) : status === "disconnected" ? (
      <a href="/api/auth/google" className="mt-2 inline-flex rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-background">Connect Google Calendar</a>
    ) : null}
  </div>;
}
