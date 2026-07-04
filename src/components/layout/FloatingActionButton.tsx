"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, FileText, Receipt, ShoppingCart, UserPlus } from "lucide-react";
import Link from "next/link";

const actions = [
  { href: "/facturacion?nueva=true", label: "Nueva Factura", icon: FileText, color: "bg-[#B8837E]" },
  { href: "/recibos?nuevo=true", label: "Registrar Pago", icon: Receipt, color: "bg-[#86C7A3]" },
  { href: "/inventario?nueva-compra=true", label: "Registrar Compra", icon: ShoppingCart, color: "bg-[#C9A89C]" },
  { href: "/clientes?nuevo=true", label: "Añadir Cliente", icon: UserPlus, color: "bg-[#B8837E]" },
];

const STORAGE_KEY = "fab-position";

function getInitialPosition() {
  if (typeof window === "undefined") return { x: 16, y: 96 };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { x: window.innerWidth - 70, y: window.innerHeight - 96 };
}

export default function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(getInitialPosition);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const didDrag = useRef(false);

  const menuUp = pos.y > (typeof window !== "undefined" ? window.innerHeight / 2 : 400);

  const savePos = useCallback((p: { x: number; y: number }) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }, []);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const onStart = useCallback((clientX: number, clientY: number) => {
    didDrag.current = false;
    setDragging(true);
    startRef.current = { x: clientX, y: clientY, posX: pos.x, posY: pos.y };
  }, [pos]);

  const onMove = useCallback((clientX: number, clientY: number) => {
    if (!dragging) return;
    const dx = clientX - startRef.current.x;
    const dy = clientY - startRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
    const maxX = typeof window !== "undefined" ? window.innerWidth - 64 : 300;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 64 : 600;
    const newX = clamp(startRef.current.posX + dx, 8, maxX);
    const newY = clamp(startRef.current.posY + dy, 8, maxY);
    setPos({ x: newX, y: newY });
  }, [dragging]);

  const onEnd = useCallback(() => {
    setDragging(false);
    savePos(pos);
  }, [pos, savePos]);

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

  return (
    <div
      ref={dragRef}
      className="fixed z-50 select-none relative"
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      onMouseDown={e => onStart(e.clientX, e.clientY)}
      onTouchStart={e => onStart(e.touches[0].clientX, e.touches[0].clientY)}
    >
      {open && (
        <div className={`absolute right-0 flex flex-col gap-3 items-end pointer-events-auto ${menuUp ? "bottom-16" : "top-16"}`}>
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
                <div className={`w-8 h-8 rounded-lg ${action.color}/10 flex items-center justify-center`}>
                  <Icon size={16} className={action.color.replace("bg-", "text-")} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <button
        onClick={handleClick}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 pointer-events-auto ${dragging ? "scale-110" : ""} ${open ? "bg-[#5C3E35] rotate-45" : "bg-[#B8837E] hover:bg-[#9A6B66]"}`}
      >
        {open ? <X size={24} className="text-white" /> : <Plus size={28} className="text-white" />}
      </button>
    </div>
  );
}
