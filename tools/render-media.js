// tools/render-media.js — renders the README's reaction–diffusion stills and GIFs straight from the engine,
// in Node, with no screen recording: frames come from the simulation itself (the processor path), so colors
// are exact and the output is reproducible. Stills are written as PNG by a small encoder here (zlib is built
// into Node); GIFs are encoded by ffmpeg from raw RGB frames (ffmpeg must be on the PATH).
//
//   node tools/render-media.js            → docs/media/*.png and *.gif for the reaction–diffusion presets
//   node tools/render-media.js vortex     → only the scenes whose name contains "vortex"
//
// The automata and the phase-field dendrite render here too, at 320 x 180 on the processor path (a minute or
// two each; the snow crystal and the fluid the longest); tools/capture.html remains as the graphics-processor
// route for stills at the demo's own resolution.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "media");
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, "morphogen.js"), "utf8");
const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const M = sandbox.Morphogen;

// ---- a stub canvas that keeps the last painted frame ----
function stubCanvas() {
  const c = { width: 0, height: 0, last: null };
  c.getContext = () => ({
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (img) => { c.last = img; }
  });
  return c;
}

// ---- PNG writer (RGB, 8-bit, no alpha) ----
const CRC_TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(rgba, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (w * 3 + 1) + 1 + x * 3;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
function rgb(rgba, w, h) {
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { out[j] = rgba[i]; out[j + 1] = rgba[i + 1]; out[j + 2] = rgba[i + 2]; }
  return out;
}

// ---- a scene: a preset's whole recipe on a field driven frame by frame, with optional scripted pointer motion ----
function scene(opts) {
  let clockMs = 0;
  const canvas = stubCanvas(), preset = opts.preset;
  const field = M.mount(canvas, { quality: [opts.width, opts.height], gpu: false, model: preset.model, params: preset.params, dscale: preset.dscale || 1, stepScale: preset.stepScale || 1,
    palette: opts.palette || preset.palette || "canopy", timeScale: opts.timeScale || preset.timeScale || 0.75, clock: () => clockMs });
  if (opts.seed) field.seedSpec(opts.seed, opts.salt || 11, { x: opts.width / 2, y: opts.height / 2 });
  const fps = 60, frames = [];
  const total = Math.round(opts.seconds * fps), every = Math.round(fps / (opts.gifFps || 20));
  for (let i = 0; i < total; i++) {
    clockMs += 1000 / fps;
    if (opts.pointer) {
      const p = opts.pointer(i / fps, opts.width, opts.height);
      if (p) { field.setPointer(true); field.seed(p.x, p.y, p.r); } else field.setPointer(false);
    }
    field.tick();
    if (opts.gif && i % every === 0 && i >= (opts.skipSeconds || 0) * fps) frames.push(rgb(canvas.last.data, opts.width, opts.height));
  }
  return { last: canvas.last, frames: frames, gifFps: opts.gifFps || 20 };
}

const ONLY = process.argv[2] || "";
function wanted(name) { return !ONLY || name.indexOf(ONLY) !== -1; }
function still(name, opts) {
  if (!wanted(name)) return;
  const r = scene(Object.assign({ gif: false }, opts));
  fs.writeFileSync(path.join(OUT, name + ".png"), png(r.last.data, opts.width, opts.height));
  console.log("still", name);
}
function gif(name, opts) {
  if (!wanted(name)) return;
  const r = scene(Object.assign({ gif: true }, opts));
  const rawPath = path.join(OUT, name + ".rgb");
  fs.writeFileSync(rawPath, Buffer.concat(r.frames));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", opts.width + "x" + opts.height, "-r", String(r.gifFps), "-i", rawPath,
    "-filter_complex", "[0:v]split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
    "-loop", "0", path.join(OUT, name + ".gif")]);
  fs.unlinkSync(rawPath);
  console.log("gif  ", name, r.frames.length, "frames");
}

// a pointer that strokes a slow figure across the field for the first few seconds, then leaves
function strokePointer(t, w, h) {
  if (t > 4.5) return null;
  const x = w * (0.15 + 0.7 * (t / 4.5)), y = h * (0.5 + 0.28 * Math.sin(t * 2.2));
  return { x: x, y: y, r: 3 * w / 320 };
}
// "stir": a drag stroke across the field every four seconds, as a visitor would, so fronts keep breaking into
// free ends that curl into rotors (the Vortex still and GIF; a one-off seeding runs off the frame)
function stirPointer(t, w, h) {
  const period = 4, s = t % period; if (s > 1.2) return null;
  const k = Math.floor(t / period), ang = (k * 2.4) % Math.PI, cx = w * (0.3 + 0.4 * ((k * 0.618) % 1)), cy = h * (0.3 + 0.4 * ((k * 0.382) % 1));
  const len = Math.min(w, h) * 0.5, u = s / 1.2 - 0.5;
  return { x: cx + Math.cos(ang) * len * u, y: cy + Math.sin(ang) * len * u, r: 3 * w / 320 };
}

const W = 400, H = 225;
const presets = {};
M.presets.forEach(p => { presets[p.id] = p; });
const gs = M.presets.filter(p => p.model === "gray-scott");

// ---- scenes ----
still("hero-vortex", { preset: presets.vortex, width: 640, height: 360, pointer: stirPointer, seconds: 18, timeScale: 0.75, palette: "canopy" });
for (const p of gs) {
  const vortex = p.id === "vortex", malachite = p.id === "malachite";
  still("preset-" + p.id, { preset: p, width: vortex ? 640 : 320, height: vortex ? 360 : 180, seed: vortex ? null : p.seed, pointer: vortex ? stirPointer : null,
    seconds: malachite ? 40 : (p.id === "phyllotaxis" ? 12 : (vortex ? 12 : 10)), timeScale: malachite ? 0.3 : 0.75, palette: "canopy" });
}
// the automata and the phase-field dendrite: each at its own palette and seeding, long enough to show its regime
const CA_SECONDS = { "ca-frost": 25, lenia: 12, rotor: 10, lichtenberg: 20, sandpile: 12, conus: 8, wildfire: 20, grain: 12, wake: 15, frost: 12 };
for (const p of M.presets.filter(q => q.model !== "gray-scott")) {
  still("preset-" + p.id, { preset: p, width: 320, height: 180, seed: p.seed, seconds: CA_SECONDS[p.id] || 12, palette: p.palette });
}
gif("hover-seeding", { preset: presets.malachite, width: W, height: H, seconds: 8, pointer: strokePointer, gifFps: 12, timeScale: 0.75, palette: "canopy" });
gif("phyllotaxis", { preset: presets.phyllotaxis, width: W, height: H, seed: presets.phyllotaxis.seed, seconds: 12, gifFps: 10, palette: "aurora" });
gif("vortex", { preset: presets.vortex, width: W, height: H, pointer: stirPointer, seconds: 16, skipSeconds: 8, gifFps: 8, timeScale: 0.75, palette: "cherenkov" });
gif("turbulence", { preset: presets.turbulence, width: W, height: H, seed: presets.turbulence.seed, seconds: 13, skipSeconds: 4, gifFps: 10, palette: "spectrum" });
console.log("done →", OUT);
