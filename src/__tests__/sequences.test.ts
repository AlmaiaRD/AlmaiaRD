import { describe, it, expect } from "vitest";
import {
  parseSequenceNumber,
  nextSequenceNumber,
  incrementSequenceNumber,
  SEQUENCE_DIGITS,
} from "@/lib/sequences";

/**
 * Regresión: el cálculo de correlativos estaba duplicado por copy-paste en 6
 * servicios (facturas, recibos, compras, devoluciones) y las 6 copias-usaban
 * `parseInt(valor.replace(prefijo, ""), 10) + 1`. Cuando el prefijo no coincide
 * con el valor almacenado, `parseInt` devuelve NaN y el correlativo guardado
 * quedaba como "REC-000NaN".
 */

describe("parseSequenceNumber", () => {
  it("extrae el número con prefijo coincidente", () => {
    expect(parseSequenceNumber("REC-000123", "REC-")).toBe(123);
    expect(parseSequenceNumber("FAC-000001", "FAC-")).toBe(1);
  });

  it("acepta prefijo con distinta capitalización", () => {
    expect(parseSequenceNumber("rec-000045", "REC-")).toBe(45);
  });

  it("usa el último bloque de dígitos si el resto tras el prefijo no es numérico", () => {
    // La implementación anterior usaba String.replace, que sustituye la
    // primera aparición en cualquier posición y luego producía NaN.
    expect(parseSequenceNumber("REC-2024-000009", "REC-")).toBe(9);
  });

  it("cae al último bloque de dígitos si el prefijo cambió", () => {
    // Caso real: se cambia invoice_prefix en Configuración y el último registro
    // todavía usa el prefijo anterior. Antes producía NaN -> "000NaN".
    expect(parseSequenceNumber("FAC-000500", "REC-")).toBe(500);
  });

  it("devuelve null para entradas no interpretables", () => {
    expect(parseSequenceNumber(null, "REC-")).toBeNull();
    expect(parseSequenceNumber(undefined, "REC-")).toBeNull();
    expect(parseSequenceNumber("", "REC-")).toBeNull();
    expect(parseSequenceNumber("   ", "REC-")).toBeNull();
    expect(parseSequenceNumber("sin-numeros", "REC-")).toBeNull();
    expect(parseSequenceNumber("REC-abc", "REC-")).toBeNull();
  });

  it("tolera espacios alrededor", () => {
    expect(parseSequenceNumber("REC- 000077 ", "REC-")).toBe(77);
  });
});

describe("nextSequenceNumber", () => {
  it("incrementa el último correlativo", () => {
    expect(nextSequenceNumber("REC-000123", "REC-")).toBe("REC-000124");
  });

  it("empieza en 1 cuando no hay registros previos", () => {
    expect(nextSequenceNumber(null, "REC-")).toBe(`REC-${"0".repeat(SEQUENCE_DIGITS - 1)}1`);
    expect(nextSequenceNumber("", "DEV-")).toBe("DEV-000001");
  });

  it("mantiene la anchura de 6 dígitos", () => {
    expect(nextSequenceNumber("REC-000999", "REC-")).toBe("REC-001000");
  });

  it("NUNCA produce un correlativo con NaN", () => {
    const sucios = ["000NaN", "NaN", "REC-", "abc", "0", null, undefined];
    for (const v of sucios) {
      const res = nextSequenceNumber(v as string | null, "REC-");
      expect(res === null || !res.includes("NaN")).toBe(true);
    }
  });

  it("devuelve null (no un número inventado) si el último valor está corrupto", () => {
    // Señal explícita para que el llamador_surface la corrupción en lugar de
    // generar un correlativo que podría colisionar.
    expect(nextSequenceNumber("REC-000NaN", "REC-")).toBeNull();
  });

  it("respeta una anchura distinta", () => {
    expect(nextSequenceNumber("X-7", "X-", 3)).toBe("X-008");
  });
});

describe("incrementSequenceNumber", () => {
  it("sube el correlativo ya emitido (reintento por colisión de clave única)", () => {
    // Función pura: encadenarla sobre el resultado anterior es lo que avanza la
    // numeración sin volver a consultar la base.
    expect(incrementSequenceNumber("REC-000010", "REC-")).toBe("REC-000011");
    expect(incrementSequenceNumber("REC-000011", "REC-")).toBe("REC-000012");
    expect(incrementSequenceNumber("REC-000012", "REC-")).toBe("REC-000013");
  });

  it("arranca en 1 si no puede interpretar el valor", () => {
    expect(incrementSequenceNumber("basura", "REC-")).toBe("REC-000001");
  });
});