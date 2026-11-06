/**
 * In-process HTML cache for public pages. Rendering from the database stays
 * cheap and changes are visible instantly because every content mutation
 * calls `purgePublicCache()`. (With several PM2 instances, each instance has
 * its own cache; the version counter in the settings table keeps them in sync.)
 */
type Entry = { body: string; headers: [string, string][]; status: number; at: number; version: number };
type G = typeof globalThis & { __vvipCache?: Map<string, Entry>; __vvipCacheVersion?: number; __vvipVersionCheckedAt?: number };
const g = globalThis as G;
g.__vvipCache ??= new Map();
g.__vvipCacheVersion ??= 0;

const MAX_ENTRIES = 300;
const TTL_MS = 10 * 60 * 1000;

export function getCached(key: string): Entry | null {
  const e = g.__vvipCache!.get(key);
  if (!e) return null;
  if (e.version !== g.__vvipCacheVersion || Date.now() - e.at > TTL_MS) {
    g.__vvipCache!.delete(key);
    return null;
  }
  return e;
}
export function setCached(key: string, entry: Omit<Entry, 'at' | 'version'>) {
  if (g.__vvipCache!.size >= MAX_ENTRIES) g.__vvipCache!.delete(g.__vvipCache!.keys().next().value!);
  g.__vvipCache!.set(key, { ...entry, at: Date.now(), version: g.__vvipCacheVersion! });
}
export function purgeLocal() {
  g.__vvipCache!.clear();
}
export const cacheVersion = () => g.__vvipCacheVersion!;
export const setCacheVersion = (v: number) => {
  if (v !== g.__vvipCacheVersion) {
    g.__vvipCacheVersion = v;
    purgeLocal();
  }
};
export const versionCheckDue = () => Date.now() - (g.__vvipVersionCheckedAt ?? 0) > 5000;
export const markVersionChecked = () => { g.__vvipVersionCheckedAt = Date.now(); };
