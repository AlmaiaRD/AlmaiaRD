// Mensajes de error amigables para los canales de comunicación.
// Se aplican ANTES de mostrar el error al usuario en toasts/listas de resultados.

export function friendlyWhatsAppError(error: string | null | undefined): string {
  const e = (error || "").toLowerCase();
  if (!e) return "Error desconocido al enviar el mensaje";

  if (e.includes("131047") || (e.includes("1105") && e.includes("not on whatsapp")) || e.includes("not on whatsapp") || e.includes("doesn't have whatsapp")) {
    return "Este número no tiene WhatsApp activo. Pide al cliente que verifique su número.";
  }
  if (e.includes("131026") || e.includes("re-engagement") || e.includes("24-hour") || e.includes("template")) {
    return "Meta solo permite enviar mensajes con plantillas aprobadas hasta que el cliente te escriba. Usa una plantilla aprobada en la pestaña Plantillas.";
  }
  if (e.includes("rate") || e.includes("too many") || e.includes("429")) {
    return "Límite de envío alcanzado. Espera unos minutos e intenta de nuevo.";
  }
  if (e.includes("access_token") || e.includes("expired") || e.includes("401") || e.includes("403")) {
    return "El token de acceso de Meta venció o no tiene permisos. Revisa la configuración del WhatsApp.";
  }
  if (e.includes("phone") || e.includes("not found")) {
    return "El número no existe o está mal escrito.";
  }
  return error || "Error al enviar el mensaje";
}

export function friendlyTelegramError(error: string | null | undefined): string {
  const e = (error || "").toLowerCase();
  if (!e) return "Error desconocido al enviar el mensaje";

  if (e.includes("chat not found") || e.includes("bot can't initiate")) {
    return "El cliente no ha iniciado conversación con el bot. Pídeles que abran tu bot y envíen /start.";
  }
  if (e.includes("bot was blocked") || e.includes("kicked from the group")) {
    return "El cliente bloqueó al bot o lo eliminó. Debe desbloquearlo y enviar /start de nuevo.";
  }
  if (e.includes("forbidden") || e.includes("not enough rights")) {
    return "El bot no tiene permiso para enviar mensajes a esta conversación.";
  }
  if (e.includes("too many requests") || e.includes("429") || e.includes("retry after")) {
    return "Telegram pidió esperar (límite de mensajes). Espera unos segundos e intenta de nuevo.";
  }
  if (e.includes("unauthorized")) {
    return "El token del bot es inválido. Revisa los Bots y Webhook.";
  }
  if (e.includes("entity") || e.includes("invalid")) {
    return "El chat_id no es válido. Verifica que el cliente compartió el número correcto.";
  }
  return error || "Error al enviar el mensaje";
}