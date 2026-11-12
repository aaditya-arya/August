import type { NoteSubmission } from './api';

export type DraftSnapshot = { content: string; pending: NoteSubmission | null };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };

/** Serial writes prevent a slower, older keystroke from replacing a newer draft. */
export function createDraftPersistence(storage: Storage, key: string) {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async read(): Promise<DraftSnapshot> {
      const raw = await storage.getItem(key);
      if (!raw) return { content: '', pending: null };
      const value = JSON.parse(raw);
      if (!value || typeof value.content !== 'string') throw new Error('The saved draft could not be read.');
      const p = value.pending;
      const pending = p && ['content', 'key', 'currentTime', 'timezone'].every(k => typeof p[k] === 'string') ? p as NoteSubmission : null;
      return { content: value.content, pending };
    },
    write(value: DraftSnapshot): Promise<void> {
      const serialized = JSON.stringify(value);
      const work = queue.catch(() => undefined).then(() => storage.setItem(key, serialized));
      queue = work;
      return work.then(() => undefined);
    },
  };
}
