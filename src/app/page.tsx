"use client";

import { Flower2, ArrowRight, BarChart3, FileText, Package, Users, Shield, Receipt } from "lucide-react";
import Link from "next/link";

const features = [
  { icon: FileText, label: "Facturación", desc: "Crea y gestiona facturas con descuentos y múltiples productos" },
  { icon: Receipt, label: "Recibos", desc: "Registra pagos en efectivo, transferencia o tarjeta" },
  { icon: Users, label: "Clientes", desc: "Directorio completo con estado de cuenta y seguimiento" },
  { icon: Package, label: "Inventario", desc: "Control de existencias con alertas de stock" },
  { icon: BarChart3, label: "Reportes", desc: "Informes de ventas, cobros y rentabilidad" },
  { icon: Shield, label: "PV y Comisiones", desc: "Control de puntos de volumen y comisiones" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FCFAF7] flex flex-col">
      <header className="px-6 py-4 border-b border-[#E8E0D8] bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#B8837E]/10 flex items-center justify-center">
              <Flower2 size={22} className="text-[#B8837E]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#5C3E35] leading-tight">ALMAIA</h1>
              <p className="text-[10px] text-[#9C8A82] tracking-widest uppercase leading-tight">Bienestar & Salud</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="h-10 px-5 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center">
              Iniciar Sesión
            </Link>
            <Link href="/login" className="h-10 px-5 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm flex items-center gap-2">
              Comenzar <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-[#B8837E]/10 text-[#B8837E] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Shield size={14} /> Sistema de Gestión Comercial
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#5C3E35] leading-tight mb-4">
            Tu negocio Amway,{" "}
            <span className="text-[#B8837E]">simplificado</span>
          </h1>
          <p className="text-lg text-[#9C8A82] max-w-2xl mx-auto mb-8">
            Administra facturación, inventario, clientes y más en un solo lugar.
            Diseñado para distribuidores Amway en República Dominicana.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/login" className="h-12 px-8 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm flex items-center gap-2">
              Acceder al Sistema <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[#B8837E]/10 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-[#B8837E]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#5C3E35] mb-1">{f.label}</h3>
                  <p className="text-sm text-[#9C8A82]">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border-t border-[#E8E0D8] py-12">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2 className="text-xl font-bold text-[#5C3E35] mb-8">¿Necesitas ayuda?</h2>
            <div className="flex items-center justify-center gap-8 text-sm text-[#9C8A82]">
              <span>Documentación</span>
              <span>Soporte Técnico</span>
              <span>Contacto</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 py-4 border-t border-[#E8E0D8] bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-[#9C8A82]">
          <span>&copy; {new Date().getFullYear()} ALMAIA RD — Distribuidora Autorizada Amway</span>
          <span>Versión 1.0.0</span>
        </div>
      </footer>
    </div>
  );
}
