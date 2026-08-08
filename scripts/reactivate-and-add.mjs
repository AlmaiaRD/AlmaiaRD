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
if (ae) { console.error("ERROR auth:", ae.message); process.exit(1); }
console.log("✅ Autenticado\n");

const EXECUTE = process.argv.includes("--execute");

// ── 1. Reactivar los 16 existentes ─────────────────────────
const reactivate = ["127833D","127835D","127836D","127837D","127838D","127839D","127840D","127841D","127842D","127843D","A4042","A5923","A7553","A8600","AD5113","E0001"];

const { data: existing, error: pe } = await supabase
  .from("products")
  .select("id, code, name, active")
  .in("code", reactivate);
if (pe) { console.error("ERROR leyendo:", pe.message); process.exit(1); }

console.log(`REACTIVAR (${existing.length}):`);
for (const p of existing.sort((a, b) => a.code.localeCompare(b.code))) {
  if (p.active) {
    console.log(`   ${p.code} | ${p.name} | ya activo (skip)`);
  } else {
    console.log(`   ${p.code} | ${p.name}`);
  }
}

// ── 2. Insertar los 2 nuevos ────────────────────────────────
const A0244DR = {
  code: "A0244DR",
  name: "Multivitamina Double X™ de Nutrilite™ – Reemplazo para 31 días",
  cost: 2880,
  pv: 20.14,
  price_30: 3744,
  price_35: 3888,
  apply_itbis: false,
  category_id: "cd6804dc-73cb-4234-a596-6b4b32fe6b98", // Salud
  subbrand_id: "2a0818d6-0d36-4d3b-8c47-55dfdc96af32", // Nutrilite
  subcategory: null,
  image_url: "https://www.amway.com.do/medias/A0244DR-en-DO-690px-01?context=bWFzdGVyfGltYWdlc3w2MjEwNHxpbWFnZS9qcGVnfGltYWdlcy9oMWMvaGUwLzg4Mzk3OTExMTYzMTguanBnfDYyMjJkNGVmMzI5YzY4NmI5OGQwZjU4NTk3OTAyZDVhMzQ5OTJhMjhlZDU1NDkyN2ZkNWQwNDU1YjI2OGFiOGM",
  description: [
    "Artículo N°: A0244DR | Contenido: 186 tabletas",
    "",
    "Reemplazo para 31 días. Nuestra multivitamina más avanzada. Impulsado por las propiedades de las plantas. Creado para ti.",
    "Contiene 22 vitaminas y minerales que incluyen vitaminas de la A a la E, calcio, zinc, magnesio, selenio y más, además de 22 nutrientes de frutas, verduras y hierbas cultivadas en nuestras granjas Nutrilite™ y en granjas asociadas. Este multivitamínico supremo te brinda más de 40 nutrientes para apoyar corazón, cerebro, hueso, ojo, inmunidad, piel, energía, envejecimiento saludable, salud celular y vitalidad.",
    "",
    "[Beneficios]",
    "• Sin saborizantes, colorantes ni conservantes artificiales",
    "• Vegetariano",
    "• Sin lactosa",
    "• Sin gluten",
    "",
    "[Ingredientes]",
    "Vitamina A (de betacaroteno y acetato de vitamina A) (74 % como betacaroteno natural) | Vitamina C (de ácido ascórbico, concentrado de acerola [fruta]) | Vitamina D (como vitamina D3) | Vitamina E (como succinato de ácido D-alfa tocoferol) | Tiamina | Riboflavina | Niacina | Vitamina B6 | Ácido fólico | Vitamina B12 | Biotina | Calcio | Magnesio | Zinc | Selenio | Hierro | Cobre | Manganeso | Cromo | Molibdeno | Yodo | Boro | Luteína (del extracto de caléndula) | Extracto de semilla quercetina | Extracto de romero | Extracto de cúrcuma | Complejo de bioflavonoides cítricos | Mezcla de moras | Complejo ABPE (Alfalfa, Berro, Perejil y Espinaca) | Extracto de menta | Extracto de cebolla | Concentrado de tocoferoles combinados",
    "Otros ingredientes: Celulosa microcristalina, fosfato dicálcico, maltodextrina, croscarmelosa de sodio, dióxido de silicio, acacia, hidroxipropil metilcelulosa, almidón comestible modificado, estearato de magnesio, fibra de caña de azúcar, sacarosa, alginato de sodio, almidón de arveja, almidón de maíz, glicerina, cera de carnauba.",
    "",
    "[Preguntas Frecuentes]",
    "¿Qué es un fitonutriente y por qué hay tantos en el suplemento Double X™ de Nutrilite™? Los fitonutrientes son compuestos químicos naturales en las plantas y defienden contra el estrés ambiental. La marca Nutrilite™ siempre ha incluido estos nutrientes de plantas en sus fórmulas de suplementos. Los fitonutrientes contenidos en los 22 concentrados de plantas del suplemento Double X™, incluyendo los de la mezcla PhytoProtect™, te ofrecen protección antioxidante amplia y específica, ayudando a que tu cuerpo se defienda proactivamente contra el exceso de radicales libres que causan estrés oxidativo.",
    "¿Por qué son importantes los antioxidantes? Nuestro cuerpo necesita radicales libres, pero demasiados causarían un estrés oxidativo que resultaría en daño celular y envejecimiento. Para contrarrestar dicho estrés, nuestro cuerpo procesa antioxidantes para equilibrar los radicales libres.",
    "Double X™ de Nutrilite™ cuenta con certificación NSF. Elegir un producto certificado por NSF te deja saber que la empresa cumple con normas y procedimientos estrictos establecidos por la NSF.",
    "¿Double X™ de Nutrilite™ tiene certificación kosher? Sí. ¿Tiene certificación halal? Sí.",
    "",
    "[Instrucciones de Uso]",
    "Toma una tableta multivitamínica, una multimineral y una de fitonutriente dos veces al día con las comidas.",
  ].join("\n"),
  benefits: "Multivitamínico supremo con más de 40 nutrientes para apoyar corazón, cerebro, hueso, ojo, inmunidad, piel, energía, envejecimiento saludable, salud celular y vitalidad. Contiene 22 vitaminas y minerales más 22 nutrientes de frutas, verduras y hierbas.",
  active: true,
};

const E3878S = {
  code: "E3878S",
  name: "Pursue™ Limpiador desinfectante concentrado",
  cost: 810,
  pv: 5.66,
  price_30: 1053,
  price_35: 1093.5,
  apply_itbis: true,
  category_id: "fdd1b7b3-55c1-4e12-9a73-ace06fd56b18", // Hogar
  subbrand_id: "1f27b045-eb06-4300-8cd5-f1c34fc3ced2", // Amway Home
  subcategory: null,
  image_url: "https://www.amway.com.do/medias/E3878S-en-DO-690px-01?context=bWFzdGVyfGltYWdlc3wzNTAzMnxpbWFnZS9qcGVnfGltYWdlcy9oMzEvaGU4Lzg4Mzk4MDI4NDcyNjIuanBnfDAzZGIxYTY3ZTE1M2IyOWRjYjVmNzgwNTY5ZTc3ZTk3Mzk3MDYxY2Q5OGZjMmZkNjAzODllZDdjMDU0NGE5ODM",
  description: [
    "Artículo N°: E3878S | Contenido: 1 L/33.8 oz. líq.",
    "",
    "DESINFECTAR PARA PROTEGER – Limpia y desinfecta una variedad de superficies para mantener tu hogar saludable y feliz.",
    "Poder concentrado de limpieza. Nuestro limpiador desinfectante extermina 22 tipos diferentes de virus, hongos y bacterias, incluidos E. coli, salmonella y más.",
    "• Elimina el 99.9% de 22 tipos de virus, hongos y bacterias.",
    "• Limpia y desinfecta una variedad de superficies en toda tu casa.",
    "• Reduce el peligro de la contaminación cruzada de superficies.",
    "",
    "[Ingredientes]",
    "Ingredientes activos: Octil decil dimetil cloruro de amonio (1,140 %), Dioctilo dimetil cloruro de amonio (0,456 %), Didecilo dimetil cloruro de amonio (0,684 %), Alquilo (C14,50 %; C12,40 %; C16,10 %) Dimetil benzol cloruro de amonio (1,520 %). Ingredientes inertes: 96,200 %.",
    "",
    "[Preguntas Frecuentes]",
    "¿El Limpiador Desinfectante Pursue™ cuenta con certificación Kosher? Sí.",
    "",
    "[Instrucciones de Uso]",
    "Aplicar la solución de uso para superficies duras no porosas, humedecer minuciosamente las superficies con un paño húmedo, trapeador, esponja, rociador o por inmersión. Las superficies tratadas deben permanecer húmedas por 10 minutos. Frota hasta secar con un paño húmedo, esponja o trapeador, o deja que se seque al aire. Para áreas con mayor suciedad, se requiere una limpieza preliminar.",
  ].join("\n"),
  benefits: "Limpia y desinfecta una variedad de superficies eliminando el 99.9% de 22 tipos de virus, hongos y bacterias, incluidos E. coli y salmonella. Reduce el peligro de contaminación cruzada.",
  active: true,
};

const newProducts = [A0244DR, E3878S];
console.log(`\nINSERTAR (${newProducts.length}):`);
for (const p of newProducts) {
  console.log(`   ${p.code} | ${p.name} | cost=${p.cost} | pv=${p.pv} | p30=${p.price_30} | p35=${p.price_35} | itbis=${p.apply_itbis} | cat=${p.category_id} | subbrand=${p.subbrand_id}`);
}

if (!EXECUTE) {
  console.log("\n👀 MODO PRUEBA: usa --execute para aplicar los cambios.");
  process.exit(0);
}

console.log("\n🚀 EJECUTANDO...\n");

// Reactivar
let reactivated = 0;
for (const p of existing) {
  if (p.active) continue;
  const { error } = await supabase.from("products").update({ active: true }).eq("id", p.id);
  if (error) {
    console.log(`   ❌ ${p.code}: ${error.message}`);
  } else {
    reactivated++;
    console.log(`   ✅ Reactivado: ${p.code} | ${p.name}`);
  }
}

// Insertar (verificar que no existan)
for (const p of newProducts) {
  const { data: dup } = await supabase.from("products").select("id, name").eq("code", p.code);
  if (dup && dup.length) {
    console.log(`   ⚠️  ${p.code} ya existe ("${dup[0].name}") — se omite el insert`);
    continue;
  }
  const { error } = await supabase.from("products").insert(p);
  if (error) {
    console.log(`   ❌ ${p.code}: ${error.message}`);
  } else {
    console.log(`   🆕 Insertado: ${p.code} | ${p.name}`);
  }
}

console.log(`\n✅ Reactivados: ${reactivated}/${existing.length}`);
console.log(`✅ Insertados: ${newProducts.length}`);
