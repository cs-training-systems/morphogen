// tools/build.js — assembles the one shipped classic script, morphogen.js, from the source modules in
// src/ (concatenated in file-name order inside one function scope). Contributors edit src/; users copy
// morphogen.js. No dependencies.
//
//   node tools/build.js            → morphogen.js in the repository root
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const files = fs.readdirSync(SRC).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
let out = "";
for (const f of files) out += fs.readFileSync(path.join(SRC, f), "utf8").replace(/\r\n/g, "\n") + "\n";
// The copyright notice in the prelude header reads "2026–CURRENT_YEAR". The build writes the range from
// the year of first publication to the current year, or the first year alone while they are the same. A
// shipped file is static, so "current" means current at the time of the build; npm test rebuilds it.
const FIRST_YEAR = 2026;
const currentYear = new Date().getFullYear();
out = out.replace("2026–CURRENT_YEAR", currentYear > FIRST_YEAR ? `${FIRST_YEAR}–${currentYear}` : String(FIRST_YEAR));
fs.writeFileSync(path.join(ROOT, "morphogen.js"), out);
console.log("morphogen.js ←", files.join(", "), `(${out.length} bytes)`);
