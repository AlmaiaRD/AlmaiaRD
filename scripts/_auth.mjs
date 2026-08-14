#!/usr/bin/env node
// Helper compartido: lee credenciales de admin desde .env.local.
// NUNCA hardcodear credenciales en los scripts.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const env = {};
  const lines = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return env;
}

export function adminCredentials() {
  const env = loadEnv();
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Faltan ADMIN_EMAIL/ADMIN_PASSWORD en .env.local");
    process.exit(1);
  }
  return { email, password };
}
