import { describe, it, expect, vi } from "vitest";
import {
  isPrivateIpv4,
  isPrivateIpv6,
  hasUsernamePassword,
  isAllowedUrl,
  hostIsAllowed,
} from "@/lib/ssrf";

describe("isPrivateIpv4", () => {
  it("bloquea rangos privados de RFC 1918", () => {
    expect(isPrivateIpv4("10.0.0.1")).toBe(true);
    expect(isPrivateIpv4("172.16.0.1")).toBe(true);
    expect(isPrivateIpv4("172.31.255.255")).toBe(true);
    expect(isPrivateIpv4("192.168.1.1")).toBe(true);
  });

  it("bloquea loopback, link-local y ranges especiales", () => {
    expect(isPrivateIpv4("127.0.0.1")).toBe(true);
    expect(isPrivateIpv4("0.0.0.0")).toBe(true);
    expect(isPrivateIpv4("169.254.0.1")).toBe(true);
    expect(isPrivateIpv4("100.64.0.1")).toBe(true);
    expect(isPrivateIpv4("192.0.2.1")).toBe(true);
    expect(isPrivateIpv4("198.18.0.1")).toBe(true);
    expect(isPrivateIpv4("224.0.0.1")).toBe(true);
    expect(isPrivateIpv4("240.0.0.1")).toBe(true);
  });

  it("permita IPs públicas", () => {
    expect(isPrivateIpv4("8.8.8.8")).toBe(false);
    expect(isPrivateIpv4("104.16.132.229")).toBe(false);
    expect(isPrivateIpv4("93.184.216.34")).toBe(false);
  });
});

describe("isPrivateIpv6", () => {
  it("bloquea loopback, ULA, link-local y unspecified", () => {
    expect(isPrivateIpv6("::1")).toBe(true);
    expect(isPrivateIpv6("::")).toBe(true);
    expect(isPrivateIpv6("fd00::1")).toBe(true);
    expect(isPrivateIpv6("fc00::1")).toBe(true);
    expect(isPrivateIpv6("fe80::1")).toBe(true);
  });

  it("bloquea IPv4-mapped IPv6 a privados (::ffff:x.x.x.x)", () => {
    expect(isPrivateIpv6("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIpv6("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateIpv6("::ffff:10.0.0.5")).toBe(true);
  });

  it("permita IPv6 públicas", () => {
    expect(isPrivateIpv6("2001:4860:4860::8888")).toBe(false);
    expect(isPrivateIpv6("2606:4700::1111")).toBe(false);
  });
});

describe("hasUsernamePassword", () => {
  it("detecta credenciales embebidas en la URL", () => {
    expect(hasUsernamePassword(new URL("https://user:pass@example.com/x.png"))).toBe(true);
    expect(hasUsernamePassword(new URL("https://example.com/x.png"))).toBe(false);
  });
});

describe("hostIsAllowed", () => {
  const fakeLookup = (addresses: Array<{ address: string; family: number }>) =>
    vi.fn().mockImplementation(async () => addresses);

  it("bloquea IPs literales privadas (IPv4)", async () => {
    expect(await hostIsAllowed("127.0.0.1", fakeLookup([]))).toBe(false);
    expect(await hostIsAllowed("0.0.0.0", fakeLookup([]))).toBe(false);
    expect(await hostIsAllowed("192.168.0.1", fakeLookup([]))).toBe(false);
  });

  it("bloquea IPs literales privadas (IPv6 mapped)", async () => {
    expect(await hostIsAllowed("[::ffff:127.0.0.1]", fakeLookup([]))).toBe(false);
  });

  it("permita IPs literales públicas", async () => {
    expect(await hostIsAllowed("8.8.8.8", fakeLookup([]))).toBe(true);
  });

  it("rechaza IPv4 mal formada", async () => {
    expect(await hostIsAllowed("999.1.2.3", fakeLookup([]))).toBe(false);
  });

  it("bloquea hostname si CUALQUIER IP resuelta es privada (DNS rebinding)", async () => {
    const lookup = fakeLookup([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    expect(await hostIsAllowed("ejemplo.com", lookup)).toBe(false);
  });

  it("permite hostname si todas las IPs resueltas son públicas", async () => {
    const lookup = fakeLookup([
      { address: "93.184.216.34", family: 4 },
      { address: "8.8.8.8", family: 4 },
    ]);
    expect(await hostIsAllowed("ejemplo.com", lookup)).toBe(true);
  });

  it("rechaza hostname que no resuelve", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    expect(await hostIsAllowed("no-existe.invalid", lookup)).toBe(false);
  });
});

describe("isAllowedUrl", () => {
  const fakeLookup = vi.fn().mockImplementation(async () => [
    { address: "93.184.216.34", family: 4 },
  ]);

  it("rechaza protocolos no HTTP(S)", async () => {
    const res = await isAllowedUrl("file:///etc/passwd", fakeLookup);
    expect(res.allowed).toBe(false);
  });

  it("rechaza credenciales embebidas", async () => {
    const res = await isAllowedUrl("https://user:pass@ejemplo.com/x.png", fakeLookup);
    expect(res.allowed).toBe(false);
  });

  it("rechaza URL inválida", async () => {
    const res = await isAllowedUrl("no es url", fakeLookup);
    expect(res.allowed).toBe(false);
  });

  it("rechaza host privado", async () => {
    const res = await isAllowedUrl("http://127.0.0.1/admin", fakeLookup);
    expect(res.allowed).toBe(false);
  });

  it("permite URL pública válida", async () => {
    const res = await isAllowedUrl("https://example.com/imagen.png", fakeLookup);
    expect(res.allowed).toBe(true);
  });
});