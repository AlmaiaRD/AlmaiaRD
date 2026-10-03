import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "DOP"): string {
  const locale = currency === "USD" ? "en-US" : "es-DO";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (d instanceof Date && isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (d instanceof Date && isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function numberToWords(amount: number): string {
  const unidades = [
    "", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  ];
  const diezAveinte = [
    "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
    "diecisiete", "dieciocho", "diecinueve", "veinte",
  ];
  const veinti = [
    "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
    "veintiséis", "veintisiete", "veintiocho", "veintinueve",
  ];
  const decenas = [
    "", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa",
  ];
  const centenas = [
    "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
    "seiscientos", "setecientos", "ochocientos", "novecientos",
  ];

  function convertir(n: number): string {
    if (n === 0) return "cero";
    if (n === 100) return "cien";
    let r = "";
    if (n >= 100) {
      r += centenas[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 30) {
      r += decenas[Math.floor(n / 10)];
      n %= 10;
      if (n > 0) r += " y " + unidades[n];
    } else if (n >= 21) {
      r += veinti[n - 21];
    } else if (n >= 10) {
      r += diezAveinte[n - 10];
    } else {
      r += unidades[n];
    }
    return r.trim();
  }

  const entero = Math.floor(amount);
  const decimal = Math.round((amount - entero) * 100);

  let result = "";
  if (entero === 1) {
    result = "un peso";
  } else if (entero === 0) {
    result = "cero pesos";
  } else if (entero >= 1000000) {
    const millones = Math.floor(entero / 1000000);
    const resto = entero % 1000000;
    const millonStr = millones === 1 ? "un millón" : convertir(millones) + " millones";
    if (resto > 0) {
      result = millonStr + " " + convertir(resto);
    } else {
      result = millonStr;
    }
    result += " pesos";
  } else {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    if (miles > 0) {
      if (miles === 1) result += "mil ";
      else result += convertir(miles) + " mil ";
    }
    result += convertir(resto);
    result += " pesos";
  }

  if (decimal > 0) {
    result += ` con ${decimal.toString().padStart(2, "0")}/100`;
  }

  return result + " dominicanos";
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function roundToNearest50(value: number): number {
  return Math.ceil(value / 50) * 50;
}

export function sanitizeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Valida una URL de imagen antes de persistirla o incrustarla en un atributo.
 *
 * Contexto (auditoría 2026-10-02): `settings.signature_url` / `logo_url` se
 * escribían en la BD sin ninguna validación y luego se interpolaban en una
 * plantilla `innerHTML` para el recibo (XSS almacenado). Además del escapado
 * del atributo, conviene impedir que se guarden esquemas ejecutables.
 *
 * Se aceptan:
 *  - `http:` / `https:` absolutas
 *  - rutas relativas que empiezan por `/` (bucket de Supabase, etc.)
 *  - `data:image/...` (previews sin subir; los SVG data-URL quedan excluidos)
 *
 * Todo lo demás (`javascript:`, `vbscript:`, `data:text/html`, etc.) devuelve "".
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const value = String(url).trim();
  if (!value) return "";
  // Se eliminan los caracteres de control (saltos de línea, tabuladores, NUL...):
  // los navegadores los ignoran al resolver el esquema, por lo que una variante
  // con un tabulador intercalado ("java" + TAB + "script:") se ejecutaría igual.
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("/")) return cleaned;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,/i.test(cleaned)) return cleaned;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return "";
}

export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Escapa un valor para escribirlo en una celda CSV.
 *
 * Entrecomillar NO basta contra la inyeccion de formulas: si la celda
 * empieza por =, +, - o @, Excel / Google Sheets / LibreOffice la
 * interpretan como una formula al abrir el archivo. Un producto cuyo
 * nombre empiece por esos caracteres, o un campo de texto libre, puede
 * ejecutar una formula en el equipo de quien abre el CSV.
 *
 * El prefijo de apostrofo es el escape que todos los hojas de calculo
 * reconocen como "esto es texto". Se aplica solo cuando el valor empieza
 * por un caracter peligroso, para no ensuciar las demas celdas.
 *
 * Ademas se duplican las comillas dobles internas (RFC 4180) y se envuelve
 * todo entrecomillas.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // 1) Caracteres de control y saltos de linea -> espacio. RFC 4180
  //    permite CRLF dentro de un campo entrecomillado, pero no todos los
  //    lectores lo respetan y un salto incrustado permite inyectar filas
  //    falsas en el archivo. Ningun campo de este reporte necesita un
  //    salto de linea, asi que se aplana.
  str = str.replace(/[\r\n\t]+/g, " ");
  // 2) Prefijo de formula. El apostrofo es el escape que Excel, Google
  //    Sheets y LibreOffice reconocen como "esto es texto".
  if (/^[=+\-@]/.test(str)) str = "'" + str;
  // 3) Comillas dobles duplicadas (RFC 4180) y campo entrecomillado.
  return '"' + str.replace(/"/g, '""') + '"';
}

/**
 * Serializa cabeceras y filas a CSV usando `csvCell`.
 *
 * Se usa CRLF como separador de linea: RFC 4180 lo exige y Excel en
 * Windows no trata el archivo correctamente con LF a secas.
 *
 * `separator` permite usar ";" en los exportes destinados a Excel en
 * espanol, que interpretan la coma como separador decimal en la
 * configuracion regional por defecto y abrirían el archivo descuadrado.
 * El separador va entrecomillado junto a la cabecera, así que un valor
 * que lo contenga no rompe nada.
 */
export function toCsv(
  headers: Array<string | number>,
  rows: Array<Array<string | number | null | undefined>>,
  separator = ","
): string {
  const lines = [headers.map(csvCell).join(separator)];
  for (const row of rows) lines.push(row.map(csvCell).join(separator));
  return lines.join("\r\n");
}
