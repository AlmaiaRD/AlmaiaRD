/**
 * Capa unificada de IA.
 *
 * Antes: cada ruta de API llamaba directo a OpenAI con gpt-4o-mini. Eso
 * obligaba a tener una clave de pago y, sin ella, la función moría con un
 * error 500 aunque el catálogo estuviera disponible.
 *
 * Ahora: `generateText()` prueba los proveedores configurados en orden y
 * devuelve el primero que responda. Si ninguno está disponible, las rutas
 * que lo necesitan caen a su lógica de palabras clave (`keywordFallback`), de
 * modo que la aplicación sigue siendo útil sin ninguna clave.
 *
 * Proveedores, por orden de preferencia:
 *
 *   1. GROQ_API_KEY        Gratis, muy rápido, compatible con la API de
 *                          OpenAI, y su multimodal sí lee imágenes (lo usa
 *                          /api/parse-purchase para extraer la factura).
 *   2. OPENROUTER_API_KEY  Gratis con límites generosos, muchos modelos.
 *   3. OLLAMA_BASE_URL     IA local en tu propia computadora. Sin clave, sin
 *                          costo, sin que nada salga de tu red. Requiere
 *                          tener Ollama instalado y un modelo descargado.
 *   4. OPENAI_API_KEY      Se mantiene por compatibilidad con quien ya la
 *                          tenga configurada. No es necesario para usar la app.
 *
 * Variables de entorno (todas opcionales, ver .env.example).
 */

export type AIProvider = "groq" | "openrouter" | "ollama" | "openai";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  /** Texto plano. Para mensajes con imagen, usar además `imageUrls`. */
  content: string;
  /**
   * Una o varias imagenes en base64 o URL. Solo las entienden los proveedores
   * con vision (Groq y OpenAI; OpenRouter segun el modelo). Es un array
   * porque una factura de compra puede tener hasta 10 paginas y todas llegan
   * en la misma peticion.
   */
  imageUrls?: string[];
}

export interface GenerateOptions {
  system?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string | null;
  provider: AIProvider | null;
  /** Motivo por el que se agotaron los proveedores, para diagnóstico. */
  error?: string;
}

interface ProviderConfig {
  name: AIProvider;
  url: string;
  apiKey?: string;
  model: string;
  supportsVision: boolean;
}

/** Modelos por defecto de cada proveedor. */
const DEFAULTS: Record<AIProvider, { model: string; supportsVision: boolean }> = {
  groq: { model: "llama-3.3-70b-versatile", supportsVision: true },
  openrouter: { model: "meta-llama/llama-3.3-70b-instruct:free", supportsVision: false },
  ollama: { model: "llama3.2", supportsVision: false },
  openai: { model: "gpt-4o-mini", supportsVision: true },
};

function buildProviders(needsVision: boolean): ProviderConfig[] {
  const list: ProviderConfig[] = [];

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    list.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      model: process.env.GROQ_MODEL?.trim() || DEFAULTS.groq.model,
      supportsVision: DEFAULTS.groq.supportsVision,
    });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    list.push({
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openrouterKey,
      model: process.env.OPENROUTER_MODEL?.trim() || DEFAULTS.openrouter.model,
      supportsVision: DEFAULTS.openrouter.supportsVision,
    });
  }

  // Ollama no necesita clave: basta con que el servidor esté encendido.
  const ollamaUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (ollamaUrl) {
    list.push({
      name: "ollama",
      // Ollama expone un endpoint compatible con OpenAI desde v0.1.24.
      url: `${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`,
      apiKey: "ollama",
      model: process.env.OLLAMA_MODEL?.trim() || DEFAULTS.ollama.model,
      supportsVision: DEFAULTS.ollama.supportsVision,
    });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && openaiKey.startsWith("sk-")) {
    list.push({
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || DEFAULTS.openai.model,
      supportsVision: DEFAULTS.openai.supportsVision,
    });
  }

  // Una petición con imagen solo puede ir a proveedores que la entiendan.
  return needsVision ? list.filter((p) => p.supportsVision) : list;
}

/** ¿Hay algún proveedor configurado? Permite avisar en la interfaz. */
export function hasAnyProvider(): boolean {
  return (
    Boolean(process.env.GROQ_API_KEY?.trim()) ||
    Boolean(process.env.OPENROUTER_API_KEY?.trim()) ||
    Boolean(process.env.OLLAMA_BASE_URL?.trim()) ||
    Boolean(process.env.OPENAI_API_KEY?.trim()?.startsWith("sk-"))
  );
}

function toWireMessages(msgs: AIMessage[]) {
  return msgs.map((m) => {
    if (!m.imageUrls?.length) return { role: m.role, content: m.content };
    // Formato multimodal de la API de OpenAI, que Groq también acepta.
    return {
      role: m.role,
      content: [
        { type: "text", text: m.content },
        ...m.imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
      ],
    };
  });
}

async function callProvider(
  p: ProviderConfig,
  opts: GenerateOptions
): Promise<string | null> {
  const systemMsgs: AIMessage[] = opts.system ? [{ role: "system", content: opts.system }] : [];
  const wire = toWireMessages([...systemMsgs, ...opts.messages]);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (p.apiKey) headers.Authorization = `Bearer ${p.apiKey}`;

  const res = await fetch(p.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: p.model,
      messages: wire,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 800,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

/**
 * Genera texto con el primer proveedor disponible.
 *
 * Devuelve `text: null` en lugar de lanzar cuando todos fallan: las rutas
 * siempre tienen un camino de salida sin IA, y no queremos un 500 porque un
 * servicio externo tuvo un mal día.
 */
export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  const needsVision = opts.messages.some((m) => Boolean(m.imageUrls?.length));
  const providers = buildProviders(needsVision);

  if (providers.length === 0) {
    return { text: null, provider: null, error: "sin proveedor de IA configurado" };
  }

  const failures: string[] = [];
  for (const p of providers) {
    try {
      const text = await callProvider(p, opts);
      if (text) return { text, provider: p.name };
      failures.push(`${p.name}: respuesta vacía`);
    } catch (err) {
      failures.push(`${p.name}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return { text: null, provider: null, error: failures.join(" | ") };
}

/**
 * Extrae un array JSON de la respuesta de la IA.
 *
 * Los modelos pequeños suelen envolver el JSON en ```json ... ``` o le
 * añadir texto alrededor, así que se limpia antes de parsear.
 */
export function extractJsonArray(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
