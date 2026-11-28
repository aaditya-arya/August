import { canonicalCategory, isObligation, type LedgerItem } from './ledger';
import { intentionState, localDay, type IntentionState } from './intention-state';
import { taskMetadata, type TaskKind } from './task-state';
import { zonedDateTimeToUtc } from './time';
import { memorySource } from './memory-source';

export type JournalTask = {
  id: string; title: string; content: string; due_at: string | null; kind: TaskKind;
  completed: boolean; completed_at: string | null; updated_at: string;
  created_at: string; tags: string[];
};
export class TaskConflictError extends Error {}

export function toTask(item: LedgerItem, timezone = 'UTC'): JournalTask | null {
  const metadata = taskMetadata(item.calendar_action?.task);
  const category = canonicalCategory(item.category);
  const plan = intentionState(item);
  const scheduledWork = isObligation(item.category, item.calendar_action) && ['task', 'reminder'].includes(item.calendar_action?.kind || '');
  if (category === 'Event' || (isObligation(item.category, item.calendar_action) && item.calendar_action?.kind === 'event')) return null;
  if (!metadata && category !== 'Task' && category !== 'Reminder' && !scheduledWork) return null;
  if (plan?.status === 'released' || plan?.status === 'paused') return null;
  const due = metadata ? metadata.due_at : plan?.target_date
    ? zonedDateTimeToUtc(`${plan.target_date}T09:00`, timezone)
    : item.calendar_action?.is_actionable ? item.calendar_action.start_time || null : null;
  const title = plan?.title || metadata?.title || item.memory?.title || memorySource(item.calendar_action?.memory)?.title || item.content.slice(0, 140);
  const deadline = taskMetadata({ version: 1, title, due_at: due })?.due_at || null;
  const kind = metadata?.kind ?? (category === 'Reminder' || item.calendar_action?.kind === 'reminder' ? 'reminder' : 'task');
  return { id: item.id, title, kind,
    content: item.content, due_at: deadline, completed: plan?.status === 'completed',
    completed_at: plan?.status === 'completed' ? plan.updated_at : null,
    updated_at: plan?.updated_at || item.created_at, created_at: item.created_at, tags: item.tags || [] };
}

export function taskList(items: LedgerItem[], timezone = 'UTC'): JournalTask[] {
  return items.map(item => toTask(item, timezone)).filter((task): task is JournalTask => task !== null)
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.due_at || '9999').localeCompare(b.due_at || '9999') || b.created_at.localeCompare(a.created_at));
}

export function taskUpdate(item: LedgerItem, patch: Record<string, unknown>, timezone: string, now = new Date()) {
  const current = toTask(item, timezone);
  if (!current) throw new Error('This entry is not an active task.');
  if (patch.expected_updated_at !== undefined && patch.expected_updated_at !== current.updated_at) throw new TaskConflictError('This task changed elsewhere. Refresh before saving your edits.');
  if (patch.completed !== undefined && typeof patch.completed !== 'boolean') throw new Error('Choose whether the task is complete.');
  const metadata = taskMetadata({ version: 1, kind: current.kind, title: patch.title === undefined ? current.title : patch.title,
    due_at: patch.due_at === undefined ? current.due_at : patch.due_at });
  if (!metadata) throw new Error('Use a title of up to 140 characters and a valid deadline, or leave the deadline empty.');
  const completed = patch.completed === undefined ? current.completed : patch.completed as boolean;
  const prior = intentionState(item);
  const state: IntentionState = { version: 1, status: completed ? 'completed' : 'active', title: metadata.title,
    next_step: prior?.next_step || '', target_date: metadata.due_at ? localDay(new Date(metadata.due_at), timezone) : null,
    target_amount: prior?.target_amount ?? null, saved_amount: prior?.saved_amount ?? null, currency: prior?.currency || (/Kolkata|Calcutta/.test(timezone) ? 'INR' : 'USD'),
    updated_at: completed === current.completed && metadata.title === current.title && metadata.due_at === current.due_at ? current.updated_at : now.toISOString() };
  const calendar = item.calendar_action || { is_actionable: false };
  return { ...calendar, task: metadata, review_state: state };
}

/** Only stored, validated items can appear in a note's save receipt. */
export function detectedEvents(items: LedgerItem[]) {
  return items.flatMap(item => {
    const calendar = item.calendar_action;
    if (calendar?.kind !== 'event' || !calendar.is_actionable || !calendar.start_time ||
      !isObligation(item.category, calendar)) return [];
    return [{ id: item.id, title: calendar.title || item.content, starts_at: calendar.start_time,
      calendar_synced: item.calendar_status === 'synced' }];
  });
}
