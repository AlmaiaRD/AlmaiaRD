"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { updateProduct } from "@/services/products";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

interface PendingProduct {
  id: string;
  code: string;
  name: string;
  image_url: string;
}

interface LogEntry {
  code: string;
  name: string;
  status: "ok" | "err" | "skip";
  message: string;
}

async function fetchImageAsBlob(url: string): Promise<Blob> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) return blob;
    }
  } catch {
    // intenta canvas
  }

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo crear el canvas"));
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Canvas vacío"))),
          "image/jpeg",
          0.9
        );
      } catch (e: any) {
        reject(new Error("Imagen bloqueada por CORS: " + (e?.message || "")));
      }
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = url;
  });
}

function extensionFor(mime: string | undefined, currentUrl: string): string {
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("jpeg") || mime?.includes("jpg")) return "jpg";
  const m = currentUrl.match(/\.(png|webp|gif)/i);
  if (m) return m[1].toLowerCase();
  return "jpg";
}

export default function MigrateImagesPanel() {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [current, setCurrent] = useState<PendingProduct | null>(null);

  const isAdmin = user?.role === "admin";

  const loadPending = useCallback(async () => {
    setLoadingProducts(true);
    setProducts([]);
    setLogs([]);
    const { data, error } = await supabase
      .from("products")
      .select("id, code, name, image_url")
      .ilike("image_url", "%amway.com.do%");
    if (error) {
      setLogs([{ code: "-", name: "Error al consultar productos", status: "err", message: error.message }]);
      toast.error("Error al consultar productos");
    } else {
      setProducts((data || []) as PendingProduct[]);
    }
    setLoadingProducts(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) loadPending();
  }, [authLoading, user, loadPending]);

  if (authLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={28} /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <AlertTriangle size={40} className="mx-auto text-amber-500 mb-4" />
        <h1 className="text-lg font-bold text-[#5C3E35] mb-2">Acceso restringido</h1>
        <p className="text-[#9C8A82] text-sm">Solo los administradores pueden migrar imágenes.</p>
      </div>
    );
  }

  async function runMigration() {
    if (running || products.length === 0) return;
    setRunning(true);
    setLogs([]);
    setProgress({ done: 0, total: products.length });

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      setCurrent(p);
      try {
        let blob: Blob;
        try {
          blob = await fetchImageAsBlob(p.image_url);
        } catch (e: any) {
          setLogs((prev) => [...prev, { code: p.code, name: p.name, status: "err", message: e?.message || "No se pudo leer la imagen (CORS/403)" }]);
          setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
          continue;
        }

        const ext = extensionFor(blob.type, p.image_url);
        const fileName = `${p.code}_${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, blob, { upsert: true, contentType: blob.type || "image/jpeg" });

        if (upErr) {
          setLogs((prev) => [...prev, { code: p.code, name: p.name, status: "err", message: "Subida: " + upErr.message }]);
          setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
          continue;
        }

        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(fileName);

        try {
          await updateProduct(p.id, { image_url: pub?.publicUrl || "" });
          setLogs((prev) => [...prev, { code: p.code, name: p.name, status: "ok", message: "Migrada a Storage" }]);
        } catch (updErr: any) {
          setLogs((prev) => [...prev, { code: p.code, name: p.name, status: "err", message: "Actualizar: " + (updErr?.message || "error") }]);
        }
      } catch (e: any) {
        setLogs((prev) => [...prev, { code: p.code, name: p.name, status: "err", message: e?.message || "Error inesperado" }]);
      }
      setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
    }
    setCurrent(null);
    setRunning(false);
  }

  const okCount = logs.filter((l) => l.status === "ok").length;
  const errCount = logs.filter((l) => l.status === "err").length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-2xl border border-[#E8E0D8] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#B8837E]/10 flex items-center justify-center">
            <ImageIcon size={20} className="text-[#B8837E]" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-[#5C3E35]">
              {loadingProducts ? "Cargando productos..." : `${products.length} productos con imagen de amway`}
            </div>
            <p className="text-xs text-[#9C8A82]">La migración se ejecuta desde tu navegador (necesario para acceder a las imágenes).</p>
          </div>
          {!loadingProducts && (
            <button onClick={loadPending} className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-[#E8E0D8] text-sm text-[#5C3E35] hover:bg-[#FAF6F0]">
              <RefreshCw size={16} /> Recargar
            </button>
          )}
        </div>

        <button
          onClick={runMigration}
          disabled={running || products.length === 0}
          className="w-full h-12 bg-[#B8837E] text-white rounded-xl text-sm font-semibold hover:bg-[#9A6B66] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {running ? (
            <><Loader2 size={18} className="animate-spin" /> Migrando {progress.done}/{progress.total}...</>
          ) : (
            <>Iniciar migración ({products.length})</>
          )}
        </button>

        {running && current && (
          <div className="mt-4 p-3 rounded-xl bg-[#FAF6F0] text-sm text-[#5C3E35]">
            <span className="text-[#9C8A82]">Procesando:</span> {current.code} — {current.name}
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E0D8] p-6">
          <div className="flex gap-6 mb-4">
            <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={16} /> {okCount} migradas</span>
            <span className="text-sm font-semibold text-red-500 flex items-center gap-1.5"><XCircle size={16} /> {errCount} con error</span>
            <span className="text-sm text-[#9C8A82] ml-auto">{logs.length} registros</span>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {logs.map((l, idx) => (
              <div key={idx} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${l.status === "ok" ? "bg-emerald-50" : l.status === "err" ? "bg-red-50" : "bg-gray-50"}`}>
                {l.status === "ok" ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" /> : <XCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />}
                <div>
                  <span className="font-medium text-[#5C3E35]">{l.code}</span> <span className="text-[#9C8A82]">— {l.name}</span>
                  <div className="text-xs text-[#9C8A82]">{l.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
