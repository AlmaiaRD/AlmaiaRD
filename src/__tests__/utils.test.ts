import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  numberToWords,
  getInitials,
  roundToNearest50,
  getLocalDateString,
  cn,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("formats DOP with es-DO locale", () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain("1,500");
  });

  it("formats USD with en-US locale", () => {
    const result = formatCurrency(99.99, "USD");
    expect(result).toContain("$");
    expect(result).toContain("99.99");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toContain("0");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2024-06-15");
    expect(result).toContain("2024");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2024, 0, 1));
    expect(result).toContain("2024");
  });
});

describe("formatDateShort", () => {
  it("returns short date format", () => {
    const result = formatDateShort("2024-06-15");
    expect(result).not.toContain("2024");
  });
});

describe("numberToWords", () => {
  it("converts 0", () => {
    expect(numberToWords(0)).toBe("cero pesos dominicanos");
  });

  it("converts 1", () => {
    expect(numberToWords(1)).toBe("un peso dominicanos");
  });

  it("converts whole pesos", () => {
    expect(numberToWords(100)).toContain("cien");
    expect(numberToWords(100)).toContain("pesos");
  });

  it("includes decimals", () => {
    const result = numberToWords(150.75);
    expect(result).toContain("75/100");
  });

  it("handles thousands", () => {
    const result = numberToWords(2500);
    expect(result).toContain("mil");
  });
});

describe("getInitials", () => {
  it("returns first two initials", () => {
    expect(getInitials("Juan Perez")).toBe("JP");
  });

  it("handles single name", () => {
    expect(getInitials("Maria")).toBe("M");
  });

  it("is uppercase", () => {
    expect(getInitials("ana lopez")).toBe("AL");
  });
});

describe("roundToNearest50", () => {
  it("rounds up to nearest 50", () => {
    expect(roundToNearest50(1)).toBe(50);
    expect(roundToNearest50(49)).toBe(50);
    expect(roundToNearest50(50)).toBe(50);
    expect(roundToNearest50(51)).toBe(100);
  });
});

describe("getLocalDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = getLocalDateString(new Date(2024, 0, 5));
    expect(result).toBe("2024-01-05");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden")).toBe("base");
  });
});
