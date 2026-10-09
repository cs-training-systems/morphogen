// tests/verify-fade.js — proves, for each Gray–Scott preset, how long a developed pattern survives after the
// pointer leaves when the optional fade window is switched on (it is OFF by default: patterns run until
// Reset). Node only, no dependencies:   node tests/verify-fade.js
// Method: mount on a stub canvas at the 320-wide reference with an injected clock that advances 1/60 s per
// frame; seed the preset's own starting pattern; develop for DEVELOP_S with the pointer "present"; remove the
// pointer; count frames until the field is quiet. Only the Gray–Scott model has a fade window: the other models
// (the dendrite and every automaton) keep what they grow, and are listed as skipped.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DEVELOP_S = 4, CAP_S = 30, FPS = 60, FADE_START = 10, FADE_END = 14.5;

const src = fs.readFileSync(path.join(__dirname, "..", "morphogen.js"), "utf8");
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const M = sandbox.Morphogen;

function stubCanvas() {
  return { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => {} }) };
}

function survival(preset) {
  let clockMs = 0;
  // the reference pace (speed 0.75), whatever the preset's own speed: the window is a property of the fade, not of the pace
  const field = M.mount(stubCanvas(), { quality: [320, 180], gpu: false, model: preset.model, params: preset.params, dscale: preset.dscale || 1, fadeStart: FADE_START, fadeEnd: FADE_END, clock: () => clockMs });
  field.setPointer(true);
  const seed = preset.seed.type === "stir" ? (preset.thumbSeed || { type: "strokes", n: 3, r: 2 }) : preset.seed;   // a timed, random stir is no seed for a repeatable test
  field.seedSpec(seed, 11, { x: 160, y: 90 });
  for (let i = 0; i < DEVELOP_S * FPS; i++) { clockMs += 1000 / FPS; field.tick(); }
  field.setPointer(false);
  let n = 0;
  while (field.isAlive() && n < CAP_S * FPS) { clockMs += 1000 / FPS; field.tick(); n++; }
  return n / FPS;
}

let failed = 0;
for (const p of M.presets) {
  const m = M.models[p.model];
  if (!m.fade) { console.log(`${p.id.padEnd(12)} ${m.name}: no fade window applies; skipped`); continue; }
  const s = survival(p);
  const ok = p.selfSustaining === false ? true : (s >= FADE_START && s <= FADE_END);
  if (!ok) failed++;
  console.log(`${p.id.padEnd(12)} feed ${p.params.feed.toFixed(3)} kill ${p.params.kill.toFixed(3)}  dies ${s.toFixed(1)} s after the pointer leaves${p.selfSustaining === false ? "   (not self-sustaining by design: the window does not bind)" : (ok ? "" : "   <-- OUTSIDE THE WINDOW")}`);
}
if (failed) { console.error(`${failed} preset(s) outside the fade window`); process.exit(1); }
console.log("all Gray–Scott presets die inside the fade window");
