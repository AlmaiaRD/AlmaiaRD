/**
 * Recomendaciones por palabras clave.
 *
 * Este modulo es la garantia de que la aplicación sigue siendo útil sin
 * ninguna IA configurada: cuando no hay clave, o el proveedor falla, o la
 * respuesta no se puede interpretar, se cae aqui.
 *
 * Puntua cada producto comparando la consulta del cliente contra nombre,
 * submarca, categoria, descripcion y beneficios. Los pesos reflejan que un
 * acierto en el nombre del producto es una senal mas fuerte que una
 * coincidencia suelta dentro del texto descriptivo.
 */

export interface KeywordProduct {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  benefits?: string | null;
  subbrand?: string | null;
  category?: string | null;
}

export interface KeywordRecommendation {
  product_id: string;
  product_name: string;
  code: string;
  subbrand: string;
  reason: string;
  priority: "high" | "medium" | "low";
  score: number;
}

/**
 * Palabras que solemos asociar a cada estacion en Republica Dominicana.
 * El orden no importa: se recorren todas.
 */
const SEASON_KEYWORDS: Record<string, string[]> = {
  verano: [
    "protector solar", "sun", "spf", "hidratante", "fresco", "energia",
    "omega", "vitamina c", "antioxidante", "shampoo", "desodorante",
  ],
  invierno: [
    "nutrilite", "vitamina", "suplemento", "inmunidad", "omega", "proteina",
    "crema", "locion", "piel", "artistry", "hidratante", "jabon",
  ],
  primavera: [
    "limpieza", "detergente", "lavanderia", "desinfectante", "shampoo",
    "energia", "protein", "exfoliante",
  ],
  otoño: [
    "crema", "locion", "piel", "artistry", "hidratante", "nutrilite",
    "vitamina", "suplemento", "jabon", "shampoo",
  ],
};

function normalize(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

/**
 * Quita acentos para que "proteccion" y "protección" se traten igual.
 * La consulta del usuario y los datos del catalogo pueden no coincidir en
 * acentuacion, y eso solo genera falsos negativos.
 */
function deaccent(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function stripTone(s: string): string {
  return deaccent(s);
}

/** Palabras vacias que no aportan senal. */
const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o",
  "para", "por", "con", "que", "necesito", "quiero", "busco", "me", "mi",
  "es", "son", "tiene", "tengo", "ayuda", "ayudan", "gusta", "quieren",
  "the", "and", "for", "with", "de", "del", "al", "a",
]);

/**
 * Devuelve hasta `limit` productos ordenados por relevancia.
 *
 * `season` amplia la busqueda con palabras tipicas de la epoca, para que
 * "que me recomiendas" en agosto sugiera protector solar.
 */
export function keywordRecommendations(
  products: KeywordProduct[],
  query: string,
  season?: string,
  limit = 15
): KeywordRecommendation[] {
  const words = normalize(query)
    .split(/[\s,.;:!?¿¡]+/)
    .map(stripTone)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const seasonal = (season && SEASON_KEYWORDS[season]) || [];

  const scored: KeywordRecommendation[] = [];

  for (const product of products) {
    const name = stripTone(normalize(product.name));
    const subbrand = stripTone(normalize(product.subbrand));
    const category = stripTone(normalize(product.category));
    const desc = stripTone(normalize(product.description));
    const benefits = stripTone(normalize(product.benefits));

    let score = 0;
    let reason = "";

    for (const keyword of [...words, ...seasonal]) {
      // Las palabras de temporada no compiten con las escritas por el
      // usuario: si hay coincidencia exacta, manda esa.
      const isSeasonal = seasonal.includes(keyword);
      let s = 0;
      let r = "";

      if (name.includes(keyword)) {
        s = keyword.length > 4 ? 10 : 8;
        r = `El nombre del producto incluye "${keyword}"`;
      } else if (subbrand.includes(keyword)) {
        s = keyword.length > 4 ? 8 : 6;
        r = `Pertenece a la submarca ${product.subbrand}`;
      } else if (category.includes(keyword)) {
        s = 6;
        r = `Es de la categoria ${product.category}`;
      } else if (benefits.includes(keyword)) {
        s = 6;
        r = `Sus beneficios mencionan "${keyword}"`;
      } else if (desc.includes(keyword)) {
        s = 5;
        r = `Su descripcion menciona "${keyword}"`;
      }

      // Un acierto real siempre gana; uno de temporada solo rellena el hueco.
      if (s > 0 && (isSeasonal ? score < 4 : s > score)) {
        if (isSeasonal && s >= score) {
          score = Math.max(score, Math.min(s, 4));
          if (!reason) reason = `Recomendado para ${season}`;
        } else {
          score = s;
          reason = r;
        }
      }
    }

    if (score > 0) {
      scored.push({
        product_id: product.id,
        product_name: product.name,
        code: product.code,
        subbrand: product.subbrand || "",
        reason: reason || `Relacionado con la consulta`,
        priority: score >= 8 ? "high" : score >= 6 ? "medium" : "low",
        score,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .filter((r, i, self) => self.findIndex((x) => x.product_id === r.product_id) === i)
    .slice(0, limit);
}
