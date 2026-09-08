import { supabase } from "@/lib/supabase";

const MEDIA_MAX_BYTES = 8 * 1024 * 1024; // 8MB (límite razonable para WhatsApp/Telegram)

export async function uploadMediaFile(
  file: File
): Promise<{ url?: string; error?: string }> {
  try {
    if (file.size > MEDIA_MAX_BYTES) {
      return { error: "El archivo supera 8MB. Usa un archivo más pequeño o una URL pública." };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "archivo";
    const path = `comms/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      return { error: `No se pudo subir el archivo: ${uploadError.message} (¿el bucket de almacenamiento está configurado?)` };
    }

    const { data, error: urlError } = await supabase.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60);

    if (urlError || !data?.signedUrl) {
      return { error: "No se pudo generar la URL del archivo subido." };
    }

    return { url: data.signedUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Error inesperado al subir el archivo" };
  }
}

export function guessMediaType(mime: string): { type: "image" | "document" | "audio" | "video"; telegram: "photo" | "document" | "audio" | "video" } {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return { type: "image", telegram: "photo" };
  if (m.startsWith("audio/")) return { type: "audio", telegram: "audio" };
  if (m.startsWith("video/")) return { type: "video", telegram: "video" };
  return { type: "document", telegram: "document" };
}