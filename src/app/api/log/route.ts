import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }
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
