import { supabase } from "@/lib/supabase";

export interface ProductRecommendation {
  product_id: string;
  product_name: string;
  code: string;
  subbrand: string;
  reason: string;
  priority: "high" | "medium" | "low";
  score: number;
}

export interface ClientRecommendation {
  client_id: string;
  client_name: string;
  action: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface SalesTrend {
  product_id: string;
  product_name: string;
  total_sold: number;
  trend: "up" | "down" | "stable";
  percentage_change: number;
}

export type Season = "verano" | "invierno" | "primavera" | "otoño";

// Expanded need mappings for better matching
const NEED_MAPPINGS: Record<string, string[]> = {
  nutricion: ["nutrilite", "suplemento", "vitamina", "omega", "proteina", "mineral", "hierro", "calcio", "zinc"],
  belleza: ["artistry", "skincare", "maquillaje", "crema", "base", "rubor", "labial", "sombra", "serum"],
  cabello: ["satinique", "shampoo", "acondicionador", "tratamiento", "mascarilla", "aceite capilar", "keratina"],
  hogar: ["amway home", "limpieza", "lavanderia", "detergente", "suavizante", "desinfectante", "multiproposito"],
  salud: ["nutrilite", "suplemento", "omega", "proteina", "vitamina", "mineral", "probiotico", "antioxidante"],
  dientes: ["glister", "pasta dental", "cepillo", "enjuague", "hilo dental", "blanqueador"],
  piel: ["artistry", "crema", "locion", "protector solar", "serum", "exfoliante", "tonico", "limpiador"],
  "cuidado personal": ["g&h", "desodorante", "jabon", "locion", "crema para manos", "exfoliante"],
  energia: ["energize", "energy", "protein bar", "bebida", "isotonic"],
  limpieza: ["amway home", "limpiador", "detergente", "desinfectante", "multiproposito", "lavanderia"],
  proteinas: ["protein", "proteina", "shake", "barra", "nutrilite"],
  vitaminas: ["vitamin", "vitamina", "nutrilite", "suplemento"],
  bebé: ["artistry baby", "baby", "bebe", "infantil"],
  deporte: ["sport", "energy", "protein", "isotonic", "electrolitos"],
  anticelulitis: ["body key", "cellulite", "celulitis", "quemagrasa"],
  peso: ["body key", "weight", "peso", "control", "metabolismo"],
};

// Seasonal product keywords
const SEASON_KEYWORDS: Record<Season, string[]> = {
  verano: [
    "protector solar", "sun", " SPF", "crema solar", "after sun",
    "hidratante", "locion", "gel", "fresco", "beverage", "isotonic",
    "energize", "energy", "omega", "vitamina c", "antioxidante",
    "shampoo", "acondicionador", "cabello", "satinique",
    "desodorante", "g&h", "cuidado personal",
  ],
  invierno: [
    "nutrilite", "vitamina", "suplemento", "inmunidad", "immun",
    "omega", "proteina", "mineral", "hierro", "zinc",
    "crema", "locion", "piel", "artistry", "hidratante",
    "caliente", "chocolate", "bebida caliente",
    "g&h", "jabon", "locion corporal",
  ],
  primavera: [
    "limpieza", "amway home", "detergente", "lavanderia",
    "desinfectante", "multiproposito", "clean",
    "shampoo", "tratamiento", "cabello",
    "energize", "protein", "body key",
    "exfoliante", "renovacion", "fresh",
  ],
  otoño: [
    "crema", "locion", "piel", "artistry", "hidratante",
    "nutrilite", "vitamina", "suplemento",
    "g&h", "desodorante", "jabon",
    "satinique", "shampoo", "acondicionador",
    "chocolate", "bebida", "comfort",
  ],
};

// Get product recommendations based on client needs
export async function getProductRecommendations(
  clientNeeds: string[]
): Promise<ProductRecommendation[]> {
  const recommendations: ProductRecommendation[] = [];

  const { data: products } = await supabase
    .from("products")
    .select(`
      id,
      name,
      code,
      subbrands (name),
      categories (name)
    `);

  if (!products) return [];

  for (const need of clientNeeds) {
    const needLower = need.toLowerCase().trim();

    // Expand the need using mappings
    const expandedKeywords: string[] = [needLower];
    for (const [key, keywords] of Object.entries(NEED_MAPPINGS)) {
      if (needLower.includes(key) || key.includes(needLower)) {
        expandedKeywords.push(...keywords);
      }
    }

    for (const product of products) {
      const nameLower = product.name?.toLowerCase() || "";
      const subbrandLower = (product.subbrands as any)?.name?.toLowerCase() || "";
      const categoryLower = (product.categories as any)?.name?.toLowerCase() || "";
      const combined = `${nameLower} ${subbrandLower} ${categoryLower}`;

      let score = 0;
      let reason = "";

      for (const keyword of expandedKeywords) {
        // Direct name match
        if (nameLower.includes(keyword)) {
          score += 10;
          reason = `Nombre contiene "${keyword}"`;
          break;
        }

        // Subbrand match
        if (subbrandLower.includes(keyword)) {
          score += 8;
          const subbrandName = Array.isArray(product.subbrands) ? product.subbrands[0]?.name : (product.subbrands as any)?.name;
          reason = `Submarca ${subbrandName || ""} relacionada`;
          break;
        }

        // Category match
        if (categoryLower.includes(keyword)) {
          score += 6;
          const catName = Array.isArray(product.categories) ? product.categories[0]?.name : (product.categories as any)?.name;
          reason = `Categoría ${catName || ""} relacionada`;
          break;
        }

        // Combined match
        if (combined.includes(keyword)) {
          score += 4;
          reason = `Relacionado con "${keyword}"`;
          break;
        }
      }

      if (score > 0) {
        recommendations.push({
          product_id: product.id,
          product_name: product.name,
          code: product.code,
          subbrand: (product.subbrands as any)?.name || "",
          reason,
          priority: score >= 8 ? "high" : score >= 5 ? "medium" : "low",
          score,
        });
      }
    }
  }

  // Sort by score and remove duplicates
  return recommendations
    .sort((a, b) => b.score - a.score)
    .filter((rec, index, self) =>
      index === self.findIndex((r) => r.product_id === rec.product_id)
    )
    .slice(0, 15);
}

// Get client recommendations based on purchase history
export async function getClientRecommendations(): Promise<ClientRecommendation[]> {
  const recommendations: ClientRecommendation[] = [];

  const { data: clientsWithDebt } = await supabase
    .from("clients")
    .select("id, name")
    .eq("status", "deuda");

  if (clientsWithDebt) {
    for (const client of clientsWithDebt) {
      recommendations.push({
        client_id: client.id,
        client_name: client.name,
        action: "Cobrar deuda pendiente",
        reason: "Cliente tiene saldo pendiente",
        priority: "high",
      });
    }
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: inactiveClients } = await supabase
    .from("clients")
    .select("id, name")
    .not("id", "in", supabase
      .from("invoices")
      .select("client_id")
      .gte("created_at", thirtyDaysAgo.toISOString())
    );

  if (inactiveClients) {
    for (const client of inactiveClients) {
      recommendations.push({
        client_id: client.id,
        client_name: client.name,
        action: "Enviar catálogo actualizado",
        reason: "Sin compras en los últimos 30 días",
        priority: "medium",
      });
    }
  }

  return recommendations;
}

// Get seasonal recommendations by season
export async function getSeasonalRecommendations(season: Season): Promise<ProductRecommendation[]> {
  const keywords = SEASON_KEYWORDS[season] || [];
  const recommendations: ProductRecommendation[] = [];

  const { data: products } = await supabase
    .from("products")
    .select(`
      id,
      name,
      code,
      subbrands (name)
    `);

  if (!products) return [];

  const seasonNames: Record<Season, string> = {
    verano: "Verano",
    invierno: "Invierno",
    primavera: "Primavera",
    otoño: "Otoño",
  };

  for (const product of products) {
    const nameLower = product.name?.toLowerCase() || "";
    const subbrandLower = (product.subbrands as any)?.name?.toLowerCase() || "";
    const combined = `${nameLower} ${subbrandLower}`;

    for (const keyword of keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        recommendations.push({
          product_id: product.id,
          product_name: product.name,
          code: product.code,
          subbrand: (product.subbrands as any)?.name || "",
          reason: `Recomendado para ${seasonNames[season]}`,
          priority: "medium",
          score: 5,
        });
        break;
      }
    }
  }

  return recommendations.slice(0, 10);
}

// Get sales trends
export async function getSalesTrends(): Promise<SalesTrend[]> {
  const trends: SalesTrend[] = [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const { data: recentSales } = await supabase
    .from("invoice_items")
    .select(`
      product_id,
      quantity,
      products (name),
      invoices (created_at)
    `)
    .gte("invoices.created_at", thirtyDaysAgo.toISOString());

  const { data: previousSales } = await supabase
    .from("invoice_items")
    .select(`
      product_id,
      quantity,
      products (name),
      invoices (created_at)
    `)
    .gte("invoices.created_at", sixtyDaysAgo.toISOString())
    .lt("invoices.created_at", thirtyDaysAgo.toISOString());

  const recentByProduct: Record<string, number> = {};
  const previousByProduct: Record<string, number> = {};

  recentSales?.forEach((sale) => {
    recentByProduct[sale.product_id] = (recentByProduct[sale.product_id] || 0) + sale.quantity;
  });

  previousSales?.forEach((sale) => {
    previousByProduct[sale.product_id] = (previousByProduct[sale.product_id] || 0) + sale.quantity;
  });

  const allProductIds = new Set([...Object.keys(recentByProduct), ...Object.keys(previousByProduct)]);

  for (const productId of allProductIds) {
    const recent = recentByProduct[productId] || 0;
    const previous = previousByProduct[productId] || 0;
    const change = previous > 0 ? ((recent - previous) / previous) * 100 : recent > 0 ? 100 : 0;

    trends.push({
      product_id: productId,
      product_name: "Producto",
      total_sold: recent,
      trend: change > 10 ? "up" : change < -10 ? "down" : "stable",
      percentage_change: Math.round(change),
    });
  }

  return trends.sort((a, b) => b.total_sold - a.total_sold).slice(0, 10);
}

// Get low stock alerts
export async function getLowStockAlerts(): Promise<any[]> {
  const { data: lowStock } = await supabase
    .from("inventory")
    .select(`
      product_id,
      stock,
      minimum_stock,
      products (name, code, subbrands (name))
    `);

  return (lowStock || []).filter((item) => item.stock <= (item.minimum_stock || 5));
}

// Get all recommendations
export async function getAllRecommendations(): Promise<{
  products: ProductRecommendation[];
  clients: ClientRecommendation[];
  seasonal: ProductRecommendation[];
}> {
  const currentMonth = new Date().getMonth() + 1;
  const season = getSeasonFromMonth(currentMonth);

  const [products, clients, seasonal] = await Promise.all([
    getProductRecommendations(["nutricion", "belleza", "cabello", "hogar"]),
    getClientRecommendations(),
    getSeasonalRecommendations(season),
  ]);

  return { products, clients, seasonal };
}

export function getSeasonFromMonth(month: number): Season {
  if (month >= 4 && month <= 9) return "verano";
  if (month >= 10 && month <= 11) return "otoño";
  if (month === 12 || month <= 2) return "invierno";
  return "primavera";
}

// ---- AI-Powered Recommendations (OpenAI) ----

export async function getAIRecommendations(
  query: string
): Promise<ProductRecommendation[]> {
  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, type: "need" }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error al obtener recomendaciones IA");
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error("AI recommendations error:", error);
    throw error;
  }
}

export async function getAISeasonalRecommendations(
  season: Season
): Promise<ProductRecommendation[]> {
  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season, type: "seasonal" }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Error al obtener recomendaciones de temporada");
    }

    const data = await response.json();
    return data.recommendations || [];
  } catch (error) {
    console.error("AI seasonal recommendations error:", error);
    throw error;
  }
}
