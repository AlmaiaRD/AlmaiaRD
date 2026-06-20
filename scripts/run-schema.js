const { readFileSync } = require("fs");
const path = require("path");

const sql = readFileSync(path.join(__dirname, "..", "supabase-schema.sql"), "utf-8");

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "rexebvnzgnnrxhxmwayx";
const TOKEN = process.env.SUPABASE_TOKEN || "";

async function main() {
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let success = 0;
  let errors = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    process.stdout.write(`[${i + 1}/${statements.length}] `);

    try {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: stmt }),
        }
      );
      const data = await res.json();

      if (res.ok) {
        console.log("✓");
        success++;
      } else {
        const msg = data.message || data.error || JSON.stringify(data);
        if (msg.includes("already exists")) {
          console.log("↻ (ya existe)");
          success++;
        } else if (msg.includes("duplicate")) {
          console.log("↻ (duplicado)");
          success++;
        } else {
          console.log(`✗ ${msg.slice(0, 80)}`);
          errors++;
        }
      }
    } catch (err) {
      console.log(`✗ Error de red: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n✓ ${success} ejecutados`);
  if (errors > 0) console.log(`✗ ${errors} errores`);

  // Verify tables
  console.log("\nVerificando tablas...");
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query:
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      }),
    }
  );
  const tables = await res.json();
  console.log("Tablas creadas:");
  tables.forEach((t) => console.log(`  - ${t.table_name}`));
}

main().catch((e) => console.error("Error:", e.message));
