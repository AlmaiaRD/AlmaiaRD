"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { getInventory, getInventoryMovements, updateMinimumStock, checkCanDeleteProduct, deleteProduct, forceDeleteProduct, getProductUsage, getLastSalePerProduct, getLastPurchasePerProduct, getFirstPurchasePerProduct } from "@/services/inventory";
import { getProducts } from "@/services/products";
import { createPurchase, getPurchases, getPurchase, updatePurchase, deletePurchase, getSoldQuantities, getPurchasedQuantities } from "@/services/purchases";
import { normalize } from "@/lib/search";
import { getSuppliers } from "@/services/suppliers";
import { getBankAccounts } from "@/services/invoices";
import { getSettings } from "@/services/settings";
import type { Supplier, BankAccount, Settings } from "@/types/database";
import { Package, Plus, Search, X, Save, Edit2, Minus, History, ChevronDown, Eye, EyeOff, Trash2, Printer, Download, FileText, BarChart3, Loader, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import { useSearchParams, useRouter } from "next/navigation";

function getStockStatus(stock: number, minimum: number): { label: string; variant: "success" | "warning" | "danger" } {
  if (stock <= 0) return { label: "Agotado", variant: "danger" };
  if (stock <= minimum) return { label: "Bajo Stock", variant: "warning" };
  return { label: "Suficiente", variant: "success" };
}

export default function InventarioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FCFAF7]"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>}>
      <InventarioContent />
    </Suspense>
  );
}

function InventarioContent() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [soldMap, setSoldMap] = useState<Record<string, number>>({});
  const [purchasedMap, setPurchasedMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [activeTab, setActiveTab] = useState<"stock" | "history" | "rotation">("stock");

  const [showDetail, setShowDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailMovements, setDetailMovements] = useState<any[]>([]);
  const [detailMinStock, setDetailMinStock] = useState(3);

  const [showPurchase, setShowPurchase] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [openDownloadId, setOpenDownloadId] = useState<string | null>(null);
  const [showDetailPurchase, setShowDetailPurchase] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<any>(null);
  const [showConfirmDeleteProduct, setShowConfirmDeleteProduct] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [productUsage, setProductUsage] = useState<{ movements: number; invoices: number; purchases: number } | null>(null);

  // Rotation state
  const [rotationData, setRotationData] = useState<any[]>([]);
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationFilterSubbrand, setRotationFilterSubbrand] = useState("");
  const [rotationFilterDays, setRotationFilterDays] = useState("");
  const [rotationFilterStatus, setRotationFilterStatus] = useState("");
  const [rotationExportOpen, setRotationExportOpen] = useState(false);
  const [rotationDetailProductId, setRotationDetailProductId] = useState<string | null>(null);
  const [rotationDetailMovements, setRotationDetailMovements] = useState<any[]>([]);
  const [rotationDetailLoading, setRotationDetailLoading] = useState(false);
  const [rotationDetailItem, setRotationDetailItem] = useState<any>(null);
  const [rotationAiAnalysis, setRotationAiAnalysis] = useState<string | null>(null);
  const [rotationAiLoading, setRotationAiLoading] = useState(false);
  const [showHiddenStock, setShowHiddenStock] = useState(false);
  const [showHiddenRotation, setShowHiddenRotation] = useState(false);
  const [hiddenStockIds, setHiddenStockIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hiddenStockIds") || "[]"); } catch { return []; }
  });
  const [hiddenRotationIds, setHiddenRotationIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("hiddenRotationIds") || "[]"); } catch { return []; }
  });

  function generatePurchasePdfLocal(purchase: any) {
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const pageW = 216;
    let y = 30;
    const margin = 20;

    function setTextColor(hex: string) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      doc.setTextColor(r, g, b);
    }

    function drawLine(x1: number, y1: number, x2: number, y2: number, color: string) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      doc.setDrawColor(r, g, b);
      doc.line(x1, y1, x2, y2);
    }

    setTextColor("#5C3E35");
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("COMPRA", margin, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    setTextColor("#9C8A82");
    doc.text(`No. ${purchase.purchase_number}`, margin, y + 7);
    y += 18;
    drawLine(margin, y, pageW - margin, y, "#E8E0D8");
    y += 8;

    doc.setFontSize(10);
    setTextColor("#5C3E35");
    doc.setFont("helvetica", "bold");
    doc.text("Fecha:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(formatDate(purchase.purchase_date), margin + 20, y);
    doc.setFont("helvetica", "bold");
    doc.text("Proveedor:", margin + 80, y);
    doc.setFont("helvetica", "normal");
    doc.text(purchase.supplier_name || "—", margin + 105, y);
    y += 10;

    if (purchase.notes) {
      doc.setFont("helvetica", "bold");
      doc.text("Notas:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(purchase.notes, margin + 20, y);
      y += 8;
    }
    y += 4;
    drawLine(margin, y, pageW - margin, y, "#E8E0D8");
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setTextColor("#9C8A82");
    const colW = [55, 25, 25, 25, 25, 25];
    const colX = [margin];
    for (let i = 1; i < colW.length; i++) colX.push(colX[i - 1] + colW[i - 1]);
    doc.text("Producto", colX[0], y);
    doc.text("Cant.", colX[1], y, { align: "center" });
    doc.text("Costo U.", colX[2], y, { align: "center" });
    doc.text("ITBIS", colX[3], y, { align: "center" });
    doc.text("Subtotal", colX[4], y, { align: "center" });
    doc.text("Total", colX[5], y, { align: "right" });
    y += 8;
    drawLine(colX[0], y, pageW - margin, y, "#E8E0D8");
    y += 4;

    doc.setFont("helvetica", "normal");
    setTextColor("#5C3E35");
    doc.setFontSize(9);

    (purchase.purchase_items || []).forEach((item: any) => {
      if (y > 250) { doc.addPage(); y = 30; }
      const hasItbis = item.itbis !== false;
      const lineItbis = hasItbis ? item.line_itbis || (item.quantity * item.unit_cost * 0.18) : 0;
      const lineTotal = item.line_total + lineItbis;
      doc.text(item.products?.name || "—", colX[0], y);
      doc.text(String(item.quantity), colX[1], y, { align: "center" });
      doc.text(formatCurrency(item.unit_cost), colX[2], y, { align: "center" });
      doc.text(formatCurrency(lineItbis), colX[3], y, { align: "center" });
      doc.text(formatCurrency(item.line_total), colX[4], y, { align: "center" });
      doc.text(formatCurrency(lineTotal), colX[5], y, { align: "right" });
      y += 7;
    });

    y += 4;
    drawLine(margin, y, pageW - margin, y, "#E8E0D8");
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    setTextColor("#5C3E35");
    doc.text("Subtotal:", pageW - margin - 60, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(purchase.subtotal), pageW - margin, y, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "bold");
    setTextColor("#5C3E35");
    doc.text("Impuesto Recogida:", pageW - margin - 60, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(purchase.impuesto_recogida || 0), pageW - margin, y, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "bold");
    setTextColor("#5C3E35");
    doc.text("Cargo Admin.:", pageW - margin - 60, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(purchase.cargo_administracion || 0), pageW - margin, y, { align: "right" });
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("ITBIS (18%):", pageW - margin - 60, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(formatCurrency(purchase.itbis || 0), pageW - margin, y, { align: "right" });
    y += 7;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setTextColor("#B8837E");
    doc.text("TOTAL:", pageW - margin - 60, y, { align: "right" });
    doc.text(formatCurrency(purchase.total), pageW - margin, y, { align: "right" });

    y += 20;
    drawLine(margin, y, pageW - margin, y, "#E8E0D8");
    y += 8;
    setTextColor("#9C8A82");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Documento generado por ${settings?.business_name || "Almaia RD"}`, margin, y);
    doc.setFontSize(8);
    setTextColor("#B8837E");
    doc.text(`${settings?.business_name || "Almaia RD"} - ${formatDate(new Date().toISOString())}`, pageW - margin, y, { align: "right" });

    doc.save(`COMPRA-${purchase.purchase_number}.pdf`);
  }

  async function handleDownloadJpg(purchase: any) {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const tmpDiv = document.createElement("div");
      tmpDiv.style.cssText = "position:fixed;left:-9999px;top:0;background:white;padding:32px;font-family:system-ui;width:600px;";
      tmpDiv.innerHTML = `
        <div style="color:#5C3E35;">
          <h2 style="font-size:22px;font-weight:bold;margin:0;">COMPRA</h2>
          <p style="font-size:10px;color:#9C8A82;margin:2px 0 16px;">No. ${purchase.purchase_number}</p>
          <hr style="border-color:#E8E0D8;margin-bottom:8px;"/>
          <p style="font-size:10px;"><b>Fecha:</b> ${formatDate(purchase.purchase_date)} &nbsp;&nbsp; <b>Proveedor:</b> ${purchase.supplier_name || "—"}</p>
          <hr style="border-color:#E8E0D8;margin:8px 0;"/>
          <table style="width:100%;font-size:9px;border-collapse:collapse;">
            <thead><tr style="background:#F0EBE3;"><th style="text-align:left;padding:4px;">Producto</th><th style="text-align:center;padding:4px;">Cant.</th><th style="text-align:center;padding:4px;">Costo U.</th><th style="text-align:center;padding:4px;">ITBIS</th><th style="text-align:right;padding:4px;">Total</th></tr></thead>
            <tbody>${(purchase.purchase_items || []).map((item: any) => {
              const hasItbis = item.itbis !== false;
              const lineItbis = hasItbis ? item.line_itbis || (item.quantity * item.unit_cost * 0.18) : 0;
              const lineTotal = item.line_total + lineItbis;
              return `<tr><td style="padding:4px;">${item.products?.name || "—"}</td><td style="text-align:center;padding:4px;">${item.quantity}</td><td style="text-align:center;padding:4px;">${formatCurrency(item.unit_cost)}</td><td style="text-align:center;padding:4px;">${formatCurrency(lineItbis)}</td><td style="text-align:right;padding:4px;font-weight:bold;">${formatCurrency(lineTotal)}</td></tr>`;
            }).join("")}</tbody>
          </table>
          <hr style="border-color:#E8E0D8;margin:8px 0;"/>
          <div style="text-align:right;font-size:10px;">
            <p>Subtotal: ${formatCurrency(purchase.subtotal)}</p>
            <p>Impuesto Recogida: ${formatCurrency(purchase.impuesto_recogida || 0)}</p>
            <p>Cargo Admin.: ${formatCurrency(purchase.cargo_administracion || 0)}</p>
            <p>ITBIS (18%): ${formatCurrency(purchase.itbis || 0)}</p>
            <p style="font-size:12px;font-weight:bold;color:#B8837E;">TOTAL: ${formatCurrency(purchase.total)}</p>
          </div>
        </div>`;
      document.body.appendChild(tmpDiv);
      const canvas = await html2canvas(tmpDiv, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      document.body.removeChild(tmpDiv);
      const link = document.createElement("a");
      link.download = `COMPRA-${purchase.purchase_number}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
      toast.success("JPG descargado");
    } catch {
      toast.error("Error al generar JPG");
    }
    setOpenDownloadId(null);
  }

  async function handleViewPurchase(id: string) {
    try {
      const pur = await getPurchase(id);
      setDetailPurchase(pur);
      setShowDetailPurchase(true);
    } catch {
      toast.error("Error al cargar la compra");
    }
    setOpenDownloadId(null);
  }

  const [purchaseForm, setPurchaseForm] = useState({
    supplier_name: "",
    purchase_date: getLocalDateString(),
    notes: "",
    discount_amount: 0,
    impuesto_recogida: 36,
    cargo_administracion: 200,
    payment_method: "Efectivo",
    bank_account_id: "",
    items: [] as { product_id: string; name: string; quantity: number; unit_cost: number; itbis?: boolean }[],
  });

  const productFiltered = useMemo(() =>
    products.filter(p => p.active && (!productSearch || normalize(p.name).includes(normalize(productSearch)) || (p.code && normalize(p.code).includes(normalize(productSearch))))),
    [products, productSearch]
  );

  const purchaseSubtotal = purchaseForm.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
  const purchaseLineItbis = purchaseForm.items.reduce((s, i) => s + ((i.itbis !== false ? 1 : 0) * i.quantity * i.unit_cost * 0.18), 0);
  const purchaseItbis = Math.round(purchaseLineItbis * 100) / 100;
  const purchaseRecogida = Number(purchaseForm.impuesto_recogida) || 0;
  const purchaseAdmin = Number(purchaseForm.cargo_administracion) || 0;
  const purchaseTotal = purchaseSubtotal + purchaseRecogida + purchaseAdmin + purchaseItbis - purchaseForm.discount_amount;

  function addProductToPurchase(product: any) {
    if (purchaseForm.items.some(i => i.product_id === product.id)) {
      toast.error("El producto ya está en la lista");
      return;
    }
    const isNutrilite = product.subbrands?.name === "Nutrilite";
    const defaultItbis = isNutrilite ? Boolean(settings?.nutrilite_itbis_enabled) : true;
    setPurchaseForm({
      ...purchaseForm,
      items: [...purchaseForm.items, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_cost: product.cost || 0,
        itbis: defaultItbis,
      }],
    });
    setShowProductSearch(false);
    setProductSearch("");
  }

  function removePurchaseItem(index: number) {
    setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.filter((_, i) => i !== index) });
  }

  function updatePurchaseItem(index: number, field: string, value: any) {
    const items = [...purchaseForm.items];
    (items[index] as any)[field] = value;
    setPurchaseForm({ ...purchaseForm, items });
  }

  useEffect(() => { load(); }, []);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("nueva-compra") === "true") {
      resetPurchaseForm();
      setShowPurchase(true);
      router.replace("/inventario");
    }
  }, [searchParams]);

  async function load() {
    try {
      const [inv, pro, sold, purchased, sup, ba, st] = await Promise.all([
        getInventory(),
        getProducts(),
        getSoldQuantities(),
        getPurchasedQuantities(),
        getSuppliers(),
        getBankAccounts(),
        getSettings().catch(() => null),
      ]);
      setInventory(inv);
      setProducts(pro);
      setSoldMap(sold);
      setPurchasedMap(purchased);
      setSuppliers(sup);
      setBankAccounts(ba);
      setSettings(st);
    } catch {
      toast.error("Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }

  async function loadRotation() {
    setRotationLoading(true);
    try {
      const [inv, sold, purchased, lastSales, lastPurchases, firstPurchases] = await Promise.all([
        getInventory(),
        getSoldQuantities(),
        getPurchasedQuantities(),
        getLastSalePerProduct(),
        getLastPurchasePerProduct(),
        getFirstPurchasePerProduct(),
      ]);

      const now = new Date();

      const data = inv.map((item: any) => {
        const product = item.products;
        const itemSold = sold[item.product_id] || 0;
        const itemPurchased = purchased[item.product_id] || 0;
        const stock = Math.max(0, itemPurchased - itemSold);
        const cost = product?.cost || 0;
        const lastSale = lastSales[item.product_id];
        const lastPurchase = lastPurchases[item.product_id];
        const firstPurchase = firstPurchases[item.product_id];
        
        let diasEnInventario = 0;
        let ultimaReferencia = "";
        
        if (lastSale) {
          const diff = now.getTime() - new Date(lastSale).getTime();
          diasEnInventario = Math.floor(diff / (1000 * 60 * 60 * 24));
          ultimaReferencia = `Venta: ${formatDate(lastSale)}`;
        } else if (lastPurchase) {
          const diff = now.getTime() - new Date(lastPurchase).getTime();
          diasEnInventario = Math.floor(diff / (1000 * 60 * 60 * 24));
          ultimaReferencia = `Compra: ${formatDate(lastPurchase)}`;
        } else {
          diasEnInventario = 999;
          ultimaReferencia = "Sin movimientos";
        }

        // Velocidad real: días desde la primera compra / total vendido
        let diasDesdeAdquisicion = 0;
        let velocidadDias = 0;
        if (firstPurchase) {
          diasDesdeAdquisicion = Math.floor((now.getTime() - new Date(firstPurchase).getTime()) / (1000 * 60 * 60 * 24));
          if (itemSold > 0 && diasDesdeAdquisicion > 0) {
            velocidadDias = Math.round(diasDesdeAdquisicion / itemSold);
          }
        }

        return {
          id: item.id,
          product_id: item.product_id,
          products: item.products,
          code: product?.code || "",
          name: product?.name || "—",
          subbrand: product?.subbrands?.name || "—",
          sold: itemSold,
          purchased: itemPurchased,
          stock,
          costoPromedio: cost,
          cost,
          firstPurchase,
          last_purchase: lastPurchase,
          last_sale: lastSale,
          diasEnInventario,
          ultimaReferencia,
          velocidadDias,
          inventory_value: item.inventory_value || 0,
          minimum_stock: item.minimum_stock || 3,
        };
      });

      setRotationData(data);
    } catch (err) {
      console.error("[loadRotation] Error:", err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      toast.error(`Error al cargar rotación: ${msg}`);
    } finally {
      setRotationLoading(false);
    }
  }

  async function loadPurchases() {
    try {
      const data = await getPurchases();
      setPurchases(data);
    } catch {
      toast.error("Error al cargar compras");
    }
  }

  useEffect(() => {
    if (activeTab === "history") loadPurchases();
    if (activeTab === "rotation") loadRotation();
  }, [activeTab]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openDownloadId && !(e.target as Element).closest(".relative")) setOpenDownloadId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDownloadId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showConfirmDeleteProduct && !(e.target as Element).closest(".relative")) setShowConfirmDeleteProduct(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showConfirmDeleteProduct]);

  const filtered = inventory.filter((item) => {
    if (!showHiddenStock && hiddenStockIds.includes(item.product_id)) return false;
    const fSold = soldMap[item.product_id] || 0;
    const fPurchased = purchasedMap[item.product_id] || 0;
    const fStock = Math.max(0, fPurchased - fSold);
    const fPending = Math.max(0, fSold - fPurchased);
    if (fStock <= 0 && fPending <= 0) return false;
    if (!searchQuery) return true;
    const q = normalize(searchQuery);
    return (
      normalize(item.products?.name || "").includes(q) ||
      normalize(item.products?.code || "").includes(q) ||
      normalize(item.products?.subbrands?.name || "").includes(q)
    );
  });

  const totalValue = inventory.reduce((s, i) => s + Number(i.inventory_value || 0), 0);
  const totalStock = inventory.reduce((s, i) => { const p = purchasedMap[i.product_id]||0; const sd = soldMap[i.product_id]||0; return s + Math.max(0, p - sd); }, 0);
  const totalPending = inventory.reduce((s, i) => { const p = purchasedMap[i.product_id]||0; const sd = soldMap[i.product_id]||0; return s + Math.max(0, sd - p); }, 0);

  async function openDetail(item: any) {
    setDetailItem(item);
    setDetailMinStock(item.minimum_stock);
    setDetailMovements([]);
    setShowDetail(true);
    try {
      const movs = await getInventoryMovements(item.product_id);
      setDetailMovements(movs);
    } catch {
      // silent
    }
  }

  async function handleSaveMinStock() {
    if (!detailItem) return;
    try {
      await updateMinimumStock(detailItem.product_id, detailMinStock);
      toast.success("Stock mínimo actualizado");
      const inv = await getInventory();
      setInventory(inv);
      setDetailItem(inv.find((i: any) => i.id === detailItem.id));
    } catch {
      toast.error("Error al actualizar");
    }
  }

  async function handleDeleteProduct(productId: string) {
    setDeletingProduct(true);
    try {
      const usage = await getProductUsage(productId);
      if (usage.movements > 0 || usage.invoices > 0 || usage.purchases > 0) {
        setProductUsage(usage);
        setDeletingProduct(false);
        return;
      }
      await deleteProduct(productId);
      toast.success("Producto eliminado exitosamente");
      setShowConfirmDeleteProduct(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar el producto");
      setDeletingProduct(false);
    }
  }

  const toggleHideStockProduct = (productId: string) => {
    const wasHidden = hiddenStockIds.includes(productId);
    setHiddenStockIds((prev) => {
      const updated = wasHidden
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem("hiddenStockIds", JSON.stringify(updated));
      return updated;
    });
    toast.success(wasHidden ? "Producto visible en Stock" : "Ocultado de Stock");
  };

  const toggleHideRotationProduct = (productId: string) => {
    const wasHidden = hiddenRotationIds.includes(productId);
    setHiddenRotationIds((prev) => {
      const updated = wasHidden
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem("hiddenRotationIds", JSON.stringify(updated));
      return updated;
    });
    toast.success(wasHidden ? "Producto visible en Rotación" : "Ocultado de Rotación");
  };

  async function handleForceDeleteProduct(productId: string) {
    setDeletingProduct(true);
    try {
      await forceDeleteProduct(productId);
      toast.success("Producto eliminado forzosamente (incluyendo registros relacionados)");
      setShowConfirmDeleteProduct(null);
      setProductUsage(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    } finally {
      setDeletingProduct(false);
    }
  }

  function resetPurchaseForm() {
    setPurchaseForm({ supplier_name: "", purchase_date: getLocalDateString(), notes: "", discount_amount: 0, impuesto_recogida: 36, cargo_administracion: 200, payment_method: "Efectivo", bank_account_id: "", items: [] });
    setEditingId(null);
  }

  function openEditPurchase(pur: any) {
    setEditingId(pur.id);
    setPurchaseForm({
      supplier_name: pur.supplier_name || "",
      purchase_date: pur.purchase_date,
      notes: pur.notes || "",
      discount_amount: pur.discount_amount || 0,
      impuesto_recogida: pur.impuesto_recogida ?? 36,
      cargo_administracion: pur.cargo_administracion ?? 200,
      payment_method: pur.payment_method || "Efectivo",
      bank_account_id: pur.bank_account_id || "",
      items: (pur.purchase_items || []).map((i: any) => ({
        product_id: i.product_id,
        name: i.products?.name || "—",
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        itbis: i.itbis !== false,
      })),
    });
    setShowPurchase(true);
  }

  async function handlePurchase() {
    if (!purchaseForm.purchase_date) { toast.error("Selecciona la fecha"); return; }
    if (purchaseForm.items.length === 0) { toast.error("Agrega al menos un producto"); return; }
    setSaving(true);
    try {
      const payload = {
        supplier_name: purchaseForm.supplier_name,
        purchase_date: purchaseForm.purchase_date,
        notes: purchaseForm.notes,
        discount_amount: purchaseForm.discount_amount,
        impuesto_recogida: Number(purchaseForm.impuesto_recogida) || 36,
        cargo_administracion: Number(purchaseForm.cargo_administracion) || 200,
        payment_method: purchaseForm.payment_method,
        bank_account_id: purchaseForm.bank_account_id || undefined,
        items: purchaseForm.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost, itbis: i.itbis })),
      };
      if (editingId) {
        await updatePurchase(editingId, payload);
        toast.success("Compra actualizada exitosamente");
      } else {
        await createPurchase(payload);
        toast.success("Compra registrada exitosamente");
      }
      setShowPurchase(false);
      resetPurchaseForm();
      await load();
      if (activeTab === "history") loadPurchases();
    } catch (e) {
      toast.error(`Error: ${(e as any)?.message || "Error al registrar compra"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePurchase(id: string) {
    try {
      await deletePurchase(id);
      toast.success("Compra eliminada");
      setShowConfirmDelete(null);
      loadPurchases();
    } catch {
      toast.error("Error al eliminar la compra");
    }
  }

  const movementLabel: Record<string, string> = {
    PURCHASE: "Compra",
    SALE: "Venta",
    ADJUSTMENT: "Ajuste",
    RETURN: "Devolución",
    CANCELLATION: "Cancelación",
  };

  const movementColor: Record<string, string> = {
    PURCHASE: "text-green-600",
    SALE: "text-red-500",
    ADJUSTMENT: "text-yellow-600",
    RETURN: "text-blue-500",
    CANCELLATION: "text-gray-500",
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#5C3E35]">Inventario</h1>
          <p className="text-sm text-[#9C8A82] mt-1">Control de existencias y stock</p>
        </div>
        <button
          onClick={() => { resetPurchaseForm(); setShowPurchase(true); }}
          className="flex items-center gap-2 bg-[#B8837E] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm"
        >
          <Plus size={18} />
          Registrar Compra
        </button>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Total Productos</p>
          <p className="text-xl font-bold text-[#5C3E35]">{inventory.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Valor Inventario</p>
          <p className="text-xl font-bold text-[#5C3E35]">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Stock Total</p>
          <p className="text-xl font-bold text-[#5C3E35]">{totalStock}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Pend. Devolución</p>
          <p className="text-xl font-bold text-[#D4A0A0]">{totalPending}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E8E0D8] mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("stock")}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === "stock"
                ? "text-[#B8837E] border-b-2 border-[#B8837E]"
                : "text-[#9C8A82] hover:text-[#5C3E35]"
            }`}
          >
            Existencias de Stock
          </button>
          <button
            onClick={() => setActiveTab("rotation")}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === "rotation"
                ? "text-[#B8837E] border-b-2 border-[#B8837E]"
                : "text-[#9C8A82] hover:text-[#5C3E35]"
            }`}
          >
            Rotación de Inventario
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === "history"
                ? "text-[#B8837E] border-b-2 border-[#B8837E]"
                : "text-[#9C8A82] hover:text-[#5C3E35]"
            }`}
          >
            Compras Registradas
          </button>
        </div>
      </div>

      {/* Search & controls */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, código o submarca..."
            className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] placeholder-[#9C8A82] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
          />
        </div>
        {activeTab === "stock" && (
          <button
            onClick={() => setShowHiddenStock(!showHiddenStock)}
            className={`flex items-center gap-2 h-12 px-4 rounded-xl text-sm font-medium border transition-all ${
              showHiddenStock
                ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]"
                : "border-[#E8E0D8] text-[#9C8A82] hover:text-[#5C3E35]"
            }`}
          >
            <EyeOff size={16} />
            {showHiddenStock ? "Ocultar ocultos" : `Ver ocultos (${hiddenStockIds.length})`}
          </button>
        )}
        {activeTab === "rotation" && (
          <button
            onClick={() => setShowHiddenRotation(!showHiddenRotation)}
            className={`flex items-center gap-2 h-12 px-4 rounded-xl text-sm font-medium border transition-all ${
              showHiddenRotation
                ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]"
                : "border-[#E8E0D8] text-[#9C8A82] hover:text-[#5C3E35]"
            }`}
          >
            <EyeOff size={16} />
            {showHiddenRotation ? "Ocultar ocultos" : `Ver ocultos (${hiddenRotationIds.length})`}
          </button>
        )}
      </div>

      {activeTab === "history" && (
        <div className="flex gap-3 mb-6">
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
            <option value="">Todos los meses</option>
            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
              <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30">
            <option value="">Todos los años</option>
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {(filterMonth || filterYear) && (
            <button onClick={() => { setFilterMonth(""); setFilterYear(""); }} className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3">Limpiar filtros</button>
          )}
        </div>
      )}

      {activeTab === "stock" && (
        <>
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Package size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay productos en inventario</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Submarca</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Producto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Compradas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Vendidas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Pend. Dev.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Mov.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Ocultar</th>
                  </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const sold = soldMap[item.product_id] || 0;
                  const purchased = purchasedMap[item.product_id] || 0;
                  const computedStock = Math.max(0, purchased - sold);
                  const computedPending = Math.max(0, sold - purchased);
                  const status = getStockStatus(computedStock, item.minimum_stock);
                  return (
                    <tr
                      key={item.id}
                      className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => openDetail(item)}
                    >
                      <td className="px-4 py-3.5 text-sm text-[#9C8A82]">{item.products?.subbrands?.name || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-[#5C3E35] font-medium">
                        {item.products?.name || "—"}
                        <span className="ml-2 text-xs text-[#9C8A82]">{item.products?.code}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right">{purchased || "—"}</td>
                      <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right">{sold}</td>
                      <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{computedStock}</td>
                      <td className="px-4 py-3.5 text-sm text-[#D4A0A0] text-right font-medium">{computedPending}</td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <History size={14} className="text-[#9C8A82] mx-auto" />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleHideStockProduct(item.product_id);
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                              hiddenStockIds.includes(item.product_id)
                                ? "bg-[#B8837E]/10 text-[#B8837E]"
                                : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
                            }`}
                          >
                            <EyeOff size={12} className="inline mr-1" />
                            {hiddenStockIds.includes(item.product_id) ? "Mostrar" : "Ocultar"}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowConfirmDeleteProduct(item.product_id);
                            }}
                            className="p-1.5 text-[#D4A0A0] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Eliminar producto"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </>
      )}

      {activeTab === "rotation" && (
        <div className="space-y-6">
          {rotationLoading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
          ) : rotationData.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Package size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay datos de rotación</p>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">Total Productos</p>
                  <p className="text-xl font-bold text-[#5C3E35]">{rotationData.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">Rotación Alta (&lt; 15d)</p>
                  <p className="text-xl font-bold text-[#86C7A3]">
                    {rotationData.filter((d: any) => d.diasEnInventario < 15 && d.diasEnInventario < 999).length}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">Rotación Media (15-60d)</p>
                  <p className="text-xl font-bold text-[#E8C87A]">
                    {rotationData.filter((d: any) => d.diasEnInventario >= 15 && d.diasEnInventario <= 60).length}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">{'Rotación Baja (> 60d)'}</p>
                  <p className="text-xl font-bold text-[#D4A0A0]">
                    {rotationData.filter((d: any) => d.diasEnInventario > 60 && d.diasEnInventario < 999).length}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">Próximos a agotarse</p>
                  <p className="text-xl font-bold text-red-500">
                    {rotationData.filter((d: any) => {
                      if (d.sold <= 0 || d.stock <= 0) return false;
                      return d.velocidadDias > 0 && Math.round(d.velocidadDias * d.stock) < 30;
                    }).length}
                  </p>
                </div>
              </div>

              {/* Capital Inmovilizado Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">{'Inmovilizado > 30 días'}</p>
                  <p className="text-lg font-bold text-[#E8C87A]">
                    {rotationData
                      .filter((d: any) => d.diasEnInventario > 30 && d.diasEnInventario < 999)
                      .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0)
                      .toLocaleString()} RD$
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">{'Inmovilizado > 60 días'}</p>
                  <p className="text-lg font-bold text-[#D4A0A0]">
                    {rotationData
                      .filter((d: any) => d.diasEnInventario > 60 && d.diasEnInventario < 999)
                      .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0)
                      .toLocaleString()} RD$
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                  <p className="text-xs text-[#9C8A82] mb-1">{'Inmovilizado > 90 días'}</p>
                  <p className="text-lg font-bold text-red-600">
                    {rotationData
                      .filter((d: any) => d.diasEnInventario > 90 && d.diasEnInventario < 999)
                      .reduce((s: number, d: any) => s + (d.costoPromedio || 0) * (d.stock || 0), 0)
                      .toLocaleString()} RD$
                  </p>
                </div>
              </div>

              {/* Recommendations Card */}
              {(() => {
                const staleProducts = rotationData.filter((d: any) => d.diasEnInventario > 90 && d.diasEnInventario < 999);
                const nearStockout = rotationData.filter((d: any) => {
                  if (d.sold <= 0 || d.stock <= 0 || !d.velocidadDias) return false;
                  return Math.round(d.velocidadDias * d.stock) < 30;
                });
                if (staleProducts.length === 0 && nearStockout.length === 0) return null;
                return (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle size={18} className="text-[#E8C87A]" />
                      <h3 className="text-sm font-bold text-[#5C3E35]">Recomendaciones Automáticas</h3>
                    </div>
                    <div className="space-y-2">
                      {staleProducts.map((d: any) => (
                        <div key={d.product_id} className="flex items-center justify-between bg-[#FAF6F0] rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <TrendingDown size={16} className="text-[#D4A0A0]" />
                            <span className="text-sm text-[#5C3E35]">{d.name}</span>
                            <span className="text-xs text-[#9C8A82]">{d.code}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="danger">{d.diasEnInventario} días sin vender</Badge>
                            <span className="text-xs text-[#E8C87A] font-medium">Sugerir oferta / liquidar</span>
                          </div>
                        </div>
                      ))}
                      {nearStockout.map((d: any) => (
                        <div key={d.product_id} className="flex items-center justify-between bg-[#FAF6F0] rounded-xl px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <TrendingUp size={16} className="text-[#86C7A3]" />
                            <span className="text-sm text-[#5C3E35]">{d.name}</span>
                            <span className="text-xs text-[#9C8A82]">{d.code}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="danger">Stock bajo</Badge>
                            <span className="text-xs text-[#86C7A3] font-medium">Reponer inventario pronto</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* AI Analysis Button & Result */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-[#B8837E]" />
                    <h3 className="text-sm font-bold text-[#5C3E35]">Análisis de Rotación con IA</h3>
                  </div>
                  <button
                    onClick={async () => {
                      setRotationAiLoading(true);
                      setRotationAiAnalysis(null);
                      try {
                        const res = await fetch("/api/inventory-analysis", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ rotationData }),
                        });
                        const data = await res.json();
                        setRotationAiAnalysis(data.analysis || "Sin respuesta");
                      } catch {
                        toast.error("Error al analizar con IA");
                      } finally {
                        setRotationAiLoading(false);
                      }
                    }}
                    disabled={rotationAiLoading}
                    className="flex items-center gap-2 h-9 px-4 bg-[#B8837E] text-white rounded-xl text-xs font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50"
                  >
                    {rotationAiLoading ? <Loader size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                    {rotationAiLoading ? "Analizando..." : "Analizar con IA"}
                  </button>
                </div>
                {rotationAiAnalysis && (
                  <div className="bg-[#FAF6F0] rounded-xl p-4 text-sm text-[#5C3E35] whitespace-pre-line leading-relaxed">
                    {rotationAiAnalysis}
                  </div>
                )}
                {!rotationAiAnalysis && !rotationAiLoading && (
                  <p className="text-xs text-[#9C8A82]">Haz clic en "Analizar con IA" para obtener recomendaciones inteligentes sobre la rotación de inventario.</p>
                )}
              </div>

              {/* Filters & Export */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={rotationFilterSubbrand}
                  onChange={(e) => setRotationFilterSubbrand(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  <option value="">Todas las submarcas</option>
                  {[...new Set(rotationData.map((d: any) => d.subbrand).filter(Boolean))].map((s) => (
                    <option key={s as string} value={s as string}>{s as string}</option>
                  ))}
                </select>
                <select
                  value={rotationFilterDays}
                  onChange={(e) => setRotationFilterDays(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  <option value="">Todos los días</option>
                  <option value="0-15">Rotación alta (0-15 días)</option>
                  <option value="15-60">Rotación media (15-60 días)</option>
                  <option value="60-999">Rotación baja (60+ días)</option>
                  <option value="90-999">Crítico (90+ días)</option>
                </select>
                <select
                  value={rotationFilterStatus}
                  onChange={(e) => setRotationFilterStatus(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-[#E8E0D8] bg-white text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30"
                >
                  <option value="">Estado</option>
                  <option value="success">Rotación alta</option>
                  <option value="warning">Rotación media</option>
                  <option value="danger">Rotación baja / Sin mov.</option>
                </select>
                {(rotationFilterSubbrand || rotationFilterDays || rotationFilterStatus) && (
                  <button
                    onClick={() => { setRotationFilterSubbrand(""); setRotationFilterDays(""); setRotationFilterStatus(""); }}
                    className="text-xs text-[#9C8A82] hover:text-[#5C3E35] px-3"
                  >
                    Limpiar filtros
                  </button>
                )}
                <div className="ml-auto relative">
                  <button
                    onClick={() => setRotationExportOpen(!rotationExportOpen)}
                    className="flex items-center gap-2 h-10 px-4 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
                  >
                    <Download size={16} /> Exportar
                  </button>
                  {rotationExportOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setRotationExportOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-[#E8E0D8] py-1 z-20">
                        <button
                          onClick={() => {
                            setRotationExportOpen(false);
                            const doc = new jsPDF({ unit: "mm", format: "letter" });
                            const pageW = 216;
                            let y = 20;
                            const margin = 15;
                            doc.setFontSize(16);
                            doc.setFont("helvetica", "bold");
                            doc.text("Reporte de Rotación de Inventario", margin, y);
                            y += 8;
                            doc.setFontSize(8);
                            doc.setFont("helvetica", "normal");
                            doc.text(`Generado: ${new Date().toLocaleDateString()}`, margin, y);
                            y += 8;
                            const cols = ["Producto", "Código", "Submarca", "Stock", "Días", "Velocidad", "Proy.Agot.", "Estado", "Capital"];
                            const widths = [40, 18, 22, 12, 12, 18, 18, 22, 22];
                            const startX = margin;
                            doc.setFontSize(7);
                            doc.setFont("helvetica", "bold");
                            let cx = startX;
                            cols.forEach((c, i) => {
                              doc.text(c, cx + (i > 0 ? widths[i] / 2 : 0), y, i > 0 ? { align: "center" } : undefined);
                              cx += widths[i];
                            });
                            y += 5;
                            doc.setFont("helvetica", "normal");
                            rotationData.forEach((item: any) => {
                              if (y > 270) { doc.addPage(); y = 20; }
                              const proy = item.velocidadDias > 0 && item.stock > 0 ? Math.round(item.velocidadDias * item.stock) : null;
                              const el = item.diasEnInventario >= 999 ? "Sin mov." :
                                item.diasEnInventario <= 15 ? "Alta" :
                                item.diasEnInventario <= 60 ? "Media" : "Baja";
                              const cap = ((item.costoPromedio || 0) * (item.stock || 0)).toLocaleString();
                              const vals = [
                                item.name?.substring(0, 20) || "—",
                                item.code || "",
                                item.subbrand?.substring(0, 15) || "—",
                                String(item.stock || 0),
                                item.diasEnInventario >= 999 ? "—" : String(item.diasEnInventario),
                                item.velocidadDias > 0 ? `${item.velocidadDias}d/v` : "Sin vtas",
                                proy ? `${proy}d` : "—",
                                el,
                                `${cap} RD$`,
                              ];
                              cx = startX;
                              vals.forEach((v, i) => {
                                doc.text(v, cx + (i > 0 ? widths[i] / 2 : 0), y, i > 0 ? { align: "center" } : undefined);
                                cx += widths[i];
                              });
                              y += 4;
                            });
                            doc.save("Reporte-Rotacion-Inventario.pdf");
                            toast.success("PDF descargado");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]"
                        >
                          <FileText size={14} /> Exportar PDF
                        </button>
                        <button
                          onClick={() => {
                            setRotationExportOpen(false);
                            const headers = ["Producto", "Código", "Submarca", "Stock", "Días en Inv.", "Velocidad", "Proy. Agot.", "Estado", "Capital"];
                            const rows = rotationData.map((item: any) => {
                              const proy = item.velocidadDias > 0 && item.stock > 0 ? `${Math.round(item.velocidadDias * item.stock)} días` : "—";
                              const el = item.diasEnInventario >= 999 ? "Sin movimientos" :
                                item.diasEnInventario <= 15 ? "Rotación alta" :
                                item.diasEnInventario <= 60 ? "Rotación media" : "Rotación baja";
                              const cap = ((item.costoPromedio || 0) * (item.stock || 0)).toLocaleString();
                              return [
                                item.name || "—",
                                item.code || "",
                                item.subbrand || "—",
                                String(item.stock || 0),
                                item.diasEnInventario >= 999 ? "—" : String(item.diasEnInventario),
                                item.velocidadDias > 0 ? `${item.velocidadDias} días/venta` : "Sin ventas",
                                proy,
                                el,
                                `${cap} RD$`,
                              ];
                            });
                            const csv = [headers.join(","), ...rows.map((r: string[]) => r.map(v => `"${v}"`).join(","))].join("\n");
                            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                            const link = document.createElement("a");
                            link.href = URL.createObjectURL(blob);
                            link.download = "Reporte-Rotacion-Inventario.csv";
                            link.click();
                            toast.success("CSV descargado");
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]"
                        >
                          <FileText size={14} /> Exportar CSV
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Rotation Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Submarca</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Producto</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Días en Inv.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Velocidad</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Proy. Agot.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Última Ref.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Recom.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Capital</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#9C8A82] uppercase tracking-wider">Ocultar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let filtered = rotationData.filter((d: any) => showHiddenRotation || !hiddenRotationIds.includes(d.product_id));
                      if (rotationFilterSubbrand) filtered = filtered.filter((d: any) => d.subbrand === rotationFilterSubbrand);
                      if (rotationFilterDays) {
                        const [min, max] = rotationFilterDays.split("-").map(Number);
                        filtered = filtered.filter((d: any) => d.diasEnInventario >= min && d.diasEnInventario <= max);
                      }
                      if (rotationFilterStatus) {
                        filtered = filtered.filter((d: any) => {
                          if (rotationFilterStatus === "success") return d.diasEnInventario <= 15;
                          if (rotationFilterStatus === "warning") return d.diasEnInventario > 15 && d.diasEnInventario <= 60;
                          if (rotationFilterStatus === "danger") return d.diasEnInventario > 60 || d.diasEnInventario >= 999;
                          return true;
                        });
                      }
                      return filtered
                        .sort((a: any, b: any) => b.diasEnInventario - a.diasEnInventario)
                        .map((item: any) => {
                          const velocidad = item.velocidadDias > 0
                            ? `${item.velocidadDias} días/venta`
                            : "Sin ventas";
                          const proyAgot = item.velocidadDias > 0 && item.stock > 0
                            ? Math.round(item.velocidadDias * item.stock)
                            : null;
                          const proyColor = proyAgot === null ? "text-[#9C8A82]" :
                            proyAgot < 30 ? "text-red-500" :
                            proyAgot < 60 ? "text-[#E8C87A]" : "text-[#86C7A3]";
                          const capital = ((item.costoPromedio || 0) * (item.stock || 0));
                          const estadoLabel = item.diasEnInventario >= 999 ? "Sin movimientos" :
                            item.diasEnInventario <= 15 ? "Rotación alta" :
                            item.diasEnInventario <= 60 ? "Rotación media" : "Rotación baja";
                          const estadoVariant = item.diasEnInventario >= 999 ? "danger" :
                            item.diasEnInventario <= 15 ? "success" :
                            item.diasEnInventario <= 60 ? "warning" : "danger";

                          // Auto-recommendations per row
                          const recoms: { label: string; variant: "success" | "warning" | "danger" }[] = [];
                          if (item.diasEnInventario > 90 && item.diasEnInventario < 999) recoms.push({ label: "Liquidar", variant: "danger" });
                          if (proyAgot !== null && proyAgot < 30) recoms.push({ label: "Reponer", variant: "warning" });
                          if (item.diasEnInventario >= 999) recoms.push({ label: "Sin mov.", variant: "danger" });

                          return (
                            <tr
                              key={item.id}
                              className="bg-white rounded-xl shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow cursor-pointer"
                              onClick={async () => {
                                setRotationDetailProductId(item.product_id);
                                setRotationDetailItem(item);
                                setRotationDetailLoading(true);
                                try {
                                  const movs = await getInventoryMovements(item.product_id);
                                  setRotationDetailMovements(movs);
                                } catch {
                                  setRotationDetailMovements([]);
                                } finally {
                                  setRotationDetailLoading(false);
                                }
                              }}
                            >
                              <td className="px-4 py-3.5 text-sm text-[#9C8A82]">{item.products?.subbrands?.name || "—"}</td>
                              <td className="px-4 py-3.5 text-sm text-[#5C3E35] font-medium">
                                {item.products?.name || "—"}
                                <span className="ml-2 text-xs text-[#9C8A82]">{item.products?.code}</span>
                              </td>
                              <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-center">{item.stock || 0}</td>
                              <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-center font-medium">
                                {item.diasEnInventario >= 999 ? "—" : item.diasEnInventario}
                              </td>
                              <td className="px-4 py-3.5 text-sm text-[#9C8A82] text-center">{velocidad}</td>
                              <td className={`px-4 py-3.5 text-sm text-center font-medium ${proyColor}`}>
                                {proyAgot === null ? "—" : `${proyAgot} días`}
                              </td>
                              <td className="px-4 py-3.5 text-sm text-[#9C8A82] text-center">{item.ultimaReferencia}</td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {recoms.length === 0 ? (
                                    <span className="text-xs text-[#9C8A82]">—</span>
                                  ) : recoms.map((r, i) => (
                                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                      r.variant === "danger" ? "bg-red-50 text-red-600" :
                                      r.variant === "warning" ? "bg-yellow-50 text-yellow-700" :
                                      "bg-green-50 text-green-600"
                                    }`}>{r.label}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <Badge variant={estadoVariant}>{estadoLabel}</Badge>
                              </td>
                              <td className="px-4 py-3.5 text-sm text-[#5C3E35] text-right font-medium">{capital.toLocaleString()} RD$</td>
                              <td className="px-4 py-3.5 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHideRotationProduct(item.product_id);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${
                                    hiddenRotationIds.includes(item.product_id)
                                      ? "bg-[#B8837E]/10 text-[#B8837E]"
                                      : "text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0]"
                                  }`}
                                >
                                  <EyeOff size={12} className="inline mr-1" />
                                  {hiddenRotationIds.includes(item.product_id) ? "Mostrar" : "Ocultar"}
                                </button>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Rotation detail modal */}
      <Modal isOpen={!!rotationDetailProductId} onClose={() => { setRotationDetailProductId(null); setRotationDetailItem(null); }} title={rotationDetailItem?.name || "Detalle del Producto"} wide>
        {rotationDetailLoading ? (
          <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-[#B8837E] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {rotationDetailItem && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Stock actual</p>
                    <p className="text-xl font-bold text-[#5C3E35]">{rotationDetailItem.stock || 0}</p>
                  </div>
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Días en inventario</p>
                    <p className="text-xl font-bold text-[#5C3E35]">
                      {rotationDetailItem.diasEnInventario >= 999 ? "—" : rotationDetailItem.diasEnInventario}
                    </p>
                  </div>
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Velocidad de venta</p>
                    <p className="text-xl font-bold text-[#5C3E35]">
                      {rotationDetailItem.velocidadDias > 0 ? `${rotationDetailItem.velocidadDias} días` : "—"}
                    </p>
                  </div>
                  <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                    <p className="text-xs text-[#9C8A82]">Proy. agotamiento</p>
                    <p className={`text-xl font-bold ${
                      rotationDetailItem.velocidadDias > 0 && rotationDetailItem.stock > 0
                        ? Math.round(rotationDetailItem.velocidadDias * rotationDetailItem.stock) < 30
                          ? "text-red-500" : "text-[#86C7A3]"
                        : "text-[#9C8A82]"
                    }`}>
                      {rotationDetailItem.velocidadDias > 0 && rotationDetailItem.stock > 0
                        ? `${Math.round(rotationDetailItem.velocidadDias * rotationDetailItem.stock)} días`
                        : "—"}
                    </p>
                  </div>
                </div>

                {/* Timeline info */}
                <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Última referencia</span>
                    <span className="text-[#5C3E35] font-medium">{rotationDetailItem.ultimaReferencia}</span>
                  </div>
                  {rotationDetailItem.firstPurchase && (
                    <div className="flex justify-between">
                      <span className="text-[#9C8A82]">Primera compra</span>
                      <span className="text-[#5C3E35] font-medium">{formatDate(rotationDetailItem.firstPurchase)}</span>
                    </div>
                  )}
                  {rotationDetailItem.last_purchase && (
                    <div className="flex justify-between">
                      <span className="text-[#9C8A82]">Última compra</span>
                      <span className="text-[#5C3E35] font-medium">{formatDate(rotationDetailItem.last_purchase)}</span>
                    </div>
                  )}
                  {rotationDetailItem.last_sale && (
                    <div className="flex justify-between">
                      <span className="text-[#9C8A82]">Última venta</span>
                      <span className="text-[#5C3E35] font-medium">{formatDate(rotationDetailItem.last_sale)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Total vendido</span>
                    <span className="text-[#5C3E35] font-medium">{rotationDetailItem.sold || 0} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Total comprado</span>
                    <span className="text-[#5C3E35] font-medium">{rotationDetailItem.purchased || 0} unidades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#9C8A82]">Capital inmovilizado</span>
                    <span className="text-[#5C3E35] font-medium">{((rotationDetailItem.costoPromedio || 0) * (rotationDetailItem.stock || 0)).toLocaleString()} RD$</span>
                  </div>
                </div>
              </>
            )}

            {/* Movements */}
            <div>
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Movimientos de inventario</h4>
              {rotationDetailMovements.length === 0 ? (
                <p className="text-sm text-[#9C8A82] py-4 text-center">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rotationDetailMovements.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className={`text-sm font-medium ${movementColor[m.movement_type] || ""}`}>
                          {movementLabel[m.movement_type] || m.movement_type}
                        </p>
                        {m.notes && <p className="text-xs text-[#9C8A82]">{m.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">
                          {m.movement_type === "PURCHASE" ? "+" : m.movement_type === "SALE" ? "-" : ""}
                          {m.quantity}
                        </p>
                        <p className="text-xs text-[#9C8A82]">{formatDate(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {activeTab === "history" && (
        <div className="space-y-3">
          {purchases.length === 0 ? (
            <div className="text-center py-16 text-[#9C8A82]">
              <Package size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No hay compras registradas</p>
            </div>
          ) : (
            purchases
              .filter((pur: any) => {
                if (filterMonth || filterYear) {
                  const d = new Date(pur.purchase_date);
                  if (filterMonth && String(d.getMonth() + 1).padStart(2, "0") !== filterMonth) return false;
                  if (filterYear && String(d.getFullYear()) !== filterYear) return false;
                }
                return true;
              })
              .map((pur: any) => (
              <div key={pur.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FAF6F0] flex items-center justify-center text-[#B8837E] shrink-0">
                      <span className="text-xs font-bold">{pur.purchase_number?.replace(settings?.purchase_prefix || "COM-", "")}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#5C3E35]">{pur.purchase_number}</p>
                      <p className="text-xs text-[#9C8A82]">{formatDate(pur.purchase_date)} {pur.supplier_name ? `· ${pur.supplier_name}` : ""}</p>
                    </div>
                  </div>
                   <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-[#5C3E35]">{formatCurrency(pur.total)}</p>
                    <div className="flex items-center gap-1 relative">
                      <button
                        onClick={() => openEditPurchase(pur)}
                        className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          generatePurchasePdfLocal(pur);
                          setOpenDownloadId(null);
                        }}
                        className="p-2 text-[#B8837E] hover:bg-[#B8837E]/10 rounded-lg transition-all"
                        title="Descargar PDF"
                      >
                        <Printer size={14} />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setOpenDownloadId(openDownloadId === pur.id ? null : pur.id)}
                          className="p-2 text-[#9C8A82] hover:text-[#5C3E35] hover:bg-[#FAF6F0] rounded-lg transition-all"
                          title="Más opciones"
                        >
                          <Download size={14} />
                        </button>
                        {openDownloadId === pur.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-[#E8E0D8] py-1 z-50">
                            <button onClick={() => { handleViewPurchase(pur.id); setOpenDownloadId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]">
                              <Eye size={14} /> Ver detalle
                            </button>
                            <button onClick={() => { generatePurchasePdfLocal(pur); setOpenDownloadId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]">
                              <Download size={14} /> Descargar PDF
                            </button>
                            <button onClick={() => handleDownloadJpg(pur)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#5C3E35] hover:bg-[#FAF6F0]">
                              <Download size={14} /> Descargar JPG
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setShowConfirmDelete(pur.id)}
                        className="p-2 text-[#D4A0A0] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {pur.purchase_items?.map((pi: any) => (
                    <div key={pi.id} className="flex items-center justify-between text-sm">
                      <span className="text-[#5C3E35]">{pi.products?.name || "Producto"}</span>
                      <span className="text-[#9C8A82]">{pi.quantity} x {formatCurrency(pi.unit_cost)}</span>
                    </div>
                  ))}
                </div>
                {(pur.discount_amount > 0 || pur.notes) && (
                  <div className="mt-2 pt-2 border-t border-[#E8E0D8] space-y-1 text-xs text-[#9C8A82]">
                    {pur.discount_amount > 0 && <p>Descuento: -{formatCurrency(pur.discount_amount)}</p>}
                    {pur.notes && <p>Notas: {pur.notes}</p>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Product detail modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={detailItem?.products?.name || "Detalle"} wide>
        {detailItem && (() => {
          const detSold = soldMap[detailItem.product_id] || 0;
          const detPurchased = purchasedMap[detailItem.product_id] || 0;
          const detStock = Math.max(0, detPurchased - detSold);
          const detPending = Math.max(0, detSold - detPurchased);
          const detStatus = getStockStatus(detStock, detailMinStock);
          const detCapital = (detailItem.products?.cost || 0) * detStock;
          const isHidden = hiddenStockIds.includes(detailItem.product_id);
          return (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#9C8A82]">{detailItem.products?.subbrands?.name} · {detailItem.products?.code}</p>
              </div>
              <Badge variant={detStatus.variant}>{detStatus.label}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Compradas</p>
                <p className="text-xl font-bold text-[#5C3E35]">{detPurchased || "—"}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Stock actual</p>
                <p className="text-xl font-bold text-[#5C3E35]">{detStock}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Pend. Dev.</p>
                <p className="text-xl font-bold text-[#D4A0A0]">{detPending}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Vendidas</p>
                <p className="text-xl font-bold text-[#5C3E35]">{detSold}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Capital</p>
                <p className="text-xl font-bold text-[#5C3E35]">{formatCurrency(detCapital)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-[#5C3E35] font-medium">Stock mínimo:</label>
              <input
                type="number" value={detailMinStock}
                onChange={(e) => setDetailMinStock(Math.max(0, Number(e.target.value)))}
                className="w-20 h-9 px-3 rounded-lg border border-[#E8E0D8] text-sm text-center"
              />
              <button onClick={handleSaveMinStock} className="h-9 px-3 bg-[#B8837E] text-white rounded-lg text-xs font-medium hover:bg-[#9A6B66] transition-all">
                <Save size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHideStockProduct(detailItem.product_id);
                  setShowDetail(false);
                }}
                className={`ml-auto flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
                  isHidden
                    ? "bg-[#B8837E]/10 border-[#B8837E] text-[#B8837E]"
                    : "border-[#E8E0D8] text-[#9C8A82] hover:text-[#5C3E35]"
                }`}
              >
                <EyeOff size={14} />
                {isHidden ? "Mostrar en stock" : "Ocultar de stock"}
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#5C3E35] mb-3">Movimientos</h4>
              {detailMovements.length === 0 ? (
                <p className="text-sm text-[#9C8A82] py-4 text-center">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detailMovements.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-[#E8E0D8]">
                      <div>
                        <p className={`text-sm font-medium ${movementColor[m.movement_type] || ""}`}>
                          {movementLabel[m.movement_type] || m.movement_type}
                        </p>
                        {m.notes && <p className="text-xs text-[#9C8A82]">{m.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#5C3E35]">
                          {m.movement_type === "PURCHASE" ? "+" : m.movement_type === "SALE" ? "-" : ""}
                          {m.quantity}
                        </p>
                        <p className="text-xs text-[#9C8A82]">{formatDate(m.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* Purchase modal */}
      <Modal isOpen={showPurchase} onClose={() => { setShowPurchase(false); resetPurchaseForm(); }} title={editingId ? "Editar Compra" : "Registrar Compra"} wide>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Fecha de la compra</label>
              <input
                type="date" value={purchaseForm.purchase_date}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Proveedor</label>
              <div className="relative">
                <input
                  type="text" value={purchaseForm.supplier_name}
                  onChange={(e) => { setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value }); setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  placeholder="Buscar o escribir proveedor..."
                  className="w-full h-12 pl-4 pr-10 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                />
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9C8A82] pointer-events-none" />
              </div>
              {showSupplierDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSupplierDropdown(false)} />
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-[#E8E0D8] shadow-lg max-h-48 overflow-y-auto">
                    {suppliers.filter(s => !supplierSearch || normalize(s.name).includes(normalize(supplierSearch))).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setPurchaseForm({ ...purchaseForm, supplier_name: s.name }); setShowSupplierDropdown(false); setSupplierSearch(""); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-[#5C3E35] hover:bg-[#FAF6F0] transition-colors flex justify-between"
                      >
                        <span>{s.name}</span>
                        {s.city && <span className="text-[#9C8A82] text-xs">{s.city}</span>}
                      </button>
                    ))}
                    {suppliers.filter(s => !supplierSearch || normalize(s.name).includes(normalize(supplierSearch))).length === 0 && (
                      <p className="px-4 py-3 text-sm text-[#9C8A82]">Sin resultados. Escribe para agregar uno nuevo.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Notas (opcional)</label>
            <textarea
              value={purchaseForm.notes}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
              placeholder="Notas adicionales..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Descuento (RD$)</label>
              <input
                type="number" step="0.01" min={0} value={purchaseForm.discount_amount}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, discount_amount: Number(e.target.value) })}
                placeholder="0"
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Forma de Pago</label>
              <select
                value={purchaseForm.payment_method}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_method: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              >
                <option>Efectivo</option>
                <option>Transferencia</option>
                <option>Tarjeta</option>
                <option>Cheque</option>
                <option>Otro</option>
              </select>
            </div>
          </div>

          {purchaseForm.payment_method === "Transferencia" && (
            <div>
              <label className="block text-sm font-medium text-[#5C3E35] mb-1.5">Cuenta Bancaria</label>
              <select
                value={purchaseForm.bank_account_id}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, bank_account_id: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-[#E8E0D8] bg-[#FCFAF7] text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
              >
                <option value="">Seleccionar banco...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.bank_name} — {b.account_type} — No. {b.account_number}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-[#5C3E35]">Productos</label>
              <button
                onClick={() => setShowProductSearch(!showProductSearch)}
                className="text-xs text-[#B8837E] hover:underline flex items-center gap-1"
              >
                <Plus size={14} />
                Agregar producto
              </button>
            </div>

            {showProductSearch && (
              <div className="mb-4 bg-[#FAF6F0] rounded-xl overflow-hidden">
                <div className="p-2">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9C8A82]" />
                    <input
                      type="text" value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar producto por nombre o código..."
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] placeholder:text-[#9C8A82] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30 focus:border-[#B8837E] transition-all"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-0.5">
                  {productFiltered.length === 0 ? (
                    <p className="text-sm text-[#9C8A82] py-3 text-center">Sin resultados</p>
                  ) : productFiltered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProductToPurchase(p)}
                      className="w-full text-left px-3 py-2 text-sm text-[#5C3E35] hover:bg-white rounded-lg transition-colors flex justify-between"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[#9C8A82] shrink-0 ml-2">{formatCurrency(p.cost || 0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {purchaseForm.items.length === 0 ? (
              <p className="text-sm text-[#9C8A82] py-3">No hay productos agregados</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {purchaseForm.items.map((item, i) => {
                  const lineSubtotal = item.quantity * item.unit_cost;
                  const hasItbis = item.itbis !== false;
                  const lineItbis = Math.round((hasItbis ? 1 : 0) * lineSubtotal * 0.18 * 100) / 100;
                  const lineTotal = lineSubtotal + lineItbis;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-[#FAF6F0] rounded-xl p-3">
                      <div className="flex-1 text-sm text-[#5C3E35] truncate">{item.name}</div>
                      <button
                        type="button"
                        onClick={() => updatePurchaseItem(i, "itbis", !hasItbis)}
                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${hasItbis ? "bg-[#B8837E]" : "bg-gray-300"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hasItbis ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                      <input
                        type="number" min={1} value={item.quantity}
                        onChange={(e) => updatePurchaseItem(i, "quantity", Math.max(1, Number(e.target.value)))}
                        className="w-16 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      />
                      <input
                        type="number" step="0.01" min={0} value={item.unit_cost}
                        onChange={(e) => updatePurchaseItem(i, "unit_cost", Number(e.target.value))}
                        className="w-24 h-9 px-2 rounded-lg border border-[#E8E0D8] text-center text-sm"
                      />
                      <span className="text-xs text-[#9C8A82] w-20 text-center">{formatCurrency(lineItbis)}</span>
                      <span className="text-sm font-medium text-[#5C3E35] w-24 text-right">{formatCurrency(lineTotal)}</span>
                      <button onClick={() => removePurchaseItem(i)} className="p-1 text-[#D4A0A0] hover:bg-white rounded-lg">
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#9C8A82]">Subtotal</span>
              <span className="text-[#5C3E35]">{formatCurrency(purchaseSubtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#9C8A82]">Impuesto de Recogida</span>
              <input type="number" step="0.01" value={purchaseForm.impuesto_recogida}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, impuesto_recogida: Number(e.target.value) })}
                className="w-24 h-7 px-2 text-right rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#9C8A82]">Cargo de Administración (Detalle)</span>
              <input type="number" step="0.01" value={purchaseForm.cargo_administracion}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, cargo_administracion: Number(e.target.value) })}
                className="w-24 h-7 px-2 text-right rounded-lg border border-[#E8E0D8] bg-white text-sm text-[#5C3E35] focus:outline-none focus:ring-2 focus:ring-[#B8837E]/30" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9C8A82]">ITBIS (18%)</span>
              <span className="text-[#5C3E35]">{formatCurrency(purchaseItbis)}</span>
            </div>
            {purchaseForm.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#D4A0A0]">Descuento</span>
                <span className="text-[#D4A0A0]">-{formatCurrency(purchaseForm.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-[#E8E0D8] pt-1.5 mt-1.5">
              <span>Total</span>
              <span className="text-[#B8837E]">{formatCurrency(purchaseTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowPurchase(false); resetPurchaseForm(); }} className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all">Cancelar</button>
            <button onClick={handlePurchase} disabled={saving} className="flex-1 h-12 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? "Guardando..." : "Registrar Compra"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail purchase modal */}
      <Modal isOpen={showDetailPurchase} onClose={() => { setShowDetailPurchase(false); setDetailPurchase(null); }} title={detailPurchase?.purchase_number || "Detalle"} wide>
        {detailPurchase && (
          <div className="space-y-5">
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Subtotal</p>
                <p className="text-lg font-bold text-[#5C3E35]">{formatCurrency(detailPurchase.subtotal)}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Recogida</p>
                <p className="text-lg font-bold text-[#5C3E35]">{formatCurrency(detailPurchase.impuesto_recogida || 0)}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Cargo Admin.</p>
                <p className="text-lg font-bold text-[#5C3E35]">{formatCurrency(detailPurchase.cargo_administracion || 0)}</p>
              </div>
              <div className="bg-[#FAF6F0] rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">ITBIS (18%)</p>
                <p className="text-lg font-bold text-[#5C3E35]">{formatCurrency(detailPurchase.itbis || 0)}</p>
              </div>
              <div className="bg-[#B8837E]/10 rounded-xl p-3 text-center">
                <p className="text-xs text-[#9C8A82]">Total</p>
                <p className="text-lg font-bold text-[#B8837E]">{formatCurrency(detailPurchase.total)}</p>
              </div>
            </div>

            <div className="bg-[#FAF6F0] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#9C8A82]">Fecha:</span><span className="text-[#5C3E35]">{formatDate(detailPurchase.purchase_date)}</span></div>
              <div className="flex justify-between"><span className="text-[#9C8A82]">Proveedor:</span><span className="text-[#5C3E35]">{detailPurchase.supplier_name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[#9C8A82]">Estado:</span><span className="text-[#5C3E35]">{detailPurchase.status}</span></div>
              {detailPurchase.discount_amount > 0 && <div className="flex justify-between"><span className="text-[#D4A0A0]">Descuento:</span><span className="text-[#D4A0A0]">-{formatCurrency(detailPurchase.discount_amount)}</span></div>}
              {(detailPurchase.impuesto_recogida || 0) > 0 && <div className="flex justify-between"><span className="text-[#9C8A82]">Impuesto Recogida:</span><span className="text-[#5C3E35]">{formatCurrency(detailPurchase.impuesto_recogida)}</span></div>}
              {(detailPurchase.cargo_administracion || 0) > 0 && <div className="flex justify-between"><span className="text-[#9C8A82]">Cargo Admin.:</span><span className="text-[#5C3E35]">{formatCurrency(detailPurchase.cargo_administracion)}</span></div>}
              {detailPurchase.notes && <div className="flex justify-between"><span className="text-[#9C8A82]">Notas:</span><span className="text-[#5C3E35]">{detailPurchase.notes}</span></div>}
            </div>

            <div>
              <p className="text-xs font-semibold text-[#9C8A82] uppercase mb-2">Productos</p>
              <div className="space-y-2">
                {(detailPurchase.purchase_items || []).map((pi: any) => {
                  const hasItbis = pi.itbis !== false;
                  const lineItbis = hasItbis ? pi.line_itbis || (pi.quantity * pi.unit_cost * 0.18) : 0;
                  const lineTotal = pi.line_total + lineItbis;
                  return (
                    <div key={pi.id} className="bg-white rounded-xl p-3 border border-[#E8E0D8] flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#5C3E35]">{pi.products?.name || "—"}</p>
                        <p className="text-xs text-[#9C8A82]">{pi.quantity} x {formatCurrency(pi.unit_cost)}{hasItbis ? ` + ITBIS ${formatCurrency(lineItbis)}` : " (sin ITBIS)"}</p>
                      </div>
                      <p className="text-sm font-bold text-[#5C3E35]">{formatCurrency(lineTotal)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowDetailPurchase(false); openEditPurchase(detailPurchase); }}
                className="flex-1 h-11 bg-[#B8837E] text-white rounded-xl text-sm font-medium hover:bg-[#9A6B66] transition-all shadow-sm flex items-center justify-center gap-2">
                <Edit2 size={16} /> Editar Compra
              </button>
              <button onClick={() => generatePurchasePdfLocal(detailPurchase)}
                className="flex-1 h-11 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Download size={16} /> Descargar PDF
              </button>
              <button onClick={() => handleDownloadJpg(detailPurchase)}
                className="flex-1 h-11 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all flex items-center justify-center gap-2">
                <Download size={16} /> Descargar JPG
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={!!showConfirmDelete} onClose={() => setShowConfirmDelete(null)} title="Confirmar Eliminación">
        <div className="space-y-5">
          <p className="text-sm text-[#5C3E35]">¿Estás seguro de eliminar esta compra? Esta acción no se puede deshacer.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirmDelete(null)}
              className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => showConfirmDelete && handleDeletePurchase(showConfirmDelete)}
              className="flex-1 h-12 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
       </Modal>

      {/* Delete product confirmation modal */}
      <Modal isOpen={!!showConfirmDeleteProduct} onClose={() => { setShowConfirmDeleteProduct(null); setProductUsage(null); }} title="Confirmar Eliminación">
        <div className="space-y-5">
          {productUsage ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-medium text-red-700 mb-2">Este producto tiene registros asociados</p>
                <ul className="text-sm text-red-600 space-y-1">
                  {productUsage.movements > 0 && <li>• {productUsage.movements} movimiento(s) de inventario</li>}
                  {productUsage.invoices > 0 && <li>• {productUsage.invoices} línea(s) en facturas</li>}
                  {productUsage.purchases > 0 && <li>• {productUsage.purchases} línea(s) en compras</li>}
                </ul>
                <p className="text-xs text-red-500 mt-2">La eliminación normal no está disponible. Usa "Forzar eliminación" para borrar el producto y todos sus registros asociados. Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmDeleteProduct(null); setProductUsage(null); }}
                  className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => showConfirmDeleteProduct && handleForceDeleteProduct(showConfirmDeleteProduct)}
                  disabled={deletingProduct}
                  className="flex-1 h-12 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> {deletingProduct ? "Eliminando..." : "Forzar eliminación"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#5C3E35]">¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDeleteProduct(null)}
                  className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => showConfirmDeleteProduct && handleDeleteProduct(showConfirmDeleteProduct)}
                  disabled={deletingProduct}
                  className="flex-1 h-12 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> {deletingProduct ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}
