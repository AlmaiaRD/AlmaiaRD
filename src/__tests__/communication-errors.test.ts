import { describe, it, expect } from "vitest";
import { friendlyWhatsAppError, friendlyTelegramError } from "@/lib/communication-errors";

describe("friendlyWhatsAppError", () => {
  it("traduce número sin WhatsApp", () => {
    expect(friendlyWhatsAppError("131047")).toContain("no tiene WhatsApp");
    expect(friendlyWhatsAppError("(1105) Not on WhatsApp")).toContain("no tiene WhatsApp");
  });

  it("traduce ventana de 24h / plantillas", () => {
    expect(friendlyWhatsAppError("131026 Re-engagement message")).toContain("plantillas");
    expect(friendlyWhatsAppError("Message failed to send because more than 24 hours")).toContain("plantillas");
  });

  it("traduce límite de envío y tokens", () => {
    expect(friendlyWhatsAppError("rate limit 429")).toContain("Límite");
    expect(friendlyWhatsAppError("Error: access_token expired")).toContain("token de acceso");
    expect(friendlyWhatsAppError("HTTP 401")).toContain("token de acceso");
  });

  it("devuelve el error original cuando no coincide", () => {
    expect(friendlyWhatsAppError("algo raro")).toBe("algo raro");
    expect(friendlyWhatsAppError(null)).toContain("Error desconocido");
  });
});

describe("friendlyTelegramError", () => {
  it("traduce chat no iniciado y bot bloqueado", () => {
    expect(friendlyTelegramError("chat not found")).toContain("/start");
    expect(friendlyTelegramError("bot was blocked by the user")).toContain("bloqueó");
  });

  it("traduce forbidden, rate limits y tokens", () => {
    expect(friendlyTelegramError("forbidden: not enough rights")).toContain("no tiene permiso");
    expect(friendlyTelegramError("Too Many Requests: retry after 5")).toContain("límite");
    expect(friendlyTelegramError("401 Unauthorized")).toContain("token del bot");
  });

  it("devuelve el error original cuando no coincide", () => {
    expect(friendlyTelegramError("otro error")).toBe("otro error");
    expect(friendlyTelegramError(undefined)).toContain("Error desconocido");
  });
});