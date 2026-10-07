import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { registerItaliana } from "./italiana";

describe("registerItaliana", () => {
  it("incrusta la fuente Italiana en jsPDF y dibuja el nombre de la marca sin error", () => {
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    registerItaliana(doc);
    expect(() => {
      doc.setFont("Italiana", "normal");
      doc.setFontSize(22);
      doc.text("ALMAIA RD", 30, 30);
    }).not.toThrow();
    const out = doc.output("arraybuffer");
    expect(out.byteLength).toBeGreaterThan(5000);
  });
});