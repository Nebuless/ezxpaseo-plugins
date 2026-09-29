type CacheEntry = {
  readonly value: number | null;
  readonly expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const CACHE_MS = 5_000;

export function cacheKey(serverId: string, argumentsKey: string): string {
  return `${serverId}\u0000${argumentsKey}`;
}

export async function getCachedCount(
  serverId: string,
  argumentsKey: string,
  now: number,
  load: () => Promise<number>,
): Promise<number> {
  const key = cacheKey(serverId, argumentsKey);
  const entry = cache.get(key);
  if (entry && entry.value !== null && entry.expiresAt > now) {
    return entry.value;
  }
  const pending = { value: null, expiresAt: 0 };
  cache.set(key, pending);
  const value = await load();
  if (cache.get(key) === pending) cache.set(key, { value, expiresAt: now + CACHE_MS });
  return value;
}

export function clearHostCache(serverId: string): void {
  const prefix = `${serverId}\u0000`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
