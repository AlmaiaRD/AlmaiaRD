import jsPDF from "jspdf";
import { formatCurrency, numberToWords } from "./utils";

interface InvoiceItemData {
  subbrand?: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  itbis?: boolean;
}

interface BankAccountData {
  holder_name: string;
  id_number?: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  email?: string;
}

interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  client_name: string;
  client_id_number?: string;
  client_phone?: string;
  client_email?: string;
  items: InvoiceItemData[];
  subtotal: number;
  itbis_total?: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  bank_account?: BankAccountData;
  logo_url?: string;
  signature_url?: string;
  business_name?: string;
  email?: string;
  phone?: string;
}

interface ReceiptData {
  receipt_number: string;
  receipt_date: string;
  client_name: string;
  invoice_number: string;
  amount: number;
  amount_in_words: string;
  payment_method: string;
  logo_url?: string;
  signature_url?: string;
  business_name?: string;
  email?: string;
  phone?: string;
}

const M = 15;
const CW = 215.9 - M * 2;
const PRIMARY = "#B8837E";
const DARK = "#5C3E35";
const GRAY = "#9C8A82";
const CREAM = "#FCFAF7";
const TABLE_HDR_BG = "#F0EBE3";

function setTextColor(doc: jsPDF, hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  doc.setTextColor(r, g, b);
}

function setDrawFillColor(doc: jsPDF, hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  doc.setDrawColor(r, g, b);
  doc.setFillColor(r, g, b);
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: "S" | "F" | "FD" = "FD") {
  setDrawFillColor(doc, "#E8E0D8");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, r, r, style);
}

function drawCreamRoundedRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number = 4) {
  setDrawFillColor(doc, "#E8E0D8");
  doc.setFillColor(252, 250, 247);
  doc.roundedRect(x, y, w, h, r, r, "FD");
}

function drawBadge(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, bgHex: string, textHex: string) {
  setDrawFillColor(doc, bgHex);
  doc.roundedRect(x, y, w, h, 12, 12, "F");
  setTextColor(doc, textHex);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(label, x + w / 2, y + h / 2 + 2.5, { align: "center" });
}

function drawFlowerIcon(doc: jsPDF, cx: number, cy: number, size: number) {
  const petalCount = 6;
  const petalR = size * 0.2;
  const petalDist = size * 0.34;
  const centerR = size * 0.2;

  // Background circle (pink circle like in the header)
  setDrawFillColor(doc, "#F2EBE8");
  doc.circle(cx, cy, size * 0.5, "F");

  // Petals
  setDrawFillColor(doc, "#B8837E");
  for (let i = 0; i < petalCount; i++) {
    const angle = (i * 360) / petalCount;
    const rad = (angle * Math.PI) / 180;
    const px = cx + Math.sin(rad) * petalDist;
    const py = cy - Math.cos(rad) * petalDist;
    doc.circle(px, py, petalR, "F");
  }

  // Center circle
  setDrawFillColor(doc, "#5C3E35");
  doc.circle(cx, cy, centerR, "F");
  setDrawFillColor(doc, "#B8837E");
  doc.circle(cx, cy, centerR * 0.55, "F");
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadImageAsBase64WithRetry(url: string, retries = 2): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    const result = await loadImageAsBase64(url);
    if (result) return result;
    if (i < retries) await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

export async function generateInvoicePdf(invoice: InvoiceData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();
  let y = M;
  const lineH = 4.5;
  const bizName = invoice.business_name || "Almaia RD";
  const bizEmail = invoice.email || "";
  const bizPhone = invoice.phone || "";

  // Load logo and signature images
  let logoBase64: string | null = null;
  let signatureBase64: string | null = null;
  
  if (invoice.logo_url) {
    logoBase64 = await loadImageAsBase64WithRetry(invoice.logo_url);
  }
  if (invoice.signature_url) {
    signatureBase64 = await loadImageAsBase64WithRetry(invoice.signature_url);
  }

  // ============================================================
  // A. HEADER
  // ============================================================

  // Left side: Logo or Brand text
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", M, y, 25, 25);
    } catch {
      drawFlowerIcon(doc, M + 10, y + 10, 20);
      setTextColor(doc, DARK);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(bizName, M + 22, y + 6);
    }
  } else {
    drawFlowerIcon(doc, M + 10, y + 10, 20);
    setTextColor(doc, DARK);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(bizName, M + 22, y + 6);
  }

  // Subtitle (spaced out)
  setTextColor(doc, PRIMARY);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("BIENESTAR & SALUD", M + 22, y + (logoBase64 ? 28 : 11));

  // Distributor line
  setTextColor(doc, DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Distribuidor Independiente Amway", M, y + (logoBase64 ? 33 : 17));

  // Description/location
  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Suplementos, cosmética y bienestar para toda la familia", M, y + (logoBase64 ? 37.5 : 21.5));
  doc.text("República Dominicana", M, y + (logoBase64 ? 41 : 25));

  // Right side: Badge + Invoice No + Date
  const badgeW = 42;
  const badgeH = 16;
  const badgeX = PW - M - badgeW;

  drawBadge(doc, badgeX, y, badgeW, badgeH, "FACTURA DE VENTA", "#F0EBE3", PRIMARY);

  setTextColor(doc, DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const numberY = y + badgeH + 7;
  doc.text(invoice.invoice_number, PW - M, numberY, { align: "right" });

  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Fecha: ${invoice.invoice_date}`, PW - M, numberY + 5, { align: "right" });

  y += logoBase64 ? 48 : 32;

  // Subtle divider line
  doc.setDrawColor(232, 224, 216);
  doc.setLineWidth(0.3);
  doc.line(M, y, PW - M, y);
  y += 8;

  // ============================================================
  // B. CLIENT / ADQUIRIENTE
  // ============================================================

  const clientSectionH = 34;
  drawCreamRoundedRect(doc, M, y, CW, clientSectionH, 5);

  // Section title
  setTextColor(doc, PRIMARY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE / ADQUIRIENTE", M + 6, y + 6);

  // Client data
  setTextColor(doc, DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Row 1: Nombre + Teléfono
  const clientName = `Nombre: ${invoice.client_name}`;
  const clientPhone = invoice.client_phone ? `Teléfono: ${invoice.client_phone}` : "";
  doc.text(clientName, M + 6, y + 14);
  if (clientPhone) {
    doc.text(clientPhone, M + CW / 2, y + 14);
  }

  // Row 2: Email
  const clientEmail = `Email: ${invoice.client_email || "N/D"}`;
  doc.text(clientEmail, M + 6, y + 21);

  // ID number if available
  if (invoice.client_id_number) {
    doc.text(`Cédula: ${invoice.client_id_number}`, M + CW / 2, y + 21);
  }

  y += clientSectionH + 8;

  // ============================================================
  // C. PRODUCTS TABLE
  // ============================================================

  const colDefs = [
    { label: "Submarca", x: M, w: 28, align: "left" as const },
    { label: "Descripción / Producto", x: M + 28, w: 65, align: "left" as const },
    { label: "Cant.", x: M + 93, w: 12, align: "right" as const },
    { label: "Precio Unit.", x: M + 105, w: 24, align: "right" as const },
    { label: "Total", x: M + 129, w: 28, align: "right" as const },
  ];

  // Table header background
  const tableStartY = y;
  doc.setFillColor(240, 235, 227);
  doc.rect(M, y, CW, 8, "F");

  // Header text
  setTextColor(doc, DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  colDefs.forEach((c) => {
    doc.text(c.label, c.x + (c.align === "right" ? c.w : 0), y + 5.5, { align: c.align });
  });
  y += 10;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, DARK);

  invoice.items.forEach((item, idx) => {
    // Check page break
    if (y > 255) {
      doc.addPage();
      y = M;
      // Repeat table header on new page
      doc.setFillColor(240, 235, 227);
      doc.rect(M, y, CW, 8, "F");
      setTextColor(doc, DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      colDefs.forEach((c) => {
        doc.text(c.label, c.x + (c.align === "right" ? c.w : 0), y + 5.5, { align: c.align });
      });
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setTextColor(doc, DARK);
    }

    const values = [
      item.subbrand || "—",
      item.name,
      String(item.quantity),
      formatCurrency(item.unit_price),
      formatCurrency(item.line_total),
    ];

    colDefs.forEach((c, i) => {
      doc.text(values[i], c.x + (c.align === "right" ? c.w : 0), y + 3, { align: c.align });
    });

    // Subtle row line
    doc.setDrawColor(240, 235, 227);
    doc.setLineWidth(0.2);
    doc.line(M, y + 5.5, M + CW, y + 5.5);

    y += 7;
  });

  y += 4;

  // ============================================================
  // D. PAYMENT DATA
  // ============================================================

  if (invoice.bank_account) {
    const bank = invoice.bank_account;
    const paySectionH = 68;
    drawCreamRoundedRect(doc, M, y, CW, paySectionH, 5);

    setTextColor(doc, PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DATOS DE PAGO POR TRANSFERENCIA", M + 6, y + 6);

    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const payFields = [
      { label: "Beneficiario:", value: bank.holder_name },
      ...(bank.id_number ? [{ label: "Cédula/RNC:", value: bank.id_number }] : []),
      { label: "Banco:", value: bank.bank_name },
      { label: "Tipo de Cuenta:", value: bank.account_type },
      { label: "No. de Cuenta:", value: bank.account_number },
      ...(bank.email ? [{ label: "Correo:", value: bank.email }] : []),
    ];

    let payY = y + 14;
    payFields.forEach((f) => {
      setTextColor(doc, GRAY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(f.label, M + 6, payY);

      setTextColor(doc, DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const labelW = doc.getTextWidth(f.label);
      doc.text(f.value, M + 8 + labelW, payY);
      payY += 7.5;
    });

    y += paySectionH + 6;
  }

  // ============================================================
  // E. SUMMARY
  // ============================================================

  const summaryX = M + CW - 75;
  const summaryW = 75;

  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Subtotal:", summaryX, y);
  setTextColor(doc, DARK);
  doc.text(formatCurrency(invoice.subtotal), summaryX + summaryW, y, { align: "right" });
  y += 6;

  if (invoice.itbis_total) {
    setTextColor(doc, GRAY);
    doc.text("ITBIS (18%):", summaryX, y);
    setTextColor(doc, DARK);
    doc.text(formatCurrency(invoice.itbis_total), summaryX + summaryW, y, { align: "right" });
    y += 6;
  }

  if (invoice.discount_amount > 0) {
    setTextColor(doc, GRAY);
    doc.text("Descuento:", summaryX, y);
    setTextColor(doc, "#D4A0A0");
    doc.text(`-${formatCurrency(invoice.discount_amount)}`, summaryX + summaryW, y, { align: "right" });
    y += 6;
  }

  // Total General (bold)
  doc.setDrawColor(232, 224, 216);
  doc.setLineWidth(0.3);
  doc.line(summaryX, y, summaryX + summaryW, y);
  y += 4;

  setTextColor(doc, DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total General:", summaryX, y);
  doc.text(formatCurrency(invoice.total), summaryX + summaryW, y, { align: "right" });
  y += 7;

  if (invoice.paid_amount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(doc, "#86C7A3");
    doc.text("Monto Cobrado:", summaryX, y);
    doc.text(formatCurrency(invoice.paid_amount), summaryX + summaryW, y, { align: "right" });
    y += 6;
  }

  if (invoice.balance_due > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setTextColor(doc, PRIMARY);
    doc.text("Saldo Pendiente:", summaryX, y);
    doc.text(formatCurrency(invoice.balance_due), summaryX + summaryW, y, { align: "right" });
    y += 8;
  } else {
    y += 4;
  }

  // Amount in words
  doc.setDrawColor(232, 224, 216);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + CW, y);
  y += 5;

  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const words = `Son: ${numberToWords(invoice.total)}`;
  doc.text(words, M, y);

  y += 10;

  // ============================================================
  // F. FOOTER
  // ============================================================

  // Check if we need a new page for footer
  if (y > 250) {
    doc.addPage();
    y = M;
  }

  // Divider
  doc.setDrawColor(232, 224, 216);
  doc.setLineWidth(0.5);
  doc.line(M, y, PW - M, y);
  y += 6;

  // Left: Thank you message + subbrands
  setTextColor(doc, PRIMARY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(`¡Gracias por tu compra y por apoyar a ${bizName}, aliados a tu bienestar!`, M, y);
  y += 5;

  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  const subbrands = "Nutrilite · Artistry · Glister · G&H · Satinique · Amway Home";
  doc.text(subbrands, M, y);

  // Right: Signature area
  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, "PNG", PW - M - 96, y - 48, 96, 48);
      setTextColor(doc, DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", PW - M, y + 4, { align: "right" });
    } catch {
      // Fallback to text signature
      setTextColor(doc, DARK);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(11);
      doc.text(bizName, PW - M, y - 6, { align: "right" });
      setTextColor(doc, DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", PW - M, y, { align: "right" });
    }
  } else {
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text(bizName, PW - M, y - 6, { align: "right" });
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("FIRMA AUTORIZADA", PW - M, y, { align: "right" });
  }

  // Save
  doc.save(`factura-${invoice.invoice_number}.pdf`);
}

export async function generateReceiptPdf(receipt: ReceiptData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;
  const bizName = receipt.business_name || "Almaia RD";
  const bizEmail = receipt.email || "";
  const bizPhone = receipt.phone || "";

  const primary = "#86C7A3";
  const dark = "#5C3E35";
  const gray = "#9C8A82";

  function setColor(hex: string) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    doc.setTextColor(r, g, b);
  }

  // Load logo and signature images
  let logoBase64: string | null = null;
  let signatureBase64: string | null = null;
  
  if (receipt.logo_url) {
    logoBase64 = await loadImageAsBase64WithRetry(receipt.logo_url);
  }
  if (receipt.signature_url) {
    signatureBase64 = await loadImageAsBase64WithRetry(receipt.signature_url);
  }

  // Left side: Logo or Brand text
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, y, 20, 20);
    } catch {
      drawFlowerIcon(doc, margin + 9, y + 9, 18);
      setColor(dark);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(bizName, margin + 20, y);
    }
  } else {
    drawFlowerIcon(doc, margin + 9, y + 9, 18);
    setColor(dark);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(bizName, margin + 20, y);
  }

  setColor(gray);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Comprobante de Pago", margin + (logoBase64 ? 0 : 20), y + (logoBase64 ? 22 : 5));

  setColor(primary);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.receipt_number, pageWidth - margin, y, { align: "right" });
  setColor(gray);
  doc.setFontSize(10);
  doc.text(`Fecha: ${receipt.receipt_date}`, pageWidth - margin, y + 6, { align: "right" });

  y += logoBase64 ? 32 : 22;

  doc.setDrawColor(134, 199, 163);
  doc.setFillColor(240, 250, 244);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 50, 3, 3, "FD");

  y += 10;
  setColor(dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  doc.text(`Cliente: ${receipt.client_name}`, margin + 10, y);
  y += 8;
  doc.text(`Factura: ${receipt.invoice_number}`, margin + 10, y);
  y += 8;
  doc.text(`Método de Pago: ${receipt.payment_method}`, margin + 10, y);
  y += 8;

  setColor(dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Monto: ${formatCurrency(receipt.amount)}`, margin + 10, y);

  y += 20;

  setColor(gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(`Son: ${receipt.amount_in_words || numberToWords(receipt.amount)}`, margin, y);

  y = doc.internal.pageSize.getHeight() - 30;
  
  // Footer with signature
  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, "PNG", pageWidth - margin - 96, y - 36, 96, 36);
      setColor(gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
    } catch {
      setColor(gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
      if (bizPhone || bizEmail) {
        doc.text(`Tel: ${bizPhone || "N/D"} | Email: ${bizEmail || "N/D"}`, margin, y + 4);
      }
    }
  } else {
    setColor(gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
    if (bizPhone || bizEmail) {
      doc.text(`Tel: ${bizPhone || "N/D"} | Email: ${bizEmail || "N/D"}`, margin, y + 4);
    }
  }

  doc.save(`recibo-${receipt.receipt_number}.pdf`);
}

interface ExpenseData {
  expense_date: string;
  category: string;
  subcategory?: string;
  concept: string;
  amount: number;
  payment_method: string;
  beneficiary?: string;
  receipt_number?: string;
  is_deductible: boolean;
  branch?: string;
  is_recurring: boolean;
  recurring_period?: string;
  comments?: string;
  logo_url?: string;
  business_name?: string;
  email?: string;
  phone?: string;
}

export async function generateExpensePdf(expense: ExpenseData): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;
  const bizName = expense.business_name || "Almaia RD";
  const bizEmail = expense.email || "";
  const bizPhone = expense.phone || "";

  const primary = "#D4A0A0";
  const dark = "#5C3E35";
  const gray = "#9C8A82";

  function setColor(hex: string) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    doc.setTextColor(r, g, b);
  }

  // Load logo image
  let logoBase64: string | null = null;
  
  if (expense.logo_url) {
    logoBase64 = await loadImageAsBase64WithRetry(expense.logo_url);
  }

  // Left side: Logo or Brand text
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, y, 20, 20);
    } catch {
      drawFlowerIcon(doc, margin + 9, y + 9, 18);
      setColor(dark);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(bizName, margin + 20, y);
    }
  } else {
    drawFlowerIcon(doc, margin + 9, y + 9, 18);
    setColor(dark);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(bizName, margin + 20, y);
  }

  setColor(gray);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Comprobante de Gasto", margin, y + (logoBase64 ? 22 : 5));

  setColor(primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(expense.category, pageWidth - margin, y, { align: "right" });
  setColor(gray);
  doc.setFontSize(10);
  doc.text(`Fecha: ${expense.expense_date}`, pageWidth - margin, y + 6, { align: "right" });

  y += logoBase64 ? 32 : 22;

  doc.setDrawColor(212, 160, 160);
  doc.setFillColor(252, 250, 247);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 60, 3, 3, "FD");

  y += 12;
  setColor(dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(expense.concept, margin + 10, y);
  y += 8;

  setColor(dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (expense.subcategory) {
    doc.text(`Subcategoría: ${expense.subcategory}`, margin + 10, y);
    y += 7;
  }
  if (expense.beneficiary) {
    doc.text(`Beneficiario: ${expense.beneficiary}`, margin + 10, y);
    y += 7;
  }
  doc.text(`Método de Pago: ${expense.payment_method}`, margin + 10, y);
  y += 7;
  if (expense.receipt_number) {
    doc.text(`N° Comprobante: ${expense.receipt_number}`, margin + 10, y);
    y += 7;
  }
  if (expense.branch) {
    doc.text(`Sucursal: ${expense.branch}`, margin + 10, y);
    y += 7;
  }
  doc.text(`Deducible: ${expense.is_deductible ? "Sí" : "No"}`, margin + 10, y);
  if (expense.is_recurring && expense.recurring_period) {
    y += 7;
    doc.text(`Recurrente: ${expense.recurring_period}`, margin + 10, y);
  }

  y += 14;

  setColor(dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Monto: ${formatCurrency(expense.amount)}`, margin, y);

  y += 10;

  setColor(gray);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.text(`Son: ${numberToWords(expense.amount)}`, margin, y);

  if (expense.comments) {
    y += 12;
    setColor(gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Notas: ${expense.comments}`, margin, y);
  }

  y = doc.internal.pageSize.getHeight() - 30;
  setColor(gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
  if (bizPhone || bizEmail) {
    doc.text(`Tel: ${bizPhone || "N/D"} | Email: ${bizEmail || "N/D"}`, margin, y + 4);
  }

  doc.save(`gasto-${expense.expense_date}.pdf`);
}
