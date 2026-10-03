/**
 * Correlativos documentales (facturas, recibos, compras, devoluciones).
 *
 * Antes esta lógica estaba duplicada por copy-paste en 6 servicios, y las 6
 * copias compartían el mismo defecto: `parseInt(valor.replace(prefijo, ""), 10)`
 * devuelve NaN cuando el prefijo no coincide con el valor almacenado (p. ej.
 * si cambia el prefijo en Configuración, o si el registro más reciente fue
 * creado con otro prefijo). NaN + 1 = NaN, y `String(NaN).padStart(6, "0")`
 * produce literalmente "000NaN", que se guarda como correlativo en la base.
 *
 * Aquí el caso no interpretable se representa con `null` para que cada llamador
 * decida explícitamente, en lugar de propagar un "000NaN" silencioso.
 */

/** Dígitos con los que se rellenan los correlativos (REC-000001). */
export const SEQUENCE_DIGITS = 6;

const TRAILING_DIGITS = /(\d+)\s*$/;

/**
 * Extrae el número de un correlativo con prefijo.
 *
 * Estrategia, en orden:
 *  1. Coincidencia exacta del prefijo followed de dígitos (`REC-000123`).
 *  2. Si el prefijo no coincide (se cambió en Configuración), se toma el último
 *     bloque de dígitos del valor (`FAC-000123` con prefijo `REC-` -> 123).
 *
 * @returns El número, o `null` si el valor no contiene dígitos utilizables.
 */
export function parseSequenceNumber(
  value: string | null | undefined,
  prefix: string,
): number | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (prefix && trimmed.toUpperCase().startsWith(prefix.toUpperCase())) {
    const rest = trimmed.slice(prefix.length).trim();
    if (/^\d+$/.test(rest)) {
      const n = Number(rest);
      return Number.isSafeInteger(n) && n >= 0 ? n : null;
    }
  }

  const match = TRAILING_DIGITS.exec(trimmed);
  if (!match) return null;

  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

/**
 * Calcula el siguiente correlativo a partir del último valor emitido.
 *
 * @param lastNumber Último correlativo almacenado (puede ser `null`/inválido).
 * @param prefix    Prefijo vigente.
 * @param digits    Anchura de relleno.
 * @returns El correlativo siguiente, o `null` si `lastNumber` existe pero no es
 *          interpretable. Devolver `null` en ese caso es intencionado: un
 *          correlativo malformado en la base debe ser visible, no silenciosamente
 *          sustituido por uno que puede colisionar con registros existentes.
 */
export function nextSequenceNumber(
  lastNumber: string | null | undefined,
  prefix: string,
  digits: number = SEQUENCE_DIGITS,
): string | null {
  if (lastNumber == null || String(lastNumber).trim() === "") {
    return `${prefix}${String(1).padStart(digits, "0")}`;
  }

  const parsed = parseSequenceNumber(lastNumber, prefix);
  if (parsed === null) return null;

  const next = parsed + 1;
  return `${prefix}${String(next).padStart(digits, "0")}`;
}

/**
 * Variante de reintento: cuando el primer intento choca por colisión de clave
 * única (dos pestañas creando a la vez), se pide el siguiente candidato a partir
 * del correlativo ya conflicteado, sin volver a consultar la base.
 */
export function incrementSequenceNumber(value: string, prefix: string, digits: number = SEQUENCE_DIGITS): string {
  const parsed = parseSequenceNumber(value, prefix);
  const next = (parsed === null ? 0 : parsed) + 1;
  return `${prefix}${String(next).padStart(digits, "0")}`;
}