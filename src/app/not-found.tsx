import Link from "next/link";
import { Flower2, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FCFAF7] flex flex-col items-center justify-center px-4">
      <div className="w-16 h-16 rounded-full bg-[#B8837E]/10 flex items-center justify-center mb-6">
        <Flower2 size={32} className="text-[#B8837E]" />
      </div>
      <h1 className="text-4xl font-bold text-[#5C3E35] mb-2">404</h1>
      <p className="text-lg text-[#9C8A82] mb-8 text-center max-w-sm">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 h-12 px-6 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
      >
        <ArrowLeft size={18} /> Ir al inicio
      </Link>
    </div>
  );
}
