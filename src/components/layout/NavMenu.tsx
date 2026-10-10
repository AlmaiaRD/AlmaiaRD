"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Pin, PinOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAMILIES, MAX_FAVORITES, modulesByFamily } from "@/lib/modules";
import { useFavorites } from "@/hooks/useFavorites";

function activeFor(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname.startsWith(href);
}

export default function NavMenu() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown de familia al hacer clic fuera o presionar Escape.
  useEffect(() => {
    if (!openFamily) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenFamily(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFamily(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openFamily]);

  const familyPills = FAMILIES.map((fam) => ({
    fam,
    modules: modulesByFamily(fam.id),
  }));

  const allModules = FAMILIES.flatMap((f) => modulesByFamily(f.id));
  const favModules = favorites
    .map((href) => ({
      href,
      module: allModules.find((m) => m.href === href),
    }))
    .filter((x): x is { href: string; module: NonNullable<typeof x.module> } => Boolean(x.module));

  function PinButton({ href, className }: { href: string; className?: string }) {
    const pinned = isFavorite(href);
    return (
      <button
        type="button"
        aria-label={pinned ? "Quitar de favoritos" : "Fijar como favorito"}
        title={pinned ? "Quitar de favoritos" : "Fijar como favorito"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(href);
        }}
        className={cn(
          "shrink-0 rounded-lg p-1.5 transition-colors",
          pinned
            ? "text-[#BA4A3A] bg-[#F2E2DD] hover:bg-[#E8D3CB]"
            : "text-[#A99B90] hover:text-[#BA4A3A] hover:bg-[#F5EFE9]",
          className
        )}
      >
        {pinned ? <Pin size={15} /> : <PinOff size={15} />}
      </button>
    );
  }

  return (
    <div ref={wrapperRef}>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden flex items-center gap-2 text-text-muted hover:text-foreground px-2 py-2"
        aria-label="Menú de navegación"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        <span className="text-sm font-medium">Menú</span>
      </button>

      {/* ===== MÓVIL ===== */}
      {mobileOpen && (
        <div className="lg:hidden flex flex-col gap-3 pb-3 pt-1">
          {/* Favoritos (móvil) */}
          {favModules.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="px-4 text-[11px] font-bold uppercase tracking-widest text-[#BA4A3A]">
                Favoritos
              </p>
              {favModules.map(({ href, module }) => {
                const Icon = module.icon;
                const active = activeFor(href, pathname);
                return (
                  <div
                    key={href}
                    className={cn(
                      "flex items-center gap-1 rounded-xl border border-[#F2E2DD] bg-[#FFF8F5] px-1 pr-1",
                      active && "border-[#BA4A3A] bg-[#F2E2DD]"
                    )}
                  >
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="flex flex-1 items-center gap-3 px-3 py-2.5 rounded-r-xl text-sm font-semibold text-[#BA4A3A]"
                    >
                      <Pin size={15} className="shrink-0" />
                      <Icon size={20} />
                      <span className="truncate">{module.label}</span>
                    </Link>
                    <PinButton href={href} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Familias (móvil, acordeón) */}
          {familyPills.map(({ fam, modules }) => {
            const open = openFamily === fam.id;
            return (
              <div key={fam.id} className="flex flex-col gap-1">
                <button
                  onClick={() => setOpenFamily(open ? null : fam.id)}
                  className="flex items-center justify-between px-4 py-2 rounded-xl text-sm font-bold text-[#39484F] hover:bg-secondary-bg"
                >
                  {fam.label}
                  <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="flex flex-col gap-1">
                    {modules.map((item) => {
                      const Icon = item.icon;
                      const active = activeFor(item.href, pathname);
                      return (
                        <div key={item.href} className="flex items-center gap-1 pl-4 pr-1">
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex flex-1 items-center gap-3 px-4 py-2.5 rounded-r-xl text-sm font-semibold transition-all duration-200",
                              active ? "bg-primary/10 text-primary" : "text-text-muted hover:text-foreground hover:bg-secondary-bg"
                            )}
                          >
                            <Icon size={20} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                          <PinButton href={item.href} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===== ESCRITORIO ===== */}
      <nav className="hidden lg:flex flex-col gap-1 py-1">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {familyPills.map(({ fam }) => {
            const famOpen = openFamily === fam.id;
            return (
              <div key={fam.id} className="relative">
                <button
                  onClick={() => setOpenFamily(famOpen ? null : fam.id)}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 whitespace-nowrap",
                    famOpen
                      ? "bg-[#F2E2DD] text-[#BA4A3A]"
                      : "text-text-muted hover:text-foreground hover:bg-secondary-bg",
                    modulesByFamily(fam.id).some((m) => activeFor(m.href, pathname)) &&
                      "border-b-2 border-[#BA4A3A] shadow-[0_2px_8px_rgba(186,74,58,0.15)]"
                  )}
                >
                  {fam.label}
                  <ChevronDown
                    size={15}
                    className={cn("transition-transform", famOpen && "rotate-180")}
                  />
                </button>

                {famOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-[#E0DAD3] shadow-lg p-2 z-50">
                    {modulesByFamily(fam.id).map((item) => {
                      const Icon = item.icon;
                      const active = activeFor(item.href, pathname);
                      return (
                        <div
                          key={item.href}
                          className={cn(
                            "flex items-center gap-1 rounded-xl",
                            active ? "bg-[#FFF5F2]" : "hover:bg-[#F5EFE9]"
                          )}
                        >
                          <Link
                            href={item.href}
                            onClick={() => setOpenFamily(null)}
                            className={cn(
                              "flex flex-1 items-center gap-3 px-3 py-2.5 rounded-l-xl text-sm font-semibold",
                              active ? "text-[#BA4A3A]" : "text-[#39484F] hover:text-[#BA4A3A]"
                            )}
                          >
                            <Icon size={19} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                          <PinButton href={item.href} className="mr-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Segunda línea: Favoritos */}
        {favModules.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1.5 border-t border-[#F0EBE3]">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#BA4A3A] pr-1">
              Favoritos
            </span>
            {favModules.map(({ href, module }) => {
              const Icon = module.icon;
              const active = activeFor(href, pathname);
              return (
                <div
                  key={href}
                  className={cn(
                    "flex items-center gap-0.5 rounded-xl border border-[#F2E2DD] bg-[#FFF8F5] pl-1 pr-0.5",
                    active &&
                      "border-[#BA4A3A] bg-[#F2E2DD] shadow-[0_2px_8px_rgba(186,74,58,0.18)]"
                  )}
                >
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-l-xl text-sm font-semibold whitespace-nowrap",
                      active ? "text-[#BA4A3A]" : "text-[#9C382A] hover:text-[#BA4A3A]"
                    )}
                  >
                    <Icon size={16} />
                    <span className="truncate max-w-[140px]">{module.label}</span>
                  </Link>
                  <PinButton href={href} className="p-1" />
                </div>
              );
            })}
            {favorites.length >= MAX_FAVORITES && (
              <span className="text-[11px] text-[#A99B90]" title={`Límite de ${MAX_FAVORITES} favoritos`}>
                máx {MAX_FAVORITES}
              </span>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}