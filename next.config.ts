import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

// `'unsafe-eval'` solo hace falta en desarrollo: React lo usa para reconstruir
// las pilas de error en el navegador. En produccion ni React ni Next lo usan.
//
// `'unsafe-inline'` se mantiene en `script-src` porque las paginas se generan
// de forma estatica y Next inyecta sus scripts de arranque inline; sustituirlo
// por un nonce obliga a renderizar TODAS las paginas de forma dinamica (ver
// docs/auditoria/AUDITORIA-2026-10-28.md). En `style-src` tambien es necesario
// por los `style={{...}}` de React, que no admiten nonce.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Ningun manejador inline (onclick="...") debe ejecutarse.
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  // El service worker descarga fotos de amway.com.do con fetch(), y toda la
  // aplicacion habla con Supabase. No hay llamadas de navegador a OpenAI ni a
  // Meta: esas van por rutas /api del servidor.
  "connect-src 'self' https://*.supabase.co https://www.amway.com.do",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Solo el bucket publico de imagenes de producto.
    //
    // Deliberadamente estrecho: el optimizador de Next descarga la imagen
    // DESDE EL SERVIDOR, asi que abrir el patron a cualquier host seria un
    // agujero de SSRF (lo mismo que protege src/lib/ssrf.ts). Las fotos de
    // producto son las unicas que pasan por aqui; el logo y la firma, cuyas
    // URL pone la usuaria a mano, se quedan como <img> (ver ProductImage).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
    // Las miniaturas del catalogo van de 40 a 320 px. Con la lista por defecto
    // el ancho mas pequeno que el optimizador ofrece es de 640, o sea que una
    // foto de 40 px descargaba la version de 640: 16 veces mas de lo necesario.
    imageSizes: [16, 32, 40, 48, 64, 96, 128, 160, 192, 256, 320, 384],
    formats: ["image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Aislamiento de origen. OJO: NO subir COEP a `require-corp`.
          // El catálogo, la firma y el logo se sirven como <img> cross-origin desde
          // Supabase Storage, y html2canvas/dom-to-image rasterizan el DOM a canvas.
          // Con `require-corp` el navegador bloquea toda subrecarga cross-origin que
          // no traiga CORP propio, lo que rompería el renderizado de imágenes y el
          // export a PDF. `credentialless` mantiene ese comportamiento (sin exigir
          // CORP) y aun así habilita crossOriginIsolated en Chromium, Firefox y Safari.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          // Protege nuestros propios recursos frente a embebido por terceros sitios.
          // No afecta a las imágenes que ESTE sitio carga de Supabase.
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
      {
        source: "/_next/static/chunks/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_DSN,
  sourcemaps: {
    disable: false,
  },
  disableLogger: true,
  automaticVercelMonitors: true,
});