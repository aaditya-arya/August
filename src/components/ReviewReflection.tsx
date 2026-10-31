"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";

export function ReviewReflection({ question }: { question: string }) {
  const [answer, setAnswer] = useState(""), [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef<{ content: string; key: string } | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const content = `Sunday reflection\n${question}\n${answer.trim()}`;
    if (!answer.trim()) return;
    if (pending.current?.content !== content) pending.current = { content, key: crypto.randomUUID() };
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key }, body: JSON.stringify({ content, currentTime: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your reflection.");
      setSaved(true); setAnswer(""); pending.current = null; window.dispatchEvent(new Event("august-ledger-changed"));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your reflection."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-3xl border border-accent/20 bg-accent/[.035] p-6 sm:p-9">
    <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-accent">A thought to take with you</p>
    <h2 className="mt-4 max-w-2xl font-serif text-2xl leading-relaxed tracking-[-.02em]">{question}</h2>
    <form onSubmit={save} className="mt-6"><label htmlFor="sunday-answer" className="text-xs text-muted">Your answer can be small. It becomes part of what you learn next time.</label><textarea id="sunday-answer" rows={3} value={answer} onChange={(event) => { setAnswer(event.target.value); setSaved(false); }} placeholder="What do you want to carry into the next week?" className="mt-3 w-full resize-y rounded-2xl border border-border bg-surface p-4 font-serif text-base leading-relaxed outline-none focus:border-accent/40" /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-xs text-muted">{saved && <span className="inline-flex items-center gap-1"><Check size={12} />Saved to your ledger</span>}</p><button disabled={saving || !answer.trim()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Keep this reflection"}<ArrowUpRight size={13} /></button></div>{error && <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p>}</form>
  </section>;
}
