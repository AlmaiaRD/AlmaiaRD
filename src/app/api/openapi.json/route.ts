import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateOpenApiDocument } from "@/lib/openapi";

export async function GET() {
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

  const doc = generateOpenApiDocument();
  return NextResponse.json(doc, {
    headers: { "Cache-Control": "no-store" },
  });
}