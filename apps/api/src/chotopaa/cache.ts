/**
 * In-memory response cache for the ChotoPaa read API: the reason it's fast.
 * A hit is answered without touching the database at all.
 *
 * Entries live for CHOTOPAA_CACHE_TTL_SECONDS. ChotoPaa's backend clears the
 * whole cache after every successful write (product edits, orders changing
 * stock…) through POST /api/chotopaa/v1/cache/purge, so the TTL only bounds
 * staleness if a purge call is lost. Bounded in size: the oldest entries go
 * first (Map keeps insertion order).
 */

const MAX_ENTRIES = 1000;

interface Entry {
  status: number;
  body: string;
  expiresAt: number;
}

const entries = new Map<string, Entry>();

export function cacheGet(key: string, now = Date.now()): Entry | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    entries.delete(key);
    return undefined;
  }
  return entry;
}

export function cacheSet(key: string, status: number, body: string, ttlMs: number): void {
  if (ttlMs <= 0) return;
  entries.delete(key);
  entries.set(key, { status, body, expiresAt: Date.now() + ttlMs });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export function cachePurge(): number {
  const count = entries.size;
  entries.clear();
  return count;
}

export function cacheSize(): number {
  return entries.size;
}
