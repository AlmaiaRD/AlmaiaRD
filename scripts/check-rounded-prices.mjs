#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  realtime: { transport: ws },
  auth: { persistSession: false },
});

const { error: ae } = await supabase.auth.signInWithPassword({ email: "admin@almaia.com", password: "Admin123!" });
if (ae) { console.error(ae.message); process.exit(1); }

const roundToNearest50 = (v) => Math.ceil(v / 50) * 50;

const { data: prods } = await supabase
  .from("products")
  .select("id, code, name, cost, pv, price_30, price_35, apply_itbis, active, subbrands(name)")
  .order("code");

let ok30 = 0, bad30 = 0, ok35 = 0, bad35 = 0, noCost = 0;

console.log("=== Precios vs fórmula SIN ITBIS embebido (cost × markup, redondeado a 50) ===");
console.log("Nota: el precio base NO incluye ITBIS; la app lo aplica al total (roundUpTo50(line×1.18)).\n");
for (const p of prods || []) {
  const base = Number(p.cost || 0);
  const exact30 = base * 1.3;
  const exact35 = base * 1.35;
  const expected30 = roundToNearest50(exact30);
  const expected35 = roundToNearest50(exact35);
  const cur30 = Number(p.price_30 || 0);
  const cur35 = Number(p.price_35 || 0);

  const good30 = Math.abs(cur30 - expected30) < 0.01;
  const good35 = Math.abs(cur35 - expected35) < 0.01;

  if (good30) ok30++; else bad30++;
  if (good35) ok35++; else bad35++;

  if (!good30 || !good35) {
    const flag30 = good30 ? "OK" : `❌ debería ${expected30}`;
    const flag35 = good35 ? "OK" : `❌ debería ${expected35}`;
    console.log(`${p.active ? "" : "[INACTIVO] "}${p.code} | ${p.name.slice(0, 40)} | cost=${base} itbis=${p.apply_itbis !== false ? "SÍ" : "no"} sub=${p.subbrands?.name ?? "—"}`);
    console.log(`   30%: actual=${cur30} ${flag30} | 35%: actual=${cur35} ${flag35}`);
  }
}

console.log(`\n=== RESUMEN ===`);
console.log(`30% correctos: ${ok30} | incorrectos: ${bad30}`);
console.log(`35% correctos: ${ok35} | incorrectos: ${bad35}`);
console.log(`total productos: ${prods?.length}`);
