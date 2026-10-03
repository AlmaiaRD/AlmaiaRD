import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reporta errores capturados por el servidor. Sentry ya captura los errores de
// render (vía captureServerError), así que aquí NO se llama a Sentry para evitar
// duplicados: se escribe en los logs del servidor (Vercel), que es un destino
// distinto. Se omiten request.headers a propósito: pueden contener cookies y
// tokens de sesión, que no deben terminar en un log.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  try {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: unknown }).digest)
        : undefined;

    console.error(
      "[onRequestError]",
      JSON.stringify({
        message: error instanceof Error ? error.message : String(error),
        digest,
        path: request.path,
        method: request.method,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource,
      })
    );
  } catch {
    // Nunca relanzar desde onRequestError: taparía el error original que se
    // está intentando reportar.
  }
};
