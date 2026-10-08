// tests/verify-fade.js — proves, for each preset, how long a developed pattern survives after the
// pointer leaves when the optional fade window is switched on (it is OFF by default: patterns
// run until Reset). Node only, no dependencies:   node tests/verify-fade.js
// Method: mount on a stub canvas at the 320-wide reference with an injected clock that advances
// 1/60 s per frame; seed the preset's own starting pattern; develop for DEVELOP_S with the pointer
// "present"; remove the pointer; count frames until the field is quiet.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DEVELOP_S = 4, CAP_S = 30, FPS = 60, FADE_START = 10, FADE_END = 14.5;

const src = fs.readFileSync(path.join(__dirname, "..", "reaction-diffusion.js"), "utf8");
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const RD = sandbox.ReactionDiffusion;

function stubCanvas() {
  return { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => {} }) };
}

function survival(preset) {
  let clockMs = 0;
  const field = RD.mount(stubCanvas(), { quality: [320, 180], gpu: false, feed: preset.feed, kill: preset.kill, fadeStart: FADE_START, fadeEnd: FADE_END, clock: () => clockMs });
  field.setPointer(true);
  field.seedSpec(preset.seed, 11);
  for (let i = 0; i < DEVELOP_S * FPS; i++) { clockMs += 1000 / FPS; field.tick(); }
  field.setPointer(false);
  let n = 0;
  while (field.isAlive() && n < CAP_S * FPS) { clockMs += 1000 / FPS; field.tick(); n++; }
  return n / FPS;
}

let failed = 0;
for (const p of RD.presets) {
  const s = survival(p);
  const ok = s >= FADE_START && s <= FADE_END;
  if (!ok) failed++;
  console.log(`${p.id.padEnd(12)} feed ${p.feed.toFixed(3)} kill ${p.kill.toFixed(3)}  dies ${s.toFixed(1)} s after the pointer leaves${ok ? "" : "   <-- OUTSIDE THE WINDOW"}`);
}
if (failed) { console.error(`${failed} preset(s) outside the fade window`); process.exit(1); }
console.log("all presets die inside the fade window");
