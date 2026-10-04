import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Comprueba que cada ruta recibe el limite que pide.
 *
 * El bug que motivó estos tests: habia un unico limitador fijo en 10/min, así
 * que `checkRateLimit("backup:ip", 2, 60000)` devolvia 10 y
 * `checkRateLimit("telegram-send:ip", 30, 60000)` se cortaba en la décima.
 */

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn(),
  auditError: vi.fn(),
}));

describe("checkRateLimit respeta el limite de cada ruta", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("permite exactamente maxRequests y bloquea al siguiente, sin Upstash", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "test");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    // backup pide 2 por minuto
    const results: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit("backup:1.2.3.4", 2, 60_000);
      results.push(r.allowed);
    }
    expect(results).toEqual([true, true, false]);
  });

  it("el limite es por clave: otra IP no se ve afectada", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "test");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    await checkRateLimit("ai-chat:1.1.1.1", 1, 60_000);
    const blocked = await checkRateLimit("ai-chat:1.1.1.1", 1, 60_000);
    const other = await checkRateLimit("ai-chat:2.2.2.2", 1, 60_000);

    expect(blocked.allowed).toBe(false);
    expect(other.allowed).toBe(true);
  });

  it("indica cuantos segundos faltan cuando bloquea", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "test");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    await checkRateLimit("send-email:9.9.9.9", 1, 60_000);
    const blocked = await checkRateLimit("send-email:9.9.9.9", 1, 60_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("no lanza en produccion si faltan las variables de Upstash", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    // Antes esto tiraba una excepcion y tumbaba la ruta entera.
    await expect(checkRateLimit("migrate:5.5.5.5", 3, 60_000)).resolves.toEqual({ allowed: true });
  });

  it("usa un limitador distinto por cada limite distinto", async () => {
    const mockLimit = vi.fn().mockResolvedValue({ success: true, reset: 0 });
    const ctor = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.limit = mockLimit;
    });

    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: Object.assign(ctor, {
        slidingWindow: (max: number, window: string) => ({ max, window }),
      }),
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-de-prueba");
    vi.stubEnv("NODE_ENV", "test");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    await checkRateLimit("backup:ip", 2, 60_000);
    await checkRateLimit("telegram-send:ip", 30, 60_000);
    await checkRateLimit("send-email:ip", 5, 60_000);
    // Repetir uno de los anteriores no debe crear otro limitador.
    await checkRateLimit("backup:ip", 2, 60_000);

    expect(ctor).toHaveBeenCalledTimes(3);
    expect(mockLimit).toHaveBeenCalledTimes(4);
  });

  it("deja pasar la peticion si Upstash falla, para no tumbar el negocio", async () => {
    const mockLimit = vi.fn().mockRejectedValue(new Error("Redis no responde"));
    const ctor = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.limit = mockLimit;
    });

    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: Object.assign(ctor, {
        slidingWindow: (max: number, window: string) => ({ max, window }),
      }),
    }));
    vi.doMock("@upstash/redis", () => ({ Redis: class {} }));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token-de-prueba");
    vi.stubEnv("NODE_ENV", "production");

    const { checkRateLimit } = await import("@/lib/rate-limit");

    await expect(checkRateLimit("ai-chat:ip", 10, 60_000)).resolves.toEqual({ allowed: true });
  });
});
