/**
 * Small persistence helper for UI preferences (favorite intervals, recent searches).
 * Uses localStorage under `prefix:` when available; `prefix: null` keeps everything in memory
 * (e.g. when the host app syncs preferences to its own account storage via callbacks).
 */
export interface WidgetStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
}

export function createStorage(prefix: string | null): WidgetStorage {
  const memory = new Map<string, string>();
  const ls = (() => {
    try {
      return prefix && typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null; // e.g. Safari private mode / sandboxed iframes
    }
  })();
  const full = (key: string) => `${prefix}:${key}`;
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = ls ? ls.getItem(full(key)) : (memory.get(key) ?? null);
        return raw === null ? fallback : (JSON.parse(raw) as T);
      } catch {
        return fallback;
      }
    },
    set(key: string, value: unknown) {
      const raw = JSON.stringify(value);
      try {
        if (ls) ls.setItem(full(key), raw);
        else memory.set(key, raw);
      } catch {
        memory.set(key, raw);
      }
    },
  };
}
