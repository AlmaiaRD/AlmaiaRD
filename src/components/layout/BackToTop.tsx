"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const SCROLL_THRESHOLD = 300;
const FAB_SIZE = 56;
const GAP = 12;
const FAB_KEY_RIGHT = "fab-pos-right";
const FAB_KEY_BOTTOM = "fab-pos-bottom";

function loadFabPosition() {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem(FAB_KEY_RIGHT);
    const b = localStorage.getItem(FAB_KEY_BOTTOM);
    if (!r && !b) return null;
    const right = r ? Number(r) : 16;
    const bottom = b ? Number(b) : 24;
    if (!Number.isFinite(right) || !Number.isFinite(bottom)) return null;
    return { right, bottom };
  } catch { console.error("Error al leer posición del FAB"); }
  return null;
}

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(() => {
    const p = loadFabPosition();
    return { right: (p?.right ?? 16) + FAB_SIZE + GAP, bottom: p?.bottom ?? 24 };
  });

  useEffect(() => {
    const update = () => {
      const scroller = document.scrollingElement || document.documentElement;
      const hasOverflow = scroller.scrollHeight > window.innerHeight;
      setVisible(hasOverflow && scroller.scrollTop > SCROLL_THRESHOLD);
      const p = loadFabPosition();
      if (p) {
        const next = { right: p.right + FAB_SIZE + GAP, bottom: p.bottom };
        setPos(prev => (prev.right === next.right && prev.bottom === next.bottom ? prev : next));
      }
    };
    update();
    document.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("storage", update);
    return () => {
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      title="Volver arriba"
      className="fixed z-[9998] w-11 h-11 rounded-full bg-[#5C3E35] text-white shadow-xl flex items-center justify-center hover:bg-[#3F2A24] hover:scale-105 transition-all duration-200"
      style={{ right: pos.right, bottom: pos.bottom }}
    >
      <ArrowUp size={20} />
    </button>
  );
}
