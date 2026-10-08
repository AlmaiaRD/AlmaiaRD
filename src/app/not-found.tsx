import Link from "next/link";
import { Flower2, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F5EFE9] flex flex-col items-center justify-center px-4">
      <div className="w-16 h-16 rounded-full bg-[#39484F]/10 flex items-center justify-center mb-6">
        <Flower2 size={32} className="text-[#39484F]" />
      </div>
      <h1 className="text-[39px] font-marca text-[#39484F] mb-2">404</h1>
      <p className="text-lg text-[#4C5760] mb-8 text-center max-w-sm">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 h-12 px-6 bg-[#BA4A3A] text-white rounded-xl text-sm font-medium hover:bg-[#9C382A] transition-all shadow-sm"
      >
        <ArrowLeft size={18} /> Ir al inicio
      </Link>
    </div>
  );
}
