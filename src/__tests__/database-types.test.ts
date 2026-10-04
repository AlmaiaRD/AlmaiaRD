import { describe, it, expectTypeOf } from "vitest";
import type { Product } from "@/types/database";
import type { CatalogProduct, ClientRef, InvoiceWithClient } from "@/types/relations";

/**
 * Estos tests no se ejecutan: comprueban los tipos en tiempo de compilacion.
 *
 * El bug que los motiva: `Product` declaraba `image_url`, `category_id`,
 * `subbrand_id`, `description`, `benefits` y `apply_itbis` como obligatorios
 * cuando en la base admiten NULL. Como el tipo era falso, seis pantallas
 * tuvieron que re-declararlo por su cuenta con las versiones correctas. Estos
 * tests fallan en `npm run verify` si alguien vuelve a ponerlos required.
 */

describe("Product: columnas que admiten NULL", () => {
  it("acepta un producto sin foto, sin submarca y sin categoria", () => {
    expectTypeOf<Product["image_url"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Product["category_id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Product["subbrand_id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Product["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Product["benefits"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Product["apply_itbis"]>().toEqualTypeOf<boolean | null>();
  });

  it("sigue admitiendo un producto completo", () => {
    expectTypeOf<{ image_url: string }>().toMatchTypeOf<
      Pick<Product, "image_url">
    >();
  });
});

describe("Relaciones: siempre opcionales y nulables", () => {
  it("una relacion ausente es null, no un error de tipo", () => {
    expectTypeOf<InvoiceWithClient["clients"]>().toEqualTypeOf<ClientRef | null | undefined>();
    expectTypeOf<CatalogProduct["subbrands"]>().toBeNullable();
    expectTypeOf<CatalogProduct["categories"]>().toBeNullable();
  });

  it("no obliga a inventar una relacion que la consulta no trajo", () => {
    // Esta es la situacion real: `select("id, name")` sin joins.
    const soloIdYNombre = { id: "1", name: "Producto" };
    expectTypeOf(soloIdYNombre).toMatchTypeOf<Pick<CatalogProduct, "id" | "name">>();
  });
});
