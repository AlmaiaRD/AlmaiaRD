"use client";

import { useEffect, useRef, useState } from "react";

interface WordmarkProps {
  /** Clases del h1 "ALMAIA" (fuente de marca, color, etc.). El tamaño lo
   *  calcula el componente para alinear con la frase inferior. */
  h1ClassName?: string;
  /** Clases del p tagline. */
  pClassName?: string;
  /** Frase inferior (por defecto "Bienestar & Salud"). */
  tagline?: string;
}

/**
 * Marca "ALMAIA" + tagline alineados: escala el tamaño de ALMAIA hasta que su
 * ancho coincide con el de la frase de abajo (bordes izq/der a la misma altura).
 * Se re-mide al redimensionar y al terminar de cargar las fuentes.
 */
export default function Wordmark({
  h1ClassName = "",
  pClassName = "",
  tagline = "Bienestar & Salud",
}: WordmarkProps) {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const pRef = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const h1 = h1Ref.current;
      const p = pRef.current;
      if (!h1 || !p) return;
      const tagW = p.getBoundingClientRect().width;
      const h1W = h1.getBoundingClientRect().width;
      const base = parseFloat(getComputedStyle(h1).fontSize);
      if (tagW > 0 && h1W > 0 && base > 0) {
        setFontSize((base * tagW) / h1W);
      }
    };

    update();
    const retry = window.setTimeout(update, 200); // por si las fuentes tardan
    window.addEventListener("resize", update);
    if (typeof document !== "undefined" && document.fonts?.ready?.then) {
      document.fonts.ready.then(update).catch(() => {});
    }
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="flex flex-col items-start">
      <h1
        ref={h1Ref}
        className={h1ClassName}
        style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
      >
        ALMAIA
      </h1>
      <p ref={pRef} className={pClassName}>
        {tagline}
      </p>
    </div>
  );
}