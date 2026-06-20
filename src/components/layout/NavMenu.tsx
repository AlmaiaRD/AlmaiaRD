"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Estadísticas", icon: BarChart3 },
  { href: "/crm", label: "CRM y Seguimiento", icon: Calendar },
  { href: "/facturacion", label: "Facturas", icon: FileText },
  { href: "/recibos", label: "Recibos", icon: Receipt },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/inventario", label: "Inventario", icon: Package },
  { href: "/catalogo", label: "Catálogo", icon: BookOpen },
  { href: "/gastos", label: "Gastos", icon: DollarSign },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export default function NavMenu() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col items-center gap-1 py-1">
      {/* First line: 5 items */}
      <div className="flex items-center justify-center gap-2">
        {navItems.slice(0, 5).map((item) => {
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
      {/* Second line: 4 items */}
      <div className="flex items-center justify-center gap-2">
        {navItems.slice(5).map((item) => {
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
  );
}
