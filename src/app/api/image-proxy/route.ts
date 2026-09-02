import { NextRequest, NextResponse } from "next/server";
import { imageProxySchema, validateQuery } from "@/lib/validation";

function isAllowedHost(host: string): boolean {
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];
  return !blockedPatterns.some((p) => p.test(host));
}

function isAllowedUrl(url: string): { allowed: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: "Invalid URL" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { allowed: false, reason: "Only HTTP/HTTPS allowed" };
  }
  if (!isAllowedHost(parsed.hostname)) {
    return { allowed: false, reason: "Blocked host (private/internal IP)" };
  }
  return { allowed: true };
}

export async function GET(request: NextRequest) {
  let url: string;
  try {
    const params = validateQuery(imageProxySchema)(new URL(request.url).searchParams);
    url = params.url;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  const urlCheck = isAllowedUrl(url);
  if (!urlCheck.allowed) {
    console.warn("[image-proxy] Blocked SSRF attempt:", urlCheck.reason, url);
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "es-DO,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
        "Referer": "https://www.amway.com.do/",
      },
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const fallbackResponse = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: controller.signal,
        redirect: "manual",
      });

      if (!fallbackResponse.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${response.status}` },
          { status: response.status }
        );
      }

      const contentType = fallbackResponse.headers.get("content-type") || "image/jpeg";
      const arrayBuffer = await fallbackResponse.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[image-proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image" },
      { status: 500 }
    );
  }
}