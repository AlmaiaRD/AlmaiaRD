import { describe, it, expect } from "vitest";
import { csvCell, toCsv, sanitizeHtml } from "@/lib/utils";

/**
 * Inyección de formulas en CSV.
 *
 * Un CSV es un archivo de TEXTO, pero al abrirlo Excel/Google Sheets/
 * LibreOffice interpretan las celdas que empiezan por =, +, - o @ como
 * fórmulas. Si un usuario controla un campo que acaba en el export (nombre de
 * producto, nombre de cliente, descripción), puede inyectar una fórmula que se
 * ejecute en el equipo de quien abre el archivo.
 *
 * El entrecomillado que usaba el export de rotación NO lo evita: `"=1+1"`
 * sigue siendo una fórmula para la hoja de cálculo.
 */
describe("csvCell — inyección de fórmulas", () => {
  it("neutraliza los prefijos que la hoja de cálculo interpreta como fórmula", () => {
    for (const prefix of ["=", "+", "-", "@"]) {
      const cell = csvCell(`${prefix}SUM(A1:A9)`);
      expect(cell.startsWith('"')).toBe(true);
      // El carácter peligroso va tras un apóstrofo: deja de ser fórmula.
      expect(cell).toContain(`'${prefix}`);
      expect(cell.startsWith(`"${prefix}`)).toBe(false);
    }
  });

  it("no toca los valores que NO son fórmulas", () => {
    expect(csvCell("Nuez de Brasil")).toBe('"Nuez de Brasil"');
    expect(csvCell("123")).toBe('"123"');
    expect(csvCell("ACME - Distribuciones")).toBe('"ACME - Distribuciones"');
    // El signo sólo es peligroso al inicio de la celda.
    expect(csvCell("Vitamina C")).toBe('"Vitamina C"');
  });

  it("duplica las comillas dobles internas (RFC 4180)", () => {
    expect(csvCell('Di "hola"')).toBe('"Di ""hola"""');
    // Y una celda que además empieza por fórmula sigue siendo segura.
    const cell = csvCell('="hola"');
    expect(cell.startsWith(`"=`)).toBe(false);
    // Las comillas internas quedaron duplicadas.
    expect(cell).toContain(`""`);
  });

  it("duplica también las comillas cuando antepone el apóstrofo", () => {
    const cell = csvCell('=CONCAT("a","b")');
    // El apóstrofo no altera el entrecomillado; las comillas internas se duplican.
    expect(cell).toBe(`"'=CONCAT(""a"",""b"")"`);
  });

  it("normaliza null/undefined a celda vacía", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe('""');
  });

  it("acepta números", () => {
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(1234.5)).toBe('"1234.5"');
  });
});

describe("toCsv", () => {
  it("encabera y separa filas con CRLF", () => {
    const csv = toCsv(["Nombre", "Stock"], [["Nuez", 10], ["Vitamina", 0]]);
    expect(csv).toBe('"Nombre","Stock"\r\n"Nuez","10"\r\n"Vitamina","0"');
  });

  it("protege toda la columna, no sólo la primera celda", () => {
    const csv = toCsv(["a", "b"], [["=1+1", "@SUM(1)"]]);
    expect(csv).toBe(`"a","b"\r\n"'=1+1","'@SUM(1)"`);
  });

  it("acepta un separador alternativo (Excel en español usa \";\")", () => {
    // El export de descripciones del catálogo usa ";": con la coma, Excel en
    // configuración regional española abre el archivo descuadrado porque la
    // interpreta como separador decimal.
    const csv = toCsv(["a", "b"], [["1", "2"]], ";");
    expect(csv).toBe('"a";"b"\r\n"1";"2"');
  });

  it("tolera filas de longitudes distintas sin romper el formato", () => {
    const csv = toCsv(["a", "b", "c"], [["1"]]);
    expect(csv).toBe('"a","b","c"\r\n"1"');
  });

  it("produce un archivo sin saltos de línea inyectables", () => {
    // Un CRLF dentro del valor podría inyectar una fila falsa en el archivo.
    // `csvCell` lo aplana a espacio, así que cada fila del CSV es una línea.
    const csv = toCsv(["a"], [["linea1\r\nlinea2"]]);
    expect(csv).toBe('"a"\r\n"linea1 linea2"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

/**
 * `sanitizeHtml` es el escapado que se usa al construir las plantillas
 * `innerHTML` de facturas, recibos y cotizaciones. Se unificó en la auditoría
 * 2026-10-02 sustituyendo cuatro copias locales divergentes.
 */
describe("sanitizeHtml — invariante de escapado", () => {
  it("escapa los cinco caracteres que rompen un contexto HTML", () => {
    const out = sanitizeHtml(`<img src=x onerror="alert('1')">`);
    for (const ch of ["<", ">", '"', "'"]) {
      expect(out).not.toContain(ch);
    }
  });

  it("escapa el ampersand una sola vez y en el orden correcto", () => {
    // Si se escapasen los & al final, "&lt;" se convertiría en "&amp;lt;".
    expect(sanitizeHtml("<")).toBe("&lt;");
    expect(sanitizeHtml("&")).toBe("&amp;");
    expect(sanitizeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("devuelve cadena vacía para null/undefined/vacío", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });
});