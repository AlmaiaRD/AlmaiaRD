"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, FileText, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import Link from "next/link";

const actions = [
  { href: "/facturacion?nueva=true", label: "Nueva Factura", icon: FileText, color: "bg-[#B8837E]", bgLight: "bg-[#B8837E]/10", textColor: "text-[#B8837E]" },
  { href: "/recibos?nuevo=true", label: "Registrar Pago", icon: Receipt, color: "bg-[#86C7A3]", bgLight: "bg-[#86C7A3]/10", textColor: "text-[#86C7A3]" },
  { href: "/inventario?nueva-compra=true", label: "Registrar Compra", icon: ShoppingCart, color: "bg-[#C9A89C]", bgLight: "bg-[#C9A89C]/10", textColor: "text-[#C9A89C]" },
  { href: "/clientes?nuevo=true", label: "Añadir Cliente", icon: UserPlus, color: "bg-[#B8837E]", bgLight: "bg-[#B8837E]/10", textColor: "text-[#B8837E]" },
];

const STORAGE_KEY = "fab-pos-right";
const STORAGE_KEY_BOTTOM = "fab-pos-bottom";

function loadPosition() {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    const b = localStorage.getItem(STORAGE_KEY_BOTTOM);
    if (r || b) return { right: r ? Number(r) : 16, bottom: b ? Number(b) : 24 };
  } catch {}
  return null;
}

export default function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(() => loadPosition() || { right: 16, bottom: 24 });
  const startRef = useRef({ x: 0, y: 0, r: 0, b: 0 });
  const didDrag = useRef(false);

  const savePos = useCallback((r: number, b: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(r));
      localStorage.setItem(STORAGE_KEY_BOTTOM, String(b));
    } catch {}
  }, []);

  const onStart = useCallback((clientX: number, clientY: number) => {
    didDrag.current = false;
    setDragging(true);
    startRef.current = { x: clientX, y: clientY, r: pos.right, b: pos.bottom };
  }, [pos.right, pos.bottom]);

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging) return;
    const dx = startRef.current.x - clientX;
    const dy = startRef.current.y - clientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    const newR = Math.max(8, Math.min(window.innerWidth - 72, startRef.current.r + dx));
    const newB = Math.max(8, Math.min(window.innerHeight - 72, startRef.current.b + dy));
    setPos({ right: newR, bottom: newB });
  }, [dragging]);

  const onEnd = useCallback(() => {
    setDragging(false);
    savePos(pos.right, pos.bottom);
  }, [pos.right, pos.bottom, savePos]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouse = (e: MouseEvent) => { e.preventDefault(); onMove(e.clientX, e.clientY); };
    const handleTouch = (e: TouchEvent) => { onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const handleUp = () => onEnd();
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleTouch, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchend", handleUp);
    };
  }, [dragging, onMove, onEnd]);

  function handleClick() {
    if (didDrag.current) return;
    setOpen(!open);
  }

  const menuUp = pos.bottom < (typeof window !== "undefined" ? window.innerHeight / 2 : 400);

  return (
    <div
      className="fixed z-[9999] select-none"
      style={{ right: pos.right, bottom: pos.bottom, touchAction: "none" }}
      onMouseDown={e => onStart(e.clientX, e.clientY)}
      onTouchStart={e => onStart(e.touches[0].clientX, e.touches[0].clientY)}
    >
      {open && (
        <div className={`absolute right-0 flex flex-col gap-3 items-end ${menuUp ? "bottom-16" : "top-16"}`}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl shadow-lg border border-[#E8E0D8] hover:shadow-xl transition-all"
              >
                <span className="text-sm font-medium text-[#5C3E35] whitespace-nowrap">{action.label}</span>
                <div className={`w-8 h-8 rounded-lg ${action.bgLight} flex items-center justify-center`}>
                  <Icon size={16} className={action.textColor} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <button
        onClick={handleClick}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${dragging ? "scale-110" : "hover:scale-105"} ${open ? "bg-[#5C3E35] rotate-45" : "bg-[#B8837E] hover:bg-[#9A6B66]"}`}
      >
        {open ? <X size={24} className="text-white" /> : <Plus size={28} className="text-white" />}
      </button>
    </div>
  );
}
