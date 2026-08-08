"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, FileText, Check, AlertTriangle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface ParsedItem {
  name: string;
  code?: string;
  quantity: number;
  unit_cost: number;
  itbis: boolean;
}

interface ParsedPurchase {
  supplier_name: string;
  purchase_date: string;
  notes: string;
  discount_amount: number;
  items: ParsedItem[];
}

interface MatchedItem extends ParsedItem {
  product_id?: string;
  matched?: boolean;
}

interface CatalogProduct {
  id: string;
  name: string;
  code?: string | null;
  cost?: number | null;
}

interface PurchasePdfImportProps {
  products: CatalogProduct[];
  onApply: (purchase: {
    supplier_name: string;
    purchase_date: string;
    notes: string;
    discount_amount: number;
    items: Array<{ product_id: string; name: string; quantity: number; unit_cost: number; itbis?: boolean }>;
  }) => void;
  onClose: () => void;
}

export default function PurchasePdfImport({ products, onApply, onClose }: PurchasePdfImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<{ parsed: ParsedPurchase } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function normalize(s: string): string {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  }

  function matchProduct(name: string): CatalogProduct | undefined {
    const n = normalize(name);
    if (!n) return undefined;
    const tokens = n.split(" ").filter(t => t.length > 2);

    let best: { product: CatalogProduct; score: number } | null = null;
    for (const p of products) {
      const pn = normalize(p.name);
      if (p.code && normalize(p.code) === n) {
        best = { product: p, score: 1 };
        break;
      }
      let score = 0;
      for (const token of tokens) {
        if (pn.includes(token)) score += 1;
      }
      const ratio = score / tokens.length;
      if (ratio > 0.6 && (!best || ratio > best.score)) {
        best = { product: p, score: ratio };
      }
    }
    return best?.product;
  }

  function processParsed(parsed: ParsedPurchase): { items: MatchedItem[] } {
    const items: MatchedItem[] = parsed.items.map((item) => {
      const product = matchProduct(item.name);
      return {
        ...item,
        product_id: product?.id,
        matched: Boolean(product),
        unit_cost: item.unit_cost || product?.cost || 0,
      };
    });
    return { items };
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsing(true);
    setPreview(null);

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      if (pdf.numPages > 10) {
        setError("El PDF tiene más de 10 páginas. Máximo soportado: 10.");
        setParsing(false);
        return;
      }

      const images: string[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        images.push(dataUrl);
        page.cleanup();
      }

      if (images.length === 0) {
        setError("No se pudieron generar imágenes del PDF");
        setParsing(false);
        return;
      }

      const catalog = products.map((p) => ({ id: p.id, name: p.name, code: p.code }));

      const res = await fetch("/api/parse-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, catalog }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al interpretar el PDF");
      }

      const { items } = processParsed(data.parsed);
      if (items.length === 0) {
        setError("La IA no encontró productos en la factura. Verifica que la imagen sea legible.");
        setParsing(false);
        return;
      }

      setPreview({ parsed: { ...data.parsed, items } });
    } catch (err) {
      console.error("[purchase-pdf]", err);
      setError((err as Error)?.message || "Error al procesar el PDF");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateItem(index: number, field: keyof MatchedItem, value: unknown) {
    if (!preview) return;
    const items = [...preview.parsed.items];
    items[index] = { ...items[index], [field]: value } as MatchedItem;
    setPreview({ ...preview, parsed: { ...preview.parsed, items } });
  }

  function handleApply() {
    if (!preview) return;
    const allMatched = preview.parsed.items.every((i) => (i as MatchedItem).product_id);
    if (!allMatched) {
      toast.error("Asigna un producto del catálogo a todos los items antes de continuar");
      return;
    }
    onApply({
      supplier_name: preview.parsed.supplier_name,
      purchase_date: preview.parsed.purchase_date,
      notes: preview.parsed.notes,
      discount_amount: preview.parsed.discount_amount,
      items: preview.parsed.items.map((i) => {
        const m = i as MatchedItem;
        return {
          product_id: m.product_id!,
          name: m.name,
          quantity: m.quantity,
          unit_cost: m.unit_cost,
          itbis: m.itbis,
        };
      }),
    });
    onClose();
  }

  const matchedCount = preview?.parsed.items.filter((i) => (i as MatchedItem).product_id).length || 0;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={handleFile}
        className="hidden"
      />

      {!preview && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
          className="w-full flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-[#D4C5B2] bg-[#FAF6F0] hover:border-[#B8837E] hover:bg-[#F5EDE8] transition-all disabled:opacity-50"
        >
          {parsing ? (
            <>
              <Loader2 size={24} className="text-[#B8837E] animate-spin" />
              <span className="text-sm font-medium text-[#5C3E35]">Interpretando el PDF con IA...</span>
            </>
          ) : (
            <>
              <Upload size={24} className="text-[#B8837E]" />
              <div className="text-left">
                <div className="text-sm font-medium text-[#5C3E35]">Subir factura de compra (PDF)</div>
                <div className="text-xs text-[#9C8A82]">La IA extrae productos, cantidades y precios automáticamente</div>
              </div>
            </>
          )}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          {!preview && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ml-auto text-xs font-medium text-red-700 hover:underline shrink-0 flex items-center gap-1"
            >
              <RefreshCw size={12} /> Reintentar
            </button>
          )}
        </div>
      )}

      {preview && (
        <>
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${matchedCount === preview.parsed.items.length ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {matchedCount === preview.parsed.items.length ? <Check size={16} /> : <AlertTriangle size={16} />}
            <span>
              {matchedCount === preview.parsed.items.length
                ? `${preview.parsed.items.length} productos coinciden con el catálogo. Revisa y confirma.`
                : `${matchedCount} de ${preview.parsed.items.length} productos coinciden. Asigna los que faltan.`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Proveedor</label>
              <input
                type="text"
                value={preview.parsed.supplier_name}
                onChange={(e) => setPreview({ ...preview, parsed: { ...preview.parsed, supplier_name: e.target.value } })}
                className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9C8A82] mb-1">Fecha</label>
              <input
                type="date"
                value={preview.parsed.purchase_date}
                onChange={(e) => setPreview({ ...preview, parsed: { ...preview.parsed, purchase_date: e.target.value } })}
                className="w-full h-10 px-3 rounded-lg border border-[#E8E0D8] bg-white text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#5C3E35]">Productos detectados</label>
              <span className="text-xs text-[#9C8A82]">Valida y corrige antes de continuar</span>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {preview.parsed.items.map((item, i) => {
                const m = item as MatchedItem;
                return (
                  <div key={i} className="flex items-center gap-2 bg-[#FAF6F0] rounded-xl p-2.5">
                    <div className="flex-1 min-w-0">
                      <select
                        value={m.product_id || ""}
                        onChange={(e) => updateItem(i, "product_id", e.target.value || undefined)}
                        className={`w-full h-9 px-2 rounded-lg border text-sm truncate ${m.product_id ? "border-[#D4C5B2] bg-white" : "border-red-300 bg-red-50"}`}
                      >
                        <option value="">{m.matched ? "Seleccionar..." : "Sin coincidencia — busca abajo"}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <div className="text-[10px] text-[#9C8A82] mt-0.5 truncate">PDF: {item.name}{item.code ? ` (${item.code})` : ""}</div>
                    </div>
                    <input
                      type="number" min={1} value={item.quantity}
                      onChange={(e) => updateItem(i, "quantity", Math.max(1, Number(e.target.value)))}
                      className="w-16 h-9 px-1 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      title="Cantidad"
                    />
                    <input
                      type="number" step="0.01" min={0} value={item.unit_cost}
                      onChange={(e) => updateItem(i, "unit_cost", Number(e.target.value))}
                      className="w-24 h-9 px-1 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      title="Costo unitario"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setPreview(null); setError(null); }}
              className="text-sm text-[#9C8A82] hover:text-[#5C3E35] transition-colors flex items-center gap-1"
            >
              <FileText size={14} /> Cambiar PDF
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={matchedCount !== preview.parsed.items.length}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B8837E] text-white text-sm font-semibold hover:bg-[#9A6B66] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check size={16} /> Aplicar a la compra
            </button>
          </div>
        </>
      )}
    </div>
  );
}
