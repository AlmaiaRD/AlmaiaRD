import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { auditError } from "@/lib/audit";

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Una instancia por combinación de límite y ventana.
 *
 * Antes había una sola, fija en 10 peticiones por minuto. Eso hacia dos cosas
 * malas a la vez: `backup` (que pide 2) admitia 5 veces mas de lo debido, y
 * `telegram-send` (que pide 30) se bloqueaba en la décima. Los limites que
 * pasa cada ruta se respetan ahora.
 */
const limiters = new Map<string, Ratelimit>();

function getLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const id = `${maxRequests}:${windowMs}`;
  const existing = limiters.get(id);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: redis!,
    // Upstash solo acepta ventanas de duraciones fijas; el tamaño de la
    // ventana se redondea hacia arriba al segundo mas cercano.
    limiter: Ratelimit.slidingWindow(maxRequests, `${Math.ceil(windowMs / 1000)} s` as `${number} s`),
    prefix: "rl:",
    analytics: false,
  });
  limiters.set(id, limiter);
  return limiter;
}

/**
 * Reserva en memoria para cuando no hay Upstash configurado.
 *
 * Cada instancia de Vercel tiene la suya, asi que esto NO cuenta bien entre
 * varias maquinas: con 10 de ellas, el limite real es 10 veces mayor. Es peor
 * que Upstash, pero mucho mejor que no tener limite ninguno, y evita que un
 * despliegue mal configurado se quede sin proteccion.
 */
const memoryStore = new Map<string, { count: number; resetTime: number }>();

/** Limpia las entradas vencidas para que el Map no crezca sin fin. */
function sweep(now: number): void {
  if (memoryStore.size < 1000) return;
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetTime) memoryStore.delete(key);
  }
}

function memoryCheck(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

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

/**
 * Comprueba si una petición puede pasar.
 *
 * Con Upstash configurado el limite es real y compartido. Sin el, en
 * desarrollo se usa la reserva en memoria. Sin el y en produccion, tambien:
 * antes esto lansaba una excepcion y tumbaba la ruta entera, de modo que
 * perder las dos variables de entorno convertia un problema de configuracion
 * en una caida total del servicio. Ahora avisa a Sentry una vez y sigue
 * funcionando con el limite en memoria.
 */
export async function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60_000
): Promise<RateLimitResult> {
  if (!redis) {
    if (process.env.NODE_ENV === "production") {
      const error = new Error(
        "checkRateLimit sin Upstash: el limite no se comparte entre instancias de Vercel"
      );
      auditError("settings.updated", error, {
        metadata: { subsystem: "rate-limit", key, maxRequests, windowMs },
      });
    }
    return memoryCheck(key, maxRequests, windowMs);
  }

  try {
    const result = await getLimiter(maxRequests, windowMs).limit(key);
    return {
      allowed: result.success,
      retryAfter: result.reset ? Math.ceil((result.reset - Date.now()) / 1000) : undefined,
    };
  } catch (error) {
    // Si Upstash esta caido, no se bloquea el negocio. Se avisa y se deja
    // pasar: es preferible un rate limit laxo durante una caida de Redis
    // que dejar de poder facturar.
    auditError("settings.updated", error instanceof Error ? error : new Error(String(error)), {
      metadata: { subsystem: "rate-limit", key, maxRequests, windowMs },
    });
    return { allowed: true };
  }
}
