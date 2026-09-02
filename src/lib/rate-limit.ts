import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// In-memory fallback for local development (no Upstash credentials)
const memoryStore = new Map<string, { count: number; resetTime: number }>();

function memoryCheck(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }
  return { allowed: true };
}

// Upstash Redis client (requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: true,
      prefix: "rl:",
    })
  : null;

export async function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60000
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // If Upstash configured, use distributed rate limit
  if (ratelimit) {
    const result = await ratelimit.limit(key);
    return {
      allowed: result.success,
      retryAfter: result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : undefined,
    };
  }

  // Fallback: in-memory (per-instance, resets on cold start)
  // NOTE: Only allowed in development. Production MUST have Upstash env vars.
  if (process.env.NODE_ENV === "production") {
    throw new Error("UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN son requeridos en producción");
  }
  return memoryCheck(key, maxRequests, windowMs);
}