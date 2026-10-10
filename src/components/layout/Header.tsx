"use client";

import { useState } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Flower2, Plus, LogOut, UserPlus, FileText, Receipt, ShoppingCart, ChevronDown, Sun, Moon, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/layout/Wordmark";

export default function Header() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="bg-[#39484F] border-b border-[#2C363D] px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <img
            src="/almaia-logo-con-fondo.svg"
            alt="Almaia RD"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain flex-shrink-0"
          />
          <Wordmark
            h1ClassName="text-[24px] sm:text-[26px] font-marca text-[#F5EFE9] leading-tight tracking-wide"
            pClassName="text-[10px] sm:text-[11px] text-[#E0DAD3] tracking-widest uppercase leading-tight font-medium"
          />
        </Link>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/facturacion?nueva=true"
            className="flex items-center gap-2 bg-[#E0DAD3] text-[#39484F] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#D3CAC0] transition-all duration-200"
          >
            <Plus size={18} />
            Nueva Factura
          </Link>
          <Link
            href="/cotizaciones?nueva=true"
            className="flex items-center gap-2 bg-[#BEA995] text-[#39484F] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#AF9983] transition-all duration-200"
          >
            <Plus size={18} />
            Crear Cotización
          </Link>
          <Link
            href="/recibos?nuevo=true"
            className="flex items-center gap-2 bg-[#E0DAD3] text-[#39484F] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#D3CAC0] transition-all duration-200"
          >
            <Plus size={18} />
            Registrar Pago
          </Link>
          <Link
            href="/inventario?nueva-compra=true"
            className="flex items-center gap-2 bg-[#BEA995] text-[#39484F] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#AF9983] transition-all duration-200"
          >
            <Plus size={18} />
            Registrar Compra
          </Link>
          <Link
            href="/clientes?nuevo=true"
            className="flex items-center gap-2 bg-[#E0DAD3] text-[#39484F] px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#D3CAC0] transition-all duration-200"
          >
            <UserPlus size={18} />
            Añadir Cliente
          </Link>
          <button
            onClick={toggleDark}
            className="flex items-center gap-2 bg-[#BEA995] text-[#39484F] px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[#AF9983] transition-all duration-200"
            title={dark ? "Modo claro" : "Modo oscuro"}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-[#E0DAD3] text-[#39484F] px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[#D3CAC0] transition-all duration-200"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Mobile Actions */}
        <div className="lg:hidden relative">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="flex items-center gap-1 bg-[#E0DAD3] text-[#39484F] px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#D3CAC0] transition-all"
          >
            <Plus size={18} />
            <ChevronDown size={14} className={`transition-transform ${showMobileMenu ? "rotate-180" : ""}`} />
          </button>

          {showMobileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                <Link
                  href="/facturacion?nueva=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-bg transition-colors border-b border-border"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <span className="text-sm text-foreground font-medium">Nueva Factura</span>
                </Link>
                <Link
                  href="/cotizaciones?nueva=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-bg transition-colors border-b border-border"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#39484F]/10 flex items-center justify-center">
                    <ClipboardList size={16} className="text-[#39484F]" />
                  </div>
                  <span className="text-sm text-foreground font-medium">Crear Cotización</span>
                </Link>
                <Link
                  href="/recibos?nuevo=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-bg transition-colors border-b border-border"
                >
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                    <Receipt size={16} className="text-success" />
                  </div>
                  <span className="text-sm text-foreground font-medium">Registrar Pago</span>
                </Link>
                <Link
                  href="/inventario?nueva-compra=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-bg transition-colors border-b border-border"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#39484F]/10 flex items-center justify-center">
                    <ShoppingCart size={16} className="text-[#39484F]" />
                  </div>
                  <span className="text-sm text-foreground font-medium">Registrar Compra</span>
                </Link>
                <Link
                  href="/clientes?nuevo=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary-bg transition-colors border-b border-border"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserPlus size={16} className="text-primary" />
                  </div>
                  <span className="text-sm text-foreground font-medium">Añadir Cliente</span>
                </Link>
                <button
                  onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <LogOut size={16} className="text-red-500" />
                  </div>
                  <span className="text-sm text-red-500 font-medium">Cerrar Sesión</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
