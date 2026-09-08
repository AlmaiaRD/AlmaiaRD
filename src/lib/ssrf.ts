import { lookup } from "node:dns/promises";

type DnsLookup = typeof lookup;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | Number(octet), 0) >>> 0;
}

export function isPrivateIpv4(ip: string): boolean {
  const int = ipv4ToInt(ip);
  // Bloques privados/reservados de RFC 1918, 1122, 6890 y redes especiales
  const blocks: Array<[number, number]> = [
    [0x00000000, 8],   // 0.0.0.0/8 (this network — SSRF a localhost vía 0.0.0.0)
    [0x0a000000, 8],   // 10.0.0.0/8
    [0x64400000, 10],  // 100.64.0.0/10 (CGNAT)
    [0x7f000000, 8],   // 127.0.0.0/8 (loopback)
    [0xa9fe0000, 16],  // 169.254.0.0/16 (link-local)
    [0xac100000, 12],  // 172.16.0.0/12
    [0xc0000000, 24],  // 192.0.0.0/24
    [0xc0000200, 24],  // 192.0.2.0/24 (TEST-NET-1)
    [0xc0a80000, 16],  // 192.168.0.0/16
    [0xc6120000, 15],  // 198.18.0.0/15 (benchmarking)
    [0xc6336400, 24],  // 198.51.100.0/24 (TEST-NET-2)
    [0xcb007100, 24],  // 203.0.113.0/24 (TEST-NET-3)
    [0xe0000000, 4],   // 224.0.0.0/4 (multicast)
    [0xf0000000, 4],   // 240.0.0.0/4 (reservado)
    [0xffffffff, 32],  // 255.255.255.255 (broadcast)
  ];
  return blocks.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (int & mask) === (base & mask);
  });
}

export function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:x.x.x.x) — mismo rango que IPv4
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);

  if (lower === "::1") return true;          // loopback
  if (lower === "::") return true;           // unspecified
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local fe80::/10
  return false;
}

export function hasUsernamePassword(parsed: URL): boolean {
  return parsed.username !== "" || parsed.password !== "";
}

export async function hostIsAllowed(
  host: string,
  dnsLookup: DnsLookup = lookup
): Promise<boolean> {
  // Normaliza IPv6 literal con corchetes
  const normalized = host.startsWith("[") ? host.slice(1, -1) : host;

  // IP literal: validar directamente
  const ipv6Literal = normalized.includes(":") && !normalized.startsWith("[");
  if (ipv6Literal) return !isPrivateIpv6(normalized);
  const ipv4Literal = /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized);
  if (ipv4Literal) {
    const parts = normalized.split(".");
    if (parts.some((p) => Number(p) > 255)) return false;
    return !isPrivateIpv4(normalized);
  }

  // Hostname: resolver TODOS los registros y validar cada IP
  // (mitiga DNS rebinding y nombres que resuelven a IPs internas)
  try {
    const addresses = await dnsLookup(normalized, { all: true });
    if (addresses.length === 0) return false;
    return addresses.every((a) =>
      a.address.includes(":") ? !isPrivateIpv6(a.address) : !isPrivateIpv4(a.address)
    );
  } catch {
    return false;
  }
}

export function isAllowedUrl(
  url: string,
  dnsLookup: DnsLookup = lookup
): Promise<{ allowed: boolean; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve({ allowed: false, reason: "URL inválida" });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Promise.resolve({ allowed: false, reason: "Solo HTTP/HTTPS permitido" });
  }
  if (hasUsernamePassword(parsed)) {
    return Promise.resolve({ allowed: false, reason: "URL con credenciales no permitida" });
  }
  if (!parsed.hostname) {
    return Promise.resolve({ allowed: false, reason: "Falta host" });
  }
  return hostIsAllowed(parsed.hostname, dnsLookup).then((ok) =>
    ok
      ? { allowed: true }
      : { allowed: false, reason: "Host bloqueado (IP privada/interna)" }
  );
}