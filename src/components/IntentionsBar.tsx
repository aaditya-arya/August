"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import { usePathname } from "next/navigation";
import { deadlineLabel, moneyProgress, yearHorizon } from "@/lib/intention-state";
import { refreshIntentions, useIntentions, useReviewClock } from "@/lib/use-intentions";
import { PlanDialog } from "./IntentionPlan";

export function IntentionsBar() {
  const { intentions, error } = useIntentions(), pathname = usePathname();
  const clock = useReviewClock();
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => void refreshIntentions(), 60000);
    const focus = () => void refreshIntentions();
    window.addEventListener("focus", focus);
    window.addEventListener("august-ledger-changed", focus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focus); window.removeEventListener("august-ledger-changed", focus); };
  }, []);
  useEffect(() => { void refreshIntentions(); }, [pathname]);
  if (!clock) return null;
  const now = new Date(clock), zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const horizon = yearHorizon(now, zone);
  const active = intentions.filter((item) => !item.needs_confirmation && !["completed", "released", "paused"].includes(item.status));
  const item = active.find((entry) => entry.state) || active[0];
  if (!item && pathname === "/digest") return null;
  const timing = item ? deadlineLabel(item.deadline, now, zone) : null;
  const funding = item?.state ? moneyProgress(item.state) : null;
  return <>
    <aside id="intentions-bar" aria-label="Your time and the plans that matter" className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md px-5 py-3 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-7 gap-y-3">
        <div className="flex w-full items-center justify-between gap-3 sm:block sm:w-auto sm:shrink-0"><p className="text-[10px] uppercase tracking-[.18em] text-muted">There is still room in {horizon.year}</p><p className="shrink-0 text-xs font-medium sm:mt-1 sm:text-sm"><span className="font-serif text-xl text-accent tabular-nums">{horizon.days_left}</span> days left in the year</p></div>
        {item ? <button onClick={() => setEditing(true)} className="w-full min-w-0 text-left sm:w-auto sm:flex-1 sm:max-w-lg"><span className="flex items-center gap-2 text-xs font-medium text-foreground"><CalendarClock size={13} className="shrink-0 text-accent" /><span className="line-clamp-1">{item.title}</span><ArrowUpRight size={12} className="shrink-0 text-accent" /></span><span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{timing?.days !== null ? `${timing?.label}. ` : item.state ? "Your plan has no date yet. " : "A wish, no deadline yet. "}{funding && item.state ? `${new Intl.NumberFormat(undefined, { style: "currency", currency: item.state.currency, maximumFractionDigits: 0 }).format(funding.remaining)} from your target. ` : ""}{item.state?.next_step || "Give it one next step, or decide it no longer matters."}</span></button> : <p className="max-w-sm text-xs leading-relaxed text-muted">{error ? "Your plans will reappear when the connection returns." : "Make room for what matters. Good experiences count, too."}</p>}
        <Link href="/digest" className="hidden shrink-0 text-xs font-semibold text-accent sm:block">Your Sunday Review <span aria-hidden="true">↗</span></Link>
      </div>
    </aside>
    {editing && item && <PlanDialog intention={item} onClose={() => setEditing(false)} />}
  </>;
}
