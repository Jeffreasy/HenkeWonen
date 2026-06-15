import fs from "node:fs";
const f = process.argv[2] || process.env.TEMP + "/check3.txt";
const clean = fs.readFileSync(f, "utf8").replace(/\[[0-9;]*m/g, "");
const re = /([\w./\\-]+\.(?:ts|tsx|astro)):(\d+):(\d+)\s*-\s*error\s*ts\((\d+)\):\s*(.*)/g;
const counts = {};
const samples = [];
let m, total = 0;
while ((m = re.exec(clean))) {
  const file = m[1].replace(/\\/g, "/");
  counts[file] = (counts[file] || 0) + 1;
  total++;
  if (samples.length < 40) samples.push(`${file}:${m[2]} ts${m[4]}: ${m[5].slice(0, 130)}`);
}
for (const [file, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(String(c).padStart(3), file);
console.log("TOTAAL:", total);
console.log("\n--- samples ---");
for (const s of samples) console.log(s);
