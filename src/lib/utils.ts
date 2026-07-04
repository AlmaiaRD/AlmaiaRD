import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function numberToWords(amount: number): string {
  const unidades = [
    "", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
    "diecisiete", "dieciocho", "diecinueve", "veinte",
  ];
  const decenas = [
    "", "", "veinti", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa",
  ];
  const centenas = [
    "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
    "seiscientos", "setecientos", "ochocientos", "novecientos",
  ];

  function convertir(n: number): string {
    if (n === 0) return "cero";
    if (n === 100) return "cien";
    let r = "";
    if (n >= 100) {
      r += centenas[Math.floor(n / 100)] + " ";
      n %= 100;
    }
    if (n >= 30) {
      r += decenas[Math.floor(n / 10)];
      n %= 10;
      if (n > 0) r += " y " + unidades[n];
    } else if (n >= 20) {
      r += "veinti" + unidades[n - 20];
    } else {
      r += unidades[n];
    }
    return r.trim();
  }

  const entero = Math.floor(amount);
  const decimal = Math.round((amount - entero) * 100);

  let result = "";
  if (entero === 1) {
    result = "un peso";
  } else if (entero === 0) {
    result = "cero pesos";
  } else {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    if (miles > 0) {
      if (miles === 1) result += "mil ";
      else result += convertir(miles) + " mil ";
    }
    result += convertir(resto);
    result += " pesos";
  }

  if (decimal > 0) {
    result += ` con ${decimal.toString().padStart(2, "0")}/100`;
  }

  return result + " dominicanos";
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function roundToNearest50(value: number): number {
  return Math.ceil(value / 50) * 50;
}

export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
