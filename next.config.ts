import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://api.openai.com https://graph.facebook.com https://www.googleapis.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
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