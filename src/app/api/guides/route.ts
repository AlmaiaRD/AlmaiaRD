import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { validateQuery } from "@/lib/validation";

const guidesQuerySchema = z.object({
  category: z.string().optional(),
  lang: z.enum(["es", "en"]).optional(),
});

const DOCS_DIR = path.join(process.cwd(), "docs");

const GROUPS = [
  { id: "user-guides", label: "Guías de Usuario" },
  { id: "training", label: "Capacitación" },
  { id: "processes", label: "Procesos" },
  { id: "troubleshooting", label: "Solución de Problemas" },
];

const FILE_LABELS: Record<string, string> = {
  "quick-start-guide.md": "Guía de Inicio Rápido",
  "invoice-management-guide.md": "Guía de Facturación",
  "customer-management-guide.md": "Guía de Gestión de Clientes",
  "inventory-management-guide.md": "Guía de Gestión de Inventario",
  "expenses-management-guide.md": "Guía de Gestión de Gastos",
  "purchases-management-guide.md": "Guía de Gestión de Compras",
  "documents-management-guide.md": "Guía de Gestión de Documentos",
  "credits-management-guide.md": "Guía de Gestión de Créditos",
  "bonuses-management-guide.md": "Guía de Gestión de Bonificaciones",
  "pv-management-guide.md": "Guía de Gestión de PV",
  "reports-management-guide.md": "Guía de Gestión de Reportes",
  "almaia-academy.md": "Almaia Academy",
  "new-user-training-guide.md": "Capacitación para Nuevos Usuarios",
  "manager-training-guide.md": "Capacitación para Gerentes",
  "create-invoice-process.md": "Cómo Crear una Factura",
  "register-expense-process.md": "Cómo Registrar un Gasto",
  "manage-customer-process.md": "Cómo Gestionar un Cliente",
  "move-inventory-process.md": "Cómo Mover Inventario",
  "send-whatsapp-process.md": "Cómo Enviar un WhatsApp",
  "generate-report-process.md": "Cómo Generar un Reporte",
  "common-issues-guide.md": "Problemas Comunes",
  "contact-support-guide.md": "Contacto y Soporte Técnico",
  "updates-maintenance-guide.md": "Actualizaciones y Mantenimiento",
};

function getFilesRecursive(dir: string, group: string): { filename: string; path: string }[] {
  const results: { filename: string; path: string }[] = [];
  const fullPath = path.join(DOCS_DIR, group);
  if (!fs.existsSync(fullPath)) return results;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push({ filename: entry.name, path: path.join(fullPath, entry.name) });
    }
  }
  return results.sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function GET(req: NextRequest) {
  try {
    validateQuery(guidesQuerySchema)(new URL(req.url).searchParams);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Validación fallida" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value } } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) { return NextResponse.json({ error: "No autorizado" }, { status: 401 }); }

  try {
    const groups = GROUPS.map((group) => {
      const files = getFilesRecursive(DOCS_DIR, group.id);
      return {
        id: group.id,
        label: group.label,
        files: files.map((f) => ({
          id: f.filename.replace(".md", ""),
          label: FILE_LABELS[f.filename] || f.filename.replace(".md", "").replace(/-/g, " "),
          filename: f.filename,
          content: fs.readFileSync(f.path, "utf-8"),
        })),
      };
    });

    return NextResponse.json({ groups });
  } catch {
    return NextResponse.json({ groups: [] });
  }
}