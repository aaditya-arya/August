'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Circle, Clock3, LayoutGrid, List, Loader2, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { flyPassage } from '@/lib/journal-motion';
import { refreshTasks, updateTask, useTasks } from '@/lib/use-tasks';
import type { JournalTask } from '@/lib/tasks';
import { useReviewClock } from '@/lib/use-intentions';

function deadline(task: JournalTask) {
  if (!task.due_at) return 'No deadline';
  return new Date(task.due_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function TasksPage() {
  const { tasks, loading, error, updating } = useTasks();
  const now = useReviewClock();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [editing, setEditing] = useState<JournalTask | null>(null);
  const [notice, setNotice] = useState<JournalTask | null>(null);
  const completed = tasks.filter(task => task.completed).length;
  const visible = tasks.filter(task => filter === 'all' || task.completed === (filter === 'completed')).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_at || '9999').localeCompare(b.due_at || '9999'));
  async function toggle(task: JournalTask, from: DOMRect) {
    try {
      await updateTask(task.id, { completed: !task.completed });
      setNotice(task.completed ? null : task);
      if (!task.completed) flyPassage(from, 'nav a[href="/clusters"]', task.title, "#d8d1fc");
    }
    catch { /* The shared task board shows the error and restores the card. */ }
  }
  return <div className="mx-auto max-w-6xl px-5 py-9 pb-28 sm:px-10 sm:py-12">
    <div className="mb-9 flex flex-wrap items-start justify-between gap-5">
      <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">One thing at a time</p><h1 className="font-serif text-4xl sm:text-5xl">Make room for done.</h1><p className="mt-4 max-w-lg text-sm leading-7 text-muted">The things you want to build, finish, and move forward. A deadline is optional.</p></div>
      <Link href="/" className="flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white dark:text-background"><Plus size={18} /> Write a task</Link>
    </div>
    <div className="mb-7 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-surface p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><CheckCircle2 size={26} /></div>
      <div className="min-w-40 flex-1"><p className="font-medium">{tasks.length - completed} open · {completed} completed</p><p className="mt-1 text-xs leading-5 text-muted">{completed ? 'That is progress worth noticing.' : 'Small steps count. Pick a place to begin.'}</p></div>
      <div className="h-2 w-36 overflow-hidden rounded-full bg-accent/10" role="progressbar" aria-label="Tasks completed" aria-valuemin={0} aria-valuemax={tasks.length || 1} aria-valuenow={completed}><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div>
    </div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2">{(['open', 'completed', 'all'] as const).map(value => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-full px-4 py-2 text-sm ${filter === value ? 'bg-accent text-white dark:text-background' : 'border border-border text-muted'}`}>{value === 'open' ? 'To do' : value === 'completed' ? 'Completed' : 'All'}</button>)}</div>
      <div className="flex items-center gap-1 rounded-xl border border-border p-1">{(['grid', 'list'] as const).map(value => <button key={value} aria-label={`${value} view`} aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-lg p-2 ${view === value ? 'bg-accent/10 text-accent' : 'text-muted'}`}>{value === 'grid' ? <LayoutGrid size={18} /> : <List size={18} />}</button>)}<button aria-label="Refresh tasks" onClick={() => void refreshTasks()} disabled={loading || updating.length > 0} className="rounded-lg p-2 text-muted"><RotateCcw size={17} /></button></div>
    </div>
    {error && <div role="alert" className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">{error}<button onClick={() => void refreshTasks()} className="ml-3 underline">Try again</button></div>}
    {loading && <p role="status" className="flex items-center gap-3 py-12 text-muted"><Loader2 size={20} className="animate-spin" /> Opening your tasks…</p>}
    {!loading && !visible.length && <div className="rounded-3xl border border-dashed border-border px-7 py-16 text-center"><CheckCircle2 className="mx-auto mb-5 text-accent" size={36} /><h2 className="font-serif text-2xl">{filter === 'completed' ? 'Your wins will live here.' : tasks.length ? 'A clear little space.' : 'Start with something you want to make.'}</h2><p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted">{tasks.length ? 'Try another filter to see the rest of your tasks.' : 'Write “I want to build a portfolio website” in your journal. Add a deadline if you have one; August keeps the task either way.'}</p></div>}
    <div className={view === 'grid' ? 'grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 xl:grid-cols-3' : 'grid grid-cols-1 gap-3'}>{visible.map(task => <article key={task.id} className={`group rounded-3xl border bg-surface p-4 sm:p-5 transition-all ${task.completed ? 'border-border opacity-70' : 'border-border hover:border-accent/40 hover:shadow-sm'}`}>
      <div className="flex items-center justify-between gap-3">
        <button disabled={updating.includes(task.id)} onClick={event => void toggle(task, event.currentTarget.getBoundingClientRect())} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`} className={`shrink-0 rounded-full p-1 transition-transform active:scale-90 ${task.completed ? 'bg-accent text-white' : 'text-accent hover:bg-accent/10'}`}>{updating.includes(task.id) ? <Loader2 size={23} className="animate-spin" /> : task.completed ? <Check size={23} /> : <Circle size={23} />}</button>
        <button disabled={updating.includes(task.id)} onClick={() => setEditing(task)} aria-label={`Edit ${task.title}`} className="rounded-lg p-2 text-muted hover:bg-accent/10 hover:text-accent"><Pencil size={15} /></button>
      </div>
      <h2 className={`mt-3 break-words font-sans text-base font-semibold leading-7 ${task.completed ? 'line-through decoration-accent/50' : ''}`}>{task.title}</h2>
      <p className="mb-5 mt-3 line-clamp-3 text-sm leading-6 text-muted">{task.content}</p><div className={`flex items-center gap-2 text-xs ${!task.completed && task.due_at && Date.parse(task.due_at) < now ? 'text-rose-600 dark:text-rose-300' : 'text-muted'}`}><Clock3 size={14} />{deadline(task)}{!task.completed && task.due_at && Date.parse(task.due_at) < now ? ' · Overdue' : ''}</div>
      {task.tags.length > 0 && <p className="mt-4 truncate text-xs text-accent/80">{task.tags.slice(0, 3).map(tag => `#${tag}`).join('  ')}</p>}
    </article>)}</div>
    <p className="mt-8 text-xs leading-6 text-muted">Tasks come from your saved journal. Android can remind you one day and one hour before a deadline, with notification permission enabled.</p>
    {notice && <div role="status" className="fixed bottom-6 left-1/2 z-40 flex w-max max-w-[90vw] -translate-x-1/2 items-center gap-4 rounded-2xl border border-border bg-surface px-5 py-4 shadow-lg"><CheckCircle2 className="shrink-0 text-accent" size={20} /><p className="truncate text-sm">One more thing, done.</p><button onClick={() => { void updateTask(notice.id, { completed: false }).then(() => setNotice(null)).catch(() => {}); }} className="text-sm font-semibold text-accent">Undo</button><button aria-label="Dismiss" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    {editing && <TaskEditor task={editing} close={() => setEditing(null)} />}
  </div>;
}

function TaskEditor({ task, close }: { task: JournalTask; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(() => task.due_at ? new Date(Date.parse(task.due_at) - new Date(task.due_at).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} onCancel={close} className="fixed inset-0 m-auto w-[min(92vw,480px)] rounded-3xl border border-border bg-surface p-7 text-foreground shadow-xl backdrop:bg-black/40"><form onSubmit={async event => { event.preventDefault(); setSaving(true); setError(null); try { const when = due ? new Date(due) : null; if (when && new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) !== due) throw new Error('This local time does not exist. Choose another time.'); await updateTask(task.id, { title, due_at: when?.toISOString() || null, expected_updated_at: task.updated_at }); close(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save.'); } finally { setSaving(false); } }} className="space-y-5"><h2 className="font-serif text-2xl">A little more clarity.</h2><label className="block text-sm">Task<input autoFocus required maxLength={140} value={title} onChange={event => setTitle(event.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-background px-4 py-3" /></label><label className="block text-sm">Deadline · optional<input type="datetime-local" value={due} onChange={event => setDue(event.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-background px-4 py-3" /></label><button type="button" onClick={() => setDue('')} className="text-sm text-accent">Keep without a deadline</button>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}<div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={close} className="rounded-xl border border-border px-4 py-3 text-sm">Cancel</button><button disabled={saving || !title.trim()} className="rounded-xl bg-accent px-5 py-3 text-sm text-white dark:text-background">{saving ? 'Saving…' : 'Save task'}</button></div></form></dialog>;
}
