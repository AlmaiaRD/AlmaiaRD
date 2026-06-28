"use client";

import { Flower2, Plus, LogOut } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function Header() {
  const { signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-[#E8E0D8] px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#B8837E]/10 flex items-center justify-center flex-shrink-0">
            <Flower2 size={22} className="sm:size-[28] text-[#B8837E]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#5C3E35] leading-tight tracking-wide">ALMAIA</h1>
            <p className="text-[10px] sm:text-[11px] text-[#9C8A82] tracking-widest uppercase leading-tight font-medium">
              Bienestar & Salud
            </p>
          </div>
        </Link>

        <div className="hidden sm:flex items-center gap-3">
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
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 border border-[#E8E0D8] text-[#9C8A82] px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-200"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
