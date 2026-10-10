import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  DollarSign,
  FileText,
  GitBranch,
  Mail,
  MessageCircle,
  Notebook,
  Package,
  Receipt,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

export interface ModuleDef {
  href: string;
  label: string;
  icon: LucideIcon;
  family: string;
}

export interface FamilyDef {
  id: string;
  label: string;
}

/** Familias de módulos en el orden de presentación del nav. */
export const FAMILIES: FamilyDef[] = [
  { id: "ventas", label: "Ventas" },
  { id: "productos", label: "Productos" },
  { id: "clientes", label: "Clientes & CRM" },
  { id: "canales", label: "Canales" },
  { id: "analisis", label: "Análisis" },
  { id: "admin", label: "Administración" },
];

/** Todos los módulos navegables, agrupados por familia. */
export const MODULES: ModuleDef[] = [
  // Ventas
  { href: "/facturacion", label: "Facturas", icon: FileText, family: "ventas" },
  { href: "/cotizaciones", label: "Cotizaciones", icon: ClipboardList, family: "ventas" },
  { href: "/recibos", label: "Recibos", icon: Receipt, family: "ventas" },
  { href: "/devoluciones", label: "Devoluciones", icon: RotateCcw, family: "ventas" },
  { href: "/gastos", label: "Gastos", icon: DollarSign, family: "ventas" },
  // Productos
  { href: "/catalogo", label: "Catálogo", icon: BookOpen, family: "productos" },
  { href: "/recomendaciones", label: "Recomendaciones IA", icon: Sparkles, family: "productos" },
  { href: "/inventario", label: "Inventario", icon: Package, family: "productos" },
  // Clientes & CRM
  { href: "/crm", label: "CRM y Seguimiento", icon: Calendar, family: "clientes" },
  { href: "/clientes", label: "Clientes", icon: Users, family: "clientes" },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch, family: "clientes" },
  { href: "/comunicaciones", label: "Comunicaciones", icon: Mail, family: "clientes" },
  // Canales
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, family: "canales" },
  { href: "/telegram", label: "Telegram", icon: Send, family: "canales" },
  // Análisis
  { href: "/dashboard", label: "Estadísticas", icon: BarChart3, family: "analisis" },
  { href: "/aprendizaje", label: "Aprendizaje", icon: Notebook, family: "analisis" },
  // Administración
  { href: "/configuracion", label: "Configuración", icon: Settings, family: "admin" },
];

/** Límite de módulos fijables como favoritos. */
export const MAX_FAVORITES = 8;

export function moduleByHref(href: string): ModuleDef | undefined {
  return MODULES.find((m) => m.href === href);
}

/** Módulos de una familia, en el orden definido. */
export function modulesByFamily(familyId: string): ModuleDef[] {
  return MODULES.filter((m) => m.family === familyId);
}