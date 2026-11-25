/**
 * Shared storage abstraction. Upstash Redis is used in production;
 * an in-memory store keeps local development and tests self-contained.
 */
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;
export const isRedisConfigured = redis !== null;

interface CachedRecord {
  value: string;
  fetched_at: string;
  expires_at: number;
}

const memoryCache = new Map<string, CachedRecord>();
const memoryWindows = new Map<string, { count: number; reset: number }>();

export async function storeGet(key: string): Promise<{ value: string; fetched_at: string } | null> {
  try {
    if (redis) {
      const raw = await redis.get<{ value: string; fetched_at: string }>(key);
      return raw && typeof raw === 'object' && typeof raw.value === 'string' ? raw : null;
    }
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expires_at <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return { value: item.value, fetched_at: item.fetched_at };
  } catch (error) {
    console.warn('[store] get failed', error);
    return null;
  }
}

export async function storeSet(
  key: string,
  value: string,
  fetchedAt: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    if (redis) {
      await redis.set(key, { value, fetched_at: fetchedAt }, { ex: ttlSeconds });
      return;
    }
    memoryCache.set(key, { value, fetched_at: fetchedAt, expires_at: Date.now() + ttlSeconds * 1000 });
  } catch (error) {
    console.warn('[store] set failed', error);
  }
}

export async function storeIncrementWindow(
  key: string,
  windowSeconds: number,
): Promise<{ count: number; resetInSeconds: number }> {
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      const ttl = await redis.ttl(key);
      return { count, resetInSeconds: ttl > 0 ? ttl : windowSeconds };
    } catch (error) {
      console.warn('[store] rate limit increment failed; failing open', error);
      return { count: 1, resetInSeconds: windowSeconds };
    }
  }

  const now = Date.now();
  const existing = memoryWindows.get(key);
  if (!existing || existing.reset <= now) {
    const reset = now + windowSeconds * 1000;
    memoryWindows.set(key, { count: 1, reset });
    return { count: 1, resetInSeconds: windowSeconds };
  }
  existing.count += 1;
  return {
    count: existing.count,
    resetInSeconds: Math.max(1, Math.ceil((existing.reset - now) / 1000)),
  };
}
