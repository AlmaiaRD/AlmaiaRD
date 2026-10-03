/**
 * Credenciales de la suite E2E.
 *
 * IMPORTANTE (auditoría 2026-10-02): antes estas credenciales estaban
 * hardcodeadas en los `.spec.ts` (correo + contraseña del administrador de
 * PRODUCCIÓN). Eso exponía un secreto real en el historial de git y en el
 * paquete de despliegue. Ahora SOLO se leen de variables de entorno.
 *
 * Definelas en `.env.local` (ignorado por git) o en el entorno del CI:
 *
 *   E2E_TEST_EMAIL=...
 *   E2E_TEST_PASSWORD=...
 *
 * Si faltan, las pruebas que necesitan autenticación fallan con un mensaje
 * explícito en lugar de caer silenciosamente en un login "de prueba".
 */
export interface E2ECredentials {
  email: string;
  password: string;
}

export function getE2ECredentials(): E2ECredentials {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  const missing: string[] = [];
  if (!email) missing.push("E2E_TEST_EMAIL");
  if (!password) missing.push("E2E_TEST_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `E2E: faltan variables de entorno (${missing.join(", ")}). ` +
        `Definelas en .env.local o en el entorno del CI. ` +
        `Las credenciales NO deben estar hardcodeadas en el repositorio.`
    );
  }

  return { email: email as string, password: password as string };
}

/** Indica si las credenciales E2E están configuradas (para saltar tests). */
export function hasE2ECredentials(): boolean {
  return Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);
}
