"use client";
import { useEffect, useRef, useState } from "react";
import { X, ArrowUpRight, CalendarClock, CheckCircle2, Pause, Leaf } from "lucide-react";
import { deadlineLabel, moneyProgress, type IntentionState } from "@/lib/intention-state";
import type { ReviewIntention } from "@/lib/review";
import { saveIntention, useReviewClock } from "@/lib/use-intentions";

function defaultCurrency() { return /Kolkata|Calcutta/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? "INR" : "USD"; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value); }

export function PlanDialog({ intention, onClose }: { intention: ReviewIntention; onClose: () => void }) {
  const reference = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState((intention.state?.title || intention.title).slice(0, 140));
  const [step, setStep] = useState(intention.state?.next_step || intention.next_step);
  const [date, setDate] = useState(intention.state?.target_date || intention.deadline || "");
  const [target, setTarget] = useState(intention.state?.target_amount?.toString() || "");
  const [saved, setSaved] = useState(intention.state?.saved_amount?.toString() || "");
  const [currency, setCurrency] = useState(intention.state?.currency || defaultCurrency());
  const [status, setStatus] = useState<IntentionState["status"]>(intention.state?.status || (intention.status === "open" || intention.status === "progress" ? "active" : intention.status));
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { reference.current?.showModal(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await saveIntention(intention.anchor_id, { status, title, next_step: step, target_date: date || null, target_amount: target.trim() ? Number(target) : null, saved_amount: saved.trim() ? Number(saved) : null, currency });
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your plan."); }
    finally { setSaving(false); }
  }
  const field = "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";
  return <dialog ref={reference} onCancel={onClose} aria-labelledby="plan-title" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-border bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/40 sm:p-8">
    <div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.2em] text-accent">Make room for it</p><h2 id="plan-title" className="mt-2 font-serif text-2xl">A wish becomes a plan.</h2></div><button aria-label="Close plan" onClick={onClose} className="rounded-lg p-2"><X size={18} /></button></div>
    <form onSubmit={save} className="space-y-5">
      <label className="block text-xs font-medium">What matters to you<input required maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} className={field} /></label>
      <label className="block text-xs font-medium">One realistic next step<textarea maxLength={300} rows={2} value={step} onChange={(event) => setStep(event.target.value)} className={field} placeholder="Something small enough to actually do." /></label>
      <div><label className="block text-xs font-medium">Your date, if there is one<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label><button type="button" onClick={() => setDate(`${new Date().getFullYear()}-12-31`)} className="mt-2 text-xs text-accent underline underline-offset-4">Make it a year-end goal</button><p className="mt-2 text-xs leading-relaxed text-muted">A wish does not need a deadline. Set one only if you want to work towards it.</p></div>
      <fieldset className="rounded-2xl border border-border p-4"><legend className="px-2 text-xs font-medium">If money is part of the plan <span className="text-muted">· optional</span></legend><div className="grid grid-cols-2 gap-3"><label className="text-xs">Target amount<input type="number" min="0.01" step="any" value={target} onChange={(event) => setTarget(event.target.value)} className={field} placeholder="Not set" /></label><label className="text-xs">Set aside so far<input type="number" min="0" step="any" value={saved} onChange={(event) => setSaved(event.target.value)} className={field} placeholder="Not recorded" /></label></div><label className="mt-3 block text-xs">Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)} className={field}>{["INR", "USD", "EUR", "GBP", "AUD", "CAD", "JPY"].map((value) => <option key={value}>{value}</option>)}</select></label><p className="mt-3 text-xs leading-relaxed text-muted">These are amounts you enter. The app does not assume a price or know your bank balance.</p></fieldset>
      <label className="block text-xs font-medium">Where this stands<select className={field} value={status} onChange={(event) => setStatus(event.target.value as IntentionState["status"])}><option value="active">Still working towards it</option><option value="completed">I followed through</option><option value="paused">Paused for now</option><option value="released">I am letting this go</option></select></label>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      <button disabled={saving} className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving your plan…" : "Save my plan"}</button>
    </form>
  </dialog>;
}

export function IntentionCard({ intention, compact = false }: { intention: ReviewIntention; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const clock = useReviewClock();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timing = deadlineLabel(intention.deadline, new Date(clock), timezone);
  const funding = intention.state ? moneyProgress(intention.state) : null;
  const complete = intention.status === "completed", closed = complete || intention.status === "released" || intention.status === "paused";
  const Icon = complete ? CheckCircle2 : intention.status === "released" ? Leaf : intention.status === "paused" ? Pause : CalendarClock;
  return <>
    <article className={`rounded-2xl border p-5 ${complete ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-surface"}`}>
      <div className="flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted">{complete ? "You followed through" : intention.status === "released" ? "You chose to let this go" : intention.status === "paused" ? "Paused, not forgotten" : intention.state ? "A plan you chose" : "Still on your mind?"}</p><h3 className="font-serif text-xl leading-snug">{intention.title}</h3></div><Icon size={18} className="mt-1 shrink-0 text-accent" /></div>
      {!closed && (!compact || intention.deadline || intention.state) && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-3 py-1.5 ${timing.overdue ? "bg-amber-500/10 text-amber-800 dark:text-amber-200" : "bg-accent/5 text-accent"}`}>{timing.label}</span>{intention.deadline && <span className="text-muted">{new Date(`${intention.deadline}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>}</div>}
      {!compact && intention.status === "progress" && <p className="mt-4 text-sm leading-relaxed text-muted">{intention.reflection}</p>}
      {!closed && funding && intention.state && <div className="mt-4"><div className="mb-2 flex justify-between gap-3 text-xs"><span>{formatMoney(intention.state.saved_amount!, intention.state.currency)} set aside</span><span>{formatMoney(funding.remaining, intention.state.currency)} to go</span></div><div role="progressbar" aria-label="Money set aside towards your target" aria-valuenow={funding.percent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-accent/10"><div className="h-full rounded-full bg-accent" style={{ width: `${funding.percent}%` }} /></div><p className="mt-2 text-[11px] text-muted">Towards your {formatMoney(intention.state.target_amount!, intention.state.currency)} target</p></div>}
      {!closed && !compact && <div className="mt-4 border-t border-border pt-4"><p className="text-xs leading-relaxed text-muted">{funding?.remaining === 0 ? "The amount is there. Decide when you want to follow through." : intention.gap}</p><p className="mt-2 text-sm leading-relaxed text-foreground"><span className="font-semibold">One next step:</span> {intention.next_step}</p></div>}
      <button onClick={() => setEditing(true)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent">{closed ? "Update this decision" : intention.state ? "Update your progress" : "Make a plan or let it go"}<ArrowUpRight size={13} /></button>
    </article>
    {editing && <PlanDialog intention={intention} onClose={() => setEditing(false)} />}
  </>;
}
