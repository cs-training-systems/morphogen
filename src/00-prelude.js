/*!
 * Morphogen — morphogen.js — an engine of emergent pattern formation on a canvas.
 * Copyright (c) 2026 Christopher A. Stamplis. Released under the MIT License.
 * Source: https://github.com/cs-training-systems/morphogen   Version 2.0.0-beta.1
 *
 * Every model is written from its published equations or rules with no borrowed code.
 * Visual inspiration: pmneila/jsexp (BSD-3-Clause). Sources are cited beside each model.
 *
 * ONE classic script, ONE global (`Morphogen`; `ReactionDiffusion` is kept as an alias),
 * no dependencies, no build step for the page that uses it. It auto-mounts every
 * `<canvas data-morphogen>` (or the older `data-reaction-diffusion`) on DOMContentLoaded and
 * binds any control inside the same `[data-rd-scope]` container by its `data-rd` role.
 *
 * ARCHITECTURE (the file is assembled from src/ in this order)
 *   00-prelude   palettes, the resolution ladder, seeding geometry, hexagonal-lattice geometry
 *   10-registry  the MODEL REGISTRY: a model declares its family, lattice, state channels,
 *                its two user parameters, its step (fragment shaders for the graphics processor,
 *                a function for the processor), its seeding, its display mapping, its liveness
 *   2x-model-*   one file per model
 *   40-gpu       the generic WebGL2 backend: ping-pong float textures, one pass per shader,
 *                seeding, display through the palette, liveness count, chronogram, resampling
 *   41-cpu       the generic processor backend: the same operations on typed arrays (the
 *                reference the tests run against; thumbnails and offline rendering use it)
 *   50-field     the field: mount, the frame loop, adaptive resolution, pointer and touch,
 *                reduced-motion chronogram, thumbnails as idle jobs
 *   60-bind      declarative controls: families, presets, sliders, buttons, live region
 *   70-presets   the families and their presets; auto-mount; the global
 *
 * FAMILIES: a family is a set of presets whose mathematics is one kind:
 *   "rd"  Reaction–diffusion — continuous fields on a plane, local kinetics plus diffusion
 *         (Gray–Scott in eight regimes; the phase-field dendrite of Kobayashi / Warren et al.)
 *   "ca"  Cellular automata — discrete states on a lattice, updated by local rules
 *         (snow crystals, Lenia, cyclic rotors, dielectric breakdown, the sandpile, Rule 30,
 *         the forest fire, Potts grains, the lattice-Boltzmann fluid)
 *
 * RESOLUTION: a model declares how it uses the ladder (320 … 1600 cells across).
 *   "ladder" — the grid is the chosen rung (adaptive beneath it on Automatic); the field is a
 *              smooth continuum and the browser's bilinear upscaling shows it without cells.
 *   "pixels" — the lattice is the canvas's own device pixels (every structure at full actual
 *              resolution); the rung becomes the model's SCALE where it has one (a snow
 *              crystal's size), and otherwise has no effect, which the measure line says.
 */
(function (global) {
  "use strict";

  var VERSION = "2.0.0-beta.1";
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  // Nine palettes, each four colours over the display scalar: the ground (black, so a decaying
  // edge fades into it), a trail, a body and a front. The brand colours only.
  var PALETTES = {
    canopy:    { name: "Canopy",    colors: ["#000000", "#003E99", "#009149", "#FEEEA3"] },
    aurora:    { name: "Aurora",    colors: ["#000000", "#009149", "#7728A8", "#FFFFFF"] },
    spectrum:  { name: "Spectrum",  colors: ["#000000", "#003E99", "#D30011", "#FFFFFF"] },
    neon:      { name: "Neon",      colors: ["#000000", "#D30011", "#009149", "#FFFFFF"] },
    accretion: { name: "Accretion", colors: ["#000000", "#003E99", "#FD5F00", "#FFFFFF"] },
    physarum:  { name: "Physarum",  colors: ["#000000", "#003E99", "#FDD100", "#FFFFFF"] },
    cherenkov: { name: "Cherenkov", colors: ["#000000", "#7728A8", "#0095DA", "#FFFFFF"] },
    orodruin:  { name: "Orodruin",  colors: ["#000000", "#D30011", "#FD5F00", "#FDD100"] },   // the heat ramp (owner, 2026-10-09)
    coastal:   { name: "Coastal",   colors: ["#000000", "#003E99", "#0095DA", "#FEEEA3"] }    // the ice and deep-water ramp (owner, 2026-10-09)
  };
  var RAMP_STOPS = [0, 0.30, 0.62, 1];
  var VMAX = 0.4;                      // every model maps its display scalar into [0, VMAX]

  // Resolution ladder: cells across. The height follows the frame's own aspect ratio.
  var LADDER = [240, 320, 400, 480, 560, 640, 800, 1000, 1200, 1600];   // 240 (owner, 2026-10-09): a coarser rung for presets that want bigger features
  function rungOf(q) { var n = parseInt(q, 10); if (n >= 100) { var i = LADDER.indexOf(n); return i < 0 ? 1 : i; } return n; }   // a width or a ladder index

  function hexToRgb(hex) { var h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function buildLut(colors, stops) {
    stops = stops || RAMP_STOPS;
    var lut = new Uint8ClampedArray(256 * 3), rgb = colors.map(hexToRgb);
    for (var i = 0; i < 256; i++) {
      var t = i / 255, j = 0;
      while (j < stops.length - 2 && t > stops[j + 1]) j++;
      var span = stops[j + 1] - stops[j], u = span > 0 ? Math.min(1, (t - stops[j]) / span) : 0;
      lut[i * 3] = rgb[j][0] + (rgb[j + 1][0] - rgb[j][0]) * u;
      lut[i * 3 + 1] = rgb[j][1] + (rgb[j + 1][1] - rgb[j][1]) * u;
      lut[i * 3 + 2] = rgb[j][2] + (rgb[j + 1][2] - rgb[j][2]) * u;
    }
    return lut;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function defaultClock() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // ---- seeding geometry (pixel units of the field: x across, y down from the top) -------------
  // Vogel's model: spot i at angle i × 137.5° and radius ∝ √i from (cx, cy), scaled so nMax spots fill the inscribed circle
  function spiralPoint(W, H, i, nMax, cx, cy) {
    var scale = 0.95 * Math.min(W, H) / 2 / Math.sqrt(nMax), rad = scale * Math.sqrt(i + 0.5), a = i * GOLDEN_ANGLE;
    if (cx === undefined) { cx = W / 2; cy = H / 2; }
    return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
  }
  // The discs {x, y, r} a seeding spec places on a W×H field (reference radii scale with W / 320).
  // `center`, when given, is where a grow or pacemaker seeding starts instead of the field's centre.
  function seedDiscList(W, H, spec, salt, growCount, center) {
    var sc = W / 320, r = Math.max((spec.r || 3) * sc, 0.75), list = [], i, p;   // never below a cell, so a tiny grid still gets its seed
    if (center && spec.type === "pacemaker") { list.push({ x: center.x, y: center.y, r: r }); return list; }
    if (spec.type === "spiral") {
      var cx = W / 2, cy = H / 2, scale = (spec.spread || 0.9) * Math.min(W, H) / 2 / Math.sqrt(spec.n);
      for (i = 0; i < spec.n; i++) { var rad = scale * Math.sqrt(i + 0.5), a = i * GOLDEN_ANGLE; list.push({ x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a), r: r }); }
    } else if (spec.type === "strokes") {
      var rnd = mulberry32((salt || 5) * 2654435761);
      for (i = 0; i < spec.n; i++) {
        var x0 = W * (0.2 + 0.6 * rnd()), y0 = H * (0.2 + 0.6 * rnd()), ang = rnd() * Math.PI, len = Math.min(W, H) * 0.28;
        for (var t = 0; t <= 1; t += 0.05) list.push({ x: x0 + Math.cos(ang) * len * (t - 0.5), y: y0 + Math.sin(ang) * len * (t - 0.5), r: r });
      }
    } else if (spec.type === "grow") {
      var n = growCount || 3;
      for (i = 0; i < n; i++) { p = spiralPoint(W, H, i, spec.n, center && center.x, center && center.y); list.push({ x: p.x, y: p.y, r: r }); }
    } else if (spec.type === "center") {
      list.push({ x: W / 2, y: H / 2, r: r });
    } else if (spec.type === "pacemaker") {           // fixed points that fire again and again
      var rnd3 = mulberry32((salt || 3) * 2654435761);
      for (i = 0; i < spec.n; i++) list.push({ x: W * (0.2 + 0.6 * rnd3()), y: H * (0.2 + 0.6 * rnd3()), r: r });
    } else if (spec.type === "fill") {                // the whole field, as one disc larger than it (noise seedings)
      list.push({ x: W / 2, y: H / 2, r: Math.hypot(W, H) });
    } else {
      var rnd2 = mulberry32((salt || 7) * 2654435761);
      for (i = 0; i < spec.n; i++) list.push({ x: W * (0.1 + 0.8 * rnd2()), y: H * (0.15 + 0.7 * rnd2()), r: r });
    }
    return list;
  }
  // Dense, even seeding of the whole field for the chronogram: a hexagonal lattice of the preset's
  // own seed kind, so every column of the chronogram holds pattern from the start.
  function latticeSeedList(W, H, spec) {
    if (spec.type === "fill") return seedDiscList(W, H, spec);
    if (spec.type === "stir") spec = { type: "strokes", r: spec.r || 2 };
    var sc = W / 320, r = (spec.r || 3) * sc, s = 30 * sc, list = [], row = 0;
    for (var y = s * 0.6; y < H; y += s * 0.87, row++) {
      for (var x = (row % 2 ? s : s * 0.5); x < W; x += s) {
        if (spec.type === "strokes") { var a = (row % 2 ? 0.6 : -0.6) + 0.35 * Math.sin(x * 0.01), len = s * 0.55; for (var t = 0; t <= 1; t += 0.1) list.push({ x: x + Math.cos(a) * len * (t - 0.5), y: y + Math.sin(a) * len * (t - 0.5), r: r }); }
        else list.push({ x: x, y: y, r: r });
      }
    }
    return list;
  }

  // ---- the hexagonal lattice ("odd-r" offset rows) ------------------------------------------------
  // Cell (r, c) has its centre at x = c + 0.5 + 0.5·(r mod 2), y = (r + 0.5)·√3/2 in pixel units, so a
  // field of w × h pixels needs w columns and h / (√3/2) rows. Its six neighbours on row r are (c−1, r),
  // (c+1, r), and on rows r±1 the columns c+a and c+a+1 with a = 0 on odd rows and −1 on even rows.
  var HEX_ROW = 0.8660254;
  function hexRows(h) { return Math.max(4, Math.round(h / HEX_ROW)); }
  function hexCell(x, y, cols, rows) { var r = clamp(Math.round(y / HEX_ROW - 0.5), 0, rows - 1), off = (r & 1) ? 0.5 : 0; return { r: r, c: clamp(Math.round(x - off - 0.5), 0, cols - 1) }; }
  function hexCenter(r, c) { return { x: c + 0.5 + ((r & 1) ? 0.5 : 0), y: (r + 0.5) * HEX_ROW }; }
  // nearest-cell sampling of a lattice (cols × rows) onto a pixel grid (w × h): out[pixel] = disp(cell index), or `empty` off-lattice
  function hexSample(disp, cols, rows, w, h, empty, out) {
    for (var py = 0; py < h; py++) {
      var yc = (py + 0.5) / HEX_ROW, r0 = Math.round(yc - 0.5);
      for (var pxl = 0; pxl < w; pxl++) {
        var xc = pxl + 0.5, best = -1, bd = 1e9;
        for (var r = r0 - 1; r <= r0 + 1; r++) {
          if (r < 0 || r >= rows) continue;
          var off = (r & 1) ? 0.5 : 0, c = Math.round(xc - off - 0.5); if (c < 0 || c >= cols) continue;
          var dx = c + 0.5 + off - xc, dy = (r + 0.5) * HEX_ROW - (py + 0.5), d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = r * cols + c; }
        }
        out[py * w + pxl] = best < 0 ? empty : disp(best);
      }
    }
    return out;
  }
