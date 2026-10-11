"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  ariaLabel?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Campos de formulario que participan en el borrador automático.
const FIELD_SELECTOR =
  "input:not([type=hidden]):not([disabled]):not([type=submit]):not([type=button]), textarea:not([disabled]), select:not([disabled])";

// Botones que significan "guardar" (al pulsarlos limpiamos el borrador).
const SAVE_BUTTON_REGEX =
  /(guardar|registrar|crear|confirmar|aceptar|aplicar|enviar|añadir|agregar|agendar|pagar|cobrar|emitir|finalizar)/i;

// TTL del borrador: 7 días. Si el usuario no vuelve antes, se ignora.
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DRAFT_PREFIX = "almaia-modal-draft:";

type DraftField = { t: string; v: string | boolean };

function draftKeyFor(title: string): string {
  return DRAFT_PREFIX + title.trim().toLowerCase().replace(/\s+/g, "-");
}

// Identificador estable para cada campo (por nombre, placeholder o posición).
function fieldKey(el: Element, index: number): string {
  const name = el.getAttribute("name");
  if (name) return `n:${name}`;
  const ph = el.getAttribute("placeholder");
  if (ph) return `p:${ph}`;
  const al = el.getAttribute("aria-label");
  if (al) return `a:${al}`;
  return `i:${el.tagName.toLowerCase()}:${index}`;
}

function readFields(root: HTMLElement): Record<string, DraftField> {
  const map: Record<string, DraftField> = {};
  const fields = Array.from(root.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
  fields.forEach((el, i) => {
    const key = fieldKey(el, i);
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      map[key] = { t: el.type, v: el.checked };
    } else {
      map[key] = { t: el.tagName.toLowerCase(), v: (el as HTMLInputElement).value ?? "" };
    }
  });
  return map;
}

// Restaura el borrador disparando eventos nativos para que React (inputs
// controlados) actualice su estado. Sin esto, escribir en el DOM no cambia
// el estado del formulario.
function applyFieldValue(el: HTMLElement, field: DraftField) {
  if (field.t === "checkbox" || field.t === "radio") {
    const input = el as HTMLInputElement;
    input.checked = Boolean(field.v);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, String(field.v));
  else (el as HTMLInputElement).value = String(field.v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function Modal({ isOpen, onClose, title, subtitle, children, wide, ariaLabel }: ModalProps) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Guardamos onClose en un ref para que el efecto NO se re-ejecute cuando el
  // padre pasa una función inline nueva en cada render. Si no, el enfoque del
  // panel se robaba el cursor de los inputs al escribir (tenías que hacer
  // click letra por letra).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Refresca el estado "sucio" y prepara el borrador al abrir.
  const dirtyRef = useRef(false);
  const restoredRef = useRef(false);

  // Ref para leer showConfirm dentro del listener sin re-registrar el efecto.
  const showConfirmRef = useRef(showConfirm);
  useEffect(() => {
    showConfirmRef.current = showConfirm;
  }, [showConfirm]);

  // Cierra solo si no hay datos sin guardar; si los hay, pide confirmación (A).
  const requestClose = () => {
    if (dirtyRef.current) {
      setShowConfirm(true);
      return;
    }
    onCloseRef.current();
  };

  // Solo enfocamos el panel UNA VEZ por apertura, no en cada re-render.
  const hasFocusedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false;
      dirtyRef.current = false;
      restoredRef.current = false;
      setShowConfirm(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Si el aviso está abierto, Escape lo cancela (sigue editando).
        if (showConfirmRef.current) {
          setShowConfirm(false);
          return;
        }
        requestClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || active === panelRef.current || !panelRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !panelRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    // Enfocar el panel UNA sola vez por apertura (fuera de React para evitar
    // warning de framer-motion).
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      const timer = window.setTimeout(() => panelRef.current?.focus(), 30);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        window.clearTimeout(timer);
      };
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, showConfirm]);

  // (B) Borrador automático: guarda al escribir, limpia al guardar/descartar,
  // y restaura al abrir si el modal se cerró por accidente.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const key = draftKeyFor(title);

    // Restaurar borrador pendiente (una sola vez por apertura).
    if (!restoredRef.current) {
      restoredRef.current = true;
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts: number; fields: Record<string, DraftField> };
          if (parsed?.ts && Date.now() - parsed.ts < DRAFT_TTL_MS && parsed.fields) {
            const fields = Array.from(panel.querySelectorAll<HTMLElement>(FIELD_SELECTOR));
            fields.forEach((el, i) => {
              const fk = fieldKey(el, i);
              const saved = parsed.fields[fk];
              // Solo rellena campos vacíos para no pisar valores precargados.
              const current = (el as HTMLInputElement).value;
              if (saved && (current === "" || current == null)) {
                applyFieldValue(el, saved);
              }
            });
          }
          window.localStorage.removeItem(key);
        }
      } catch {
        /* almacenamiento no disponible: se omite el borrador */
      }
    }

    const clearDraft = () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    };

    const onInput = () => {
      dirtyRef.current = true;
      try {
        window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), fields: readFields(panel) }));
      } catch {
        /* noop */
      }
    };

    // Al enviar un formulario (Enter) o pulsar un botón de guardar, limpiamos
    // el borrador para que el próximo "nuevo" arranque en blanco.
    const onClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.("button") as HTMLButtonElement | null;
      if (!btn) return;
      if (btn.type === "submit" || SAVE_BUTTON_REGEX.test(btn.textContent || "")) {
        clearDraft();
      }
    };
    const onSubmit = () => clearDraft();

    panel.addEventListener("input", onInput, true);
    panel.addEventListener("change", onInput, true);
    panel.addEventListener("click", onClick, true);
    panel.addEventListener("submit", onSubmit, true);
    return () => {
      panel.removeEventListener("input", onInput, true);
      panel.removeEventListener("change", onInput, true);
      panel.removeEventListener("click", onClick, true);
      panel.removeEventListener("submit", onSubmit, true);
    };
  }, [isOpen, title]);

  // Confirma el descarte desde el aviso (A) y cierra.
  const confirmDiscard = () => {
    try {
      window.localStorage.removeItem(draftKeyFor(title));
    } catch {
      /* noop */
    }
    dirtyRef.current = false;
    setShowConfirm(false);
    onCloseRef.current();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={requestClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full mx-0 sm:mx-auto overflow-hidden outline-none",
              expanded
                ? "max-w-[98vw] sm:max-w-[95vw] h-[96vh] sm:h-[94vh]"
                : cn("max-h-[90vh] sm:max-h-[90vh] max-h-[calc(100vh-2rem)]", wide ? "max-w-3xl" : "max-w-lg")
            )}
          >
            <div className="bg-foreground px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <h2 className="text-white text-base sm:text-lg font-semibold">{title}</h2>
                {subtitle && (
                  <p className="text-[#D4C8C0] text-xs sm:text-sm mt-0.5">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  title={expanded ? "Restaurar tamaño" : "Expandir espacio de trabajo"}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Cerrar"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className={cn("p-4 sm:p-6 overflow-y-auto", expanded ? "h-[calc(96vh-64px)] sm:h-[calc(94vh-68px)]" : "max-h-[75vh]")}>{children}</div>

            {/* Aviso de descarte (A): protege los datos no guardados. */}
            <AnimatePresence>
              {showConfirm && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center p-4"
                >
                  <motion.div
                    initial={{ scale: 0.96, y: 6 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.96, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-10 h-10 rounded-full bg-[#E8C87A]/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={20} className="text-[#B8860B]" />
                      </span>
                      <div>
                        <h3 className="text-[15px] font-semibold text-[#39484F]">¿Cerrar sin guardar?</h3>
                        <p className="text-xs text-[#4C5760] mt-0.5">Se perderá lo que escribiste en este formulario.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        type="button"
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 h-10 border border-[#E0DAD3] text-[#39484F] rounded-xl text-sm font-medium hover:bg-[#F1E9DF] transition-all"
                      >
                        Seguir editando
                      </button>
                      <button
                        type="button"
                        onClick={confirmDiscard}
                        className="flex-1 h-10 bg-[#BA4A3A] text-white rounded-xl text-sm font-medium hover:bg-[#9C382A] transition-all"
                      >
                        Sí, cerrar
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
