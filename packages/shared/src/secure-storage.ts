type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown>; removeItem: (key: string) => Promise<unknown> };
type Manifest = { version: string; count: number };

/** Small, Unicode-safe chunks fit native keychain limits. Publishing a manifest
 * last keeps the previous encrypted value intact if writing is interrupted. */
export function createChunkedSecureStorage(storage: Storage, uniqueId: () => string): { getItem: Storage['getItem']; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> } {
  const queues = new Map<string, Promise<unknown>>();
  function serial<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = queues.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    queues.set(key, next);
    void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => undefined);
    return next;
  }
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await storage.getItem(`${key}.index`);
    if (raw === null) return null;
    const value = JSON.parse(raw);
    if (!value || !/^[\w-]+$/.test(value.version) || !Number.isInteger(value.count) || value.count < 1 || value.count > 10000) throw new Error('Secure storage could not be read.');
    return value;
  }
  async function removeChunks(key: string, value: Manifest | null) {
    if (value) await Promise.all(Array.from({ length: value.count }, (_, i) => storage.removeItem(`${key}.${value.version}.${i}`)));
  }
  return {
    getItem: key => serial(key, async () => {
      const value = await manifest(key);
      if (!value) return null;
      const parts = await Promise.all(Array.from({ length: value.count }, (_, i) => storage.getItem(`${key}.${value.version}.${i}`)));
      if (parts.some(part => part === null)) throw new Error('A secure storage value is incomplete.');
      return parts.join('');
    }),
    setItem: (key, value) => serial(key, async () => {
      const old = await manifest(key), parts: string[] = [];
      let current = '', bytes = 0;
      for (const character of value) {
        const point = character.codePointAt(0)!;
        const size = point > 0xffff ? 4 : point > 0x7ff ? 3 : point > 0x7f ? 2 : 1;
        if (bytes + size > 1200) { parts.push(current); current = ''; bytes = 0; }
        current += character; bytes += size;
      }
      parts.push(current);
      const next = { version: uniqueId(), count: parts.length };
      try {
        const writes = await Promise.allSettled(parts.map((part, i) => storage.setItem(`${key}.${next.version}.${i}`, part)));
        const failed = writes.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        await storage.setItem(`${key}.index`, JSON.stringify(next));
      } catch (error) { await removeChunks(key, next).catch(() => undefined); throw error; }
      await removeChunks(key, old).catch(() => undefined);
    }),
    removeItem: key => serial(key, async () => {
      const old = await manifest(key);
      await storage.removeItem(`${key}.index`);
      await removeChunks(key, old);
    }),
  };
}
