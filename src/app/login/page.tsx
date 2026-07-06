"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flower2, LogIn, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const { user, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (pendingRedirect && user) {
      router.replace("/dashboard");
    }
  }, [pendingRedirect, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor ingresa tu correo y contraseña");
      return;
    }
    setError(null);
    setLoggingIn(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
      setLoggingIn(false);
      toast.error(signInError);
    } else {
      setLoggingIn(false);
      setPendingRedirect(true);
    }
  }

  return (
    <div className="min-h-screen bg-[#FCFAF7] flex flex-col">
      <header className="px-6 py-4 border-b border-[#E8E0D8] bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-[#B8837E]/10 flex items-center justify-center">
              <Flower2 size={22} className="text-[#B8837E]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#5C3E35] leading-tight">ALMAIA</h1>
              <p className="text-[10px] text-[#9C8A82] tracking-widest uppercase leading-tight">Bienestar & Salud</p>
            </div>
          </Link>
          <Link
            href="/"
            className="h-9 px-4 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center gap-2"
          >
            <ArrowLeft size={15} /> Volver
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-sm border border-[#E8E0D8] p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-full bg-[#B8837E]/10 flex items-center justify-center mx-auto mb-4">
                <LogIn size={26} className="text-[#B8837E]" />
              </div>
              <h2 className="text-xl font-bold text-[#5C3E35]">Inicia Sesión</h2>
              <p className="text-sm text-[#9C8A82] mt-1">Accede al sistema de gestión</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Correo Electrónico</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@almaia.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-[#E8E0D8] bg-[#FAF8F6] text-[#5C3E35] placeholder:text-[#BFB0A8] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all text-sm"
                    disabled={loggingIn}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-12 rounded-xl border border-[#E8E0D8] bg-[#FAF8F6] text-[#5C3E35] placeholder:text-[#BFB0A8] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all text-sm"
                    disabled={loggingIn}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9C8A82] hover:text-[#5C3E35] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full h-12 bg-[#B8837E] text-white rounded-xl text-sm font-semibold hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loggingIn ? (
                  <><Loader2 size={18} className="animate-spin" /> Ingresando...</>
                ) : (
                  <><LogIn size={18} /> Ingresar</>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#E8E0D8] text-center">
              <p className="text-xs text-[#9C8A82]">
                ¿No tienes cuenta? <button className="text-[#B8837E] font-medium hover:underline">Solicitar Acceso</button>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-[#BFB0A8] mt-6">
            &copy; {new Date().getFullYear()} ALMAIA RD — Distribuidora Autorizada Amway
          </p>
        </div>
      </main>
    </div>
  );
}
