import { Redis } from "@upstash/redis";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_TTL = 60_000;

// In-memory fallback
const memoryStore = new Map<string, CacheEntry<any>>();

// Upstash Redis client (optional)
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  redis = null;
}

function getMemory<T>(key: string): T | undefined {
  const entry = memoryStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setMemory<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  memoryStore.set(key, { data, expiresAt: Date.now() + ttl });
}

function invalidateMemory(keyPrefix: string): void {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(keyPrefix)) memoryStore.delete(key);
  }
}

async function getRedis<T>(key: string): Promise<T | undefined> {
  if (!redis) return undefined;
  try {
    const value = await redis.get(key);
    if (!value) return undefined;
    const entry = value as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      await redis.del(key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

async function setRedis<T>(key: string, data: T, ttl = DEFAULT_TTL): Promise<void> {
  if (!redis) return;
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttl };
    await redis.set(key, entry, { ex: Math.ceil(ttl / 1000) });
  } catch {
    // Fallback to memory
    setMemory(key, data, ttl);
  }
}

async function invalidateRedis(keyPrefix: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`${keyPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    invalidateMemory(keyPrefix);
  }
}

export async function getCached<T>(key: string): Promise<T | undefined> {
  if (redis) return getRedis(key);
  return getMemory(key);
}

export async function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): Promise<void> {
  if (redis) return setRedis(key, data, ttl);
  setMemory(key, data, ttl);
}

export async function invalidateCache(keyPrefix: string): Promise<void> {
  if (redis) return invalidateRedis(keyPrefix);
  invalidateMemory(keyPrefix);
}

export async function clearCache(): Promise<void> {
  memoryStore.clear();
  if (redis) {
    try {
      const keys = await redis.keys("*");
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // ignore
    }
  }
}