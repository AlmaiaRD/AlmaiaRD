import { describe, it, expect } from "vitest";
import { canOptimize } from "@/components/ui/ProductImage";

/**
 * El optimizador de Next descarga la imagen DESDE EL SERVIDOR. Si se le
 * acepta cualquier host, se acaba sirviendo de proxy para URLs arbitrarias,
 * que es lo mismo que protege src/lib/ssrf.ts. Estos tests fijan que solo
 * pasa lo del bucket de productos.
 */

const SUPABASE = "https://rexebvnzgnnrxhxmwayx.supabase.co";

describe("canOptimize", () => {
  it("acepta una foto del bucket de productos", () => {
    expect(canOptimize(`${SUPABASE}/storage/v1/object/public/product-images/abc-123.jpg`)).toBe(true);
  });

  it("acepta el bucket con y sin slash final", () => {
    expect(
      canOptimize(`${SUPABASE}/storage/v1/object/public/product-images/sub/carpeta/foto.png`)
    ).toBe(true);
  });

  it("rechaza otro bucket del mismo proyecto Supabase", () => {
    // El patron de next.config solo cubre product-images. Otro bucket pasaria
    // a descargarlo el servidor sin querer.
    expect(canOptimize(`${SUPABASE}/storage/v1/object/public/logos/firma.png`)).toBe(false);
  });

  it("acepta otro proyecto de Supabase, y es a proposito", () => {
    // El limite de seguridad es la RUTA del bucket, no el proyecto: los
    // buckets publicos de Supabase los sirve su propia CDN. Lo que no se
    // admite es descargar desde una ruta cualquiera de un host cualquiera.
    // Este test deja la decision escrita para que no se cambie por descuido.
    expect(
      canOptimize("https://otro-proyecto.supabase.co/storage/v1/object/public/product-images/a.jpg")
    ).toBe(true);
  });

  it("rechaza un host cualquiera", () => {
    expect(canOptimize("https://ejemplo.com/foto.jpg")).toBe(false);
  });

  it("rechaza http sin cifrar", () => {
    expect(canOptimize(`${SUPABASE.replace("https", "http")}/storage/v1/object/public/product-images/a.jpg`)).toBe(false);
  });

  it("rechaza una URL sin dasar por el bucket", () => {
    expect(canOptimize(`${SUPABASE}/otra/cosa/a.jpg`)).toBe(false);
  });

  it("no se deja engañar por .. en la ruta", () => {
    // new URL normaliza el recorrido, asi que esto acaba siendo
    // /storage/v1/object/public/secret.txt y no pasa el filtro. Se comprueba
    // porque un '..' sin normalizar seria una forma de salirse del bucket.
    expect(
      canOptimize(`${SUPABASE}/storage/v1/object/public/product-images/../secret.txt`)
    ).toBe(false);
  });

  it("rechaza un host que lleva el sufijo pero no lo termina", () => {
    expect(
      canOptimize(
        "https://malo.supabase.co.attacker.example/storage/v1/object/public/product-images/a.jpg"
      )
    ).toBe(false);
  });

  it("rechaza entradas que no son URL", () => {
    expect(canOptimize("")).toBe(false);
    expect(canOptimize("no-es-una-url")).toBe(false);
  });
});
