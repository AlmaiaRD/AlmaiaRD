import { jsPDF } from "jspdf";
import { formatCurrency, numberToWords } from "./utils";
import { registerItaliana } from "./fonts/italiana";
import { registerInspiration } from "./fonts/inspiration";
export type PDFDoc = InstanceType<typeof jsPDF>;

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
  bank_accounts?: BankAccountData[];
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
const PRIMARY = "#BA4A3A";     // terracota — acentos (badges, secciones, saldo)
const DARK = "#39484F";        // pizarra — texto principal
const GRAY = "#4C5760";        // muted — texto secundario
const CREAM_PANEL = "#F4EFE9"; // crema — paneles (cliente, pagos); como el JPG de referencia
const CREAM_HEADER = "#F0ECE3";// crema — cabecera de tabla y píldora de badge
const DANGER = "#D4A0A0";
const SUCCESS = "#86C7A3";

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

function hexRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function drawCreamRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number = 4,
  fillHex: string = CREAM_PANEL
) {
  const c = hexRgb(fillHex);
  doc.setDrawColor(224, 218, 211); // borde perla sutil
  doc.setFillColor(c.r, c.g, c.b);
  doc.roundedRect(x, y, w, h, r, r, "FD");
}

export function drawFlowerIcon(doc: jsPDF, cx: number, cy: number, size: number) {
  const petalCount = 6;
  const petalR = size * 0.2;
  const petalDist = size * 0.34;
  const centerR = size * 0.2;

  // Background circle (pink circle like in the header)
  setDrawFillColor(doc, "#F3ECE3");
  doc.circle(cx, cy, size * 0.5, "F");

  // Petals
  setDrawFillColor(doc, "#BA4A3A");
  for (let i = 0; i < petalCount; i++) {
    const angle = (i * 360) / petalCount;
    const rad = (angle * Math.PI) / 180;
    const px = cx + Math.sin(rad) * petalDist;
    const py = cy - Math.cos(rad) * petalDist;
    doc.circle(px, py, petalR, "F");
  }

  // Center circle
  setDrawFillColor(doc, "#39484F");
  doc.circle(cx, cy, centerR, "F");
  setDrawFillColor(doc, "#BA4A3A");
  doc.circle(cx, cy, centerR * 0.55, "F");
}

// Dibuja texto con letter-spacing (tracking) — replica el tracking del header web
export function drawTrackedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  tracking: number,
  color: string,
  font = "helvetica",
  fontStyle: string = "normal"
): number {
  doc.setFont(font, fontStyle);
  doc.setFontSize(fontSize);
  setTextColor(doc, color);
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    doc.text(ch, cx, y);
    cx += doc.getTextWidth(ch) + tracking;
  }
  return cx;
}

export function trackedTextWidth(doc: jsPDF, text: string, fontSize: number, tracking: number): number {
  doc.setFontSize(fontSize);
  return doc.getTextWidth(text) + tracking * (text.length - 1);
}

// Header claro "estilo factura" (fondo blanco): marca Italiana con flor/logo a la
// izquierda y píldora crema con el tipo de documento a la derecha. Replica la
// factura de referencia (FAC-000024, JPG del usuario). Devuelve la Y del cuerpo.
function drawLightHeader(
  doc: jsPDF,
  opts: {
    badgeLabel: string;
    logoBase64?: string | null;
    bizName: string;
  }
): number {
  const PW = doc.internal.pageSize.getWidth();

  // Logo (si cargó) o flor vectorial a la izquierda de la marca
  let textX = M + 11;
  if (opts.logoBase64) {
    try {
      const props = doc.getImageProperties(opts.logoBase64);
      const ratio = props.width && props.height ? props.height / props.width : 1;
      const lw = 13;
      const lh = lw * ratio;
      doc.addImage(opts.logoBase64, "PNG", M, 16 - lh / 2, lw, lh);
      textX = M + 16;
    } catch {
      /* usar flor vectorial */
    }
  }
  if (textX === M + 11) drawFlowerIcon(doc, M + 3, 16, 11);

  // Marca Italiana 24pt pizarra con tracking (lineamiento del header de la web:
  // tracking-wide sobre "ALMAIA RD" en mayúscula, peso 400)
  const brandText = opts.bizName.toUpperCase();
  const brandSize = 24;
  const brandTrack = brandSize * 0.025; // tracking-wide de Tailwind (0.025em)
  drawTrackedText(doc, brandText, textX, 16, brandSize, brandTrack, DARK, "Italiana", "normal");

  // Tagline terracota en mayúscula con tracking-widest (0.1em), con el mismo
  // lineamiento de Wordmark en el header: el ancho se alinea al de la marca
  const taglineText = "BIENESTAR & SALUD";
  doc.setFont("helvetica", "normal");
  const refSize = 10;
  const refTrack = refSize * 0.1; // tracking-widest de Tailwind
  const taglineW = trackedTextWidth(doc, taglineText, refSize, refTrack);
  const brandW = trackedTextWidth(doc, brandText, brandSize, brandTrack);
  const scale = Math.min(1.4, Math.max(0.75, brandW / taglineW));
  drawTrackedText(doc, taglineText, textX, 22.5, refSize * scale, refTrack * scale, PRIMARY, "helvetica", "normal");

  // Distribuidor
  setTextColor(doc, DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Distribuidor Independiente Amway", textX, 29);

  // Descripción y país
  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Suplementos, cosmética y bienestar para toda la familia", textX, 34.5);
  doc.text("República Dominicana", textX, 39.5);

  // Píldora crema con texto terracota a la derecha (badge 1pt más grande y
  // centrado verticalmente respecto del óvalo que lo contiene)
  const badgeH = 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const bw = doc.getTextWidth(opts.badgeLabel) + 16;
  const bx = PW - M - bw;
  doc.setDrawColor(224, 218, 211);
  doc.setFillColor(240, 236, 227); // crema #F0ECE3
  doc.roundedRect(bx, 10, bw, badgeH, badgeH / 2, badgeH / 2, "FD");
  setTextColor(doc, PRIMARY);
  // Centrado óptico: baseline = centro de la píldora + media altura de mayúscula
  // (0.35 * fontSize en pt, convertido a mm) — 1pt = 0.3528mm
  const badgeBaseline = 10 + badgeH / 2 + 9 * 0.35 * 0.3528; // 16.1mm
  doc.text(opts.badgeLabel, bx + bw / 2, badgeBaseline, { align: "center" });

  return 44;
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

export async function buildInvoicePdfDoc(invoice: InvoiceData): Promise<PDFDoc> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  registerItaliana(doc);
  registerInspiration(doc);
  const PW = doc.internal.pageSize.getWidth();
  let y = M;
  const bizName = invoice.business_name || "Almaia RD";

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
  // A. HEADER (fondo blanco + píldora crema — como el JPG de referencia)
  // ============================================================

  y = drawLightHeader(doc, {
    badgeLabel: "FACTURA DE VENTA",
    logoBase64,
    bizName,
  });

  // Número y fecha a la derecha, dentro del header claro
  setTextColor(doc, DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(invoice.invoice_number, PW - M, 25, { align: "right" });

  setTextColor(doc, GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha: ${invoice.invoice_date}`, PW - M, 31, { align: "right" });

  // Divisor perla bajo el header
  doc.setDrawColor(224, 218, 211);
  doc.setLineWidth(0.3);
  doc.line(M, 44, PW - M, 44);

  y = 48;

  // ============================================================
  // B. CLIENT / ADQUIRIENTE
  // ============================================================

  const clientSectionH = 26;
  drawCreamRoundedRect(doc, M, y, CW, clientSectionH, 5);

  // Section title
  setTextColor(doc, PRIMARY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE / ADQUIRIENTE", M + 6, y + 5.5);

  // Client data
  setTextColor(doc, DARK);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Row 1: Nombre + Teléfono
  const clientName = `Nombre: ${invoice.client_name}`;
  const clientPhone = invoice.client_phone ? `Teléfono: ${invoice.client_phone}` : "";
  doc.text(clientName, M + 6, y + 13.5);
  if (clientPhone) {
    doc.text(clientPhone, M + CW / 2, y + 13.5);
  }

  // Row 2: Email
  const clientEmail = `Email: ${invoice.client_email || "N/D"}`;
  doc.text(clientEmail, M + 6, y + 19.5);

  // ID number if available
  if (invoice.client_id_number) {
    doc.text(`Cédula: ${invoice.client_id_number}`, M + CW / 2, y + 19.5);
  }

  y += clientSectionH + 8;

  // ============================================================
  // C. PRODUCTS TABLE
  // ============================================================

  // Columnas: Submarca un poco más a la derecha (deja aire a la izquierda) y
  // Total un poco más a la izquierda (deja aire a la derecha), como pide la
  // revisión de la factura.
  const colDefs = [
    { label: "Submarca", x: M + 6, w: 24, align: "left" as const },
    { label: "Descripción / Producto", x: M + 32, w: 73, align: "left" as const },
    { label: "Cant.", x: M + 107, w: 12, align: "right" as const },
    { label: "Precio Unit.", x: M + 121, w: 30, align: "right" as const },
    { label: "Total", x: M + 153, w: 27, align: "right" as const },
  ];

  // Table header background (crema, como el JPG de referencia)
  setDrawFillColor(doc, CREAM_HEADER);
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

  invoice.items.forEach((item) => {
    // Check page break
    if (y > 255) {
      doc.addPage();
      y = M;
      // Repeat table header on new page (crema)
      setDrawFillColor(doc, CREAM_HEADER);
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
    doc.setDrawColor(224, 218, 211);
    doc.setLineWidth(0.2);
    doc.line(M, y + 5.5, M + CW, y + 5.5);

    y += 7;
  });

  y += 4;

  // ============================================================
  // D. PAYMENT DATA
  // ============================================================

  const bankList = invoice.bank_accounts && invoice.bank_accounts.length > 0
    ? invoice.bank_accounts
    : (invoice.bank_account ? [invoice.bank_account] : []);

  if (bankList.length > 0) {
    const mainBank = bankList[0];
    const bankRows = bankList.length;
    const paySectionH = 20 + bankRows * 9 + 4;
    drawCreamRoundedRect(doc, M, y, CW, paySectionH, 5);

    setTextColor(doc, PRIMARY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DATOS DE PAGO POR TRANSFERENCIA", M + 6, y + 6);

    // Beneficiario / Cédula / Correo en una sola fila (como el JPG)
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const third = CW / 3;
    doc.text(`Beneficiario: ${mainBank.holder_name}`, M + 6, y + 15);
    if (mainBank.id_number) doc.text(`Cédula/RNC: ${mainBank.id_number}`, M + 6 + third, y + 15);
    if (mainBank.email) doc.text(`Correo: ${mainBank.email}`, M + 6 + 2 * third, y + 15);

    // Una fila por banco: Banco | Tipo | No.
    let bankY = y + 23;
    bankList.forEach((bank) => {
      doc.text(bank.bank_name, M + 6, bankY);
      doc.text(bank.account_type, M + 6 + third, bankY);
      doc.text(`No. ${bank.account_number}`, M + 6 + 2 * third, bankY);
      bankY += 9;
    });

    y += paySectionH + 6;
  }

  // ============================================================
  // E. SUMMARY
  // ============================================================

  const summaryX = M;
  const summaryW = CW;

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
    setTextColor(doc, DANGER);
    doc.text(`-${formatCurrency(invoice.discount_amount)}`, summaryX + summaryW, y, { align: "right" });
    y += 6;
  }

  // Total General (bold)
  doc.setDrawColor(224, 218, 211);
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
    setTextColor(doc, SUCCESS);
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

  // ============================================================
  // F. FOOTER
  // ============================================================

  // Check if we need a new page for footer
  if (y > 250) {
    doc.addPage();
    y = M;
  }

  // Divider
  doc.setDrawColor(224, 218, 211);
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

  // Firma a la derecha sobre "FIRMA AUTORIZADA" (como el JPG de referencia)
  const sigRight = PW - M;
  if (signatureBase64) {
    try {
      const props = doc.getImageProperties(signatureBase64);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      const maxW = PW / 2 - M;
      const targetH = Math.max(120, Math.min(300, y - M));
      const sigW = Math.min(targetH * ratio, maxW);
      const sigH = sigW / ratio;
      const sigX = sigRight - sigW;
      doc.addImage(signatureBase64, "PNG", sigX, y - sigH, sigW, sigH);
      setTextColor(doc, DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", sigX + sigW / 2, y + 4, { align: "center" });
    } catch {
      // Fallback to text signature
      setTextColor(doc, DARK);
      doc.setFont("Inspiration", "normal");
      doc.setFontSize(16);
      doc.text("Yrahisa Mateo", sigRight, y - 6, { align: "right" });
      setTextColor(doc, DARK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", sigRight, y + 5, { align: "right" });
    }
  } else {
    setTextColor(doc, DARK);
    doc.setFont("Inspiration", "normal");
    doc.setFontSize(16);
    doc.text("Yrahisa Mateo", sigRight, y - 6, { align: "right" });
    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("FIRMA AUTORIZADA", sigRight, y + 5, { align: "right" });
  }

  return doc;
}

export async function generateInvoicePdf(invoice: InvoiceData): Promise<void> {
  const doc = await buildInvoicePdfDoc(invoice);
  doc.save(`factura-${invoice.invoice_number}.pdf`);
}

export async function buildReceiptPdfDoc(receipt: ReceiptData): Promise<PDFDoc> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  registerItaliana(doc);
  registerInspiration(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;
  const bizName = receipt.business_name || "Almaia RD";
  const bizEmail = receipt.email || "";
  const bizPhone = receipt.phone || "";

  const primary = "#BA4A3A";
  const dark = "#39484F";
  const gray = "#5F6B72";

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
      doc.setFont("Italiana", "normal");
      doc.text(bizName.toUpperCase(), margin + 20, y);
    }
  } else {
    drawFlowerIcon(doc, margin + 9, y + 9, 18);
    setColor(dark);
    doc.setFontSize(22);
    doc.setFont("Italiana", "normal");
    doc.text(bizName.toUpperCase(), margin + 20, y);
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

  doc.setDrawColor(186, 74, 58);
  doc.setFillColor(245, 239, 233);
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
  
  // Footer with signature (centrada sobre "FIRMA AUTORIZADA")
  if (signatureBase64) {
    try {
      const props = doc.getImageProperties(signatureBase64);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      const maxW = pageWidth - 2 * margin;
      const targetH = Math.min(220, y - margin);
      const sigW = Math.min(targetH * ratio, maxW);
      const sigH = sigW / ratio;
      doc.addImage(signatureBase64, "PNG", (pageWidth - sigW) / 2, y - sigH, sigW, sigH);
      setColor(gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", pageWidth / 2, y + 4, { align: "center" });
      doc.setFontSize(8);
      doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
    } catch {
      // Firma: "Yrahisa Mateo" en Inspiration aunque no haya imagen de firma
      setColor(gray);
      doc.setFont("Inspiration", "normal");
      doc.setFontSize(16);
      doc.text("Yrahisa Mateo", pageWidth / 2, y - 14, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", pageWidth / 2, y + 1, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
      if (bizPhone || bizEmail) {
        doc.text(`Tel: ${bizPhone || "N/D"} | Email: ${bizEmail || "N/D"}`, margin, y + 4);
      }
    }
  } else {
    // Firma: "Yrahisa Mateo" en Inspiration aunque no haya imagen de firma
    setColor(gray);
    doc.setFont("Inspiration", "normal");
    doc.setFontSize(16);
    doc.text("Yrahisa Mateo", pageWidth / 2, y - 14, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("FIRMA AUTORIZADA", pageWidth / 2, y + 1, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
    if (bizPhone || bizEmail) {
      doc.text(`Tel: ${bizPhone || "N/D"} | Email: ${bizEmail || "N/D"}`, margin, y + 4);
    }
  }

  return doc;
}

export async function generateReceiptPdf(receipt: ReceiptData): Promise<void> {
  const doc = await buildReceiptPdfDoc(receipt);
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
  registerItaliana(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;
  const bizName = expense.business_name || "Almaia RD";
  const bizEmail = expense.email || "";
  const bizPhone = expense.phone || "";

  const dark = "#39484F";
  const gray = "#4C5760";

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

  // Header claro (marca + píldora crema — lenguaje visual del JPG de referencia)
  y = drawLightHeader(doc, {
    badgeLabel: "COMPROBANTE DE GASTO",
    logoBase64,
    bizName,
  });

  setColor(dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(expense.category, pageWidth - margin, 25, { align: "right" });
  setColor(gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha: ${expense.expense_date}`, pageWidth - margin, 31, { align: "right" });

  doc.setDrawColor(224, 218, 211);
  doc.setLineWidth(0.3);
  doc.line(margin, 44, pageWidth - margin, 44);

  y = 48;

  drawCreamRoundedRect(doc, margin, y, pageWidth - margin * 2, 60, 5);

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
  doc.setDrawColor(224, 218, 211);
  doc.setLineWidth(0.5);
  doc.line(margin, y - 10, pageWidth - margin, y - 10);
  setColor(gray);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${bizName} — Distribuidora Autorizada Amway`, margin, y);
  if (bizPhone || bizEmail) {
    doc.text(`Tel: ${bizPhone || "N/D"} | Email: ${bizEmail || "N/D"}`, margin, y + 4);
  }

  doc.save(`gasto-${expense.expense_date}.pdf`);
}

interface QuoteItemData {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  pv?: number;
  description?: string;
}

interface QuoteData {
  quote_number: string;
  quote_date: string;
  valid_until: string;
  status: string;
  client_name: string;
  client_phone?: string;
  client_email?: string;
  items: QuoteItemData[];
  subtotal: number;
  itbis_total?: number;
  discount_amount: number;
  total: number;
  pv_total?: number;
  notes?: string;
  logo_url?: string;
  signature_url?: string;
  business_name?: string;
  email?: string;
  phone?: string;
}

export async function buildQuotePdfDoc(quote: QuoteData): Promise<PDFDoc> {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  registerItaliana(doc);
  registerInspiration(doc);
  await drawQuotePdfContent(doc, quote);
  return doc;
}

export async function drawQuotePdfContent(doc: PDFDoc, quote: QuoteData): Promise<void> {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  let y = M;
  const bizName = quote.business_name || "Almaia RD";

  // Precargar el logo PNG original de Almaia (flor) para el header
  let almaiaLogoB64: string | null = null;
  try {
    almaiaLogoB64 = await loadImageAsBase64("/almaia-logo.png");
  } catch {
    almaiaLogoB64 = null;
  }

  let signatureBase64: string | null = null;
  if (quote.signature_url) {
    signatureBase64 = await loadImageAsBase64WithRetry(quote.signature_url);
  }

  // Helper to draw header on any page
  const drawHeader = (pageY: number) => {
    let hy = pageY;
    // Flor original de Almaia (logo PNG) a la izquierda de "Almaia", ambos alineados a la izquierda (como las facturas)
    let logoW = 0; let logoH = 0;
    if (almaiaLogoB64) {
      try {
        const props = doc.getImageProperties(almaiaLogoB64);
        const ratio = props.width && props.height ? props.height / props.width : 0.8;
        logoW = 20; logoH = logoW * ratio;
        doc.addImage(almaiaLogoB64, "PNG", M, hy, logoW, logoH);
      } catch {
        logoW = 16; logoH = 16;
        drawFlowerIcon(doc, M + 8, hy + 8, 16);
      }
    } else {
      logoW = 16; logoH = 16;
      drawFlowerIcon(doc, M + 8, hy + 8, 16);
    }
    const nameBaseY = hy + logoH / 2;
    setTextColor(doc, DARK); doc.setFontSize(22); doc.setFont("Italiana", "normal");
    doc.text(bizName.toUpperCase(), M + logoW + 4, nameBaseY);

    setTextColor(doc, PRIMARY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("BIENESTAR & SALUD", M + logoW + 4, nameBaseY + 5);

    const infoY = hy + logoH + 6;
    setTextColor(doc, DARK); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("Tus aliados en el camino a tu bienestar y salud.", M, infoY);

    setTextColor(doc, GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("Suplementos, cosmética y bienestar para toda la familia", M, infoY + 4.5);
    doc.text("República Dominicana", M, infoY + 9);

    // Badge — right aligned (píldora: extremos redondos, pegado al texto)
    const badgeH = 16;
    const badgeRad = badgeH / 2;
    setTextColor(doc, PRIMARY); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    const badgeLabel = "COTIZACIÓN";
    const badgeW = doc.getTextWidth(badgeLabel) + 18;
    const badgeX = PW - M - badgeW;
    setDrawFillColor(doc, "#F3EBE0");
    doc.roundedRect(badgeX, hy, badgeW, badgeH, badgeRad, badgeRad, "F");
    doc.text(badgeLabel, badgeX + badgeW / 2, hy + badgeH / 2 + 2.2, { align: "center" });

    setTextColor(doc, DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    const numberY = hy + badgeH + 7;
    doc.text(quote.quote_number, PW - M, numberY, { align: "right" });

    setTextColor(doc, GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Fecha: ${quote.quote_date}`, PW - M, numberY + 5, { align: "right" });
    doc.text(`Válida hasta: ${quote.valid_until}`, PW - M, numberY + 9.5, { align: "right" });

    hy += logoH + 24;
    doc.setDrawColor(224, 218, 211); doc.setLineWidth(0.3);
    doc.line(M, hy, PW - M, hy);
    return hy + 8;
  };

  // ── PAGE 1: HEADER + CLIENT + TABLE + SUMMARY ──
  y = drawHeader(y);

  // Client section
  const clientSectionH = 24;
  drawCreamRoundedRect(doc, M, y, CW, clientSectionH, 5);
  setTextColor(doc, PRIMARY); doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("CLIENTE / ADQUIRIENTE", M + 6, y + 5);
  setTextColor(doc, DARK); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${quote.client_name}`, M + 6, y + 12);
  if (quote.client_phone) doc.text(`Teléfono: ${quote.client_phone}`, M + CW / 2, y + 12);
  doc.text(`Email: ${quote.client_email || "N/D"}`, M + 6, y + 18);
  y += clientSectionH + 6;

  // Table
  const colDefs = [
    { label: "Descripción / Producto", x: M, w: 108, align: "left" as const },
    { label: "Cant.", x: M + 108, w: 14, align: "right" as const },
    { label: "Precio Unit.", x: M + 122, w: 30, align: "right" as const },
    { label: "Total", x: M + 152, w: 34, align: "right" as const },
  ];

  doc.setFillColor(243, 235, 224);
  doc.rect(M, y, CW, 8, "F");
  setTextColor(doc, DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  colDefs.forEach((c) => { doc.text(c.label, c.x + (c.align === "right" ? c.w : 0), y + 5.5, { align: c.align }); });
  y += 10;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); setTextColor(doc, DARK);
  quote.items.forEach((item) => {
    if (y > 255) {
      doc.addPage(); y = drawHeader(M);
    }
    const nameLines = doc.splitTextToSize(item.name, 104) as string[];
    const rowHeight = Math.max(7, nameLines.length * 4.2 + 1);

    if (y + rowHeight > 255) {
      doc.addPage(); y = drawHeader(M);
    }

    setTextColor(doc, DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    nameLines.forEach((line: string, i: number) => {
      doc.text(line, M + 2, y + 2 + i * 4);
    });

    setTextColor(doc, DARK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(String(item.quantity), M + 108 + 12, y + 3, { align: "right" });
    doc.text(formatCurrency(item.unit_price), M + 122 + 28, y + 3, { align: "right" });
    doc.text(formatCurrency(item.line_total), M + 152 + 32, y + 3, { align: "right" });

    doc.setDrawColor(243, 235, 224); doc.setLineWidth(0.2);
    doc.line(M, y + rowHeight, M + CW, y + rowHeight);

    y += rowHeight;
  });
  y += 4;

  // Summary
  const summaryX = M + CW - 75; const summaryW = 75;

  setTextColor(doc, GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Subtotal:", summaryX, y);
  setTextColor(doc, DARK); doc.text(formatCurrency(quote.subtotal), summaryX + summaryW, y, { align: "right" }); y += 6;

  if (quote.itbis_total) {
    setTextColor(doc, GRAY); doc.text("ITBIS (18%):", summaryX, y);
    setTextColor(doc, DARK); doc.text(formatCurrency(quote.itbis_total), summaryX + summaryW, y, { align: "right" }); y += 6;
  }
  if (quote.discount_amount > 0) {
    setTextColor(doc, GRAY); doc.text("Descuento:", summaryX, y);
    setTextColor(doc, "#D4A0A0"); doc.text(`-${formatCurrency(quote.discount_amount)}`, summaryX + summaryW, y, { align: "right" }); y += 6;
  }

  doc.setDrawColor(224, 218, 211); doc.setLineWidth(0.3);
  doc.line(summaryX, y, summaryX + summaryW, y); y += 4;

  setTextColor(doc, DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Total General:", summaryX, y);
  doc.text(formatCurrency(quote.total), summaryX + summaryW, y, { align: "right" }); y += 10;

  if (quote.notes) {
    setTextColor(doc, GRAY); doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(`Notas: ${quote.notes}`, CW);
    doc.text(noteLines, M, y); y += noteLines.length * 4 + 6;
  }

  doc.setDrawColor(224, 218, 211); doc.setLineWidth(0.3);
  doc.line(M, y, M + CW, y); y += 5;
  setTextColor(doc, GRAY); doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  doc.text(`Son: ${numberToWords(quote.total)}`, M, y); y += 15;

  // Signature on first page (right side, below total in words)
  if (signatureBase64) {
    try {
      const props = doc.getImageProperties(signatureBase64);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      const maxW = 70;
      const targetH = Math.max(15, Math.min(40, (y - M) * 0.08));
      let sigW = Math.min(targetH * ratio, maxW);
      let sigH = sigW / ratio;
      if (!isFinite(sigW) || sigW < 1) sigW = 30;
      if (!isFinite(sigH) || sigH < 1) sigH = 30;
      const sigX = PW - M - sigW;
      const sigY = y;
      doc.addImage(signatureBase64, "PNG", sigX, sigY, sigW, sigH);
      setTextColor(doc, DARK); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", sigX + sigW / 2, sigY + sigH + 4, { align: "center" });
      y += sigH + 12;
    } catch {
      setTextColor(doc, DARK); doc.setFont("Inspiration", "normal"); doc.setFontSize(16);
      doc.text("Yrahisa Mateo", PW - M, y - 8, { align: "right" });
      setTextColor(doc, DARK); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      doc.text("FIRMA AUTORIZADA", PW - M, y + 6, { align: "right" });
      y += 16;
    }
  } else {
    setTextColor(doc, DARK); doc.setFont("Inspiration", "normal"); doc.setFontSize(16);
    doc.text("Yrahisa Mateo", PW - M, y - 8, { align: "right" });
    setTextColor(doc, DARK); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("FIRMA AUTORIZADA", PW - M, y + 6, { align: "right" });
    y += 16;
  }

  // ── LAST PAGE: Closing message with signature, contact info ──
  doc.addPage();
  y = M;

  // Header on last page — flor original de Almaia (logo PNG) a la izquierda, "Almaia" a su derecha alineado (como las facturas)
  let lastLogoW = 0; let lastLogoH = 16;
  if (almaiaLogoB64) {
    try {
      const props = doc.getImageProperties(almaiaLogoB64);
      const ratio = props.width && props.height ? props.height / props.width : 0.8;
      lastLogoW = 20; lastLogoH = lastLogoW * ratio;
      doc.addImage(almaiaLogoB64, "PNG", M, y, lastLogoW, lastLogoH);
    } catch {
      lastLogoW = 16;
      drawFlowerIcon(doc, M + 8, y + 8, 16);
    }
  } else {
    lastLogoW = 16;
    drawFlowerIcon(doc, M + 8, y + 8, 16);
  }
  const lastCenterY = y + lastLogoH / 2;
  setTextColor(doc, DARK); doc.setFontSize(22); doc.setFont("Italiana", "normal");
  doc.text(bizName.toUpperCase(), M + lastLogoW + 4, lastCenterY);

  setTextColor(doc, PRIMARY); doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text("BIENESTAR & SALUD", M + lastLogoW + 4, lastCenterY + 5);
  y += Math.max(lastLogoH, 20) + 6;

  // Mensaje de cierre (texto nuevo)
  y += 16;
  setTextColor(doc, DARK); doc.setFont("helvetica", "italic"); doc.setFontSize(11);
  doc.text("Nos sentimos honrados de poder apoyarte y orientarte", PW / 2, y, { align: "center" }); y += 6;
  doc.text("en este camino hacia una mejor calidad de vida.", PW / 2, y, { align: "center" }); y += 6;
  doc.text("Estamos a tus órdenes y en la mejor disposición", PW / 2, y, { align: "center" }); y += 6;
  doc.text("de responder a tus preguntas e inquietudes.", PW / 2, y, { align: "center" }); y += 12;

  // Signature on last page (centered, same size)
  if (signatureBase64) {
    try {
      const props = doc.getImageProperties(signatureBase64);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      const maxW = 50;
      const sigW = Math.min(maxW, maxW * ratio);
      const sigH = sigW / ratio;
      const sigX = (PW - sigW) / 2;
      doc.addImage(signatureBase64, "PNG", sigX, y, sigW, sigH);
      y += sigH + 4;
    } catch {
      // fallback
    }
  }

  setTextColor(doc, PRIMARY); doc.setFont("helvetica", "italic"); doc.setFontSize(11);
  doc.text("Aliados a tu bienestar y salud", PW / 2, y, { align: "center" }); y += 8;

  // Contact info
  setTextColor(doc, GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const phone = quote.phone || "809-863-5602";
  const email = quote.email || "info@almaia-rd.com";
  doc.text(`Tel: ${phone}`, PW / 2, y, { align: "center" }); y += 5;
  doc.text(`Email: ${email}`, PW / 2, y, { align: "center" }); y += 5;

  // Footer (sin "Aliados de tu bienestar" — ahora va tras la firma)
  y = PH - 20;
  doc.setDrawColor(224, 218, 211); doc.setLineWidth(0.5);
  doc.line(M, y, PW - M, y); y += 7;
  setTextColor(doc, GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  doc.text("Nutrilite · Artistry · Glister · G&H · Satinique · Amway Home", PW / 2, y, { align: "center" });
  y += 4;
  setTextColor(doc, GRAY); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  const version = "v2.3-" + new Date().toISOString().slice(0, 16).replace("T", " ");
  doc.text(`Generado: ${version}`, PW / 2, y, { align: "center" });
}

export async function generateQuotePdf(quote: QuoteData): Promise<void> {
  const doc = await buildQuotePdfDoc(quote);
  const clientName = (quote.client_name || "cliente").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "").replace(/\s+/g, "_");
  doc.save(`${quote.quote_number}_${clientName}.pdf`);
}

export async function generateQuoteJpg(quote: QuoteData): Promise<void> {
  const doc = await buildQuotePdfDoc(quote);
  const clientName = (quote.client_name || "cliente").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "").replace(/\s+/g, "_");
  const pdfDataUri = doc.output("datauristring");
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${(await import("pdfjs-dist/package.json")).default.version}/build/pdf.worker.min.mjs`;
  const pdf = await getDocument(pdfDataUri).promise;
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = vp.width; canvas.height = vp.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  const jpgDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const link = document.createElement("a");
  link.href = jpgDataUrl;
  link.download = `${quote.quote_number}_${clientName}.jpg`;
  link.click();
}
