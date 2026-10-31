"use client";
import { useEffect, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { groupByCategory, getClassification, normalizeStoredItem, type LedgerItem } from "@/lib/ledger";
import { MemoryCard } from "@/components/MemoryCard";

export default function ClustersPage() {
  const [items, setItems] = useState<LedgerItem[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [category, setCategory] = useState<string | null>(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/items").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your memories.");
      if (live) { setItems((data.items || []).map((item: LedgerItem) => normalizeStoredItem(item))); setError(""); }
    }).catch(failure => { if (live) setError(failure.message); }).finally(() => { if (live) setLoading(false); });
    const changed = () => setRevision(value => value + 1);
    window.addEventListener("august-ledger-changed", changed);
    return () => { live = false; window.removeEventListener("august-ledger-changed", changed); };
  }, [revision]);
  const groups = groupByCategory(items), search = query.toLocaleLowerCase().trim();
  const filtered = items.filter(item => (!category || item.category === category) && (!search || [item.content, item.memory?.title, getClassification(item).label, ...(item.tags || [])].some(value => value?.toLocaleLowerCase().includes(search))));
  return <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 lg:px-12">
    <header className="mb-8"><p className="text-[10px] uppercase tracking-[.2em] text-accent">Clusters & Retrieval</p><h1 className="mt-3 font-serif text-4xl tracking-[-.04em]">Find your way back.</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">Different parts of your life, with the story around them still intact.</p></header>
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-4"><Search size={17} className="shrink-0 text-muted" /><input aria-label="Search memories" placeholder="A person, a phrase, a moment..." value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}</div>
    <nav aria-label="Memory categories" className="mb-8 flex flex-wrap gap-2"><button onClick={() => setCategory(null)} aria-pressed={!category} className={`rounded-full border px-3 py-2 text-xs ${!category ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted"}`}>All <span className="ml-1 opacity-60">{items.length}</span></button>{groups.map(group => <button key={group.category} onClick={() => setCategory(category === group.category ? null : group.category)} aria-pressed={category === group.category} className={`rounded-full border px-3 py-2 text-xs ${category === group.category ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted"}`}>{group.label}<span className="ml-2 opacity-60">{group.items.length}</span></button>)}</nav>
    {loading ? <p role="status" className="flex items-center gap-2 py-12 text-sm text-muted"><Loader2 size={17} className="animate-spin" />Opening your memories...</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setRevision(value => value + 1)} className="mt-3 text-sm text-accent">Try again</button></div> : filtered.length ? <div className="grid items-start gap-4 md:grid-cols-2">{filtered.map(item => <MemoryCard key={item.id} item={item} />)}</div> : <p className="rounded-2xl border border-dashed border-border p-8 text-sm text-muted">{items.length ? "No matches. Try another phrase or category." : "Your collection starts with something you write."}</p>}
  </div>;
}
