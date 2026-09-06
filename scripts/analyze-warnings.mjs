import fs from "node:fs";
import path from "node:path";

const file = process.argv[2];
const buf = fs.readFileSync(file);
let text;
if (buf.subarray(0, 2).toString("hex") === "feff") {
  text = buf.toString("utf16le").replace(/^\uFEFF/, "");
} else {
  text = buf.toString("utf8").replace(/^\uFEFF/, "");
}
const report = JSON.parse(text);

let total = 0;
const byRule = {};
const byFile = {};

for (const f of report) {
  const msgs = f.messages.filter((m) => m.severity >= 1);
  if (msgs.length === 0) continue;
  const rel = f.filePath.replace(/\\/g, "/").replace("C:/Users/soporte/Desktop/AMWAY/AlmaiaRD-Web/", "");
  byFile[rel] = (byFile[rel] || 0) + msgs.length;
  for (const m of msgs) {
    total++;
    byRule[m.ruleId] = (byRule[m.ruleId] || 0) + 1;
  }
}

console.log("TOTAL:", total);
console.log("\n=== Por regla ===");
Object.entries(byRule)
  .sort((a, b) => b[1] - a[1])
  .forEach(([r, n]) => console.log(String(n).padStart(6), r));

console.log("\n=== Por archivo ===");
Object.entries(byFile)
  .sort((a, b) => b[1] - a[1])
  .forEach(([f, n]) => console.log(String(n).padStart(6), f));
