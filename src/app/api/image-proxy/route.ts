import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isAllowedUrl } from "@/lib/ssrf";
import { imageProxySchema, validateQuery } from "@/lib/validation";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10MB

async function readBodyWithCap(response: Response): Promise<{ buffer: Buffer; tooLarge: boolean }> {
  if (!response.body) {
    return { buffer: Buffer.alloc(0), tooLarge: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return { buffer: Buffer.alloc(0), tooLarge: true };
    }
    chunks.push(value);
  }
  return { buffer: Buffer.concat(chunks, total), tooLarge: false };
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    );
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let url: string;
  try {
    const params = validateQuery(imageProxySchema)(new URL(request.url).searchParams);
    url = params.url;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  const urlCheck = await isAllowedUrl(url);
  if (!urlCheck.allowed) {
    console.warn("[image-proxy] Blocked SSRF attempt:", urlCheck.reason, url);
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const fetchHeaders: Record<string, string> = {
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
    };

    if (new URL(url).username || new URL(url).password) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: "URL with credentials not allowed" }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: fetchHeaders,
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";

    // Solo se sirven imágenes; cualquier otro contenido se rechaza
    if (response.ok && !contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Blocked content type" }, { status: 415 });
    }

    if (!response.ok) {
      // Fallback con User-Agent simple (mismo origen, sin seguir redirects)
      const fallback = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "image/*",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      if (!fallback.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${response.status}` },
          { status: response.status }
        );
      }
      const fbType = fallback.headers.get("content-type") || "";
      if (!fbType.toLowerCase().startsWith("image/")) {
        return NextResponse.json({ error: "Blocked content type" }, { status: 415 });
      }
      const { buffer, tooLarge } = await readBodyWithCap(fallback);
      if (tooLarge) {
        return NextResponse.json({ error: "Respuesta demasiado grande" }, { status: 413 });
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": fbType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    const { buffer, tooLarge } = await readBodyWithCap(response);
    if (tooLarge) {
      return NextResponse.json({ error: "Respuesta demasiado grande" }, { status: 413 });
    }

    return new NextResponse(new Uint8Array(buffer), {
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