import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SISTEMA DE FACTURACION ALMAIA RD",
    short_name: "Almaia RD",
    id: "/",
    description:
      "Sistema integral de gestión comercial para distribución Amway en República Dominicana",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFAF7",
    theme_color: "#B8837E",
    orientation: "portrait-primary",
    categories: ["business", "finance"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
