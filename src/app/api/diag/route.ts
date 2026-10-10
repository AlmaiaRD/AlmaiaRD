import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMPORAL: endpoint de diagnóstico. Se elimina tras resolver el guardado de favoritos.
const DIAG_TOKEN = "dg_9f3a1c7e_4b2d_11f0_9c3a_secret";
const REF = "rexebvnzgnnrxhxmwayx";

function kind(k?: string): string {
  if (!k) return "empty";
  if (k.startsWith("sb_secret_")) return "sb_secret";
  if (k.startsWith("sb_publishable_")) return "sb_publishable";
  if (k.startsWith("eyJ")) return "jwt";
  return "other";
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

export async function GET(req: Request) {
  if (req.headers.get("x-diag") !== DIAG_TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const origin = new URL(req.url).origin;

  const out: Record<string, unknown> = {
    hasServiceRole: !!srv,
    serviceRoleLen: srv.length,
    serviceRoleKind: kind(srv),
  };
  if (!url) return NextResponse.json(out);

  const svc = createClient(url, srv, { auth: { persistSession: false } });

  const stamp = Date.now();
  const email = `diag+${stamp}@almaia.test`;
  const password = `Di4g_${stamp}_x!`;
  let createdId: string | null = null;

  try {
    // Crear usuario en Auth
    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: srv, Authorization: `Bearer ${srv}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const createJson = (await createRes.json()) as { id?: string; msg?: string };
    out.adminCreateUser = { status: createRes.status, id: createJson.id };
    if (!createJson.id) throw new Error("no id");
    createdId = createJson.id;

    // Insertar fila en public.users (con name, que es NOT NULL)
    const ins = await svc
      .from("users")
      .insert({ id: createdId, name: "Diag Temp", email, role: "assistant" });
    out.insertUserRow = ins.error
      ? { ok: false, code: ins.error.code, message: ins.error.message }
      : { ok: true };

    // 1) UPDATE con SERVICE ROLE (lo que hace la ruta) — no-op
    const svcUpd = await svc
      .from("users")
      .update({ preferences: { diag_svc: true } })
      .eq("id", createdId)
      .select("id");
    out.serviceRoleUpdate = svcUpd.error
      ? { ok: false, code: svcUpd.error.code, message: svcUpd.error.message }
      : { ok: true, rows: svcUpd.data?.length ?? 0 };

    // Login del usuario temporal
    const loginRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginJson = (await loginRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: { id?: string };
    };
    out.tempLogin = { status: loginRes.status, ok: !!loginJson.access_token };

    // 2) UPDATE con JWT del usuario (sujeto a RLS) — no-op
    if (loginJson.access_token) {
      const patch = await fetch(`${url}/rest/v1/users?id=eq.${createdId}`, {
        method: "PATCH",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${loginJson.access_token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ preferences: { diag_user: true } }),
      });
      const body = await patch.text();
      out.userJwtUpdateRLS = { status: patch.status, body: body.slice(0, 150) };
    }

    // 3) PRUEBA END-TO-END de la ruta real /api/preferences con cookie de sesión
    if (loginJson.access_token) {
      const expiresAt = Math.floor(Date.now() / 1000) + (loginJson.expires_in ?? 3600);
      const session = {
        access_token: loginJson.access_token,
        refresh_token: loginJson.refresh_token,
        expires_at: expiresAt,
        expires_in: loginJson.expires_in ?? 3600,
        token_type: "bearer",
        user: { id: createdId },
      };
      const cookieVal = "base64-" + b64url(session);
      const cookie = `sb-${REF}-auth-token=${cookieVal}`;
      const res = await fetch(`${origin}/api/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ favorites: ["/inventario"] }),
        redirect: "manual",
      });
      out.routeE2E = { status: res.status, body: (await res.text()).slice(0, 300) };
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  } finally {
    if (createdId) {
      await svc.from("users").delete().eq("id", createdId);
      const del = await fetch(`${url}/auth/v1/admin/users/${createdId}`, {
        method: "DELETE",
        headers: { apikey: srv, Authorization: `Bearer ${srv}` },
      });
      out.cleanup = { deletedAuthUser: del.status };
    }
  }

  return NextResponse.json(out);
}
