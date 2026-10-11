"use client"; // Los error boundaries deben ser Client Components

/**
 * Error GLOBAL: cubre fallos del layout raíz (html/body, carga de fuentes,
 * proveedores), que el `error.tsx` del dashboard NO alcanza porque está por
 * debajo. Reemplaza el layout raíz completo, por eso DEBE renderizar sus
 * propios <html> y <body> y traer sus propios estilos.
 *
 * (El ErrorBoundary del layout raíz sigue existiendo; este archivo es la capa
 * que Next.js invoca antes, a nivel de documento.)
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          background: "#F5EFE9",
          color: "#39484F",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <div
            style={{
              width: "4rem",
              height: "4rem",
              borderRadius: "9999px",
              background: "rgba(186, 74, 58, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: "1.75rem",
            }}
          >
            🌸
          </div>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.5rem" }}>Ups, algo salió mal</h1>
          <p style={{ fontSize: "1rem", color: "#4C5760", margin: "0 0 0.5rem" }}>
            La aplicación encontró un problema inesperado.
          </p>
          <p style={{ fontSize: "0.875rem", color: "#8A9199", margin: "0 0 2rem" }}>
            Tus datos no se han perdido. Puedes intentar de nuevo.
          </p>
          <button
            onClick={() => retry()}
            style={{
              height: "3rem",
              padding: "0 1.5rem",
              background: "#819E82",
              color: "#fff",
              border: "none",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
          {error?.digest ? (
            <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#A9A29B" }}>
              Código: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
