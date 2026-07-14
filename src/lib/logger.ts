const LOG_API = "/api/log";

type LogLevel = "info" | "warn" | "error";

function send(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const payload = { level, message, data, url: location.href, timestamp: new Date().toISOString() };

  if (process.env.NODE_ENV === "development") {
    console[level](`[${level.toUpperCase()}]`, message, data || "");
    return;
  }

  try {
    fetch(LOG_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // silent
  }
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => send("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) => send("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) => send("error", message, data),
};
