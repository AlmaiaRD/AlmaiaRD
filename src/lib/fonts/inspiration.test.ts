import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { registerInspiration } from "./inspiration";

describe("registerInspiration", () => {
  it("incrusta la fuente Inspiration en jsPDF y dibuja la firma sin error", () => {
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    registerInspiration(doc);
    expect(() => {
      doc.setFont("Inspiration", "normal");
      doc.setFontSize(11);
      doc.text("Yrahisa Mateo", 30, 30);
    }).not.toThrow();
    const out = doc.output("arraybuffer");
    expect(out.byteLength).toBeGreaterThan(5000);
  });
});