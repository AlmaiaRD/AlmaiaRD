import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const EXCLUDE_TABLES = new Set([
  "_prisma_migrations",
]);

async function getTables() {
  const { data, error } = await supabase
    .from("information_schema.tables")
    .select("table_name, table_type")
    .eq("table_schema", "public")
    .eq("table_type", "BASE TABLE");

  if (error) throw new Error(`Error listing tables: ${error.message}`);
  return data.map((r) => r.table_name).filter((t) => !EXCLUDE_TABLES.has(t));
}

async function exportTable(table) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order("id", { ascending: true, nullsFirst: false })
    .limit(100000);

  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from(table)
      .select("*")
      .limit(100000);

    if (fallbackError) {
      console.error(`  Error exportando ${table}: ${fallbackError.message}`);
      return { table, rows: [], error: fallbackError.message };
    }
    return { table, rows: fallback || [] };
  }

  return { table, rows: data || [] };
}

async function run() {
  const start = Date.now();
  const date = new Date().toISOString().split("T")[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = `backup-${date}`;

  console.log(`Iniciando backup: ${backupName}`);

  const tables = await getTables();
  console.log(`Tablas encontradas: ${tables.length}`);

  const results = [];
  for (const table of tables) {
    console.log(`Exportando ${table}...`);
    const result = await exportTable(table);
    results.push(result);
  }

  const manifest = {
    backup_name: backupName,
    created_at: new Date().toISOString(),
    table_count: results.length,
    total_rows: results.reduce((s, r) => s + r.rows.length, 0),
    tables: results.map((r) => ({
      name: r.table,
      row_count: r.rows.length,
      error: r.error || null,
    })),
  };

  const backupData = {
    manifest,
    data: results.reduce((acc, r) => {
      acc[r.table] = r.rows;
      return acc;
    }, {}),
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const fileName = `${backupName}.json`;

  console.log(`\nSubiendo a Storage: ${fileName}`);
  console.log(`Total tablas: ${manifest.table_count}`);
  console.log(`Total filas: ${manifest.total_rows}`);
  console.log(`Tamaño: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB`);

  const { error: uploadError } = await supabase.storage
    .from("backups")
    .upload(fileName, jsonStr, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Error subiendo backup: ${uploadError.message}`);
  }

  // Limpiar backups anteriores a 8 semanas
  const { data: existingFiles, error: listError } = await supabase.storage
    .from("backups")
    .list();

  if (!listError && existingFiles) {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    for (const file of existingFiles) {
      if (new Date(file.created_at) < eightWeeksAgo && file.name.startsWith("backup-")) {
        await supabase.storage.from("backups").remove([file.name]);
        console.log(`  Eliminado backup antiguo: ${file.name}`);
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nBackup completado en ${elapsed}s`);
  console.log(`Archivo: ${fileName}`);
}

run().catch((err) => {
  console.error("Backup falló:", err.message);
  process.exit(1);
});
