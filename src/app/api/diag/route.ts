import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMPORAL: endpoint de diagnóstico. Se elimina tras resolver el guardado de favoritos.
// Requiere el header x-diag con el token exacto; en otro caso responde 404.
const DIAG_TOKEN = "dg_9f3a1c7e_4b2d_11f0_9c3a_secret";

function kind(k?: string): string {
  if (!k) return "empty";
  if (k.startsWith("sb_secret_")) return "sb_secret";
  if (k.startsWith("sb_publishable_")) return "sb_publishable";
  if (k.startsWith("eyJ")) return "jwt";
  return "other";
}

function jwtClaims(k?: string): Record<string, unknown> | null {
  if (!k || !k.startsWith("eyJ")) return null;
  try {
    const p = k.split(".")[1];
    const pad = p + "=".repeat((4 - (p.length % 4)) % 4);
    const json = JSON.parse(
      Buffer.from(pad.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    );
    return { role: json.role, ref: json.ref, iss: json.iss };
  } catch {
    return null;
  }
}

async function rest(path: string, init: RequestInit & { url: string; key: string }) {
  const res = await fetch(path, init);
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 400) };
}

export async function GET(req: Request) {
  if (req.headers.get("x-diag") !== DIAG_TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const out: Record<string, unknown> = {
    hasUrl: !!url,
    hasAnon: !!anon,
    anonKind: kind(anon),
    hasServiceRole: !!srv,
    serviceRoleLen: srv.length,
    serviceRoleKind: kind(srv),
    serviceRoleClaims: jwtClaims(srv),
  };

  if (!url) return NextResponse.json(out);

  // 1) ¿La service role puede leer `users` (salta RLS)?
  if (srv) {
    const db = createClient(url, srv, { auth: { persistSession: false } });
    const { data, error } = await db.from("users").select("id, role").limit(2);
    out.serviceRoleRead = error
      ? { ok: false, code: error.code, message: error.message }
      : { ok: true, rows: data?.length ?? 0 };
  }

  // 2) Cliente anon sin sesión (fallback que usa la ruta si falta la service role)
  if (anon) {
    const db2 = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await db2.from("users").select("id").limit(1);
    out.anonNoSessionRead = error
      ? { ok: false, code: error.code, message: error.message }
      : { ok: true, rows: data?.length ?? 0 };
  }

  // 3) Si la service role funciona: crea un usuario temporal, prueba la política
  //    RLS de UPDATE sobre `users` con SU propio JWT, y limpia todo.
  const svcRead = out.serviceRoleRead as { ok?: boolean } | undefined;
  if (srv && svcRead?.ok) {
    const stamp = Date.now();
    const email = `diag+${stamp}@almaia.test`;
    const password = `Di4g_${stamp}_x!`;
    let createdId: string | null = null;
    try {
      // 3a) Crear usuario en Auth (admin API con service role)
      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: srv,
          Authorization: `Bearer ${srv}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      const createJson = (await createRes.json()) as { id?: string; msg?: string };
      out.adminCreateUser = { status: createRes.status, id: createJson.id, msg: createJson.msg };
      if (!createJson.id) throw new Error("no id");
      createdId = createJson.id;

      // 3b) Insertar fila en public.users (service role)
      const db = createClient(url, srv, { auth: { persistSession: false } });
      const ins = await db.from("users").insert({ id: createdId, email, role: "assistant" });
      out.serviceInsertUserRow = ins.error
        ? { ok: false, code: ins.error.code, message: ins.error.message }
        : { ok: true };

      // 3c) Login del usuario temporal
      const loginRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginJson = (await loginRes.json()) as { access_token?: string; user?: { id?: string } };
      out.tempLogin = { status: loginRes.status, ok: !!loginJson.access_token };
      const jwt = loginJson.access_token;
      if (!jwt) throw new Error("no jwt");

      // 3d) UPDATE con el JWT del usuario (sujeto a RLS) — valor no-op
      const patch = await rest(`${url}/rest/v1/users?id=eq.${createdId}`, {
        url,
        key: anon,
        method: "PATCH",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ preferences: { diag: true } }),
      });
      let rows = 0;
      try {
        const parsed = JSON.parse(patch.body);
        if (Array.isArray(parsed)) rows = parsed.length;
      } catch {
        /* noop */
      }
      out.rlsUpdateOwnTest = {
        status: patch.status,
        rowsAffected: rows,
        policyExists: rows > 0,
        body: patch.body.slice(0, 200),
      };
    } catch (e) {
      out.tempUserTest = { error: e instanceof Error ? e.message : String(e) };
    } finally {
      // 3e) Limpieza
      if (createdId) {
        const db = createClient(url, srv, { auth: { persistSession: false } });
        await db.from("users").delete().eq("id", createdId);
        const del = await fetch(`${url}/auth/v1/admin/users/${createdId}`, {
          method: "DELETE",
          headers: { apikey: srv, Authorization: `Bearer ${srv}` },
        });
        out.cleanup = { deletedAuthUser: del.status };
      }
    }
  }

  return NextResponse.json(out);
}
