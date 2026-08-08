import { describe, it, expect } from "vitest";
import { ITBIS_RATE, ITBIS_MULTIPLIER, SESSION_TIMEOUT_MS } from "@/lib/constants";

describe("constants", () => {
  it("ITBIS_RATE is 0.18", () => {
    expect(ITBIS_RATE).toBe(0.18);
  });

  it("ITBIS_MULTIPLIER is 1.18", () => {
    expect(ITBIS_MULTIPLIER).toBe(1.18);
  });

  it("SESSION_TIMEOUT_MS is 30 minutes", () => {
    expect(SESSION_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});
