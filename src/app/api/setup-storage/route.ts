import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PROJECT_REF = "rexebvnzgnnrxhxmwayx";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }
    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (userData?.role !== "admin") {
      return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
    }

    const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN;
    if (!mgmtToken) {
      return NextResponse.json({ error: "SUPABASE_ACCESS_TOKEN no configurado" }, { status: 500 });
    }

    const headers = {
      Authorization: `Bearer ${mgmtToken}`,
      "Content-Type": "application/json",
    };

    const bucketRes = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/storage/buckets`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "product-images", name: "product-images", public: true }),
      }
    );

    if (!bucketRes.ok) {
      const text = await bucketRes.text();
      if (bucketRes.status === 409) {
        return NextResponse.json({ ok: true, message: "El bucket ya existe" });
      }
      return NextResponse.json({ error: "Error al configurar storage" }, { status: 500 });
    }

    const sqlRes = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/sql/query`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `
            CREATE POLICY IF NOT EXISTS "product_images_insert" ON storage.objects
              FOR INSERT TO authenticated
              WITH CHECK (bucket_id = 'product-images');

            CREATE POLICY IF NOT EXISTS "product_images_select" ON storage.objects
              FOR SELECT TO authenticated
              USING (bucket_id = 'product-images');

            CREATE POLICY IF NOT EXISTS "product_images_delete" ON storage.objects
              FOR DELETE TO authenticated
              USING (bucket_id = 'product-images' AND auth.uid() = owner);

            CREATE POLICY IF NOT EXISTS "product_images_update" ON storage.objects
              FOR UPDATE TO authenticated
              USING (bucket_id = 'product-images' AND auth.uid() = owner)
              WITH CHECK (bucket_id = 'product-images' AND auth.uid() = owner);
          `,
        }),
      }
    );

    if (!sqlRes.ok) {
      const err = await sqlRes.text();
      console.error("Storage RLS error:", err);
    }

    return NextResponse.json({ ok: true, message: "Bucket product-images configurado correctamente" });
  } catch {
    return NextResponse.json({ error: "Error al configurar storage" }, { status: 500 });
  }
}
