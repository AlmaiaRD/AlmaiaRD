const fs = require("fs");
let sql = fs.readFileSync("scripts/seed-data.sql", "utf-8");

// Fix every UUID-like string: replace non-hex chars in each segment
sql = sql.replace(/'([a-f0-9-]+)'/gi, (match, p1) => {
  const parts = p1.split("-");
  if (parts.length !== 5) return match;
  const lens = [8, 4, 4, 4, 12];
  for (let i = 0; i < 5; i++) {
    if (parts[i].length !== lens[i]) return match;
  }
  // Map any non-hex first char to a valid hex
  const hexMap = { c: "a1", p: "b2", i: "c3", r: "d4", e: "e5", s: "f6", f: "97", b: "88", h: "76" };
  const fixed = parts.map((p) => {
    let result = p.toLowerCase();
    for (const [char, repl] of Object.entries(hexMap)) {
      result = result.replaceAll(char, repl);
    }
    return result;
  }).join("-");
  
  // Ensure it passes UUID regex
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fixed)) {
    return "'" + fixed + "'";
  }
  return match;
});

fs.writeFileSync("scripts/seed-data.sql", sql, "utf-8");
console.log("✓ UUIDs fixed");
// Show first few UUIDs
const lines = sql.split("\n");
lines.slice(6, 8).forEach(l => console.log(l));
