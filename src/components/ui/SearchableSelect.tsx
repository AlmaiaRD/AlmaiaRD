"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Color del focus/acento. "brand" = terracota, "success" = verde salvia. */
  tone?: "brand" | "success";
  className?: string;
  disabled?: boolean;
  /** Permite limpiar la selección con la X. */
  clearable?: boolean;
}

/** Normaliza texto para búsqueda insensible a acentos y mayúsculas. */
function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados",
  tone = "brand",
  className = "",
  disabled = false,
  clearable = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return options;
    return options.filter(
      (o) => norm(o.label).includes(q) || norm(o.sublabel || "").includes(q),
    );
  }, [options, query]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Enfocar el buscador y resetear al abrir
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // pequeño delay para que el input exista en el DOM
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  // Mantener el elemento activo visible
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function choose(optionValue: string) {
    onChange(optionValue);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) choose(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const ring =
    tone === "success"
      ? "focus:ring-[#86C7A3]/30 focus:border-[#86C7A3] ring-[#86C7A3]/30 border-[#86C7A3]"
      : "focus:ring-[#BA4A3A]/30 focus:border-[#BA4A3A] ring-[#BA4A3A]/30 border-[#BA4A3A]";

  const triggerCls = `w-full h-12 pl-4 ${
    clearable && selected ? "pr-16" : "pr-10"
  } rounded-xl border bg-[#F5EFE9] text-sm text-left focus:outline-none focus:ring-2 transition-all truncate ${
    open ? `ring-2 ${ring}` : "border-[#E0DAD3]"
  } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={triggerCls}
      >
        <span className={selected ? "text-[#39484F]" : "text-[#4C5760]"}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && selected && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-[#4C5760] hover:text-[#39484F] rounded"
            title="Limpiar"
          >
            <X size={14} />
          </span>
        )}
        <ChevronDown
          size={16}
          className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4C5760] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-[#E0DAD3] shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-[#E0DAD3]">
            <Search
              size={15}
              className="absolute left-4.5 top-1/2 -translate-y-1/2 text-[#4C5760]"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E0DAD3] bg-[#F5EFE9] text-sm text-[#39484F] placeholder:text-[#4C5760] focus:outline-none focus:ring-2 focus:ring-[#BA4A3A]/30 focus:border-[#BA4A3A] transition-all"
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-[#4C5760] py-4 text-center">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  data-index={i}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(o.value)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex flex-col gap-0.5 ${
                    i === activeIndex ? "bg-[#F1E9DF]" : ""
                  } ${o.value === value ? "font-semibold" : ""}`}
                >
                  <span className="text-[#39484F] truncate">{o.label}</span>
                  {o.sublabel && (
                    <span className="text-xs text-[#4C5760] truncate">
                      {o.sublabel}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
