import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { validateBody } from "@/lib/validation";

const logSchema = z.object({
  level: z.enum(["log", "warn", "error", "info", "debug"]),
  message: z.string().max(2000),
  data: z.any().optional(),
  url: z.string().url().optional(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await validateBody(logSchema)(req);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }
  try {
    const body = await req.json();
    const { level, message, data, url, timestamp } = body;

    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[method](`[CLIENT ${level.toUpperCase()}] ${message}`, {
      data,
      url,
      timestamp,
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}