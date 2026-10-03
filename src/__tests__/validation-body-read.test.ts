import { describe, it, expect } from "vitest";
import {
  validateBody,
  sendEmailSchema,
  aiChatSchema,
  preferencesSchema,
  whatsappSendSchema,
  telegramSendSchema,
} from "@/lib/validation";

/**
 * Regresión C-1 (auditoría 10/10/2026).
 *
 * `validateBody()` consumía el cuerpo del `Request` y doce rutas lo volvían a
 * leer con `req.json()`. Como el body es un stream de un solo uso, la segunda
 * lectura lanzaba `TypeError: Body is unusable` -> HTTP 500 en cada POST válido
 * de email, WhatsApp, Telegram, parseo de compras e IA.
 *
 * Estos tests fijan el contrato que rompió: validar NO debe agotar el cuerpo.
 */

function postRequest(payload: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("validateBody — el cuerpo sigue disponible tras validar (C-1)", () => {
  it("permite leer el body original después de validar", async () => {
    const req = postRequest({ query: "hola" });

    const parsed = await validateBody(aiChatSchema)(req);
    expect(parsed).toEqual({ query: "hola" });

    // Esta es la lectura que reventaba con TypeError antes del fix.
    const reread = await req.json();
    expect(reread).toEqual({ query: "hola" });
  });

  it("permite leer el body aunque la validación consuma primero el clon", async () => {
    const req = postRequest({
      to: "cliente@example.com",
      subject: "Factura",
      body: "Adjunto tu factura.",
    });

    await validateBody(sendEmailSchema)(req);

    const reread = await req.json();
    expect(reread.to).toBe("cliente@example.com");
  });

  it("deja el body intacto también cuando la validación falla", async () => {
    // query demasiado larga -> ZodError
    const req = postRequest({ query: "x".repeat(5000) });

    await expect(validateBody(aiChatSchema)(req)).rejects.toThrow(/Validación fallida/);

    // El clon se consumió, pero el request original sigue legible.
    const reread = await req.json();
    expect((reread as { query: string }).query).toHaveLength(5000);
  });

  it("sigue devolviendo el valor parseado (contrato intacto)", async () => {
    const parsed = await validateBody(
      whatsappSendSchema,
    )(postRequest({ configId: "3f1b1a2c-1111-4222-8333-444455556666", to: "+18095551234", type: "text", text: "hola" }));

    expect(parsed.type).toBe("text");
    expect(parsed.to).toBe("+18095551234");
  });

  it("rechaza body no-JSON con un error utilizable", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "no soy json",
    });

    await expect(validateBody(aiChatSchema)(req)).rejects.toThrow();
  });
});

describe("validateBody — esquemas con reglas de negocio", () => {
  it("exige mediaType cuando hay mediaUrl en Telegram", async () => {
    await expect(
      validateBody(telegramSendSchema)(
        postRequest({
          configId: "3f1b1a2c-1111-4222-8333-444455556666",
          chatId: "123",
          text: "hola",
          mediaUrl: "https://example.com/a.jpg",
        }),
      ),
    ).rejects.toThrow(/mediaType/);
  });

  it("acepta preferences con claves adicionales (passthrough)", async () => {
    const parsed = await validateBody(preferencesSchema)(
      postRequest({ theme: "dark", customFlag: true }),
    );
    expect(parsed.theme).toBe("dark");
    expect(parsed.customFlag).toBe(true);
  });
});