/**
 * Guardado automático de PDF/JPG en carpetas locales (File System Access API).
 *
 * Estructura que se crea sola dentro de la carpeta base elegida por el usuario:
 *   Facturas/2026/factura pdf/…
 *   Facturas/2026/factura jpg/…
 *   Recibos/2026/recibo pdf/…
 *   Recibos/2026/recibo jpg/…
 *   Cotizaciones/2026/cotizacion pdf/…
 *   Cotizaciones/2026/cotizacion jpg/…
 *   Compras/2026/compra pdf/…
 *   Compras/2026/compra jpg/…
 *
 * El permiso de la carpeta base se guarda en IndexedDB: se elige UNA vez
 * (Chrome/Edge de escritorio) y de ahí en adelante cada documento se escribe
 * directo en su carpeta, sin pasar por Descargas ni por la papelera.
 * En navegadores sin soporte (p. ej. Safari/iOS) se usa la descarga normal.
 */

export type DocumentKind = "factura" | "recibo" | "cotizacion" | "compra";

const KIND_FOLDER: Record<DocumentKind, string> = {
  factura: "Facturas",
  recibo: "Recibos",
  cotizacion: "Cotizaciones",
  compra: "Compras",
};

const IDB_NAME = "almaia-docs";
const IDB_STORE = "handles";
const IDB_KEY = "baseDir";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClear(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** ¿El navegador soporta guardar en carpetas (File System Access API)? */
export function fsFolderSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** Pide al usuario elegir la carpeta base y la guarda en IndexedDB. */
export async function pickDocumentFolder(): Promise<boolean> {
  if (!fsFolderSupported()) return false;
  try {
    const w = window as unknown as {
      showDirectoryPicker(opts?: { id?: string; mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
    };
    const handle = await w.showDirectoryPicker({ id: "almaia-docs", mode: "readwrite" });
    await idbSet(handle);
    return true;
  } catch {
    // El usuario canceló el selector.
    return false;
  }
}

export async function hasDocumentFolder(): Promise<boolean> {
  if (!fsFolderSupported()) return false;
  return (await idbGet()) !== null;
}

export async function clearDocumentFolder(): Promise<void> {
  await idbClear();
}

export interface SaveTarget {
  kind: DocumentKind;
  ext: "pdf" | "jpg";
  /** Año del documento, p. ej. "2026" */
  year: string;
  /** Nombre del archivo con su extensión, p. ej. "factura-FAC-000032-Cliente.pdf" */
  filename: string;
  blob: Blob;
}

/** Guarda el archivo en la carpeta correspondiente. Devuelve true si se guardó en carpeta. */
export async function saveDocumentToFolder(opts: SaveTarget): Promise<boolean> {
  if (!fsFolderSupported()) return false;
  const base = await idbGet();
  if (!base) return false;
  // En esta versión de lib.dom los métodos de permiso no vienen tipados en
  // FileSystemDirectoryHandle, aunque existen en Chrome/Edge.
  const handle = base as FileSystemDirectoryHandle & {
    queryPermission(opts?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
    requestPermission(opts?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  };
  try {
    let perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "prompt") perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return false;

    const kindDir = await handle.getDirectoryHandle(KIND_FOLDER[opts.kind], { create: true });
    const yearDir = await kindDir.getDirectoryHandle(opts.year, { create: true });
    const sub = opts.ext === "pdf" ? `${opts.kind} pdf` : `${opts.kind} jpg`;
    const extDir = await yearDir.getDirectoryHandle(sub, { create: true });
    const file = await extDir.getFileHandle(opts.filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(opts.blob);
    await writable.close();
    return true;
  } catch (e) {
    console.warn("[saveDocumentToFolder]", e);
    return false;
  }
}

/** Descarga normal (fallback cuando no hay carpeta configurada ni soporte). */
export function fallbackDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Intenta guardar en la carpeta; si no puede, descarga normal. Devuelve true si fue a carpeta. */
export async function saveOrDownload(opts: SaveTarget): Promise<boolean> {
  const saved = await saveDocumentToFolder(opts);
  if (!saved) fallbackDownload(opts.blob, opts.filename);
  return saved;
}

/** Convierte un canvas a Blob JPEG (0.95 de calidad, como se usaba). */
export function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar el JPG"))),
      "image/jpeg",
      0.95
    );
  });
}

/** Año a partir de una fecha de documento (con resguardo al año actual). */
export function documentYear(date?: string | null): string {
  const d = date ? new Date(date) : null;
  const year = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
  return String(year);
}