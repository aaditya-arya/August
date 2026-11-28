"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { WritingComposer } from "@/components/WritingComposer";
import { LedgerEntry } from "@/components/LedgerEntry";
import { getClassification, groupByCategory, type LedgerItem } from "@/lib/ledger";
import styles from "./page.module.css";

const periods = [["7", "7 days"], ["30", "30 days"], ["all", "All time"]] as const;
type Period = typeof periods[number][0];

export default function JournalPage() {
  const [period, setPeriod] = useState<Period>("7");
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [today] = useState(() => new Date());

  useEffect(() => {
    let controller: AbortController | null = null;
    const loadItems = (silent: boolean) => {
      controller?.abort();
      const next = new AbortController();
      controller = next;
      fetch(`/api/items?days=${period}`, { signal: next.signal, cache: "no-store" })
        .then(async response => {
          if (!response.ok) throw new Error("Journal request failed");
          const data = await response.json();
          if (!next.signal.aborted) {
            setItems(data.items || []);
            setError(false);
          }
        })
        .catch(() => { if (!next.signal.aborted && !silent) setError(true); })
        .finally(() => { if (!next.signal.aborted) setLoading(false); });
    };
    loadItems(false);
    const refresh = () => { if (document.visibilityState === "visible") loadItems(true); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [period, revision]);

  useEffect(() => {
    const filed = () => setRevision(value => value + 1);
    window.addEventListener("august-ledger-changed", filed);
    return () => window.removeEventListener("august-ledger-changed", filed);
  }, []);
  const categories = useMemo(() => groupByCategory(items), [items]);
  const visible = category ? items.filter(item => getClassification(item).category === category) : items;

  return <div className={styles.journal}>
    <header className={styles.heading}>
      <h1>Journal</h1>
      <time dateTime={format(today, "yyyy-MM-dd")}>{format(today, "EEEE, MMMM d")}</time>
    </header>
    <WritingComposer />
    <section className={styles.moments} aria-labelledby="saved-moments">
      <div className={styles.momentsHeader}>
        <h2 id="saved-moments">Saved moments</h2>
        <div className={styles.periods} role="group" aria-label="Filter moments by time">
          {periods.map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => {
            if (period !== value) { setPeriod(value); setCategory(null); setLoading(true); setError(false); }
          }}>{label}</button>)}
        </div>
      </div>
      {categories.length > 1 && <label className={styles.category}>
        <span>Category</span>
        <select value={category ?? ""} onChange={event => setCategory(event.target.value || null)}>
          <option value="">All categories</option>
          {categories.map(group => <option key={group.category} value={group.category}>{group.label} ({group.items.length})</option>)}
        </select>
      </label>}
      {error ? <div className={styles.emptyMoments} role="alert">
        <p>Your saved moments couldn’t load.</p>
        <button type="button" onClick={() => { setError(false); setLoading(true); setRevision(value => value + 1); }}>Try again</button>
      </div> : loading ? <p className={styles.emptyMoments} role="status"><Loader2 size={18} className="motion-safe:animate-spin" /> Loading moments…</p>
        : visible.length ? <div className="space-y-4">{visible.map(item => <LedgerEntry key={item.id} item={item} />)}</div>
        : <p className={styles.emptyMoments}><BookOpen size={21} aria-hidden="true" /> No saved moments in this view yet.</p>}
    </section>
  </div>;
}
