import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  // La página de bienvenida (/) es PÚBLICA: es la puerta de entrada al
  // sistema (muestra qué es y da acceso al login). No contiene datos
  // privados, así que no requiere sesión. Todo lo demás sí la exige.
  if (req.nextUrl.pathname === "/") {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[middleware] SUPABASE_URL o SUPABASE_ANON_KEY no definidos — bloqueando acceso");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const res = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // OJO: los assets estáticos (svg, png, etc.) DEBEN quedar fuera del matcher.
  // Si el middleware los intercepta, un usuario sin sesión recibe un 307 a
  // /login en lugar de la imagen → el logo no se ve en /login ni en la landing.
  matcher: [
    "/((?!_next/static|_next/image|login|[^/]+\\.(?:svg|png|jpe?g|webp|gif|ico|css|js|woff2?|txt|xml|json)|manifest\\.webmanifest|sw\\.js|icons/.*).*)",
  ],
};
