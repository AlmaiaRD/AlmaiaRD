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
    <header className="bg-white border-b border-[#E8E0D8] px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#B8837E]/10 flex items-center justify-center">
            <Flower2 size={28} className="text-[#B8837E]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#5C3E35] leading-tight tracking-wide">ALMAIA</h1>
            <p className="text-[11px] text-[#9C8A82] tracking-widest uppercase leading-tight font-medium">
              Bienestar & Salud
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
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
            href="/compras"
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
