"use client";

import { useState } from "react";
import { Flower2, Plus, LogOut, UserPlus, FileText, Receipt, ShoppingCart, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function Header() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-[#E8E0D8] px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#B8837E]/10 flex items-center justify-center flex-shrink-0">
            <Flower2 size={22} className="sm:w-7 sm:h-7 text-[#B8837E]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#5C3E35] leading-tight tracking-wide">ALMAIA</h1>
            <p className="text-[10px] sm:text-[11px] text-[#9C8A82] tracking-widest uppercase leading-tight font-medium">
              Bienestar & Salud
            </p>
          </div>
        </Link>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/facturacion?nueva=true"
            className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm"
          >
            <Plus size={18} />
            Nueva Factura
          </Link>
          <Link
            href="/recibos?nuevo=true"
            className="flex items-center gap-2 bg-[#86C7A3] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#6DB08A] transition-all duration-200 shadow-sm"
          >
            <Plus size={18} />
            Registrar Pago
          </Link>
          <Link
            href="/inventario?nueva-compra=true"
            className="flex items-center gap-2 bg-[#C9A89C] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#B08E82] transition-all duration-200 shadow-sm"
          >
            <Plus size={18} />
            Registrar Compra
          </Link>
          <Link
            href="/clientes?nuevo=true"
            className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all duration-200 shadow-sm"
          >
            <UserPlus size={18} />
            Añadir Cliente
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 border border-[#E8E0D8] text-[#9C8A82] px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-200"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Mobile Actions */}
        <div className="md:hidden relative">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="flex items-center gap-1 bg-[#B8837E] text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
          >
            <Plus size={18} />
            <ChevronDown size={14} className={`transition-transform ${showMobileMenu ? "rotate-180" : ""}`} />
          </button>

          {showMobileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E8E0D8] rounded-xl shadow-lg z-50 overflow-hidden">
                <Link
                  href="/facturacion?nueva=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F0] transition-colors border-b border-[#E8E0D8]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#B8837E]/10 flex items-center justify-center">
                    <FileText size={16} className="text-[#B8837E]" />
                  </div>
                  <span className="text-sm text-[#5C3E35] font-medium">Nueva Factura</span>
                </Link>
                <Link
                  href="/recibos?nuevo=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F0] transition-colors border-b border-[#E8E0D8]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#86C7A3]/10 flex items-center justify-center">
                    <Receipt size={16} className="text-[#86C7A3]" />
                  </div>
                  <span className="text-sm text-[#5C3E35] font-medium">Registrar Pago</span>
                </Link>
                <Link
                  href="/inventario?nueva-compra=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F0] transition-colors border-b border-[#E8E0D8]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#C9A89C]/10 flex items-center justify-center">
                    <ShoppingCart size={16} className="text-[#C9A89C]" />
                  </div>
                  <span className="text-sm text-[#5C3E35] font-medium">Registrar Compra</span>
                </Link>
                <Link
                  href="/clientes?nuevo=true"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F0] transition-colors border-b border-[#E8E0D8]"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#B8837E]/10 flex items-center justify-center">
                    <UserPlus size={16} className="text-[#B8837E]" />
                  </div>
                  <span className="text-sm text-[#5C3E35] font-medium">Añadir Cliente</span>
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
