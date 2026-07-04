"use client";

import { useState, useEffect } from "react";
import { getCrossSellProducts } from "@/services/ia";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  clientId: string;
  topProducts: { name: string; count: number }[];
}

export default function CrossSellSection({ clientId, topProducts }: Props) {
  const [suggestions, setSuggestions] = useState<{ product_name: string; code: string; frequency: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (topProducts.length === 0) { setLoading(false); return; }
      // Look up product IDs by name
      const names = topProducts.slice(0, 3).map(p => p.name);
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("name", names);
      if (!products || products.length === 0) { setLoading(false); return; }

      const results = new Map<string, { product_name: string; code: string; frequency: number }>();
      for (const p of products) {
        const items = await getCrossSellProducts(p.id, 3);
        for (const item of items) {
          if (!results.has(item.product_id) || results.get(item.product_id)!.frequency < item.frequency) {
            results.set(item.product_id, { product_name: item.product_name, code: item.code, frequency: item.frequency });
          }
        }
      }
      if (!cancelled) {
        setSuggestions(
          [...results.values()]
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 6)
        );
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId, topProducts]);

  if (loading) return <div className="text-xs text-[#9C8A82] py-2">Buscando productos complementarios...</div>;
  if (suggestions.length === 0) return <div className="text-xs text-[#9C8A82] py-2">No hay sugerencias disponibles</div>;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#B8837E]/10 text-[#B8837E] border border-[#B8837E]/20">
          <ShoppingCart size={12} />
          {s.product_name}
          <span className="text-[10px] opacity-60">{s.frequency}%</span>
        </span>
      ))}
    </div>
  );
}
