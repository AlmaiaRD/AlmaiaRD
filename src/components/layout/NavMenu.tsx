"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  BarChart3,
  FileText,
  Receipt,
  Users,
  Package,
  BookOpen,
  DollarSign,
  Calendar,
  Settings,
  Menu,
  X,
  GitBranch,
  Mail,
  Notebook,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Estadísticas", icon: BarChart3 },
  { href: "/facturacion", label: "Facturas", icon: FileText },
  { href: "/recibos", label: "Recibos", icon: Receipt },
  { href: "/gastos", label: "Gastos", icon: DollarSign },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/recomendaciones", label: "Recomendaciones IA", icon: Sparkles },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/crm", label: "CRM y Seguimiento", icon: Calendar },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/comunicaciones", label: "Comunicaciones", icon: Mail },
  { href: "/aprendizaje", label: "Aprendizaje", icon: Notebook },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export default function NavMenu() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden flex items-center gap-2 text-[#9C8A82] hover:text-[#5C3E35] px-2 py-2"
        aria-label="Menú de navegación"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        <span className="text-sm font-medium">Menú</span>
      </button>

      {mobileOpen && (
        <div className="md:hidden flex flex-col gap-1 pb-3 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-[#B8837E]/10 text-[#B8837E]"
                    : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      <nav className="hidden md:flex flex-col items-center gap-1 py-1">
        <div className="flex items-center justify-center gap-2">
          {navItems.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                  isActive
                    ? "bg-[#B8837E]/10 text-[#B8837E] border-b-2 border-[#B8837E]"
                    : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
                )}
              >
                <Icon size={24} />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-2">
          {navItems.slice(6).map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                  isActive
                    ? "bg-[#B8837E]/10 text-[#B8837E] border-b-2 border-[#B8837E]"
                    : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
                )}
              >
                <Icon size={24} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
