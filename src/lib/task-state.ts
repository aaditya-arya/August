export type TaskKind = 'task' | 'reminder';
export type TaskMetadata = { version: 1; title: string; due_at: string | null; kind?: TaskKind };

export function taskMetadata(value: unknown): TaskMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 140) return null;
  if (raw.kind !== undefined && raw.kind !== 'task' && raw.kind !== 'reminder') return null;
  if (raw.due_at !== null) {
    if (typeof raw.due_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw.due_at) || !Number.isFinite(Date.parse(raw.due_at))) return null;
    const date = raw.due_at.slice(0, 10);
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || Number(raw.due_at.slice(11, 13)) > 23) return null;
  }
  return { version: 1, title: raw.title.trim(), due_at: raw.due_at === null ? null : new Date(raw.due_at as string).toISOString(),
    ...(raw.kind ? { kind: raw.kind } : {}) };
}
