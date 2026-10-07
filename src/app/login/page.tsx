"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flower2, LogIn, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import toast from "react-hot-toast";
import Wordmark from "@/components/layout/Wordmark";

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
    <div className="min-h-screen bg-[#D8CBBF] flex flex-col">
      <header className="px-6 py-4 border-b border-[#E0DAD3] bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-[#39484F]/10 flex items-center justify-center">
              <Flower2 size={22} className="text-[#39484F]" />
            </div>
            <div>
              <Wordmark
                h1ClassName="text-[24px] font-marca text-[#39484F] leading-tight"
                pClassName="text-[10px] text-[#4C5760] tracking-widest uppercase leading-tight"
              />
            </div>
          </Link>
          <Link
            href="/"
            className="h-9 px-4 border border-[#E0DAD3] text-[#39484F] rounded-xl text-sm font-medium hover:bg-[#F1E9DF] transition-all flex items-center gap-2"
          >
            <ArrowLeft size={15} /> Volver
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-sm border border-[#E0DAD3] p-8">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-full bg-[#39484F]/10 flex items-center justify-center mx-auto mb-4">
                <LogIn size={26} className="text-[#39484F]" />
              </div>
              <h2 className="text-xl font-bold text-[#39484F]">Inicia Sesión</h2>
              <p className="text-sm text-[#4C5760] mt-1">Accede al sistema de gestión</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#39484F] mb-1.5">Correo Electrónico</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5760]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-[#E0DAD3] bg-[#F6EFE8] text-[#39484F] placeholder:text-[#A99B90] focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30 focus:border-[#BA4A3A] transition-all text-sm"
                    disabled={loggingIn}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#39484F] mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4C5760]" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-12 rounded-xl border border-[#E0DAD3] bg-[#F6EFE8] text-[#39484F] placeholder:text-[#A99B90] focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30 focus:border-[#BA4A3A] transition-all text-sm"
                    disabled={loggingIn}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4C5760] hover:text-[#39484F] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full h-12 bg-[#BA4A3A] text-white rounded-xl text-sm font-semibold hover:bg-[#9C382A] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loggingIn ? (
                  <><Loader2 size={18} className="animate-spin" /> Ingresando...</>
                ) : (
                  <><LogIn size={18} /> Ingresar</>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#E0DAD3] text-center">
              <p className="text-xs text-[#4C5760]">
                ¿No tienes cuenta? <button className="text-[#39484F] font-medium hover:underline hover:text-[#BA4A3A]">Solicitar Acceso</button>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-[#A99B90] mt-6">
            &copy; {new Date().getFullYear()} ALMAIA RD — Distribuidora Autorizada Amway
          </p>
        </div>
      </main>
    </div>
  );
}
