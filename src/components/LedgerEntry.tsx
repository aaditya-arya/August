"use client";

import { Calendar, CheckCircle2 } from "lucide-react";
import { generateGoogleCalendarUrl, shouldOfferCalendarAdd } from "@/lib/calendar";
import { type LedgerItem } from "@/lib/ledger";
import { resolveLifeTexture } from "@/lib/ledger-presentation";
import { getRelativeTimeLabel } from "@/lib/time";

/** Open-category entry rendering for the ledger. Review insights use source links instead. */
export function LedgerEntry({ item }: { item: LedgerItem }) {
  const style = resolveLifeTexture(item);
  const Icon = style.icon;
  return (
    <article className={`rounded-2xl border bg-surface p-5 sm:p-6 ${style.borderClass}`} style={{ borderLeftWidth: 3, borderLeftColor: style.color }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${style.textAccent}`}>
          <Icon size={13} /> {style.label}
        </span>
        <time dateTime={item.event_timestamp || item.created_at} className="text-xs text-muted">{getRelativeTimeLabel(item.event_timestamp || item.created_at)}</time>
      </div>
      <p className={`entry-copy text-foreground ${style.key === "shaairi_quote" || style.key === "quiet_moment" ? "italic" : ""}`}>{item.content}</p>
      {item.tags && item.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{item.tags.map((tag) => <span key={tag} className="rounded bg-accent/5 px-2 py-0.5 text-xs text-muted">#{tag}</span>)}</div>}
      {item.calendar_status === "synced" && <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 size={13} />Synced to Google Calendar</p>}
      {item.calendar_action && shouldOfferCalendarAdd(item) && <a href={generateGoogleCalendarUrl(item.calendar_action, item.content)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"><Calendar size={13} />Add to Google Calendar</a>}
    </article>
  );
}
