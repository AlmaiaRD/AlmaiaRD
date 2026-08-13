"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import PageContainer from "@/components/layout/PageContainer";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import RotationTab from "@/components/inventory/RotationTab";
import PurchaseModal from "@/components/inventory/PurchaseModal";
import { getInventory, getInventoryMovements, updateMinimumStock, checkCanDeleteProduct, deleteProduct, forceDeleteProduct, getProductUsage, getLastSalePerProduct, getLastPurchasePerProduct, getFirstPurchasePerProduct, getInventoryPaginated } from "@/services/inventory";
import { getProducts } from "@/services/products";
import { createPurchase, getPurchases, getPurchase, updatePurchase, deletePurchase, getSoldQuantities, getPurchasedQuantities } from "@/services/purchases";
import { normalize } from "@/lib/search";
import { getSuppliers } from "@/services/suppliers";
import { getBankAccounts } from "@/services/invoices";
import { getSettings } from "@/services/settings";
import type { Supplier, BankAccount, Settings } from "@/types/database";
import { Package, Plus, Search, Save, Edit2, Minus, History, Eye, EyeOff, Trash2, Printer, Download } from "lucide-react";
import { formatCurrency, formatDate, getLocalDateString } from "@/lib/utils";
import { ITBIS_RATE } from "@/lib/constants";
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
  const [kpiStats, setKpiStats] = useState({ totalValue: 0, totalStock: 0, totalPending: 0 });
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
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [openDownloadId, setOpenDownloadId] = useState<string | null>(null);
  const [showDetailPurchase, setShowDetailPurchase] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<any>(null);
  const [showConfirmDeleteProduct, setShowConfirmDeleteProduct] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [productUsage, setProductUsage] = useState<{ movements: number; invoices: number; purchases: number } | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

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
  const [page, setPage] = useState(1);
  const [totalInventory, setTotalInventory] = useState(0);
  const pageSize = 50;

  // Sync hidden products with server preferences
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/preferences");
        if (!res.ok) return;
        const { preferences } = await res.json();
        if (preferences) {
          if (preferences.hidden_stock_ids) setHiddenStockIds(preferences.hidden_stock_ids);
          if (preferences.hidden_rotation_ids) setHiddenRotationIds(preferences.hidden_rotation_ids);
        }
      } catch { /* fallback a localStorage */ }
    })();
  }, []);

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
      const lineItbis = hasItbis ? item.line_itbis || (item.quantity * item.unit_cost * ITBIS_RATE) : 0;
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
      function esc(s: string | null | undefined) { return s ? String(s).replace(/[&<>"']/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" } as Record<string, string>)[c]) : ""; }
      tmpDiv.innerHTML = `
        <div style="color:#5C3E35;">
          <h2 style="font-size:22px;font-weight:bold;margin:0;">COMPRA</h2>
          <p style="font-size:10px;color:#9C8A82;margin:2px 0 16px;">No. ${esc(purchase.purchase_number)}</p>
          <hr style="border-color:#E8E0D8;margin-bottom:8px;"/>
          <p style="font-size:10px;"><b>Fecha:</b> ${esc(formatDate(purchase.purchase_date))} &nbsp;&nbsp; <b>Proveedor:</b> ${esc(purchase.supplier_name) || "—"}</p>
          <hr style="border-color:#E8E0D8;margin:8px 0;"/>
          <table style="width:100%;font-size:9px;border-collapse:collapse;">
            <thead><tr style="background:#F0EBE3;"><th style="text-align:left;padding:4px;">Producto</th><th style="text-align:center;padding:4px;">Cant.</th><th style="text-align:center;padding:4px;">Costo U.</th><th style="text-align:center;padding:4px;">ITBIS</th><th style="text-align:right;padding:4px;">Total</th></tr></thead>
            <tbody>${(purchase.purchase_items || []).map((item: any) => {
              const hasItbis = item.itbis !== false;
              const lineItbis = hasItbis ? item.line_itbis || (item.quantity * item.unit_cost * ITBIS_RATE) : 0;
              const lineTotal = item.line_total + lineItbis;
              return `<tr><td style="padding:4px;">${esc(item.products?.name) || "—"}</td><td style="text-align:center;padding:4px;">${esc(String(item.quantity))}</td><td style="text-align:center;padding:4px;">${esc(formatCurrency(item.unit_cost))}</td><td style="text-align:center;padding:4px;">${esc(formatCurrency(lineItbis))}</td><td style="text-align:right;padding:4px;font-weight:bold;">${esc(formatCurrency(lineTotal))}</td></tr>`;
            }).join("")}</tbody>
          </table>
          <hr style="border-color:#E8E0D8;margin:8px 0;"/>
          <div style="text-align:right;font-size:10px;">
            <p>Subtotal: ${esc(formatCurrency(purchase.subtotal))}</p>
            <p>Impuesto Recogida: ${esc(formatCurrency(purchase.impuesto_recogida || 0))}</p>
            <p>Cargo Admin.: ${esc(formatCurrency(purchase.cargo_administracion || 0))}</p>
            <p>ITBIS (18%): ${esc(formatCurrency(purchase.itbis || 0))}</p>
            <p style="font-size:12px;font-weight:bold;color:#B8837E;">TOTAL: ${esc(formatCurrency(purchase.total))}</p>
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

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

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
  const purchaseLineItbis = purchaseForm.items.reduce((s, i) => s + ((i.itbis !== false ? 1 : 0) * i.quantity * i.unit_cost * ITBIS_RATE), 0);
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

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [invResult, pro, sold, purchased, sup, ba, st] = await Promise.all([
          getInventoryPaginated(page, pageSize),
          getProducts(),
          getSoldQuantities(),
          getPurchasedQuantities(),
          getSuppliers(),
          getBankAccounts(),
          getSettings().catch(() => null),
        ]);
        if (cancelled) return;
        setInventory(invResult.data || []);
        setTotalInventory(invResult.total);
        setProducts(pro);
        setSoldMap(sold);
        setPurchasedMap(purchased);
        setSuppliers(sup);
        setBankAccounts(ba);
        setSettings(st);
        loadKpis(sold, purchased);
      } catch {
        toast.error("Error al cargar inventario");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  useEffect(() => {
    if (searchParams.get("nueva-compra") === "true") {
      resetPurchaseForm();
      Promise.resolve().then(() => setShowPurchase(true));
      router.replace("/inventario");
    }
  }, [searchParams]);

  async function load() {
    try {
      const [invResult, pro, sold, purchased, sup, ba, st] = await Promise.all([
        getInventoryPaginated(page, pageSize),
        getProducts(),
        getSoldQuantities(),
        getPurchasedQuantities(),
        getSuppliers(),
        getBankAccounts(),
        getSettings().catch(() => null),
      ]);
      setInventory(invResult.data || []);
      setTotalInventory(invResult.total);
      setProducts(pro);
      setSoldMap(sold);
      setPurchasedMap(purchased);
      setSuppliers(sup);
      setBankAccounts(ba);
      setSettings(st);
      loadKpis(sold, purchased);
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
        const stock = item.stock ?? Math.max(0, itemPurchased - itemSold);
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
    if (activeTab === "history") {
      (async () => {
        try {
          const data = await getPurchases();
          setPurchases(data);
        } catch {
          toast.error("Error al cargar compras");
        }
      })();
    }
    if (activeTab === "rotation") {
      (async () => {
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
            const stock = item.stock ?? Math.max(0, itemPurchased - itemSold);
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
      })();
    }
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

  async function loadKpis(sold: Record<string, number>, purchased: Record<string, number>) {
    try {
      const inv = await getInventory();
      setKpiStats({
        totalValue: inv.reduce((s, i) => s + Number(i.inventory_value || 0), 0),
        totalStock: inv.reduce((s, i) => { const p = purchased[i.product_id] || 0; const sd = sold[i.product_id] || 0; return s + Math.max(0, p - sd); }, 0),
        totalPending: inv.reduce((s, i) => { const p = purchased[i.product_id] || 0; const sd = sold[i.product_id] || 0; return s + Math.max(0, sd - p); }, 0),
      });
    } catch {
      // silent
    }
  }


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
      fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden_stock_ids: updated }),
      }).catch((e) => console.error("Error al sincronizar preferencias", e));
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
      fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden_rotation_ids: updated }),
      }).catch((e) => console.error("Error al sincronizar preferencias", e));
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
          <p className="text-xl font-bold text-[#5C3E35]">{totalInventory}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Valor Inventario</p>
          <p className="text-xl font-bold text-[#5C3E35]">{formatCurrency(kpiStats.totalValue)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Stock Total</p>
          <p className="text-xl font-bold text-[#5C3E35]">{kpiStats.totalStock}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E8E0D8]">
          <p className="text-xs text-[#9C8A82] mb-1">Pend. Devolución</p>
          <p className="text-xl font-bold text-[#D4A0A0]">{kpiStats.totalPending}</p>
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
          <Pagination page={page} pageSize={pageSize} total={totalInventory} onPageChange={handlePageChange} />
        </>
      )}

      {activeTab === "rotation" && (
        <RotationTab
          rotationData={rotationData}
          rotationLoading={rotationLoading}
          rotationFilterSubbrand={rotationFilterSubbrand}
          rotationFilterDays={rotationFilterDays}
          rotationFilterStatus={rotationFilterStatus}
          rotationExportOpen={rotationExportOpen}
          rotationDetailProductId={rotationDetailProductId}
          rotationDetailMovements={rotationDetailMovements}
          rotationDetailLoading={rotationDetailLoading}
          rotationDetailItem={rotationDetailItem}
          rotationAiAnalysis={rotationAiAnalysis}
          rotationAiLoading={rotationAiLoading}
          hiddenRotationIds={hiddenRotationIds}
          showHiddenRotation={showHiddenRotation}
          setRotationFilterSubbrand={setRotationFilterSubbrand}
          setRotationFilterDays={setRotationFilterDays}
          setRotationFilterStatus={setRotationFilterStatus}
          setRotationExportOpen={setRotationExportOpen}
          setRotationDetailProductId={setRotationDetailProductId}
          setRotationDetailMovements={setRotationDetailMovements}
          setRotationDetailLoading={setRotationDetailLoading}
          setRotationDetailItem={setRotationDetailItem}
          setRotationAiAnalysis={setRotationAiAnalysis}
          setRotationAiLoading={setRotationAiLoading}
          toggleHideRotationProduct={toggleHideRotationProduct}
        />
      )}

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
      <PurchaseModal
        isOpen={showPurchase}
        editing={!!editingId}
        saving={saving}
        form={purchaseForm}
        suppliers={suppliers}
        bankAccounts={bankAccounts}
        products={products}
        showSupplierDropdown={showSupplierDropdown}
        supplierSearch={supplierSearch}
        showPdfImport={showPdfImport}
        showProductSearch={showProductSearch}
        productSearch={productSearch}
        productFiltered={productFiltered}
        subtotal={purchaseSubtotal}
        itbis={purchaseItbis}
        total={purchaseTotal}
        setForm={setPurchaseForm}
        setSupplierSearch={setSupplierSearch}
        setShowSupplierDropdown={setShowSupplierDropdown}
        setShowPdfImport={setShowPdfImport}
        setShowProductSearch={setShowProductSearch}
        setProductSearch={setProductSearch}
        onApplyPdf={(purchase) => {
          setPurchaseForm({
            supplier_name: purchase.supplier_name,
            purchase_date: purchase.purchase_date,
            notes: purchase.notes,
            discount_amount: purchase.discount_amount,
            impuesto_recogida: 36,
            cargo_administracion: 200,
            payment_method: "Efectivo",
            bank_account_id: "",
            items: purchase.items,
          });
          setShowPdfImport(false);
          toast.success(`Compra interpretada: ${purchase.items.length} productos`);
        }}
        addProduct={addProductToPurchase}
        updateItem={updatePurchaseItem}
        removeItem={removePurchaseItem}
        onClose={() => { setShowPurchase(false); resetPurchaseForm(); }}
        onSubmit={handlePurchase}
      />

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
      <Modal isOpen={!!showConfirmDeleteProduct} onClose={() => { setShowConfirmDeleteProduct(null); setProductUsage(null); setConfirmDeleteText(""); }} title={productUsage ? "Forzar Eliminación" : "Confirmar Eliminación"}>
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
                <p className="text-xs text-red-500 mt-2">La eliminación normal no está disponible. Usa &quot;Forzar eliminación&quot; para borrar el producto y todos sus registros asociados. Esta acción no se puede deshacer.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1.5">Escribe <strong>ELIMINAR</strong> para confirmar</label>
                <input type="text" value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full h-12 px-4 rounded-xl border border-red-300 bg-red-50 text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all text-center font-bold uppercase tracking-widest" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmDeleteProduct(null); setProductUsage(null); setConfirmDeleteText(""); }}
                  className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => showConfirmDeleteProduct && handleForceDeleteProduct(showConfirmDeleteProduct)}
                  disabled={deletingProduct || confirmDeleteText !== "ELIMINAR"}
                  className="flex-1 h-12 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> {deletingProduct ? "Eliminando..." : "Forzar eliminación"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#5C3E35]">¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.</p>
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1.5">Escribe <strong>ELIMINAR</strong> para confirmar</label>
                <input type="text" value={confirmDeleteText} onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full h-12 px-4 rounded-xl border border-red-300 bg-red-50 text-[#5C3E35] text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all text-center font-bold uppercase tracking-widest" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowConfirmDeleteProduct(null); setConfirmDeleteText(""); }}
                  className="flex-1 h-12 border border-[#E8E0D8] text-[#5C3E35] rounded-xl text-sm font-medium hover:bg-[#FAF6F0] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => showConfirmDeleteProduct && handleDeleteProduct(showConfirmDeleteProduct)}
                  disabled={deletingProduct || confirmDeleteText !== "ELIMINAR"}
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
