"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Miniaturas del catalogo.
 *
 * Antes cada producto era un <img> pelado. Un <img> no carga de forma perezosa
 * por defecto, asi que una lista de 100 productos intentaba bajar las 100
 * fotos enteras de golpe: fotos de movil de hasta 2 MB, o sea del orden de
 * 200 MB para abrir un listado. Este componente:
 *
 * - Redimensiona en el servidor a la medida que se muestra, asi que se baja una
 *   miniatura y no el original.
 * - Carga solo lo que se ve en pantalla.
 * - Muestra un fondo mientras llega, para que la lista no dé saltos de alto.
 *
 * POR QUE NO SE USA PARA EL LOGO NI LA FIRMA
 * Esas URLs las escribe la usuaria en Configuracion y pueden venir de
 * cualquier sitio. Pasarlas por el optimizador de Next obligaria a permitir
 * cualquier host, y ese optimizador descarga desde el servidor: es
 * exactamente el hueco que cerraria isAllowedUrl. Ademas el logo y la firma se
 * rasterizan con dom-to-image para el PDF, y una imagen con carga perezosa
 * todavia no descargada sale en blanco en el PDF.
 */

const SUPABASE_HOST_SUFFIX = ".supabase.co";
const PRODUCT_PATH = "/storage/v1/object/public/product-images/";

/** Imagen diminuta en memoria: un degradado del color de la app. */
const BLUR =
  "data:image/svg+xml;base64," +
  btoaFallback(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#F1E9DF"/><rect width="8" height="4" fill="#F3EBE1"/></svg>'
  );

/** btoa no existe en Node durante el render de servidor. */
function btoaFallback(svg: string): string {
  if (typeof btoa === "function") return btoa(svg);
  return Buffer.from(svg, "utf-8").toString("base64");
}

/**
 * El optimizador solo acepta los hosts que esten en next.config. Si la URL no
 * es del bucket de productos (una fila antigua subida antes de cambiar de
 * bucket, por ejemplo) se cae a un <img> normal en vez de reventar la pagina.
 */
export function canOptimize(url: string): boolean {
  if (typeof window !== "undefined") {
    // En el navegador no se puede usar Buffer; y aqui solo hace falta una
    // comparacion sin depender de Node.
    try {
      const parsed = new URL(url, window.location.origin);
      return (
        parsed.protocol === "https:" &&
        parsed.hostname.endsWith(SUPABASE_HOST_SUFFIX) &&
        parsed.pathname.startsWith(PRODUCT_PATH)
      );
    } catch {
      return false;
    }
  }
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(SUPABASE_HOST_SUFFIX) &&
      parsed.pathname.startsWith(PRODUCT_PATH)
    );
  } catch {
    return false;
  }
}

export interface ProductImageProps {
  src: string;
  alt: string;
  /** Ancho en pixeles CSS. Las fotos son cuadradas, asi que tambien es el alto. */
  size?: number;
  /** Tamano real del recuadro cuando lo manda el contenedor (object-contain). */
  className?: string;
  sizes?: string;
  /** Las imagenes del desplegable de cotizaciones son pequenas. */
  loading?: "lazy" | "eager";
  /** Las que van justo al entrar se cargan ya, sin esperar al scroll. */
  priority?: boolean;
}

/** El ancho que se le pide al optimizador sale de `sizes`, no de este numero. */

export function ProductImage({
  src,
  alt,
  size = 128,
  className = "",
  sizes,
  loading,
  priority,
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);

  if (!canOptimize(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL fuera del bucket de productos: el optimizador la rechazaria
      <img
        src={src}
        alt={alt}
        loading={loading ?? "lazy"}
        decoding="async"
        className={className}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={sizes ?? `${size}px`}
      loading={priority ? undefined : (loading ?? "lazy")}
      priority={priority}
      placeholder="blur"
      blurDataURL={BLUR}
      onLoad={() => setLoaded(true)}
      className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}

export default ProductImage;
