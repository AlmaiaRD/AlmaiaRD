import { describe, expect, it } from "vitest";
import { filterBundlePickerProducts } from "@/lib/bundles";
import type { CatalogProduct } from "@/types/relations";

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "p-1",
    code: "P-001",
    name: "Producto 1",
    image_url: null,
    subcategory: null,
    category_id: null,
    subbrand_id: null,
    description: null,
    benefits: null,
    cost: 100,
    pv: 10,
    price_30: 130,
    price_35: 135,
    active: true,
    apply_itbis: true,
    duracion_dias: null,
    is_bundle: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("selector de productos para bundles", () => {
  it("permite agregar tantos productos como haya, sin tope de 20", () => {
    const products = Array.from({ length: 25 }, (_, i) =>
      product({ id: `p-${i}`, code: `P-${i}`, name: `Producto ${i}` })
    );

    expect(filterBundlePickerProducts(products, { search: "", subbrandId: "" })).toHaveLength(25);
  });

  it("no exige stock para mostrar un producto", () => {
    // `stock` no existe en `products`: vive en `inventory` y solo se valida al
    // facturar. Un producto sin existencia debe seguir seleccionable.
    const withoutStock = { ...product({ id: "sin-stock", code: "P-0", name: "Sin stock" }), stock: 0 } as CatalogProduct;

    expect(filterBundlePickerProducts([withoutStock], { search: "", subbrandId: "" })).toHaveLength(1);
  });

  it("excluye archivados y otros bundles", () => {
    const list = [
      product(),
      product({ id: "archivado", name: "Archivado", active: false }),
      product({ id: "bundle", name: "Otro bundle", is_bundle: true }),
    ];

    expect(filterBundlePickerProducts(list, { search: "", subbrandId: "" }).map((p) => p.id)).toEqual(["p-1"]);
  });

  it("filtra por marca y por nombre o código sin perder el resto del catálogo", () => {
    const list = [
      product({ id: "nutrilite", name: "Proteína", subbrand_id: "sb-1" }),
      product({ id: "otra", name: "Proteína vegetal", subbrand_id: "sb-2" }),
      product({ id: "codigo", name: "Vitamina", code: "PRO-123", subbrand_id: "sb-2" }),
    ];

    expect(filterBundlePickerProducts(list, { search: "", subbrandId: "sb-1" }).map((p) => p.id)).toEqual(["nutrilite"]);
    expect(filterBundlePickerProducts(list, { search: "pro", subbrandId: "" }).map((p) => p.id)).toEqual([
      "nutrilite",
      "otra",
      "codigo",
    ]);
  });
});
