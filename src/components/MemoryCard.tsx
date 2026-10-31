"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";
import { getClassification, type LedgerItem } from "@/lib/ledger";
import { generateGoogleCalendarUrl, shouldOfferCalendarAdd } from "@/lib/calendar";

const notes = new Map<string, Promise<string>>();
function readNote(id: string) {
  let request = notes.get(id);
  if (!request) {
    request = fetch(`/api/notes?id=${encodeURIComponent(id)}`).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.note) throw new Error(data.error || "Could not open the original note.");
      return data.note.content as string;
    }).catch(error => { notes.delete(id); throw error; });
    notes.set(id, request);
  }
  return request;
}

export function OriginalNote({ item, onClose }: { item: LedgerItem; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [original, setOriginal] = useState<string | null>(null), [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    let live = true;
    if (item.note_id) readNote(item.note_id).then(text => { if (live) setOriginal(text); }).catch(failure => { if (live) setError(failure.message); });
    return () => { live = false; };
  }, [item.note_id]);
  const segments = [];
  let offset = 0;
  if (original) {
    for (const span of item.memory?.spans || []) {
      if (span.start < offset || span.end > original.length) continue;
      segments.push(<span key={`before-${span.start}`}>{original.slice(offset, span.start)}</span>, <mark key={span.start} className="rounded bg-accent/10 text-inherit">{original.slice(span.start, span.end)}</mark>);
      offset = span.end;
    }
    segments.push(<span key="rest">{original.slice(offset)}</span>);
  }
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="original-title" className="fixed inset-0 m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-border bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/40 sm:p-9">
    <div className="mb-6 flex items-center justify-between gap-5"><div><p className="text-[10px] uppercase tracking-[.18em] text-accent">In your own words</p><h2 id="original-title" className="mt-2 font-serif text-2xl">The original note</h2></div><button onClick={onClose} aria-label="Close original note" className="rounded-lg p-2"><X size={18} /></button></div>
    {error ? <p role="alert" className="text-sm">{error}</p> : !original ? <p role="status" className="text-sm text-muted">Opening your note...</p> : <div className="whitespace-pre-wrap break-words font-serif text-base leading-[1.9]">{segments}</div>}
  </dialog>;
}

export function MemoryCard({ item }: { item: LedgerItem }) {
  const [expanded, setExpanded] = useState(false), [original, setOriginal] = useState(false);
  const category = getClassification(item);
  const long = item.content.length > 320;
  const title = item.memory?.title;
  return <article className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-medium text-accent">{category.label}</span><time dateTime={item.event_timestamp} className="text-[10px] text-muted">{new Date(item.event_timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time></div>
    {title && <h3 className="mb-3 font-serif text-xl leading-snug">{title}</h3>}
    <p className={`whitespace-pre-wrap break-words font-serif text-sm leading-[1.85] text-foreground ${long && !expanded ? "line-clamp-4" : ""}`}>{item.content}</p>
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">{long && <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="inline-flex items-center gap-1 text-xs font-medium text-accent">{expanded ? "Show less" : "Read full passage"}<ChevronDown size={12} className={expanded ? "rotate-180" : ""} /></button>}{item.note_id && <button onClick={() => setOriginal(true)} className="inline-flex items-center gap-1 text-xs text-muted">Open original note<ArrowUpRight size={12} /></button>}</div>
    {item.tags?.length ? <div className="mt-4 flex flex-wrap gap-2">{item.tags.map(tag => <span key={tag} className="text-[10px] text-muted">#{tag}</span>)}</div> : null}
    {item.calendar_status === "synced" && <p className="mt-4 text-xs text-muted">Synced to Google Calendar</p>}
    {item.calendar_action && shouldOfferCalendarAdd(item) && <a href={generateGoogleCalendarUrl(item.calendar_action, item.content)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-xs text-accent">Add to Google Calendar ↗</a>}
    {original && <OriginalNote item={item} onClose={() => setOriginal(false)} />}
  </article>;
}
