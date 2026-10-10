import { NextResponse } from "next/server";

// TEMPORAL: endpoint de diagnóstico. Se elimina tras resolver el guardado de favoritos.
const DIAG_TOKEN = "dg_9f3a1c7e_4b2d_11f0_9c3a_secret";
const REF = "rexebvnzgnnrxhxmwayx";

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
  const out: Record<string, unknown> = {};

  // Lista de usuarios de Auth (admin API) — solo id/email
  const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=50`, {
    headers: { apikey: srv, Authorization: `Bearer ${srv}` },
  });
  const listJson = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> };
  const authUsers = listJson.users || [];

  // Filas de public.users
  const pubRes = await fetch(`${url}/rest/v1/users?select=id,email,role`, {
    headers: { apikey: srv, Authorization: `Bearer ${srv}` },
  });
  const pubUsers = (await pubRes.json()) as Array<{ id: string; email?: string; role?: string }>;
  const pubIds = new Set(pubUsers.map((u) => u.id));

  out.authUserCount = authUsers.length;
  out.publicUserCount = pubUsers.length;
  out.authUsersMissingPublicRow = authUsers
    .filter((u) => !pubIds.has(u.id))
    .map((u) => ({ id: u.id, email: u.email }));
  out.publicRowsWithoutAuth = pubUsers
    .filter((u) => !authUsers.some((a) => a.id === u.id))
    .map((u) => ({ id: u.id, email: u.email }));

  // Probar la ruta real con la sesión de CADA usuario de Auth (magic link, sin correo)
  const results: unknown[] = [];
  for (const u of authUsers) {
    try {
      const gl = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: { apikey: srv, Authorization: `Bearer ${srv}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magiclink", email: u.email }),
      });
      const glJson = (await gl.json()) as { hashed_token?: string; msg?: string };
      if (!glJson.hashed_token) {
        results.push({ email: u.email, step: "generate_link", status: gl.status, msg: glJson.msg });
        continue;
      }
      const ver = await fetch(`${url}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: anon, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magiclink", token: glJson.hashed_token }),
      });
      const verJson = (await ver.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        user?: { id?: string };
      };
      if (!verJson.access_token) {
        results.push({ email: u.email, step: "verify", status: ver.status });
        continue;
      }
      const session = {
        access_token: verJson.access_token,
        refresh_token: verJson.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (verJson.expires_in ?? 3600),
        expires_in: verJson.expires_in ?? 3600,
        token_type: "bearer",
        user: { id: u.id },
      };
      const cookie = `sb-${REF}-auth-token=base64-${b64url(session)}`;
      const res = await fetch(`${origin}/api/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({}),
        redirect: "manual",
      });
      const body = await res.text();
      results.push({
        email: u.email,
        hasPublicRow: pubIds.has(u.id),
        routeStatus: res.status,
        routeBody: body.slice(0, 200),
      });
    } catch (e) {
      results.push({ email: u.email, error: e instanceof Error ? e.message : String(e) });
    }
  }
  out.routeE2E_byRealUser = results;

  return NextResponse.json(out);
}
