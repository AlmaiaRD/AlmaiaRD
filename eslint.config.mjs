import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "unused-imports/no-unused-imports": "warn",
    },
  },
  {
    // Excepción documentada: las imágenes del catálogo, facturas, cotizaciones, recibos y previews de
    // producto se sirven como URLs públicas de Supabase Storage (https://<ref>.supabase.co/storage/...).
    // Migrarlas a next/image exigiría remotePatterns con el hostname del ref (dinámico, definido por env)
    // y, si ese patrón no coincide exactamente, el loader respondería 400 Bad Request, rompiendo la
    // visualización de imágenes en producción. Son warnings de rendimiento (LCP), no de corrección.
    files: [
      "src/app/(dashboard)/catalogo/page.tsx",
      "src/app/(dashboard)/configuracion/page.tsx",
      "src/app/(dashboard)/cotizaciones/page.tsx",
      "src/app/(dashboard)/facturacion/page.tsx",
      "src/components/ui/ImageUpload.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
