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


  // ---- the model registry -------------------------------------------------------------------------
  // A model is a plain object:
  //   id, family ("rd" | "ca"), name, source (the citation)
  //   lattice: "square" | "hex"          channels: 2 | 4 (RG32F or RGBA32F per state texture)
  //   targets: 1 | 3                      state textures per buffer (the lattice-Boltzmann fluid needs 27 numbers)
  //   grid: "ladder" | "pixels"           how the resolution ladder is used (see the header)
  //   params: [ { key, label, min, max, step, def }, { … } ]   the two user parameters (the sliders)
  //   extra: { key: value }               fixed parameters a preset may override
  //   pack(P) → Float32Array(8)           the parameters as the shaders see them (uP, uP2)
  //   init(P) → [[r,g,b,a], …]            the clear colour per target (the empty field)
  //   stepsPerUnit                        how many lattice steps one "step" of the frame loop is (default 1)
  //   gpu: { passes: [ { fs, out: "state" | "aux", repeat: n | fn(P) } ], seed, display, alive, kernel }
  //        fs: GLSL after the shared head; `void main()` writes o0 (and o1, o2 for three targets)
  //        seed: GLSL statements run for a cell inside a seeded disc, mutating `c` (`c1`, `c2`);
  //              available: q (the cell's pixel position), og (the disc centre), rr (its radius), uVal, hash(p, uQ.w)
  //        display: GLSL `float display(vec4 c, ivec2 p)` → the scalar in [0, VMAX]
  //        alive:   GLSL `bool alive(vec4 c, ivec2 p)`
  //        kernel(P) → { w, h, data }     an optional R32F texture (uK)
  //   cpu: { step(st, n, P, X), seed(st, discs, val, X), display(st, i) → scalar, alive(st) → bool }
  //        st.W × st.H is the lattice; st.p[t][ch] are the planes; st.aux[ch] the work planes; st.rnd a generator
  //        X: { dscale, radius, step, hex }
  var MODELS = {}, MODEL_ORDER = [];
  function defineModel(def) { MODELS[def.id] = def; MODEL_ORDER.push(def.id); return def; }
  function modelById(id) { return MODELS[id] || null; }
  function packParams(model, P) {
    var out = new Float32Array(8), i = 0, keys = model.pack ? null : [];
    if (model.pack) return model.pack(P, out);
    model.params.forEach(function (d) { keys.push(d.key); });
    for (var k in (model.extra || {})) keys.push(k);
    for (; i < keys.length && i < 8; i++) out[i] = P[keys[i]];
    return out;
  }
  // the parameter object for a model: slider defaults, fixed extras, then a preset's overrides
  function paramsFor(model, over) {
    var P = {};
    model.params.forEach(function (d) { P[d.key] = d.def; });
    for (var k in (model.extra || {})) P[k] = model.extra[k];
    for (var k2 in (over || {})) if (over[k2] !== undefined) P[k2] = over[k2];
    return P;
  }

  // ---- shared shader text ---------------------------------------------------------------------------
  var VS = "#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}";
  // every fragment program starts with this: the state (uS0..2), the work texture (uA), a kernel (uK),
  // the parameters (uP, uP2), the frame context (uQ: dscale, radius, step, random seed), clamped and
  // periodic reads, a hash, and the hexagonal lattice's geometry
  var GLSL_HEAD =
    "#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;\n" +
    "uniform sampler2D uS0,uS1,uS2,uA,uA1,uA2,uK;uniform vec4 uP,uP2,uQ;uniform ivec2 uSize;\n" +
    "ivec2 wrapC(ivec2 q){return clamp(q,ivec2(0),uSize-1);}\n" +
    "ivec2 wrapP(ivec2 q){return ivec2((q.x+uSize.x)%uSize.x,(q.y+uSize.y)%uSize.y);}\n" +
    "vec4 S(ivec2 q){return texelFetch(uS0,wrapC(q),0);}vec4 Sp(ivec2 q){return texelFetch(uS0,wrapP(q),0);}\n" +
    "vec4 S1(ivec2 q){return texelFetch(uS1,wrapC(q),0);}vec4 S2(ivec2 q){return texelFetch(uS2,wrapC(q),0);}\n" +
    "vec4 A(ivec2 q){return texelFetch(uA,wrapC(q),0);}vec4 A1(ivec2 q){return texelFetch(uA1,wrapC(q),0);}vec4 A2(ivec2 q){return texelFetch(uA2,wrapC(q),0);}vec4 K(ivec2 q){return texelFetch(uK,q,0);}\n" +
    "float hash(ivec2 p,float s){uvec2 q=uvec2(p+ivec2(4096));uint h=q.x*1664525u+q.y*1013904223u+uint(s*1000.0);h^=h>>16;h*=2246822519u;h^=h>>13;h*=3266489917u;h^=h>>16;return float(h&16777215u)/16777216.0;}\n" +
    "vec2 hexQ(ivec2 p){float off=((p.y&1)==1)?0.5:0.0;return vec2(float(p.x)+0.5+off,(float(p.y)+0.5)*0.8660254);}\n" +
    "ivec2 hexN(ivec2 p,int k){int a=((p.y&1)==1)?0:-1;return k==0?p+ivec2(-1,0):k==1?p+ivec2(1,0):k==2?p+ivec2(a,-1):k==3?p+ivec2(a+1,-1):k==4?p+ivec2(a,1):p+ivec2(a+1,1);}\n" +
    "const float VMAX=0.4;\n";
  function outDecl(nt) { var s = "layout(location=0) out vec4 o0;"; if (nt > 1) s += "layout(location=1) out vec4 o1;"; if (nt > 2) s += "layout(location=2) out vec4 o2;"; return s + "\n"; }


  // ==== FAMILY "rd" — reaction–diffusion =================================================================

  // ---- Gray–Scott --------------------------------------------------------------------------------------
  // Gray & Scott (1984); Pearson (1993). Two concentrations U, V on a square grid; per step, with the 3×3
  // Laplacian (centre −1, edges 0.2, corners 0.05) and dt = 1:
  //   U' = U + (Du·∇²U − g·U·V² + f·(1 − U))      Du = 0.2097
  //   V' = V + (Dv·∇²V + g·U·V² − (f + k)·V)      Dv = 0.105
  // g is the autocatalytic gain (1 unless a fade window is set); a preset may multiply both diffusion
  // rates (the diffusion scale, uQ.x), which sets the spacing between fronts without changing the regime.
  defineModel({
    id: "gray-scott", family: "rd", name: "Gray–Scott", lattice: "square", channels: 2, grid: "ladder", fade: true,
    source: "P. Gray and S. K. Scott, Chem. Eng. Sci. 39 (1984); J. E. Pearson, Science 261 (1993)",
    params: [
      { key: "feed", label: "Feed", min: 0.008, max: 0.070, step: 0.001, def: 0.010 },
      { key: "kill", label: "Kill", min: 0.030, max: 0.066, step: 0.001, def: 0.035 }
    ],
    extra: { gain: 1 },
    init: function () { return [[1, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec2 c=S(p).rg;" +
        "vec2 e=S(p+ivec2(1,0)).rg,w=S(p+ivec2(-1,0)).rg,n=S(p+ivec2(0,1)).rg,so=S(p+ivec2(0,-1)).rg,ne=S(p+ivec2(1,1)).rg,nw=S(p+ivec2(-1,1)).rg,se=S(p+ivec2(1,-1)).rg,sw=S(p+ivec2(-1,-1)).rg;" +
        "vec2 l=0.2*(e+w+n+so)+0.05*(ne+nw+se+sw)-c;float f=uP.x,k=uP.y,g=uP.z,ds=uQ.x;" +
        "float a=g*c.r*c.g*c.g;float u=c.r+(ds*0.2097*l.r-a+f*(1.0-c.r));float v=c.g+(ds*0.105*l.g+a-(f+k)*c.g);" +
        "o0=vec4(clamp(u,0.0,1.0),clamp(v,0.0,1.0),0.0,1.0);}" }],
      seed: "c.g=max(c.g,uVal);",
      display: "float display(vec4 c,ivec2 p){return c.g;}",
      alive: "bool alive(vec4 c,ivec2 p){return c.g>0.01;}"
    },
    cpu: {
      step: function (st, n, P, X) {
        var W = st.W, H = st.H, U = st.p[0][0], V = st.p[0][1], U2 = st.aux[0], V2 = st.aux[1];
        var f = P.feed, k = P.kill, g = P.gain, du = 0.2097 * X.dscale, dv = 0.105 * X.dscale;
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) {
            var y0 = y * W, ym = (y > 0 ? y - 1 : y) * W, yp = (y < H - 1 ? y + 1 : y) * W;
            for (var x = 0; x < W; x++) {
              var xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, i = y0 + x, u = U[i], v = V[i];
              var lu = 0.2 * (U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x]) + 0.05 * (U[ym + xm] + U[ym + xp] + U[yp + xm] + U[yp + xp]) - u;
              var lv = 0.2 * (V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x]) + 0.05 * (V[ym + xm] + V[ym + xp] + V[yp + xm] + V[yp + xp]) - v;
              var uvv = g * u * v * v, un = u + (du * lu - uvv + f * (1 - u)), vn = v + (dv * lv + uvv - (f + k) * v);
              U2[i] = un < 0 ? 0 : (un > 1 ? 1 : un); V2[i] = vn < 0 ? 0 : (vn > 1 ? 1 : vn);
            }
          }
          var t = U; U = U2; U2 = t; t = V; V = V2; V2 = t;
        }
        st.p[0][0] = U; st.p[0][1] = V; st.aux[0] = U2; st.aux[1] = V2;
      },
      seed: function (st, discs, value) {
        var W = st.W, H = st.H, V = st.p[0][1];
        for (var d = 0; d < discs.length; d++) {
          var cx = discs[d].x, cy = discs[d].y, r = discs[d].r, r2 = r * r;
          for (var y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) for (var x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
            var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) { var i = y * W + x; if (V[i] < value) V[i] = value; }
          }
        }
      },
      display: function (st, i) { return st.p[0][1][i]; },
      alive: function (st) { var V = st.p[0][1], n = 0; for (var i = 0; i < st.N; i++) if (V[i] > 0.01) n++; return n; }
    }
  });

  // ---- the phase-field dendrite ----------------------------------------------------------------------
  // Kobayashi (1993) as restated by Warren, Kobayashi, Lobkovsky and Carter and documented by NIST's FiPy
  // (examples.phase.anisotropy; read 2026-10-09). An order parameter φ (0 melt, 1 solid) and the
  // undercooling ΔT on a square grid of spacing dx:
  //   τ ∂φ/∂t = ∇·(D ∇φ) + φ(1 − φ) m(φ, ΔT),   m = φ − ½ − (κ₁/π) atan(κ₂ ΔT)
  //   ∂ΔT/∂t = D_T ∇²ΔT + ∂φ/∂t
  // with the anisotropic tensor D = α² [[1 + cβ, −c β_ψ], [c β_ψ, 1 + cβ]], β = cos(N ψ), β_ψ = −N sin(N ψ),
  // ψ = θ₀ + atan(φ_y / φ_x). A small noise χ on the reaction (Kobayashi's side-branching term) is added.
  // This is a reaction–diffusion system in form: diffusion of φ and ΔT plus a local bistable reaction.
  // Stepped explicitly at dt = 0.2 dx² / D_T. Two passes: the flux D∇φ into the work texture, then its
  // divergence, the reaction and the heat equation. The physical scale is fixed by dx, so a finer rung
  // shows more, smaller dendrites at the same detail.
  defineModel({
    // grid "pixels": a dendrite's arms need hundreds of cells of room and an interface several cells thick (the
    // published example runs on a 500-cell grid), so the lattice is the canvas's own pixels, never the ladder
    id: "dendrite", family: "rd", name: "Phase-field dendrite", lattice: "square", channels: 2, grid: "pixels", stepsPerUnit: 2, keeps: true, glow: { blur: 1.0, decay: 0.9 },
    source: "R. Kobayashi, Physica D 63 (1993) 410–423; J. A. Warren et al.; NIST FiPy examples.phase.anisotropy",
    params: [
      { key: "cooling", label: "Supercooling", min: 0.2, max: 1.0, step: 0.01, def: 0.4 },
      { key: "aniso", label: "Anisotropy", min: 0.0, max: 0.12, step: 0.005, def: 0.05 }
    ],
    // DT the heat diffusivity of the published run; theta0 the crystal's orientation, drawn at random at every reset;
    // noise the amplitude of Kobayashi's side-branching term (owner 2026-10-09: variation and randomness built in)
    extra: { alpha: 0.015, tau: 3e-4, kappa1: 0.9, kappa2: 20, theta0: 0.3927, DT: 2.25, noise: 0.08 },
    randomize: function (P, rnd) { P.theta0 = rnd() * Math.PI / 3; },
    init: function (P) { return [[0, -P.cooling, 0, 1]]; },
    gpu: {
      // conservative staggered form: the flux D∇φ is evaluated at the east and north FACES of each cell (the normal
      // gradient from the pair across the face, the tangential one averaged), and the divergence is the difference
      // of adjacent faces, so neighbouring cells are coupled and no odd–even mode escapes the diffusion
      passes: [
        { out: "aux", fs:
          "vec2 flux(vec2 g,float c,float a2,float N,float th0){float psi=th0+atan(g.y,g.x);float b=cos(N*psi),db=-N*sin(N*psi);return a2*vec2((1.0+c*b)*g.x-c*db*g.y,c*db*g.x+(1.0+c*b)*g.y);}\n" +
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);const float dx=0.025,N=6.0;float c=uP.y,a2=uP.z*uP.z,th0=uP2.z;" +
          "float f0=S(p).r,fe=S(p+ivec2(1,0)).r,fn=S(p+ivec2(0,1)).r;" +
          "vec2 ge=vec2((fe-f0)/dx,0.25*((S(p+ivec2(0,1)).r-S(p+ivec2(0,-1)).r)+(S(p+ivec2(1,1)).r-S(p+ivec2(1,-1)).r))/dx);" +
          "vec2 gn=vec2(0.25*((S(p+ivec2(1,0)).r-S(p+ivec2(-1,0)).r)+(S(p+ivec2(1,1)).r-S(p+ivec2(-1,1)).r))/dx,(fn-f0)/dx);" +
          "o0=vec4(flux(ge,c,a2,N,th0).x,flux(gn,c,a2,N,th0).y,0.0,1.0);}" },
        { fs:
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);const float dx=0.025;float DT=uP2.w,dt=0.2*dx*dx/DT,tau=uP.w,k1=uP2.x,k2=uP2.y,an=uQ.x;vec2 c=S(p).rg;" +
          "float div=(A(p).x-A(p+ivec2(-1,0)).x+A(p).y-A(p+ivec2(0,-1)).y)/dx;" +
          "float m=c.r-0.5-(k1/3.14159265)*atan(k2*c.g);float chi=hash(p,uQ.w)-0.5;" +
          "float dphi=(div+c.r*(1.0-c.r)*(m+an*chi))*dt/tau;" +
          "float lap=(S(p+ivec2(1,0)).g+S(p+ivec2(-1,0)).g+S(p+ivec2(0,1)).g+S(p+ivec2(0,-1)).g-4.0*c.g)/(dx*dx);" +
          "o0=vec4(clamp(c.r+dphi,0.0,1.0),c.g+DT*lap*dt+dphi,0.0,1.0);}" }
      ],
      seed: "c.r=1.0;",
      // the solid wears the ramp by its heat: the warm new tips in the front colour, the cooled core in the trail colour;
      // outside, the heat the freezing released glows as a halo in the trail colour
      display: "float display(vec4 c,ivec2 p){float tt=clamp((c.g+uP.x)/uP.x,0.0,1.0);if(c.r>0.5)return 0.12+0.28*tt;float h=clamp(tt-0.15,0.0,1.0)/0.85;return max(VMAX*c.r*0.7,0.3*h*(1.0-c.r));}",
      alive: "bool alive(vec4 c,ivec2 p){return c.r>0.5;}"
    },
    cpu: {
      step: function (st, n, P, X) {
        var W = st.W, H = st.H, F = st.p[0][0], T = st.p[0][1], FX = st.aux[0], FY = st.aux[1], F2 = st.aux[2], T2 = st.aux[3];
        var dx = 0.025, DT = P.DT, dt = 0.2 * dx * dx / DT, an = P.noise, c = P.aniso, a2 = P.alpha * P.alpha, N = 6, th0 = P.theta0, tau = P.tau, k1 = P.kappa1, k2 = P.kappa2, rnd = st.rnd;
        for (var s = 0; s < n; s++) {
          var x, y, i, xm, xp, ym, yp;
          function at(xx, yy) { return F[clamp(yy, 0, H - 1) * W + clamp(xx, 0, W - 1)]; }
          function fl(gx, gy) { var psi = th0 + Math.atan2(gy, gx), b = Math.cos(N * psi), db = -N * Math.sin(N * psi); return [a2 * ((1 + c * b) * gx - c * db * gy), a2 * (c * db * gx + (1 + c * b) * gy)]; }
          for (y = 0; y < H; y++) for (x = 0; x < W; x++) {          // fluxes at the east and north faces
            i = y * W + x; var f0 = F[i];
            var ge = fl((at(x + 1, y) - f0) / dx, 0.25 * ((at(x, y + 1) - at(x, y - 1)) + (at(x + 1, y + 1) - at(x + 1, y - 1))) / dx);
            var gn = fl(0.25 * ((at(x + 1, y) - at(x - 1, y)) + (at(x + 1, y + 1) - at(x - 1, y + 1))) / dx, (at(x, y + 1) - f0) / dx);
            FX[i] = ge[0]; FY[i] = gn[1];
          }
          for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
            i = y * W + x; xm = y * W + (x > 0 ? x - 1 : x); xp = y * W + (x < W - 1 ? x + 1 : x); ym = (y > 0 ? y - 1 : y) * W + x; yp = (y < H - 1 ? y + 1 : y) * W + x;
            var div = (FX[i] - FX[xm] + FY[i] - FY[ym]) / dx, f = F[i], t = T[i];
            var m = f - 0.5 - (k1 / Math.PI) * Math.atan(k2 * t), dphi = (div + f * (1 - f) * (m + an * (rnd() - 0.5))) * dt / tau;
            var lap = (T[xp] + T[xm] + T[yp] + T[ym] - 4 * t) / (dx * dx);
            F2[i] = clamp(f + dphi, 0, 1); T2[i] = t + DT * lap * dt + dphi;
          }
          F.set(F2); T.set(T2);
        }
      },
      seed: function (st, discs) {
        var W = st.W, H = st.H, F = st.p[0][0];
        for (var d = 0; d < discs.length; d++) {
          var cx = discs[d].x, cy = discs[d].y, r = discs[d].r, r2 = r * r;
          for (var y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) for (var x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
            var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) F[y * W + x] = 1;
          }
        }
      },
      display: function (st, i, P) { var f = st.p[0][0][i], tt = clamp((st.p[0][1][i] + P.cooling) / P.cooling, 0, 1); if (f > 0.5) return 0.12 + 0.28 * tt; var h = clamp(tt - 0.15, 0, 1) / 0.85; return Math.max(VMAX * f * 0.7, 0.3 * h * (1 - f)); },
      alive: function (st) { var F = st.p[0][0], n = 0; for (var i = 0; i < st.N; i++) if (F[i] > 0.5) n++; return n; }
    }
  });


  // ==== FAMILY "ca" — cellular automata ==================================================================
  // Every automaton here runs on the canvas's own device pixels ("pixels"), so a cell is a pixel and the
  // structures are many pixels wide, or on the ladder with bilinear display where the state is a smooth
  // field (Lenia, the fluid). The resolution rung reaches a pixel-lattice model only as its scale (uQ.y,
  // the crystal radius), which the size-controlled models use and the others ignore.

  // A crystal's seed is remembered by every cell that grows from it, packed into one float as
  // row × 4096 + column + 1 (exact in a 32-bit float up to 4096 × 4096 cells). Growth stops beyond the
  // radius the resolution setting gives (uQ.y, in pixel units) — the engine's size control, an addition
  // to both published rules, which grow without limit.
  var GLSL_ORIGIN =
    "vec2 originQ(float o){o-=1.0;return hexQ(ivec2(int(mod(o,4096.0)),int(floor(o/4096.0))));}\n" +
    "bool inRadius(ivec2 p,float o){if(uQ.y<=0.0||o<=0.0)return true;vec2 d=hexQ(p)-originQ(o);return dot(d,d)<=uQ.y*uQ.y;}\n";
  var GLSL_SEED_ORIGIN = "float sr0=floor(og.y/0.8660254);float soff=(mod(sr0,2.0)==1.0)?0.5:0.0;float sc0=floor(og.x-soff);float sorigin=sr0*4096.0+sc0+1.0;";
  function originOf(og) { var r = Math.floor(og.y / HEX_ROW), off = (r & 1) ? 0.5 : 0, c = Math.floor(og.x - off); return r * 4096 + c + 1; }
  function originCenter(o) { o -= 1; return hexCenter(Math.floor(o / 4096), o % 4096); }
  function inRadius(r, c, o, R) { if (!(R > 0) || !(o > 0)) return true; var q = hexCenter(r, c), oq = originCenter(o), dx = q.x - oq.x, dy = q.y - oq.y; return dx * dx + dy * dy <= R * R; }
  // the six neighbours of (r, c) on odd-r offset rows, as indices (clamped at the lattice edge: a no-flux boundary)
  function hexNb(r, c, cols, rows, out) {
    var a = (r & 1) ? 0 : -1, rm = r > 0 ? r - 1 : r, rp = r < rows - 1 ? r + 1 : r;
    out[0] = r * cols + (c > 0 ? c - 1 : c); out[1] = r * cols + (c < cols - 1 ? c + 1 : c);
    out[2] = rm * cols + clamp(c + a, 0, cols - 1); out[3] = rm * cols + clamp(c + a + 1, 0, cols - 1);
    out[4] = rp * cols + clamp(c + a, 0, cols - 1); out[5] = rp * cols + clamp(c + a + 1, 0, cols - 1);
    return out;
  }
  // the vapour depletion halo around a crystal: undisturbed vapour (within 6 % of the far field) is the ground,
  // real depletion glows in the trail colour
  function haloValue(d, rho) { var t = (rho - d) / rho - 0.06; return t <= 0 ? 0 : 0.12 * Math.min(1, t / 0.94); }
  var GLSL_HALO = "float halo(float d,float rho){float t=(rho-d)/rho-0.06;return t<=0.0?0.0:0.12*min(1.0,t/0.94);}\n";
  // a crystal wears the palette: the newest ice at the tips in the front colour, the core in the trail colour
  var GLSL_CRYSTAL = "float crystal(ivec2 p,float o){if(uQ.y<=0.0||o<=0.0)return 0.3;float dd=length(hexQ(p)-originQ(o))/uQ.y;return 0.12+0.28*clamp(dd,0.0,1.0);}\n";
  function crystalValue(r, c, o, R) { if (!(R > 0) || !(o > 0)) return 0.3; var q = hexCenter(r, c), oq = originCenter(o); return 0.12 + 0.28 * clamp(Math.hypot(q.x - oq.x, q.y - oq.y) / R, 0, 1); }

  // ---- Gravner–Griffeath snow crystal ---------------------------------------------------------------------
  // J. Gravner and D. Griffeath, "Modeling snow crystal growth II: a mesoscopic lattice map with plausible
  // dynamics", Physica D 237 (2008) 385–404 (read at source 2026-10-09). Each cell of the hexagonal lattice
  // holds a (attached), b (quasi-liquid boundary mass), c (crystal mass), d (diffusive vapour mass); the
  // vapour starts at density ρ. Each step, at every unattached site:
  //   i.   diffusion: d ← the mean of d over the site and its six neighbours, an attached neighbour counting
  //        as the site itself (reflecting);
  //   ii.  freezing (boundary sites, those touching the crystal): a proportion κ of d becomes crystal mass,
  //        the rest boundary mass; d ← 0;
  //   iii. attachment (boundary sites): with n attached neighbours, join if n ≤ 2 and b ≥ β; or n = 3 and
  //        (b ≥ 1, or the neighbourhood's diffusive mass < θ and b ≥ α); or n ≥ 4; on joining c ← b + c, b ← 0;
  //   iv.  melting (boundary sites): a proportion μ of b and γ of c return to d;
  //   v.   noise: d ← (1 ± σ) d with probability ½ each.
  // Attachment is permanent. The paper's "simple star" set (ρ .65, β 1.75, κ .15, μ .015, γ .00001,
  // α .026, θ .2) is the default; ρ (vapour) and β (anisotropy of attachment) are the sliders.
  defineModel({
    // grid "ladder": the crystal's morphology is defined in cells (a star is hundreds of cells across), so the
    // resolution rung sets how large it is on screen, and the glow blur scales with the cell so no cell is ever seen
    id: "snow", family: "ca", name: "Snow crystal", lattice: "hex", channels: 4, grid: "ladder", maxRung: 8, keeps: true, stepsPerUnit: 3, glow: { blur: 0.9, decay: 0.965, cell: true },
    source: "J. Gravner and D. Griffeath, Physica D 237 (2008) 385–404",
    params: [
      { key: "rho", label: "Vapor", min: 0.30, max: 0.90, step: 0.01, def: 0.65 },
      { key: "beta", label: "Anisotropy", min: 1.05, max: 3.0, step: 0.01, def: 1.75 }
    ],
    extra: { kappa: 0.15, mu: 0.015, gamma: 0.00001, alpha: 0.026, theta: 0.2, sigma: 0.0, crystal: 1 / 3, pearl: 0.5 },   // crystal, pearl: the engine's size and stroke spacing (not the paper's)
    init: function (P) { return [[0, 0, 0, P.rho]]; },
    gpu: {
      passes: [{ fs: GLSL_ORIGIN +
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);float kap=uP.z,mu=uP.w,gam=uP2.x,alp=uP2.y,the=uP2.z,sig=uP2.w,bet=uP.y;" +
        "vec4 c=S(p);if(c.r>0.0){o0=c;return;}" +
        "int n=0;float dsum=c.a,d=0.0,ori=0.0;" +
        "for(int k=0;k<6;k++){vec4 v=S(hexN(p,k));if(v.r>0.0){n++;if(ori==0.0)ori=v.r;d+=c.a;}else{d+=v.a;dsum+=v.a;}}" +
        "d=(d+c.a)/7.0;float b=c.g,cm=c.b;" +
        "if(n>0){b+=(1.0-kap)*d;cm+=kap*d;d=0.0;" +
        " bool join=false;if(inRadius(p,ori)){if(n<=2)join=b>=bet;else if(n==3)join=b>=1.0||(dsum<the&&b>=alp);else join=true;}" +
        " if(join){o0=vec4(ori,0.0,cm+b,0.0);return;}" +
        " d+=mu*b+gam*cm;b*=(1.0-mu);cm*=(1.0-gam);}" +
        "if(sig>0.0)d*=1.0+((hash(p,uQ.w)<0.5)?-sig:sig);" +
        "o0=vec4(0.0,b,cm,d);}" }],
      seed: GLSL_SEED_ORIGIN + "c=vec4(sorigin,0.0,1.0,0.0);",
      display: GLSL_ORIGIN + GLSL_HALO + GLSL_CRYSTAL + "float display(vec4 c,ivec2 p){return c.r>0.0?crystal(p,c.r):halo(c.a,uP.x);}",
      alive: "bool alive(vec4 c,ivec2 p){return c.r>0.0;}"
    },
    cpu: {
      step: function (st, n, P, X) {
        var W = st.W, H = st.H, A = st.p[0][0], B = st.p[0][1], C = st.p[0][2], D = st.p[0][3], A2 = st.aux[0], B2 = st.aux[1], C2 = st.aux[2], D2 = st.aux[3];
        var kap = P.kappa, mu = P.mu, gam = P.gamma, alp = P.alpha, the = P.theta, sig = P.sigma, bet = P.beta, R = X.radius, rnd = st.rnd, nb = [0, 0, 0, 0, 0, 0];
        for (var s = 0; s < n; s++) {
          for (var r = 0; r < H; r++) for (var c = 0; c < W; c++) {
            var i = r * W + c;
            if (A[i] > 0) { A2[i] = A[i]; B2[i] = B[i]; C2[i] = C[i]; D2[i] = D[i]; continue; }
            hexNb(r, c, W, H, nb);
            var cnt = 0, dsum = D[i], d = 0, ori = 0;
            for (var k = 0; k < 6; k++) { var j = nb[k]; if (A[j] > 0) { cnt++; if (!ori) ori = A[j]; d += D[i]; } else { d += D[j]; dsum += D[j]; } }
            d = (d + D[i]) / 7; var b = B[i], cm = C[i];
            if (cnt > 0) {
              b += (1 - kap) * d; cm += kap * d; d = 0;
              var join = false;
              if (inRadius(r, c, ori, R)) { if (cnt <= 2) join = b >= bet; else if (cnt === 3) join = b >= 1 || (dsum < the && b >= alp); else join = true; }
              if (join) { A2[i] = ori; B2[i] = 0; C2[i] = cm + b; D2[i] = 0; continue; }
              d += mu * b + gam * cm; b *= (1 - mu); cm *= (1 - gam);
            }
            if (sig > 0) d *= 1 + (rnd() < 0.5 ? -sig : sig);
            A2[i] = 0; B2[i] = b; C2[i] = cm; D2[i] = d;
          }
          A.set(A2); B.set(B2); C.set(C2); D.set(D2);
        }
      },
      seed: function (st, discs) {
        var W = st.W, H = st.H;
        for (var d = 0; d < discs.length; d++) {
          var cell = hexCell(discs[d].x, discs[d].y, W, H), rr = Math.max(0, Math.round(discs[d].r) - 1), o = originOf(discs[d]);
          for (var r = cell.r - rr; r <= cell.r + rr; r++) for (var c = cell.c - rr; c <= cell.c + rr; c++) if (r > 0 && c > 0 && r < H - 1 && c < W - 1) { var i = r * W + c; st.p[0][0][i] = o; st.p[0][1][i] = 0; st.p[0][2][i] = 1; st.p[0][3][i] = 0; }
        }
      },
      display: function (st, i, P, X) { var o = st.p[0][0][i]; return o > 0 ? crystalValue(Math.floor(i / st.W), i % st.W, o, X.radius) : haloValue(st.p[0][3][i], P.rho); },
      alive: function (st) { var A = st.p[0][0], n = 0; for (var i = 0; i < st.N; i++) if (A[i] > 0) n++; return n; }
    }
  });

  // ---- Reiter's snow crystal (kept as the simpler rule) -------------------------------------------------
  // C. A. Reiter, "A local cellular model for snow crystal growth", Chaos, Solitons & Fractals 23(4) (2005)
  // 1111–1119, doi:10.1016/s0960-0779(04)00374-1. One number per cell, s, the water there. A cell is
  // receptive if it is ice (s ≥ 1) or touches ice; receptive cells hold their water and gain γ; everywhere
  // else the water diffuses toward the mean of the six neighbours, u' = u + (α/2)(ū − u); the background
  // vapour is β; a little noise in the vapour makes every crystal branch differently. Two passes: classify
  // and split, then diffuse and recombine. A no-flux boundary (the paper's edge held at β is an endless
  // reservoir that feeds an arm along the edge of a bounded screen); the outer two rings never freeze.
  defineModel({
    id: "reiter", family: "ca", name: "Reiter snow", lattice: "hex", channels: 4, grid: "ladder", maxRung: 8, keeps: true, glow: { blur: 0.9, decay: 0.965, cell: true },
    source: "C. A. Reiter, Chaos, Solitons & Fractals 23(4) (2005) 1111–1119",
    params: [
      { key: "beta", label: "Vapor", min: 0.30, max: 0.90, step: 0.01, def: 0.5 },
      { key: "gamma", label: "Growth", min: 0.0001, max: 0.003, step: 0.0001, def: 0.001 }
    ],
    extra: { alpha: 1, noise: 0.02, crystal: 1 / 3, pearl: 0.5 },
    init: function (P) { return [[P.beta, 0, 0, 0]]; },
    gpu: {
      passes: [
        { out: "aux", fs: GLSL_ORIGIN +     // pass A: receptive? → (u diffusing, v held + γ, origin)
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=S(p);float s=c.r;bool ice=s>=1.0;float og=c.g;" +
          "if(!ice){for(int k=0;k<6;k++){vec4 v=S(hexN(p,k));if(v.r>=1.0){if(inRadius(p,v.g)){ice=true;og=v.g;}break;}}}" +
          "if(p.x<2||p.y<2||p.x>=uSize.x-2||p.y>=uSize.y-2)ice=false;" +
          "o0=ice?vec4(0.0,s+uP.y,og,1.0):vec4(s,0.0,og,0.0);}" },
        { fs:                                // pass B: diffuse u toward the six-neighbour mean, recombine, noise
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=A(p);float m=0.0;for(int k=0;k<6;k++)m+=A(hexN(p,k)).r;" +
          "float u=c.r+uP.z*0.5*(m/6.0-c.r);float s=u+c.g;if(uP.w>0.0&&c.a<0.5)s+=(hash(p,uQ.w)-0.5)*uP.w;o0=vec4(s,c.b,0.0,1.0);}" }
      ],
      seed: GLSL_SEED_ORIGIN + "c=vec4(1.0,sorigin,0.0,1.0);",
      display: GLSL_ORIGIN + GLSL_HALO + GLSL_CRYSTAL + "float display(vec4 c,ivec2 p){return c.r>=1.0?crystal(p,c.g):halo(c.r,uP.x);}",
      alive: "bool alive(vec4 c,ivec2 p){return c.r>=1.0;}"
    },
    cpu: {
      step: function (st, n, P, X) {
        var W = st.W, H = st.H, Sx = st.p[0][0], O = st.p[0][1], U = st.aux[0], V = st.aux[1], REC = st.aux[2], U2 = st.aux[3];
        var a = P.alpha, g = P.gamma, noise = P.noise, R = X.radius, rnd = st.rnd, nb = [0, 0, 0, 0, 0, 0], i, r, c, k;
        for (var s = 0; s < n; s++) {
          for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
            i = r * W + c; var ice = Sx[i] >= 1, og = O[i];
            if (!ice) { hexNb(r, c, W, H, nb); for (k = 0; k < 6; k++) { var j = nb[k]; if (Sx[j] >= 1) { if (inRadius(r, c, O[j], R)) { ice = true; og = O[j]; } break; } } }
            if (r < 2 || c < 2 || r >= H - 2 || c >= W - 2) ice = false;
            REC[i] = ice ? 1 : 0; if (ice) { V[i] = Sx[i] + g; U[i] = 0; O[i] = og; } else { V[i] = 0; U[i] = Sx[i]; }
          }
          for (r = 0; r < H; r++) for (c = 0; c < W; c++) {
            i = r * W + c; hexNb(r, c, W, H, nb); var m = 0; for (k = 0; k < 6; k++) m += U[nb[k]];
            U2[i] = U[i] + a * 0.5 * (m / 6 - U[i]);
          }
          for (i = 0; i < st.N; i++) { var w2 = U2[i] + V[i]; if (noise && !REC[i]) w2 += (rnd() - 0.5) * noise; Sx[i] = w2; }
        }
      },
      seed: function (st, discs) {
        var W = st.W, H = st.H;
        for (var d = 0; d < discs.length; d++) {
          var cell = hexCell(discs[d].x, discs[d].y, W, H), rr = Math.max(0, Math.round(discs[d].r) - 1), o = originOf(discs[d]);
          for (var r = cell.r - rr; r <= cell.r + rr; r++) for (var c = cell.c - rr; c <= cell.c + rr; c++) if (r > 0 && c > 0 && r < H - 1 && c < W - 1) { st.p[0][0][r * W + c] = 1; st.p[0][1][r * W + c] = o; }
        }
      },
      display: function (st, i, P, X) { var sv = st.p[0][0][i]; return sv >= 1 ? crystalValue(Math.floor(i / st.W), i % st.W, st.p[0][1][i], X.radius) : haloValue(sv, P.beta); },
      alive: function (st) { var Sx = st.p[0][0], n = 0; for (var i = 0; i < st.N; i++) if (Sx[i] >= 1) n++; return n; }
    }
  });


  // ---- Lenia -------------------------------------------------------------------------------------------
  // B. W.-C. Chan, "Lenia — Biology of Artificial Life", Complex Systems 28(3) (2019); arXiv:1812.05433 (read
  // at source 2026-10-09). A continuous state A ∈ [0, 1] on a square grid; the potential U = K ∗ A with a
  // ring kernel of radius R, core K_C(r) = exp(4 − 1/(r(1 − r))), normalized to sum 1; the growth
  // G(u) = 2 exp(−(u − μ)² / 2σ²) − 1; the update A ← clip(A + G(U) / T, 0, 1). Orbium lives at μ 0.15, σ 0.016
  // (R 13, T 10). Periodic in space, as in the paper. The field is smooth, so it runs on the ladder and the
  // browser's bilinear upscaling shows it without cells; the kernel is a texture (uK).
  function leniaKernel(R) {
    var n = 2 * R + 1, data = new Float32Array(n * n), sum = 0;
    for (var j = 0; j < n; j++) for (var i = 0; i < n; i++) {
      var r = Math.hypot(i - R, j - R) / R, k = (r > 0 && r < 1) ? Math.exp(4 - 1 / (r * (1 - r))) : 0;
      data[j * n + i] = k; sum += k;
    }
    for (var q = 0; q < data.length; q++) data[q] /= sum;
    return { w: n, h: n, data: data };
  }
  defineModel({
    id: "lenia", family: "ca", name: "Lenia", lattice: "square", channels: 2, grid: "ladder", maxRung: 7, keeps: true, glow: { blur: 0.8, decay: 0.85 },
    source: "B. W.-C. Chan, Complex Systems 28(3) (2019), arXiv:1812.05433",
    params: [
      { key: "mu", label: "Growth center", min: 0.05, max: 0.40, step: 0.001, def: 0.15 },
      { key: "sigma", label: "Growth width", min: 0.005, max: 0.050, step: 0.001, def: 0.016 }
    ],
    extra: { R: 13, T: 10 },
    init: function () { return [[0, 0, 0, 1]]; },
    gpu: {
      kernel: function (P) { return leniaKernel(P.R); },
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);const int R=13;float u=0.0;" +     // R fixed so the loop unrolls
        "for(int j=-R;j<=R;j++)for(int i=-R;i<=R;i++){float k=K(ivec2(i+R,j+R)).r;if(k>0.0)u+=k*Sp(p+ivec2(i,j)).r;}" +
        "float g=2.0*exp(-(u-uP.x)*(u-uP.x)/(2.0*uP.y*uP.y))-1.0;o0=vec4(clamp(S(p).r+g/uP.w,0.0,1.0),0.0,0.0,1.0);}" }],
      // a soft patch of primordial soup under a smooth envelope; creatures emerge from it
      seed: "float dd=length(q-og)/max(rr,1.0);float hh=hash(p,uQ.w);c.r=max(c.r,smoothstep(1.0,0.35,dd)*(hh<0.45?0.0:hh));",   // a sparse soup: about half the cells empty
      display: "float display(vec4 c,ivec2 p){return VMAX*c.r;}",
      alive: "bool alive(vec4 c,ivec2 p){return c.r>0.01;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, A = st.p[0][0], A2 = st.aux[0], R = P.R, T = P.T, mu = P.mu, sg = P.sigma;
        if (!st.kernel || st.kernel.R !== R) { st.kernel = leniaKernel(R); st.kernel.R = R; }
        var K = st.kernel.data, kn = st.kernel.w;
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var u = 0;
            for (var j = -R; j <= R; j++) { var yy = ((y + j) % H + H) % H; for (var i = -R; i <= R; i++) { var k = K[(j + R) * kn + i + R]; if (k > 0) u += k * A[yy * W + ((x + i) % W + W) % W]; } }
            var g = 2 * Math.exp(-(u - mu) * (u - mu) / (2 * sg * sg)) - 1;
            A2[y * W + x] = clamp(A[y * W + x] + g / T, 0, 1);
          }
          A.set(A2);
        }
      },
      seed: function (st, discs) { discSeed(st, discs, function (i, x, y) { var d = discs[0] ? Math.hypot(x + 0.5 - discs[0].x, y + 0.5 - discs[0].y) / Math.max(discs[0].r, 1) : 0, env = clamp((1 - d) / 0.65, 0, 1), h = st.rnd(), v = env * (h < 0.45 ? 0 : h); if (st.p[0][0][i] < v) st.p[0][0][i] = v; }); },
      display: function (st, i) { return VMAX * st.p[0][0][i]; },
      alive: function (st) { return countAbove(st.p[0][0], 0.01); }
    }
  });

  // shared processor helpers: run fn(i) for every cell inside the discs; count cells above a threshold
  function discSeed(st, discs, fn) {
    var W = st.W, H = st.H;
    for (var d = 0; d < discs.length; d++) {
      var cx = discs[d].x, cy = discs[d].y, r = discs[d].r, r2 = r * r;
      for (var y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) for (var x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) fn(y * W + x, x, y);
      }
    }
  }
  function countAbove(A, thr) { var n = 0; for (var i = 0; i < A.length; i++) if (A[i] > thr) n++; return n; }
  function idx(st, x, y) { return clamp(y, 0, st.H - 1) * st.W + clamp(x, 0, st.W - 1); }

  // ---- the cyclic automaton (Rotor) ----------------------------------------------------------------------
  // D. Griffeath's cyclic cellular automaton (1980s; R. Fisch, J. Gravner, D. Griffeath, "Cyclic cellular
  // automata in two dimensions", 1991). Each cell holds one of n states; it advances to the next state
  // (wrapping) when at least `threshold` of its eight neighbours already hold that next state. From noise:
  // consuming blocks, then "demons" (cycles of adjacent cells holding every state) emit spiral waves, the
  // discrete excitable medium. Empty cells (state −1) are inert and black until painted.
  defineModel({
    id: "rotor", family: "ca", name: "Cyclic automaton", lattice: "square", channels: 2, grid: "pixels", keeps: true, glow: { blur: 2.2, decay: 0.94 },
    source: "R. Fisch, J. Gravner and D. Griffeath, Statistics and Computing 1 (1991) 23–39",
    params: [
      // the owner's centres and ranges (2026-10-09): 5 states at threshold 3; a half-step threshold means "at least the
      // next whole number of neighbours" (measured on the eight-neighbour lattice: threshold 1 fixates or locks the whole field)
      { key: "states", label: "States", min: 3, max: 7, step: 1, def: 5 },
      { key: "threshold", label: "Threshold", min: 1.5, max: 3.5, step: 0.5, def: 3, fixedRange: true }
    ],
    init: function () { return [[-1, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);float n=uP.x;int t=int(ceil(uP.y-0.001));vec4 c=S(p);float s=c.r;if(s<0.0){o0=vec4(-1.0,0.0,0.0,1.0);return;}" +
        "float nx=mod(s+1.0,n);int cnt=0;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){if(i==0&&j==0)continue;float v=S(p+ivec2(i,j)).r;if(v>=0.0&&abs(v-nx)<0.5)cnt++;}" +
        "bool ch=cnt>=t;o0=vec4(ch?nx:s,ch?1.0:0.0,0.0,1.0);}" }],
      seed: "c.r=floor(hash(p,uQ.w)*uP.x);",
      display: "float display(vec4 c,ivec2 p){if(c.r<0.0)return 0.0;float t=c.r/uP.x;return VMAX*(1.0-abs(2.0*t-1.0));}",
      alive: "bool alive(vec4 c,ivec2 p){return c.g>0.5;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, A = st.p[0][0], C = st.p[0][1], A2 = st.aux[0], ns = P.states, t = Math.ceil(P.threshold - 0.001);
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x, v = A[i]; if (v < 0) { A2[i] = -1; C[i] = 0; continue; }
            var nx = (v + 1) % ns, cnt = 0;
            for (var j = -1; j <= 1; j++) for (var k = -1; k <= 1; k++) { if (!j && !k) continue; var w = A[idx(st, x + k, y + j)]; if (w >= 0 && Math.abs(w - nx) < 0.5) cnt++; }
            var ch = cnt >= t; A2[i] = ch ? nx : v; C[i] = ch ? 1 : 0;
          }
          A.set(A2);
        }
      },
      seed: function (st, discs, value, X) { discSeed(st, discs, function (i) { st.p[0][0][i] = Math.floor(st.rnd() * X.P.states); }); },
      display: function (st, i, P) { var v = st.p[0][0][i]; if (v < 0) return 0; var t = v / P.states; return VMAX * (1 - Math.abs(2 * t - 1)); },
      alive: function (st) { return countAbove(st.p[0][1], 0.5); }
    }
  });

  // ---- the dielectric-breakdown model (Lichtenberg) --------------------------------------------------------
  // L. Niemeyer, L. Pietronero and H. J. Wiesmann, "Fractal dimension of dielectric breakdown", Phys. Rev.
  // Lett. 52 (1984) 1033–1036. The potential φ obeys Laplace's equation with φ = 0 on the discharge and φ = 1
  // on the far boundary (here the field's edge); a site next to the discharge joins it with probability
  // proportional to φ^η. η = 1 is diffusion-limited aggregation; larger η gives sparser, lightning-like
  // channels. Each step relaxes φ by eight Jacobi sweeps, then grows: a candidate joins when a per-cell random
  // number falls below rate · φ^η. Every attached cell remembers the step it joined (its age, for the colour).
  defineModel({
    id: "lichtenberg", family: "ca", name: "Dielectric breakdown", lattice: "square", channels: 4, grid: "pixels", keeps: true, glow: { blur: 1.6, decay: 0.985 },
    source: "L. Niemeyer, L. Pietronero and H. J. Wiesmann, Phys. Rev. Lett. 52 (1984) 1033–1036",
    params: [
      { key: "eta", label: "Exponent", min: 1.0, max: 6.0, step: 0.1, def: 2.1 },     // owner's centre points, 2026-10-09
      { key: "rate", label: "Rate", min: 0.1, max: 4.0, step: 0.1, def: 1.3 }
    ],
    init: function () { return [[1, 0, 0, 1]]; },
    gpu: {
      passes: [
        { repeat: 3, fs:
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=S(p);if(c.g>0.0){o0=vec4(0.0,c.g,c.b,1.0);return;}" +
          "if(p.x==0||p.y==0||p.x==uSize.x-1||p.y==uSize.y-1){o0=vec4(1.0,0.0,c.b,1.0);return;}" +
          "float s=S(p+ivec2(1,0)).r+S(p+ivec2(-1,0)).r+S(p+ivec2(0,1)).r+S(p+ivec2(0,-1)).r;o0=vec4(s*0.25,0.0,c.b,1.0);}" },
        { fs:
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=S(p);if(c.g>0.0){o0=c;return;}" +
          "bool nb=S(p+ivec2(1,0)).g>0.0||S(p+ivec2(-1,0)).g>0.0||S(p+ivec2(0,1)).g>0.0||S(p+ivec2(0,-1)).g>0.0;" +
          "if(nb&&hash(p,uQ.w)<uP.y*pow(max(c.r,0.0),uP.x)){o0=vec4(0.0,uQ.z,0.0,1.0);return;}o0=c;}" }
      ],
      seed: "c=vec4(0.0,max(1.0,uQ.z),0.0,1.0);",
      // the newest channels in the front colour fading to the trail colour with age; outside, a faint glow where the field is strong
      display: "float display(vec4 c,ivec2 p){if(c.g>0.0){float age=uQ.z-c.g;return VMAX-0.28*clamp(age/2400.0,0.0,1.0);}float f=1.0-c.r;return 0.08*f*f*f;}",
      alive: "bool alive(vec4 c,ivec2 p){return c.g>0.0&&uQ.z-c.g<2.0;}"
    },
    cpu: {
      step: function (st, n, P, X) {
        var W = st.W, H = st.H, F = st.p[0][0], G = st.p[0][1], F2 = st.aux[0], rnd = st.rnd, eta = P.eta, rate = P.rate;
        for (var s = 0; s < n; s++) {
          for (var it = 0; it < 8; it++) {
            for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
              var i = y * W + x;
              if (G[i] > 0) { F2[i] = 0; continue; }
              if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { F2[i] = 1; continue; }
              F2[i] = 0.25 * (F[i + 1] + F[i - 1] + F[i + W] + F[i - W]);
            }
            F.set(F2);
          }
          for (var y2 = 1; y2 < H - 1; y2++) for (var x2 = 1; x2 < W - 1; x2++) {
            var j = y2 * W + x2; if (G[j] > 0) continue;
            if ((G[j + 1] > 0 || G[j - 1] > 0 || G[j + W] > 0 || G[j - W] > 0) && rnd() < rate * Math.pow(Math.max(F[j], 0), eta)) { G[j] = X.step; F[j] = 0; }
          }
        }
      },
      seed: function (st, discs, value, X) { discSeed(st, discs, function (i) { st.p[0][0][i] = 0; st.p[0][1][i] = Math.max(1, X.step); }); },
      display: function (st, i, P, X) { var g = st.p[0][1][i]; if (g > 0) return VMAX - 0.28 * clamp((X.step - g) / 2400, 0, 1); var f = 1 - st.p[0][0][i]; return 0.08 * f * f * f; },
      alive: function (st, P, X) { var G = st.p[0][1], n = 0; for (var i = 0; i < st.N; i++) if (G[i] > 0 && X.step - G[i] < 2) n++; return n; }
    }
  });

  // ---- the abelian sandpile -----------------------------------------------------------------------------------
  // P. Bak, C. Tang and K. Wiesenfeld, "Self-organized criticality", Phys. Rev. Lett. 59 (1987) 381–384. Grains
  // on a square grid; a site holding `threshold` (4) or more topples, giving one grain to each of its four
  // neighbours; grains that fall off the edge are lost. The final configuration does not depend on the order
  // of toppling (the abelian property), so the parallel update here is exact. Grains dropped steadily at one
  // point build the circular fractal pattern of the identity-like configurations; the four levels 0–3 take
  // the four colours of the palette.
  defineModel({
    id: "sandpile", family: "ca", name: "Abelian sandpile", lattice: "square", channels: 2, grid: "pixels", stepsPerUnit: 8, keeps: true, glow: { blur: 1.3, decay: 0.9 },
    source: "P. Bak, C. Tang and K. Wiesenfeld, Phys. Rev. Lett. 59 (1987) 381–384",
    params: [
      { key: "grains", label: "Grains", min: 1, max: 64, step: 1, def: 16 },
      { key: "threshold", label: "Threshold", min: 4, max: 8, step: 1, def: 4 }
    ],
    init: function () { return [[0, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);float th=uP.y;float h=S(p).r;float t=0.0;if(h>=th){h-=th;t=1.0;}float add=0.0;" +
        "for(int k=0;k<4;k++){ivec2 q=p+(k==0?ivec2(1,0):k==1?ivec2(-1,0):k==2?ivec2(0,1):ivec2(0,-1));if(q.x<0||q.y<0||q.x>=uSize.x||q.y>=uSize.y)continue;if(S(q).r>=th)add+=th*0.25;}" +
        "o0=vec4(h+add,t,0.0,1.0);}" }],
      seed: "c.r+=uP.x;",
      display: "float display(vec4 c,ivec2 p){return VMAX*min(c.r,3.0)/3.0;}",
      alive: "bool alive(vec4 c,ivec2 p){return c.g>0.5;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, A = st.p[0][0], T = st.p[0][1], A2 = st.aux[0], th = P.threshold;
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x, h = A[i], t = 0; if (h >= th) { h -= th; t = 1; }
            var add = 0;
            if (x < W - 1 && A[i + 1] >= th) add += th / 4; if (x > 0 && A[i - 1] >= th) add += th / 4;
            if (y < H - 1 && A[i + W] >= th) add += th / 4; if (y > 0 && A[i - W] >= th) add += th / 4;
            A2[i] = h + add; T[i] = t;
          }
          A.set(A2);
        }
      },
      seed: function (st, discs, value, X) { discSeed(st, discs, function (i) { st.p[0][0][i] += X.P.grains; }); },
      display: function (st, i) { return VMAX * Math.min(st.p[0][0][i], 3) / 3; },
      alive: function (st) { return countAbove(st.p[0][1], 0.5); }
    }
  });

  // ---- falling sand (Sandpile) -------------------------------------------------------------------------------------
  // T. Toffoli and N. Margolus, "Cellular Automata Machines" (MIT Press, 1987), the "sand" rule on the Margolus
  // neighbourhood: the lattice is cut into 2 × 2 blocks whose origin alternates between steps; within a block a
  // grain in the top row falls into the cell beneath if that is free, else slides into the other bottom cell if
  // that is free and nothing else claims it. Dropped grains fall, heap at the bottom at the angle of repose, and
  // avalanche when the heap is oversteepened — the pile the abelian model abstracts. `slip` is the probability a
  // grain takes the diagonal when it may (1 = the published rule; lower = steeper heaps).
  var SAND_BLOCK =
    // the block's four cells from the cell's own position; the output for this cell after the block rule
    "float sandOut(ivec2 p,int off,float slip,float seed,out float moved){ivec2 b=p-((p+ivec2(off))&1);ivec2 me=p-b;" +
    "float tl=S(b).r,tr=S(b+ivec2(1,0)).r,bl=S(b+ivec2(0,1)).r,br=S(b+ivec2(1,1)).r;" +
    "bool edgeY=b.y+1>=uSize.y,edgeX=b.x+1>=uSize.x;if(edgeY||edgeX){moved=0.0;return S(p).r;}" +   // a cut-off block at the edge stands still
    "float r=hash(b,seed);float ntl=tl,ntr=tr,nbl=bl,nbr=br;moved=0.0;" +
    "if(tl>0.5&&bl<0.5){ntl=0.0;nbl=1.0;}if(tr>0.5&&br<0.5){ntr=0.0;nbr=1.0;}" +
    "if(ntl>0.5&&nbl>0.5&&nbr<0.5&&ntr<0.5&&r<slip){ntl=0.0;nbr=1.0;}else if(ntr>0.5&&nbr>0.5&&nbl<0.5&&ntl<0.5&&r<slip){ntr=0.0;nbl=1.0;}" +
    "float o=me.x==0?(me.y==0?ntl:nbl):(me.y==0?ntr:nbr);float was=S(p).r;moved=(o>0.5&&was<0.5)?1.0:0.0;return o;}\n";
  defineModel({
    id: "sand", family: "ca", name: "Falling sand", lattice: "square", channels: 2, grid: "pixels", stepsPerUnit: 2, keeps: true, glow: { blur: 1.2, decay: 0.9 },
    source: "T. Toffoli and N. Margolus, Cellular Automata Machines, MIT Press (1987), the sand rule",
    params: [
      { key: "grains", label: "Grains", min: 1, max: 12, step: 0.5, def: 4 },
      { key: "slip", label: "Slip", min: 0, max: 1, step: 0.05, def: 0.7 }
    ],
    init: function () { return [[0, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs: SAND_BLOCK + "void main(){ivec2 p=ivec2(gl_FragCoord.xy);float mv;float o=sandOut(p,int(uQ.z)&1,uP.y,uQ.w,mv);o0=vec4(o,mv,0.0,1.0);}" }],
      // a sprinkle of grains over a disc the size of the Grains setting
      seed: "float dd=length(q-og);if(dd<=uP.x&&hash(p,uQ.w)<0.6)c.r=1.0;",
      display: "float display(vec4 c,ivec2 p){return c.r>0.5?(c.g>0.5?VMAX:0.27):0.0;}",
      alive: "bool alive(vec4 c,ivec2 p){return c.g>0.5;}"
    },
    cpu: {
      step: function (st, n, P, X) {
        var W = st.W, H = st.H, A = st.p[0][0], M = st.p[0][1], A2 = st.aux[0], rnd = st.rnd, slip = P.slip;
        for (var s = 0; s < n; s++) {
          var off = (X.step + s) & 1; A2.set(A); M.fill(0);
          for (var by = -off; by < H; by += 2) for (var bx = -off; bx < W; bx += 2) {
            if (by < 0 || bx < 0 || by + 1 >= H || bx + 1 >= W) continue;
            var i0 = by * W + bx, i1 = i0 + 1, i2 = i0 + W, i3 = i2 + 1, tl = A[i0], tr = A[i1], bl = A[i2], br = A[i3];
            if (tl > 0.5 && bl < 0.5) { tl = 0; bl = 1; } if (tr > 0.5 && br < 0.5) { tr = 0; br = 1; }
            var r = rnd();
            if (tl > 0.5 && bl > 0.5 && br < 0.5 && tr < 0.5 && r < slip) { tl = 0; br = 1; } else if (tr > 0.5 && br > 0.5 && bl < 0.5 && tl < 0.5 && r < slip) { tr = 0; bl = 1; }
            A2[i0] = tl; A2[i1] = tr; A2[i2] = bl; A2[i3] = br;
            if (bl > 0.5 && A[i2] < 0.5) M[i2] = 1; if (br > 0.5 && A[i3] < 0.5) M[i3] = 1;
          }
          A.set(A2);
        }
      },
      seed: function (st, discs, value, X) { discSeed(st, discs, function (i, x, y) { if (Math.hypot(x + 0.5 - discs[0].x, y + 0.5 - discs[0].y) <= X.P.grains && st.rnd() < 0.6) st.p[0][0][i] = 1; }); },
      display: function (st, i) { return st.p[0][0][i] > 0.5 ? (st.p[0][1][i] > 0.5 ? VMAX : 0.27) : 0; },
      alive: function (st) { return countAbove(st.p[0][1], 0.5); }
    }
  });

  // ---- Rule 30 (Conus) ---------------------------------------------------------------------------------------------
  // S. Wolfram, "Statistical mechanics of cellular automata", Rev. Mod. Phys. 55 (1983) 601–644; "A New Kind of
  // Science" (2002). An elementary one-dimensional automaton: each cell's next state is the rule's bit for the
  // 3-cell neighbourhood (left, self, right) read as a number 0–7. Rows are stacked in time, the newest at the
  // bottom, scrolling up — the pigmentation of Conus textile's shell, laid down row by row at the mantle edge.
  // The brush and Seed act on the live row (the bottom); Density sprinkles random cells into the stroke.
  defineModel({
    id: "conus", family: "ca", name: "Elementary automaton", lattice: "square", channels: 2, grid: "pixels", keeps: true, seedAll: true, glow: { blur: 1.0, decay: 0 },   // its history is its own trail: blur only
    source: "S. Wolfram, Rev. Mod. Phys. 55 (1983) 601–644",
    params: [
      { key: "rule", label: "Rule", min: 0, max: 255, step: 1, def: 30 },
      { key: "density", label: "Density", min: 0, max: 1, step: 0.01, def: 0 }
    ],
    init: function () { return [[0, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);int Hh=uSize.y-1;if(p.y<Hh){o0=S(p+ivec2(0,1));return;}" +
        "int rule=int(uP.x);float l=Sp(ivec2(p.x-1,Hh)).r,m=S(ivec2(p.x,Hh)).r,r=Sp(ivec2(p.x+1,Hh)).r;int code=(l>0.5?4:0)+(m>0.5?2:0)+(r>0.5?1:0);" +
        "float v=((rule>>code)&1)==1?1.0:0.0;o0=vec4(v,float(code),0.0,1.0);}" }],
      seed: "if(p.y==uSize.y-1&&abs(q.x-og.x)<=max(rr,0.5)){c.r=(hash(p,uQ.w)<uP.y||abs(q.x-og.x)<=0.5)?1.0:c.r;}",
      display: "float display(vec4 c,ivec2 p){return c.r>0.5?0.22+0.18*c.g/7.0:0.0;}",
      alive: "bool alive(vec4 c,ivec2 p){return p.y==uSize.y-1&&c.r>0.5;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, A = st.p[0][0], C = st.p[0][1], rule = P.rule | 0, bot = (H - 1) * W;
        for (var s = 0; s < n; s++) {
          var row = new Float32Array(W), code = new Float32Array(W);
          for (var x = 0; x < W; x++) { var l = A[bot + (x + W - 1) % W], m = A[bot + x], r = A[bot + (x + 1) % W]; var cd = (l > 0.5 ? 4 : 0) + (m > 0.5 ? 2 : 0) + (r > 0.5 ? 1 : 0); row[x] = (rule >> cd) & 1; code[x] = cd; }
          A.copyWithin(0, W); C.copyWithin(0, W); A.set(row, bot); C.set(code, bot);
        }
      },
      seed: function (st, discs, value, X) {
        var W = st.W, bot = (st.H - 1) * st.W;
        for (var d = 0; d < discs.length; d++) { var cx = discs[d].x, r = Math.max(discs[d].r, 0.5); for (var x = 0; x < W; x++) if (Math.abs(x + 0.5 - cx) <= r && (st.rnd() < X.P.density || Math.abs(x + 0.5 - cx) <= 0.5)) st.p[0][0][bot + x] = 1; }
      },
      display: function (st, i) { return st.p[0][0][i] > 0.5 ? 0.22 + 0.18 * st.p[0][1][i] / 7 : 0; },
      alive: function (st) { var bot = (st.H - 1) * st.W, n = 0; for (var x = 0; x < st.W; x++) if (st.p[0][0][bot + x] > 0.5) n++; return n; }
    }
  });

  // ---- the forest-fire model (Wildfire) ------------------------------------------------------------------------
  // B. Drossel and F. Schwabl, "Self-organized critical forest-fire model", Phys. Rev. Lett. 69 (1992) 1629–1632.
  // Each cell is empty, a tree, or burning; every step: a burning cell becomes empty; a tree burns if a neighbour
  // burns; a tree ignites by lightning with probability f; an empty cell grows a tree with probability p. Read
  // as contagion it is the SIR epidemic with regrowth. The brush ignites what it touches and plants where it
  // finds nothing; the first Seed plants the whole field. Burnt ground glows in the trail colour, fading.
  defineModel({
    id: "wildfire", family: "ca", name: "Forest fire", lattice: "square", channels: 2, grid: "pixels", keeps: true, glow: { blur: 1.6, decay: 0.96 },
    source: "B. Drossel and F. Schwabl, Phys. Rev. Lett. 69 (1992) 1629–1632",
    params: [
      { key: "growth", label: "Growth", min: 0.0005, max: 0.02, step: 0.0005, def: 0.005 },
      { key: "lightning", label: "Lightning", min: 0, max: 0.0002, step: 0.000005, def: 0.00002 }
    ],
    init: function () { return [[0, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=S(p);float s=c.r,ash=max(0.0,c.g-1.0);float h=hash(p,uQ.w);" +
        "if(s>1.5){o0=vec4(0.0,60.0,0.0,1.0);return;}" +
        "if(s>0.5){bool nb=S(p+ivec2(1,0)).r>1.5||S(p+ivec2(-1,0)).r>1.5||S(p+ivec2(0,1)).r>1.5||S(p+ivec2(0,-1)).r>1.5;o0=vec4((nb||h<uP.y)?2.0:1.0,0.0,0.0,1.0);return;}" +
        "o0=vec4(h<uP.x?1.0:0.0,ash,0.0,1.0);}" }],
      seed: "c.r=c.r>0.5?2.0:(hash(p,uQ.w)<0.6?1.0:0.0);",
      display: "float display(vec4 c,ivec2 p){if(c.r>1.5)return VMAX;if(c.r>0.5)return 0.24;return 0.12*clamp(c.g/60.0,0.0,1.0);}",
      alive: "bool alive(vec4 c,ivec2 p){return c.r>0.5||c.g>0.0;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, A = st.p[0][0], G = st.p[0][1], A2 = st.aux[0], G2 = st.aux[1], rnd = st.rnd, pg = P.growth, f = P.lightning;
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x, v = A[i], ash = Math.max(0, G[i] - 1);
            if (v > 1.5) { A2[i] = 0; G2[i] = 60; continue; }
            if (v > 0.5) { var nb = A[idx(st, x + 1, y)] > 1.5 || A[idx(st, x - 1, y)] > 1.5 || A[idx(st, x, y + 1)] > 1.5 || A[idx(st, x, y - 1)] > 1.5; A2[i] = (nb || rnd() < f) ? 2 : 1; G2[i] = 0; continue; }
            A2[i] = rnd() < pg ? 1 : 0; G2[i] = ash;
          }
          A.set(A2); G.set(G2);
        }
      },
      seed: function (st, discs) { discSeed(st, discs, function (i) { var A = st.p[0][0]; A[i] = A[i] > 0.5 ? 2 : (st.rnd() < 0.6 ? 1 : 0); }); },
      display: function (st, i) { var v = st.p[0][0][i]; if (v > 1.5) return VMAX; if (v > 0.5) return 0.24; return 0.12 * clamp(st.p[0][1][i] / 60, 0, 1); },
      alive: function (st) { var A = st.p[0][0], G = st.p[0][1], n = 0; for (var i = 0; i < st.N; i++) if (A[i] > 0.5 || G[i] > 0) n++; return n; }
    }
  });

  // ---- Potts grain growth (Grain) ----------------------------------------------------------------------------------
  // R. B. Potts (1952); M. P. Anderson, D. J. Srolovitz, G. S. Grest and P. S. Sahni, "Computer simulation of grain
  // growth — I. Kinetics", Acta Metall. 32 (1984) 783–791. Each cell holds one of Q orientations; a cell proposes
  // the orientation of a random neighbour and accepts it by the Metropolis rule on the number of unlike neighbours
  // (energy), always when it lowers the energy, else with probability exp(−ΔE / T). Q = 2 is the Ising magnet.
  // Updated on a checkerboard (two half-steps) so no cell reads a neighbour changed in the same half-step.
  // Empty cells (−1) are black; a painted patch of random orientations seeds grains that spread into the empty
  // field, then coarsen.
  function pottsPass(par) {
    return "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=S(p);if(((p.x+p.y)&1)!=" + par + "){o0=vec4(c.r,0.0,0.0,1.0);return;}float s=c.r,T=uP.y;" +
      "int k=int(hash(p,uQ.w)*8.0);ivec2 d=k==0?ivec2(1,0):k==1?ivec2(-1,0):k==2?ivec2(0,1):k==3?ivec2(0,-1):k==4?ivec2(1,1):k==5?ivec2(-1,1):k==6?ivec2(1,-1):ivec2(-1,-1);" +
      "float ns=S(p+d).r;if(ns<-0.5){o0=vec4(s,0.0,0.0,1.0);return;}if(s<-0.5){o0=vec4(ns,1.0,0.0,1.0);return;}" +
      "float e0=0.0,e1=0.0;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){if(i==0&&j==0)continue;float v=S(p+ivec2(i,j)).r;if(v<-0.5)continue;e0+=abs(v-s)<0.5?0.0:1.0;e1+=abs(v-ns)<0.5?0.0:1.0;}" +
      "float dE=e1-e0;bool acc=dE<=0.0||hash(p+ivec2(7,3),uQ.w)<exp(-dE/T);o0=vec4(acc?ns:s,(acc&&abs(ns-s)>0.5)?1.0:0.0,0.0,1.0);}";
  }
  defineModel({
    id: "grain", family: "ca", name: "Potts grain growth", lattice: "square", channels: 2, grid: "pixels", keeps: true, glow: { blur: 1.6, decay: 0.85 },
    source: "M. P. Anderson, D. J. Srolovitz, G. S. Grest and P. S. Sahni, Acta Metall. 32 (1984) 783–791",
    params: [
      { key: "states", label: "Orientations", min: 2, max: 32, step: 1, def: 12 },
      { key: "temperature", label: "Temperature", min: 0.05, max: 2.0, step: 0.05, def: 0.6 }
    ],
    init: function () { return [[-1, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs: pottsPass(0) }, { fs: pottsPass(1) }],
      seed: "c.r=floor(hash(p,uQ.w)*uP.x);",
      display: "float display(vec4 c,ivec2 p){return c.r<-0.5?0.0:0.1+0.3*c.r/max(uP.x-1.0,1.0);}",
      alive: "bool alive(vec4 c,ivec2 p){return c.g>0.5;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, A = st.p[0][0], C = st.p[0][1], rnd = st.rnd, T = P.temperature, D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
        for (var s = 0; s < n; s++) for (var par = 0; par < 2; par++) {
          for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
            var i = y * W + x; if (((x + y) & 1) !== par) { C[i] = 0; continue; }
            var v = A[i], d = D[Math.floor(rnd() * 8)], ns = A[idx(st, x + d[0], y + d[1])];
            if (ns < -0.5) { C[i] = 0; continue; }
            if (v < -0.5) { A[i] = ns; C[i] = 1; continue; }
            var e0 = 0, e1 = 0;
            for (var j = -1; j <= 1; j++) for (var k = -1; k <= 1; k++) { if (!j && !k) continue; var w = A[idx(st, x + k, y + j)]; if (w < -0.5) continue; e0 += Math.abs(w - v) < 0.5 ? 0 : 1; e1 += Math.abs(w - ns) < 0.5 ? 0 : 1; }
            var dE = e1 - e0, acc = dE <= 0 || rnd() < Math.exp(-dE / T);
            if (acc) A[i] = ns; C[i] = (acc && Math.abs(ns - v) > 0.5) ? 1 : 0;
          }
        }
      },
      seed: function (st, discs, value, X) { discSeed(st, discs, function (i) { st.p[0][0][i] = Math.floor(st.rnd() * X.P.states); }); },
      display: function (st, i, P) { var v = st.p[0][0][i]; return v < -0.5 ? 0 : 0.1 + 0.3 * v / Math.max(P.states - 1, 1); },
      alive: function (st) { return countAbove(st.p[0][1], 0.5); }
    }
  });


  // ---- the lattice-Boltzmann fluid (Wake) ---------------------------------------------------------------------------
  // The D2Q9 lattice-Boltzmann method with BGK collision (Bhatnagar, Gross and Krook 1954; Qian, d'Humières and
  // Lallemand, Europhys. Lett. 17 (1992) 479–484), the descendant of the lattice-gas automata of Frisch, Hasslacher
  // and Pomeau (1986). Nine populations f_i per cell along e_0 … e_8 with weights 4/9, 1/9 ×4, 1/36 ×4;
  // density ρ = Σ f_i, velocity u = Σ e_i f_i / ρ; equilibrium f_i^eq = w_i ρ (1 + 3 e_i·u + 9/2 (e_i·u)² − 3/2 u²);
  // collision f_i ← f_i + (f_i^eq − f_i)/τ with the viscosity ν = (τ − ½)/3; streaming f_i(x + e_i) ← f_i(x).
  // Two passes: collide into the work textures, then stream by pulling. Painted cells are solid and bounce back
  // (the population heading into a wall returns reversed); fluid enters at the left edge at the flow speed and
  // leaves at the right. Three state textures: f0–f3, f4–f7, (f8, solid, u_x, u_y). The field is smooth: it runs
  // on the ladder and is shown by bilinear upscaling. Colour is the vorticity and the departure from the
  // undisturbed flow, so a quiet field is black until an obstacle is painted.
  var LBM_E = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  var LBM_W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
  var LBM_OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
  function lbmEq(i, rho, ux, uy) { var eu = LBM_E[i][0] * ux + LBM_E[i][1] * uy; return LBM_W[i] * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * (ux * ux + uy * uy)); }
  var GLSL_LBM =
    "const vec2 E[9]=vec2[9](vec2(0,0),vec2(1,0),vec2(0,1),vec2(-1,0),vec2(0,-1),vec2(1,1),vec2(-1,1),vec2(-1,-1),vec2(1,-1));" +
    "const float Wt[9]=float[9](4./9.,1./9.,1./9.,1./9.,1./9.,1./36.,1./36.,1./36.,1./36.);const int OPP[9]=int[9](0,3,4,1,2,7,8,5,6);\n" +
    "float feq(int i,float rho,vec2 u){float eu=dot(E[i],u);return Wt[i]*rho*(1.0+3.0*eu+4.5*eu*eu-1.5*dot(u,u));}\n" +
    "float ai(ivec2 q,int i){q=wrapC(q);return i<4?A(q)[i]:(i<8?A1(q)[i-4]:A2(q).r);}\n";
  defineModel({
    id: "wake", family: "ca", name: "Lattice-Boltzmann fluid", lattice: "square", channels: 4, targets: 3, grid: "ladder", keeps: true, glow: { blur: 0.8, decay: 0.8 },
    source: "Y. H. Qian, D. d'Humières and P. Lallemand, Europhys. Lett. 17 (1992) 479–484",
    params: [
      { key: "flow", label: "Flow", min: 0.02, max: 0.13, step: 0.005, def: 0.115 },        // owner's centre points, 2026-10-09
      { key: "viscosity", label: "Viscosity", min: 0.004, max: 0.10, step: 0.001, def: 0.005 }
    ],
    init: function (P) { var f = []; for (var i = 0; i < 9; i++) f.push(lbmEq(i, 1, P.flow, 0)); return [[f[0], f[1], f[2], f[3]], [f[4], f[5], f[6], f[7]], [f[8], 0, P.flow, 0]]; },
    gpu: {
      passes: [
        { out: "aux", fs: GLSL_LBM +     // collide
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 a=S(p),b=S1(p),c2=S2(p);if(c2.y>0.5){o0=a;o1=b;o2=c2;return;}" +
          "float f[9]=float[9](a.x,a.y,a.z,a.w,b.x,b.y,b.z,b.w,c2.x);float rho=0.0;vec2 u=vec2(0.0);for(int i=0;i<9;i++){rho+=f[i];u+=E[i]*f[i];}u/=max(rho,1e-6);" +
          "float om=1.0/(3.0*uP.y+0.5);for(int i=0;i<9;i++)f[i]+=om*(feq(i,rho,u)-f[i]);" +
          "o0=vec4(f[0],f[1],f[2],f[3]);o1=vec4(f[4],f[5],f[6],f[7]);o2=vec4(f[8],c2.y,u);}" },
        { fs: GLSL_LBM +                  // stream (pull), bounce back at solids, inlet and outlet
          "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c2=S2(p);float solid=c2.y;float f[9];" +
          "if(solid>0.5){for(int i=0;i<9;i++)f[i]=ai(p+ivec2(E[i]),OPP[i]);}else{for(int i=0;i<9;i++)f[i]=ai(p-ivec2(E[i]),i);}" +
          "if(p.x==0){for(int i=0;i<9;i++)f[i]=feq(i,1.0,vec2(uP.x,0.0));}else if(p.x==uSize.x-1){for(int i=0;i<9;i++)f[i]=ai(p-ivec2(1,0),i);}" +
          "o0=vec4(f[0],f[1],f[2],f[3]);o1=vec4(f[4],f[5],f[6],f[7]);o2=vec4(f[8],solid,A2(p).zw);}" }
      ],
      seed: "c2.y=1.0;",
      display: GLSL_LBM +
        "float display(vec4 c,ivec2 p){vec4 s=S2(p);if(s.y>0.5)return VMAX;float curl=(S2(p+ivec2(1,0)).w-S2(p+ivec2(-1,0)).w)-(S2(p+ivec2(0,1)).z-S2(p+ivec2(0,-1)).z);" +
        "float dev=length(s.zw-vec2(uP.x,0.0));return VMAX*clamp(4.0*abs(curl)/uP.x+0.5*dev/uP.x,0.0,1.0);}",
      alive: "bool alive(vec4 c,ivec2 p){return S2(p).y>0.5;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, F = [st.p[0][0], st.p[0][1], st.p[0][2], st.p[0][3], st.p[1][0], st.p[1][1], st.p[1][2], st.p[1][3], st.p[2][0]];
        var SOL = st.p[2][1], UX = st.p[2][2], UY = st.p[2][3], om = 1 / (3 * P.viscosity + 0.5), u0 = P.flow;
        if (!st.work) { st.work = []; for (var q = 0; q < 9; q++) st.work.push(new Float32Array(st.N)); }
        var G = st.work, i, x, y, k, j;
        for (var s = 0; s < n; s++) {
          for (i = 0; i < st.N; i++) {                                           // collide
            if (SOL[i] > 0.5) { for (k = 0; k < 9; k++) G[k][i] = F[k][i]; continue; }
            var rho = 0, ux = 0, uy = 0;
            for (k = 0; k < 9; k++) { var fk = F[k][i]; rho += fk; ux += LBM_E[k][0] * fk; uy += LBM_E[k][1] * fk; }
            ux /= Math.max(rho, 1e-6); uy /= Math.max(rho, 1e-6); UX[i] = ux; UY[i] = uy;
            for (k = 0; k < 9; k++) G[k][i] = F[k][i] + om * (lbmEq(k, rho, ux, uy) - F[k][i]);
          }
          for (y = 0; y < H; y++) for (x = 0; x < W; x++) {                      // stream
            i = y * W + x;
            if (x === 0) { for (k = 0; k < 9; k++) F[k][i] = lbmEq(k, 1, u0, 0); continue; }
            if (x === W - 1) { for (k = 0; k < 9; k++) F[k][i] = G[k][i - 1]; continue; }
            if (SOL[i] > 0.5) { for (k = 0; k < 9; k++) { j = idx(st, x + LBM_E[k][0], y + LBM_E[k][1]); F[k][i] = G[LBM_OPP[k]][j]; } continue; }
            for (k = 0; k < 9; k++) { j = idx(st, x - LBM_E[k][0], y - LBM_E[k][1]); F[k][i] = G[k][j]; }
          }
        }
      },
      seed: function (st, discs) { discSeed(st, discs, function (i) { st.p[2][1][i] = 1; }); },
      display: function (st, i, P) {
        var W = st.W, x = i % W, y = (i / W) | 0, SOL = st.p[2][1], UX = st.p[2][2], UY = st.p[2][3];
        if (SOL[i] > 0.5) return VMAX;
        var curl = (UY[idx(st, x + 1, y)] - UY[idx(st, x - 1, y)]) - (UX[idx(st, x, y + 1)] - UX[idx(st, x, y - 1)]);
        var dev = Math.hypot(UX[i] - P.flow, UY[i]);
        return VMAX * clamp(4 * Math.abs(curl) / P.flow + 0.5 * dev / P.flow, 0, 1);
      },
      alive: function (st) { return countAbove(st.p[2][1], 0.5); }
    }
  });


  // ---- the graphics-processor backend (WebGL2, float textures) -------------------------------------
  // Generic: it knows textures, passes and the palette, and nothing about any model. A model's step is
  // its list of fragment programs; the state lives in a ping-pong pair of buffers, each buffer holding
  // `targets` textures (multiple render targets) of `channels` floats per cell.
  function gpuBackend(canvas) {
    var gl = canvas.getContext && canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl || typeof gl.getExtension !== "function" || !gl.getExtension("EXT_color_buffer_float")) return null;
    function compile(type, src) { var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + "\n" + src); return sh; }
    var UNIFORMS = ["uS0", "uS1", "uS2", "uA", "uA1", "uA2", "uK", "uL", "uP", "uP2", "uQ", "uSize", "uD", "uN", "uVal", "uHex", "uAll", "uVmax", "uOut", "uNew", "uGlow"];
    function program(fs) {
      var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      var L = {}; UNIFORMS.forEach(function (u) { L[u] = gl.getUniformLocation(p, u); });
      return { p: p, L: L };
    }
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var lutLoaded = null;

    // ---- state ----
    var model = null, NT = 1, fmt = gl.RG32F, hex = false;
    var W = 0, H = 0, CW = 0, CH = 0;          // lattice (W × H) and canvas (CW × CH) sizes
    var bufs = [null, null], cur = 0, aux = null, comp = null, showComp = false, kern = null;
    var cntTex = null, cntW = 0, cntH = 0, cntBuf = null;
    var progs = {}, shared = {};              // compiled programs per model id; copy/resample per target count
    // the glow stage: the display scalar at canvas resolution (gA, gB for the separable blur) and the persistence
    // field (gP, ping-pong) that every frame takes the maximum of the blurred scalar and its own decayed self
    var gA = null, gB = null, gP = [null, null], gCur = 0, glowProgs = null;
    function makeOne(w, h) { var t = makeTex(w, h, gl.RGBA32F), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t: t, f: f }; }
    function freeOne(x) { if (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } }
    function glowPrograms() {
      if (glowProgs) return glowProgs;
      glowProgs = {
        blur: program(GLSL_HEAD + "uniform vec4 uGlow;out vec4 o;void main(){ivec2 p=ivec2(gl_FragCoord.xy);ivec2 sz=textureSize(uS0,0);float s=max(uGlow.x,0.01);int R=int(ceil(2.5*s));float sum=0.0,ws=0.0;" +
          "for(int k=-16;k<=16;k++){if(k<-R||k>R)continue;float w=exp(-float(k*k)/(2.0*s*s));ivec2 q=clamp(p+ivec2(uGlow.zw)*k,ivec2(0),sz-1);sum+=w*texelFetch(uS0,q,0).r;ws+=w;}o=vec4(sum/ws,0.0,0.0,1.0);}"),
        persist: program(GLSL_HEAD + "uniform vec4 uGlow;out vec4 o;void main(){ivec2 p=ivec2(gl_FragCoord.xy);float v=texelFetch(uS0,p,0).r,old=texelFetch(uA,p,0).r*uGlow.y;o=vec4(max(v,old),0.0,0.0,1.0);}"),
        lut: program(GLSL_HEAD + "uniform sampler2D uL;uniform float uVmax;out vec4 o;void main(){float v=texelFetch(uS0,ivec2(gl_FragCoord.xy),0).r;o=vec4(texture(uL,vec2(clamp(v/uVmax,0.0,1.0),0.5)).rgb,1.0);}")
      };
      return glowProgs;
    }
    function drawTex(pr, src, srcA, target, w, h) {
      var L = run(pr, target, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(L.uS0, 0);
      if (srcA) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, srcA); gl.uniform1i(L.uA, 6); }
      return L;
    }
    // render the display scalar (same sampling as the show pass) into gA, then blur it in place (gA ↔ gB)
    function scalarPass() {
      var set = progs[model.id], L = run(set.scalar, gA.f, CW, CH); bindState(L, showComp && comp ? comp : bufs[cur]); setCommon(L);
      gl.uniform1f(L.uHex, hex ? 1 : 0); gl.uniform2f(L.uOut, CW, CH); gl.drawArrays(gl.TRIANGLES, 0, 3);
      var g = model.glow, sigma = g && g.blur ? g.blur * (g.cell ? Math.max(1, CW / W) : Math.max(0.6, CW / 1000)) : 0;   // `cell`: the blur follows the cell's size on screen
      if (sigma > 0) {
        var gp = glowPrograms(), Lb = drawTex(gp.blur, gA.t, null, gB.f, CW, CH); gl.uniform4f(Lb.uGlow, sigma, 0, 1, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
        Lb = drawTex(gp.blur, gB.t, null, gA.f, CW, CH); gl.uniform4f(Lb.uGlow, sigma, 0, 0, 1); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    function clearGlow() { if (gP[0]) { [gP[0], gP[1]].forEach(function (x) { gl.bindFramebuffer(gl.FRAMEBUFFER, x.f); gl.viewport(0, 0, CW, CH); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }); } }
    var stepIndex = 0, P8 = new Float32Array(8), Q = [1, 0, 0, 0];

    function makeTex(w, h, f) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, f || fmt, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    // a buffer: `targets` textures behind one framebuffer with that many colour attachments
    function makeBuf(w, h) {
      var b = { t: [], f: gl.createFramebuffer() }, att = [];
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.f);
      for (var i = 0; i < NT; i++) { b.t.push(makeTex(w, h)); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, b.t[i], 0); att.push(gl.COLOR_ATTACHMENT0 + i); }
      gl.drawBuffers(att);
      return b;
    }
    function freeBuf(b) { if (b) { b.t.forEach(function (t) { gl.deleteTexture(t); }); gl.deleteFramebuffer(b.f); } }
    function clearBuf(b, inits) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, b.f); gl.viewport(0, 0, W, H);
      for (var i = 0; i < NT; i++) { var c = inits[Math.min(i, inits.length - 1)]; gl.clearBufferfv(gl.COLOR, i, new Float32Array([c[0] || 0, c[1] || 0, c[2] || 0, c[3] === undefined ? 1 : c[3]])); }
    }
    function bindState(L, b) {
      for (var i = 0; i < 3; i++) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, b.t[Math.min(i, NT - 1)]); }
      gl.uniform1i(L.uS0, 0); gl.uniform1i(L.uS1, 1); gl.uniform1i(L.uS2, 2);
      if (aux) { for (var j = 0; j < 3; j++) { gl.activeTexture(gl.TEXTURE6 + j); gl.bindTexture(gl.TEXTURE_2D, aux.t[Math.min(j, NT - 1)]); } gl.uniform1i(L.uA, 6); gl.uniform1i(L.uA1, 7); gl.uniform1i(L.uA2, 8); }
      if (kern) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, kern); gl.uniform1i(L.uK, 4); }
    }
    function setCommon(L) {
      gl.uniform4fv(L.uP, P8.subarray(0, 4)); gl.uniform4fv(L.uP2, P8.subarray(4, 8));
      gl.uniform4f(L.uQ, Q[0], Q[1], Q[2], Q[3]); gl.uniform2i(L.uSize, W, H);
    }
    function run(pr, target, w, h) { gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, w, h); return pr.L; }

    // ---- programs for a model (compiled once, cached) ----
    function programsFor(m) {
      if (progs[m.id]) return progs[m.id];
      var o = outDecl(NT), g = m.gpu, set = { passes: [] };
      g.passes.forEach(function (ps) { set.passes.push({ pr: program(GLSL_HEAD + o + ps.fs), out: ps.out || "state", repeat: ps.repeat || 1 }); });
      set.seed = program(GLSL_HEAD + o + "uniform vec3 uD[32];uniform int uN;uniform float uVal,uHex,uAll;\n" +
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=texelFetch(uS0,p,0);vec4 c1=texelFetch(uS1,p,0),c2=texelFetch(uS2,p,0);" +
        "vec2 q=uHex>0.5?hexQ(p):vec2(p)+0.5;bool hit=false;vec2 og=vec2(0.0);float rr=0.0;" +
        "for(int i=0;i<32;i++){if(i>=uN)break;vec2 d=q-uD[i].xy;if(dot(d,d)<=uD[i].z*uD[i].z){hit=true;og=uD[i].xy;rr=uD[i].z;}}" +
        "if(uAll>0.5&&uN>0){og=uD[0].xy;rr=uD[0].z;}if(hit||uAll>0.5){" + g.seed + "}o0=c;" + (NT > 1 ? "o1=c1;" : "") + (NT > 2 ? "o2=c2;" : "") + "}");
      set.show = program(GLSL_HEAD + "uniform sampler2D uL;uniform float uVmax,uHex;uniform vec2 uOut;out vec4 o;\n" + g.display + "\n" +
        "void main(){ivec2 g=uSize;ivec2 p;if(uHex>0.5){vec2 pix=vec2(gl_FragCoord.x,uOut.y-gl_FragCoord.y);float yc=pix.y/0.8660254;int r0=int(floor(yc));float best=1e9;p=ivec2(0);" +
        "for(int dr=-1;dr<=1;dr++){int r=r0+dr;if(r<0||r>=g.y)continue;float off=((r&1)==1)?0.5:0.0;int cc=int(floor(pix.x-off));if(cc<0||cc>=g.x)continue;" +
        "vec2 d=vec2(float(cc)+0.5+off-pix.x,(float(r)+0.5)*0.8660254-pix.y);float dd=dot(d,d);if(dd<best){best=dd;p=ivec2(cc,r);}}}" +
        "else{p=ivec2(int(gl_FragCoord.x),g.y-1-int(gl_FragCoord.y));}" +
        "float v=display(texelFetch(uS0,p,0),p);o=vec4(texture(uL,vec2(clamp(v/uVmax,0.0,1.0),0.5)).rgb,1.0);}");
      // the display scalar into a float texture, for reading back (thumbnails): the same sampling as the show pass
      set.scalar = program(GLSL_HEAD + "uniform float uHex;uniform vec2 uOut;out vec4 o;\n" + g.display + "\n" +
        "void main(){ivec2 g=uSize;ivec2 p;if(uHex>0.5){vec2 pix=vec2(gl_FragCoord.x,uOut.y-gl_FragCoord.y);float yc=pix.y/0.8660254;int r0=int(floor(yc));float best=1e9;p=ivec2(0);" +
        "for(int dr=-1;dr<=1;dr++){int r=r0+dr;if(r<0||r>=g.y)continue;float off=((r&1)==1)?0.5:0.0;int cc=int(floor(pix.x-off));if(cc<0||cc>=g.x)continue;" +
        "vec2 d=vec2(float(cc)+0.5+off-pix.x,(float(r)+0.5)*0.8660254-pix.y);float dd=dot(d,d);if(dd<best){best=dd;p=ivec2(cc,r);}}}" +
        "else{p=ivec2(int(gl_FragCoord.x),g.y-1-int(gl_FragCoord.y));}o=vec4(display(texelFetch(uS0,p,0),p),0.0,0.0,1.0);}");
      set.count = program(GLSL_HEAD + g.alive + "\nout vec4 o;void main(){ivec2 b=ivec2(gl_FragCoord.xy)*16;float n=0.0;" +
        "for(int y=0;y<16;y++)for(int x=0;x<16;x++){ivec2 p=b+ivec2(x,y);if(p.x<uSize.x&&p.y<uSize.y&&alive(texelFetch(uS0,p,0),p))n+=1.0;}o=vec4(n,0.0,0.0,1.0);}");
      progs[m.id] = set; return set;
    }
    function sharedFor() {
      if (shared[NT]) return shared[NT];
      var o = outDecl(NT), s = {};
      s.copy = program(GLSL_HEAD + o + "void main(){ivec2 p=ivec2(gl_FragCoord.xy);o0=texelFetch(uS0,p,0);" + (NT > 1 ? "o1=texelFetch(uS1,p,0);" : "") + (NT > 2 ? "o2=texelFetch(uS2,p,0);" : "") + "}");
      s.resample = program(GLSL_HEAD + o + "uniform ivec2 uNew;\n" +
        "vec4 bil(sampler2D t,ivec2 s,vec2 f){ivec2 i0=ivec2(floor(f));vec2 u=f-vec2(i0);ivec2 a=clamp(i0,ivec2(0),s-1),b=clamp(i0+ivec2(1,0),ivec2(0),s-1),c=clamp(i0+ivec2(0,1),ivec2(0),s-1),d=clamp(i0+ivec2(1,1),ivec2(0),s-1);" +
        "return mix(mix(texelFetch(t,a,0),texelFetch(t,b,0),u.x),mix(texelFetch(t,c,0),texelFetch(t,d,0),u.x),u.y);}\n" +
        "void main(){ivec2 s=textureSize(uS0,0);vec2 f=(gl_FragCoord.xy/vec2(uNew))*vec2(s)-0.5;o0=bil(uS0,s,f);" + (NT > 1 ? "o1=bil(uS1,s,f);" : "") + (NT > 2 ? "o2=bil(uS2,s,f);" : "") + "}");
      shared[NT] = s; return s;
    }

    function alloc(w, h, keep) {
      var old = keep && bufs[cur] ? { b: bufs[cur], w: W, h: H } : null;
      CW = w; CH = h; canvas.width = w; canvas.height = h;
      W = w; H = hex ? hexRows(h) : h;
      var fresh = [makeBuf(W, H), makeBuf(W, H)];
      if (old) { var s = sharedFor(); var L = run(s.resample, fresh[0].f, W, H); bindState(L, old.b); gl.uniform2i(L.uNew, W, H); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      freeBuf(bufs[0]); freeBuf(bufs[1]); freeBuf(aux); freeBuf(comp); if (old) freeBuf(old.b);
      bufs = fresh; cur = 0; aux = makeBuf(W, H); comp = null; showComp = false;
      freeOne(gA); freeOne(gB); freeOne(gP[0]); freeOne(gP[1]);
      gA = makeOne(CW, CH); gB = makeOne(CW, CH); gP = [makeOne(CW, CH), makeOne(CW, CH)]; gCur = 0; clearGlow();
      cntW = Math.ceil(W / 16); cntH = Math.ceil(H / 16);
      if (cntTex) gl.deleteTexture(cntTex);
      cntTex = makeTex(cntW, cntH, gl.RGBA32F); cntBuf = new Float32Array(cntW * cntH * 4);
      var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cntTex, 0); cntFb = f;
      if (!old) clearBuf(bufs[0], model.init(curP));
    }
    var cntFb = null, curP = null;

    var be = {
      kind: "gpu",
      width: function () { return CW; }, height: function () { return CH; },
      latticeWidth: function () { return W; }, latticeHeight: function () { return H; },
      // choose the model; the state is re-allocated for its channels and lattice
      use: function (m, P) {
        model = m; curP = P; NT = m.targets || 1; fmt = (m.channels || 2) > 2 ? gl.RGBA32F : gl.RG32F; hex = m.lattice === "hex";
        bufs.forEach(freeBuf); bufs = [null, null]; freeBuf(aux); aux = null; freeBuf(comp); comp = null;
        if (kern) { gl.deleteTexture(kern); kern = null; }
        if (m.gpu.kernel) { var k = m.gpu.kernel(P); kern = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, kern); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, k.w, k.h, 0, gl.RED, gl.FLOAT, k.data);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
        programsFor(m); if (CW) alloc(CW, CH, false);
      },
      setParams: function (P) { curP = P; P8 = packParams(model, P); },
      setContext: function (dscale, radius) { Q[0] = dscale || 1; Q[1] = radius || 0; },
      resize: function (w, h, keep) { alloc(w, h, keep && model.grid !== "pixels"); },
      reset: function () { clearBuf(bufs[cur], model.init(curP)); showComp = false; clearGlow(); },
      step: function (n) {
        var set = progs[model.id], per = model.stepsPerUnit || 1;
        for (var s = 0; s < n * per; s++) {
          stepIndex++; Q[2] = stepIndex; Q[3] = (stepIndex % 9973) * 0.37;
          for (var i = 0; i < set.passes.length; i++) {
            var ps = set.passes[i], rep = typeof ps.repeat === "function" ? ps.repeat(curP) : ps.repeat;
            for (var r = 0; r < rep; r++) {
              var target = ps.out === "aux" ? aux : bufs[1 - cur];
              var L = run(ps.pr, target.f, W, H); bindState(L, bufs[cur]); setCommon(L);
              gl.drawArrays(gl.TRIANGLES, 0, 3);
              if (ps.out !== "aux") cur = 1 - cur;
            }
          }
        }
      },
      seed: function (discs, value) {
        var set = progs[model.id], arr = new Float32Array(32 * 3);
        for (var i = 0; i < discs.length; i += 32) {
          var n = Math.min(32, discs.length - i);
          for (var j = 0; j < n; j++) { arr[j * 3] = discs[i + j].x; arr[j * 3 + 1] = discs[i + j].y; arr[j * 3 + 2] = discs[i + j].r; }
          var L = run(set.seed, bufs[1 - cur].f, W, H); bindState(L, bufs[cur]); setCommon(L);
          gl.uniform3fv(L.uD, arr); gl.uniform1i(L.uN, n); gl.uniform1f(L.uVal, value); gl.uniform1f(L.uHex, hex ? 1 : 0); gl.uniform1f(L.uAll, model.seedAll ? 1 : 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3); cur = 1 - cur;
        }
      },
      // how many cells are alive (the model's own test), counted in 16×16 blocks and read back
      aliveCount: function () {
        var set = progs[model.id], L = run(set.count, cntFb, cntW, cntH); bindState(L, bufs[cur]); setCommon(L);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.readPixels(0, 0, cntW, cntH, gl.RGBA, gl.FLOAT, cntBuf);
        var n = 0; for (var i = 0; i < cntBuf.length; i += 4) n += cntBuf[i]; return n;
      },
      render: function (lut) {
        if (lutLoaded !== lut) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, lut); lutLoaded = lut; }
        var set = progs[model.id], g = model.glow;
        if (g && (g.blur || g.decay)) {            // the glow stage: scalar → blur → persistence → palette
          scalarPass();
          var gp = glowPrograms(), nx = 1 - gCur, Lp = drawTex(gp.persist, gA.t, gP[gCur].t, gP[nx].f, CW, CH); gl.uniform4f(Lp.uGlow, 0, g.decay || 0, 0, 0); gl.drawArrays(gl.TRIANGLES, 0, 3); gCur = nx;
          var Ll = drawTex(gp.lut, gP[gCur].t, null, null, CW, CH);
          gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.uniform1i(Ll.uL, 5); gl.uniform1f(Ll.uVmax, VMAX); gl.drawArrays(gl.TRIANGLES, 0, 3);
          return;
        }
        var L = run(set.show, null, CW, CH); bindState(L, showComp && comp ? comp : bufs[cur]); setCommon(L);
        gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.uniform1i(L.uL, 5);
        gl.uniform1f(L.uVmax, VMAX); gl.uniform1f(L.uHex, hex ? 1 : 0); gl.uniform2f(L.uOut, CW, CH);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      // chronogram: copy columns [x0, x1) of the state into a composite shown instead of the state
      stripBegin: function () { freeBuf(comp); comp = makeBuf(W, H); clearBuf(comp, model.init(curP)); },
      copyColumns: function (x0, x1) {
        var s = sharedFor(); gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, 0, x1 - x0, H);
        var L = run(s.copy, comp.f, W, H); bindState(L, bufs[cur]); gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.SCISSOR_TEST);
      },
      stripEnd: function () { showComp = true; },
      showState: function () { showComp = false; },
      // the display scalars of the whole canvas as a Float32Array (row 0 at the top), read back from a float texture
      getDisplay: function () {
        scalarPass();                           // the blurred scalar, as the glow stage would show it
        gl.bindFramebuffer(gl.FRAMEBUFFER, gA.f);
        var buf = new Float32Array(CW * CH * 4); gl.readPixels(0, 0, CW, CH, gl.RGBA, gl.FLOAT, buf);
        var out = new Float32Array(CW * CH);
        for (var y = 0; y < CH; y++) for (var x = 0; x < CW; x++) out[y * CW + x] = buf[((CH - 1 - y) * CW + x) * 4];   // readPixels gives the bottom row first
        return out;
      },
      destroy: function () { bufs.forEach(freeBuf); freeBuf(aux); freeBuf(comp); freeOne(gA); freeOne(gB); freeOne(gP[0]); freeOne(gP[1]); if (kern) gl.deleteTexture(kern); var ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); }
    };
    return be;
  }


  // ---- the processor backend ------------------------------------------------------------------------
  // The same operations on typed arrays. It is the reference the tests run against, the thumbnail and
  // chronogram engine where there is no WebGL2, and the renderer the README's media is drawn with in Node.
  function cpuBackend(canvas) {
    var ctx = (canvas && canvas.getContext) ? canvas.getContext("2d", { alpha: false }) : null;
    var model = null, NT = 1, NC = 2, hex = false, curP = null;
    var W = 0, H = 0, CW = 0, CH = 0, st = null, comp = null, showComp = false, image, px, disp = null, stepIndex = 0;
    var X = { dscale: 1, radius: 0, step: 0, hex: false, rnd: mulberry32(7) };

    function planes(w, h) { var p = []; for (var t = 0; t < NT; t++) { var ch = []; for (var c = 0; c < NC; c++) ch.push(new Float32Array(w * h)); p.push(ch); } return p; }
    function state(w, h) {
      var s = { W: w, H: h, N: w * h, p: planes(w, h), aux: [], rnd: X.rnd };
      for (var c = 0; c < 4; c++) s.aux.push(new Float32Array(w * h));
      return s;
    }
    function fill(s, inits) { for (var t = 0; t < NT; t++) { var c0 = inits[Math.min(t, inits.length - 1)]; for (var c = 0; c < NC; c++) s.p[t][c].fill(c0[c] || 0); } }
    function alloc(w, h, keep) {
      var old = keep ? st : null, oW = W, oH = H;
      CW = w; CH = h; W = w; H = hex ? hexRows(h) : h;
      st = state(W, H); fill(st, model.init(curP));
      if (old) resample(old, oW, oH);
      disp = new Float32Array(CW * CH); comp = null; showComp = false;
      if (canvas) { canvas.width = w; canvas.height = h; }
      if (ctx) { image = ctx.createImageData(w, h); px = image.data; }
    }
    function resample(old, oW, oH) {
      for (var t = 0; t < NT; t++) for (var c = 0; c < NC; c++) {
        var A = st.p[t][c], O = old.p[t][c];
        for (var y = 0; y < H; y++) {
          var fy = (y + 0.5) * oH / H - 0.5, yi = Math.floor(fy), ty = fy - yi;
          var ya = clamp(yi, 0, oH - 1) * oW, yb = clamp(yi + 1, 0, oH - 1) * oW;
          for (var x = 0; x < W; x++) {
            var fx = (x + 0.5) * oW / W - 0.5, xi = Math.floor(fx), tx = fx - xi;
            var xa = clamp(xi, 0, oW - 1), xb = clamp(xi + 1, 0, oW - 1);
            A[y * W + x] = (O[ya + xa] * (1 - tx) + O[ya + xb] * tx) * (1 - ty) + (O[yb + xa] * (1 - tx) + O[yb + xb] * tx) * ty;
          }
        }
      }
    }
    function shown() { return showComp && comp ? comp : st; }
    var glowP = null, tmp = null;
    // the display scalar, blurred by the model's glow (a separable box blur run twice ≈ a Gaussian)
    function displayArray() {
      var s = shown(), d = model.cpu.display;
      if (hex) hexSample(function (i) { return d(s, i, curP, X); }, W, H, CW, CH, 0, disp);
      else for (var i = 0; i < W * H; i++) disp[i] = d(s, i, curP, X);
      var g = model.glow, sigma = g && g.blur ? g.blur * (g.cell ? Math.max(1, CW / W) : Math.max(0.6, CW / 1000)) : 0;
      if (sigma > 0) { var r = Math.max(1, Math.round(sigma)); if (!tmp || tmp.length !== disp.length) tmp = new Float32Array(disp.length); boxBlur(disp, tmp, CW, CH, r); boxBlur(disp, tmp, CW, CH, r); }
      return disp;
    }
    function boxBlur(a, t, w, h, r) {
      var x, y, i, n = 2 * r + 1;
      for (y = 0; y < h; y++) { var row = y * w, acc = 0; for (i = -r; i <= r; i++) acc += a[row + clamp(i, 0, w - 1)]; for (x = 0; x < w; x++) { t[row + x] = acc / n; acc += a[row + clamp(x + r + 1, 0, w - 1)] - a[row + clamp(x - r, 0, w - 1)]; } }
      for (x = 0; x < w; x++) { var acc2 = 0; for (i = -r; i <= r; i++) acc2 += t[clamp(i, 0, h - 1) * w + x]; for (y = 0; y < h; y++) { a[y * w + x] = acc2 / n; acc2 += t[clamp(y + r + 1, 0, h - 1) * w + x] - t[clamp(y - r, 0, h - 1) * w + x]; } }
    }
    var be = {
      kind: "cpu",
      width: function () { return CW; }, height: function () { return CH; },
      latticeWidth: function () { return W; }, latticeHeight: function () { return H; },
      use: function (m, P) { model = m; curP = P; X.P = P; NT = m.targets || 1; NC = m.channels || 2; hex = m.lattice === "hex"; X.hex = hex; if (CW) alloc(CW, CH, false); },
      setParams: function (P) { curP = P; X.P = P; },
      setContext: function (dscale, radius) { X.dscale = dscale || 1; X.radius = radius || 0; },
      resize: function (w, h, keep) { alloc(w, h, keep && model.grid !== "pixels" && st); },
      reset: function () { fill(st, model.init(curP)); comp = null; showComp = false; if (glowP) glowP.fill(0); },
      step: function (n) { var per = model.stepsPerUnit || 1; for (var s = 0; s < n * per; s++) { stepIndex++; X.step = stepIndex; model.cpu.step(st, 1, curP, X); } },
      seed: function (discs, value) { model.cpu.seed(st, discs, value, X); },
      aliveCount: function () { return model.cpu.alive(st, curP, X); },
      render: function (lut) {
        if (!ctx) return;
        var src = displayArray(), scale = 255 / VMAX, g = model.glow;
        if (g && g.decay) {                      // persistence: the maximum of the scalar and its own decayed past
          if (!glowP || glowP.length !== src.length) glowP = new Float32Array(src.length);
          for (var k = 0; k < src.length; k++) { var v = Math.max(src[k], glowP[k] * g.decay); glowP[k] = v; src[k] = v; }
        }
        for (var i = 0, p = 0; i < CW * CH; i++, p += 4) { var idx = (src[i] * scale) | 0; if (idx > 255) idx = 255; if (idx < 0) idx = 0; idx *= 3; px[p] = lut[idx]; px[p + 1] = lut[idx + 1]; px[p + 2] = lut[idx + 2]; px[p + 3] = 255; }
        ctx.putImageData(image, 0, 0);
      },
      stripBegin: function () { comp = state(W, H); fill(comp, model.init(curP)); },
      copyColumns: function (x0, x1) { for (var t = 0; t < NT; t++) for (var c = 0; c < NC; c++) { var A = st.p[t][c], C = comp.p[t][c]; for (var y = 0; y < H; y++) for (var x = x0; x < x1 && x < W; x++) C[y * W + x] = A[y * W + x]; } },
      stripEnd: function () { showComp = true; },
      showState: function () { showComp = false; },
      getDisplay: function () { return displayArray(); },
      state: function () { return st; },
      destroy: function () {}
    };
    return be;
  }


  // ---- the field ------------------------------------------------------------------------------------------
  var DEFAULTS = {
    model: "gray-scott",         // a model id from the registry; `params` overrides its parameters
    params: null,
    quality: 320,                // the resolution ceiling: a ladder width (320 by default) or index, or "auto" (up to the display)
    dscale: 1,                   // both Gray–Scott diffusion rates × this (a preset may set it)
    stepScale: 1,                // steps per frame = baseSteps × timeScale × stepScale (a preset may slow itself)
    hover: false,                // false: the pointer paints only while a button is held; true: on hover alone
    baseSteps: 8,
    timeScale: 0.75,
    fadeStart: Infinity, fadeEnd: Infinity,
    palette: "canopy",
    seedValue: 0.5,
    brush: 0.03,                 // the pointer's mark: its diameter as a share of the field's height
    seedSpeedGain: 0.25,         // extra radius per cell of pointer travel, relative to the brush
    chronoSteps: 2400,           // simulation steps the reduced-motion chronogram spans, seed → emergence
    budgetMs: 8, ceilingMs: 12,  // processor path: compute time per frame
    pixelCap: 2048,              // the most cells across a pixel-lattice model takes on the graphics processor
    cpuPixelCap: 640,            // … and on the processor
    thumb: { width: 96, height: 54, steps: 300 },
    gpu: true,
    reducedMotion: false,
    clock: null
  };

  function mount(canvas, options) {
    var o = {};
    for (var key in DEFAULTS) o[key] = DEFAULTS[key];
    for (var k2 in (options || {})) if (options[k2] !== undefined) o[k2] = options[k2];
    var now = o.clock || defaultClock;

    var be = (o.gpu && canvas.getContext) ? gpuBackend(canvas) : null;
    if (!be) be = cpuBackend(canvas);
    var model = null, P = null, gain = 1, leftAt = null, stepAcc = 0;
    var grow = null, growN = 0, growTick = 0, growCenter = null, firstMark = null, everyMark = false, marked = false, stir = null;
    var lut = buildLut((PALETTES[o.palette] || PALETTES.canopy).colors);
    var paused = false, pointerIn = false, alive = false, rafId = 0, last = null, pearlAt = null, pending = [];
    var listeners = [];
    var frames = 0, fpsAt = 0, fps = 0, msAvg = 0, msSamples = 0, msHold = 0, lastTs = 0, dtAvg = 16.7, slowRing = new Uint8Array(30), slowCount = 0, sinceMax = 0;
    var level = 1, auto = true, capLevel = LADDER.length - 1, qualityAuto = true;
    if (typeof o.quality === "number") { capLevel = clamp(rungOf(o.quality), 0, LADDER.length - 1); level = Math.min(level, capLevel); qualityAuto = false; }
    var aspect = measureAspect(), chronoJob = null, chronoSpec = null, fixed = Array.isArray(o.quality) ? o.quality : null;

    function emit(type) { for (var i = 0; i < listeners.length; i++) listeners[i](type, api); }
    function measureAspect() { var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null; return (r && r.width > 0 && r.height > 0) ? r.width / r.height : 16 / 9; }
    function devWidth() { var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null; return r && r.width ? Math.round(r.width * (global.devicePixelRatio || 1)) : 0; }
    function topRung() { var m = model.maxRung !== undefined ? model.maxRung : LADDER.length - 1; return Math.min(capLevel, m); }
    function dims(n) { var w = LADDER[n]; return [w, Math.max(16, Math.round(w / aspect))]; }
    // the grid for the current model: the ladder rung, or the canvas's device pixels for a pixel-lattice model
    function gridDims() {
      if (fixed) return fixed;
      if (model.grid === "pixels") { var w = devWidth() || 400, cap = be.kind === "gpu" ? o.pixelCap : o.cpuPixelCap; w = clamp(w, 320, cap); return [w, Math.max(16, Math.round(w / aspect))]; }
      return dims(level);
    }
    function displayCap() {
      var devW = devWidth(); if (!devW) return LADDER.length - 1;
      var cap = 0; for (var n = 0; n < LADDER.length; n++) if (LADDER[n] <= devW) cap = n; return cap;
    }
    // a size-controlled model (a crystal): the rung becomes the radius it may grow to — about a third of the
    // field's height at 320, a fifteenth at 1600; Automatic takes the 640 rung
    function radius() {
      if (!model.sized) return 0;
      var L = qualityAuto ? 640 : LADDER[capLevel], share = P.crystal !== undefined ? P.crystal : 1 / 3;
      return be.height() * share * 320 / L;
    }
    function pushContext() { be.setContext(model.fade ? o.dscale : (P.noise !== undefined ? P.noise : o.dscale), radius()); }   // uQ.x carries the diffusion scale, or a model's noise amplitude
    function regrid(keep) {
      var d = gridDims(); be.resize(d[0], d[1], keep); pushContext();
      msAvg = 0; msSamples = 0; msHold = 60; slowRing.fill(0); slowCount = 0;
    }
    function setLevel(n, keep) {
      n = clamp(n, 0, LADDER.length - 1);
      if (be.width() && n === level) return;
      level = n; regrid(keep);
      if (o.reducedMotion) chronogram(); else be.render(lut);
      emit("quality");
    }
    function reevaluate() { msHold = 0; msSamples = Math.min(msSamples, 10); }
    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var a = measureAspect(), pix = model.grid === "pixels" && !fixed;
        if (!pix && Math.abs(a / aspect - 1) < 0.02) return;
        aspect = a; regrid(!pix);
        if (o.reducedMotion) chronogram(); else be.render(lut);
        emit("quality");
      }, 150);
    }
    if (global.addEventListener) global.addEventListener("resize", onResize);

    function reset() {
      if (model.randomize) { model.randomize(P, Math.random); be.setParams(P); }   // a model may draw fresh randomness for every clear (a crystal's orientation)
      be.reset(); alive = false; leftAt = null; gain = 1; grow = null; growN = 0; stir = null; marked = false; pending.length = 0;
    }
    // a "stir" seeding: `points` single marks and `slashes` curved strokes of varying length, each at a random place
    // and a random moment within `frames` frames, different every time (the Vortex opening, owner 2026-10-09)
    function makeStir(spec) {
      var W = be.width(), H = be.height(), r = Math.max((spec.r || 2) * W / 320, 0.75), items = [], i;
      for (i = 0; i < (spec.points || 5); i++) items.push({ at: Math.random() * (spec.frames || 60), discs: [{ x: W * (0.1 + 0.8 * Math.random()), y: H * (0.1 + 0.8 * Math.random()), r: r }] });
      for (i = 0; i < (spec.slashes || 4); i++) {
        var cx = W * (0.15 + 0.7 * Math.random()), cy = H * (0.15 + 0.7 * Math.random()), len = Math.min(W, H) * (0.15 + 0.3 * Math.random()), a = Math.random() * Math.PI;
        var bend = (Math.random() < 0.5 ? -1 : 1) * len * (0.2 + 0.3 * Math.random()), ux = Math.cos(a), uy = Math.sin(a);
        var p0 = { x: cx - ux * len / 2, y: cy - uy * len / 2 }, p2 = { x: cx + ux * len / 2, y: cy + uy * len / 2 }, p1 = { x: cx - uy * bend, y: cy + ux * bend };
        var discs = [], n = Math.max(4, Math.ceil(len / Math.max(1, r)));
        for (var k = 0; k <= n; k++) { var t = k / n, s = 1 - t; discs.push({ x: s * s * p0.x + 2 * s * t * p1.x + t * t * p2.x, y: s * s * p0.y + 2 * s * t * p1.y + t * t * p2.y, r: r }); }
        items.push({ at: Math.random() * (spec.frames || 60), discs: discs });
      }
      return { tick: 0, items: items };
    }
    function scaleR(r) { return r * be.width() / 320; }
    function brushR() { return Math.max(1, o.brush * be.height() / 2); }   // the mark's radius in pixels
    function markSeeded() { alive = true; leftAt = null; gain = 1; marked = true; }
    function flushSeeds() { if (pending.length) { be.seed(pending, o.seedValue); pending.length = 0; } }
    function growStep() {
      if (stir) {
        stir.tick++; var left = 0;
        for (var si = 0; si < stir.items.length; si++) { var it = stir.items[si]; if (it.done) continue; if (it.at <= stir.tick) { for (var d = 0; d < it.discs.length; d++) pending.push(it.discs[d]); it.done = true; alive = true; } else left++; }
        if (!left) stir = null;
      }
      if (!grow || ++growTick % grow.every !== 0) return;
      var W = be.width(), H = be.height();
      if (grow.type === "pacemaker") {                 // the same points fire again: target rings; a sandpile's drop point
        var pts = seedDiscList(W, H, grow, 3, 0, growCenter);
        for (var i = 0; i < pts.length; i++) pending.push(pts[i]);
        alive = true; return;
      }
      if (growN >= grow.n && !grow.edge) return;
      var p = spiralPoint(W, H, growN++, grow.n, growCenter && growCenter.x, growCenter && growCenter.y);
      if (grow.edge) {                                 // keep placing spots until the spiral has left the frame
        var cx = growCenter ? growCenter.x : W / 2, cy = growCenter ? growCenter.y : H / 2;
        if (Math.hypot(p.x - cx, p.y - cy) > Math.hypot(W, H) / 2) { grow = null; return; }
        if (p.x < 0 || p.x >= W || p.y < 0 || p.y >= H) return;
      }
      pending.push({ x: p.x, y: p.y, r: (grow.r || 3) * W / 320 }); alive = true;
    }
    function updateGain(t) {
      if (!model.fade || pointerIn || o.fadeStart === Infinity) { leftAt = null; gain = 1; }
      else {
        if (leftAt === null) leftAt = t;
        var s = (t - leftAt) / 1000;
        gain = s <= o.fadeStart ? 1 : (s >= o.fadeEnd ? 0 : (function () { var x = 1 - (s - o.fadeStart) / (o.fadeEnd - o.fadeStart); return x * x * (3 - 2 * x); })());
      }
      if (model.fade && P.gain !== gain) { P.gain = gain; be.setParams(P); }
    }

    // one frame of work, no scheduling
    function tick() {
      var t0 = now();
      updateGain(t0); growStep(); flushSeeds();
      stepAcc += o.baseSteps * o.timeScale * o.stepScale;
      var n = Math.floor(stepAcc); stepAcc -= n;
      if (n) be.step(n);
      be.render(lut);
      var wasAlive = alive;
      if (++sinceMax >= (be.kind === "gpu" ? 10 : 1)) { sinceMax = 0; alive = be.aliveCount() > 0 || pending.length > 0; }   // a pacemaker or stir keeps the loop scheduled (below) but does not count as life
      if (!alive && wasAlive && !model.keeps) { be.reset(); be.render(lut); leftAt = null; gain = 1; }
      var ms = now() - t0;
      msSamples++; msAvg += (ms - msAvg) / Math.min(msSamples, 30);
      var slot = msSamples % 30, wasSlow = slowRing[slot], isSlow = (ms > 16 || dtAvg > 24) ? 1 : 0;
      slowRing[slot] = isSlow; slowCount += isSlow - wasSlow;
      if (auto && msHold > 0) msHold--;
      else if (auto && qualityAuto && msSamples >= 30 && model.grid === "ladder" && !fixed) {   // the ladder adapts only on Automatic; a chosen rung is the grid
        var tooSlow = msAvg > o.ceilingMs || slowCount >= 2 || dtAvg > 24, top = Math.min(topRung(), displayCap());
        if ((tooSlow || level > top) && level > 0) setLevel(level - 1, true);
        else if (!tooSlow && msAvg < o.budgetMs && dtAvg < 19 && level < top) setLevel(level + 1, true);
      }
      return { ms: ms, wasAlive: wasAlive };
    }
    function frame(ts) {
      rafId = 0;
      if (paused || o.reducedMotion) return;
      if (lastTs) dtAvg += ((ts - lastTs) - dtAvg) / 20; lastTs = ts;
      var r = tick(); frames++;
      if (ts - fpsAt >= 1000) { fps = frames * 1000 / (ts - fpsAt); frames = 0; fpsAt = ts; }
      if (alive || pointerIn || pending.length || grow || stir) rafId = global.requestAnimationFrame(frame);
      else { lastTs = 0; if (r.wasAlive) emit("quiet"); }
    }
    function wake() { if (global.requestAnimationFrame && !rafId && !paused && !o.reducedMotion) rafId = global.requestAnimationFrame(frame); }

    // the reduced-motion chronogram: time runs continuously across the width — column x shows the field at
    // step T·x/W — from a dense, even seeding, so the still is the development from seed (left) to the pattern
    // at full strength (right) with no seams
    function chronogram(spec) {
      if (chronoJob) { clearTimeout(chronoJob); chronoJob = null; }
      var W = be.latticeWidth(), PW = be.width(), PH = be.height();
      spec = spec || chronoSpec || { type: "spiral", n: 21, r: 3 };
      var T = spec.chrono || o.chronoSteps, per = Math.max(1, Math.floor(T / W)), ops = Math.ceil(T / per);
      be.reset(); be.seed(latticeSeedList(PW, PH, spec), o.seedValue);
      be.stripBegin();
      emit("busy");
      var i = 0;
      function op() {
        var x0 = Math.floor(W * i / ops), x1 = i === ops - 1 ? W : Math.floor(W * (i + 1) / ops);
        if (i) be.step(per);
        if (x1 > x0) be.copyColumns(x0, x1);
        i++;
      }
      if (be.kind === "gpu") { while (i < ops) op(); be.stripEnd(); be.render(lut); alive = true; emit("still"); return; }
      (function slice() {
        var budget = 12; while (i < ops && budget--) op();
        if (i < ops) chronoJob = setTimeout(slice, 0);
        else { be.stripEnd(); be.render(lut); alive = true; chronoJob = null; emit("still"); }
      })();
    }

    // ---- pointer and touch: click and drag paints (a touch always does); hover mode paints on hover alone ----
    var down = false;
    function gridPoint(e) { var rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) / rect.width * be.width(), y: (e.clientY - rect.top) / rect.height * be.height() }; }
    function onEnter() { pointerIn = true; last = null; pearlAt = null; wake(); }
    function onLeave() { pointerIn = false; down = false; last = null; pearlAt = null; }
    function paintAt(e) {
      var p = gridPoint(e);
      if ((!marked || everyMark) && firstMark && !last) { api.seedSpec(firstMark, undefined, p); last = p; return; }   // the first mark (or every click, when the preset says so) starts the pattern's own seeding there
      if (model.sized) {                                   // a string of pearls: single seeds spaced along the stroke by a share of the crystal radius
        var R = radius() || be.height() / 3, gap = Math.max(2, R * (P.pearl !== undefined ? P.pearl : 0.5)), rs = brushR();
        if (!pearlAt) { pending.push({ x: p.x, y: p.y, r: rs }); pearlAt = p; }
        else { var dist = Math.hypot(p.x - pearlAt.x, p.y - pearlAt.y); if (dist >= gap) { var n = Math.floor(dist / gap), ux = (p.x - pearlAt.x) / dist, uy = (p.y - pearlAt.y) / dist; for (var i = 1; i <= n; i++) pending.push({ x: pearlAt.x + ux * gap * i, y: pearlAt.y + uy * gap * i, r: rs }); pearlAt = { x: pearlAt.x + ux * gap * n, y: pearlAt.y + uy * gap * n }; } }
        markSeeded(); last = p; wake(); return;
      }
      var speed = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
      var base = brushR(), r = Math.min(base * 4, base + o.seedSpeedGain * speed * base / scaleR(3));
      if (last && speed > r) { var m = Math.ceil(speed / r); for (var j = 1; j <= m; j++) pending.push({ x: last.x + (p.x - last.x) * j / m, y: last.y + (p.y - last.y) * j / m, r: r }); }
      else pending.push({ x: p.x, y: p.y, r: r });
      markSeeded(); last = p; wake();
    }
    function onDown(e) {
      if (o.reducedMotion) return;
      if (o.hover && e.pointerType !== "touch") return;
      if (e.button !== undefined && e.button !== 0) return;
      down = true; last = null; pearlAt = null; pointerIn = true; paintAt(e);
      if (canvas.setPointerCapture && e.pointerId !== undefined) { try { canvas.setPointerCapture(e.pointerId); } catch (x) {} }
    }
    function onUp() { down = false; last = null; pearlAt = null; }
    function onMove(e) {
      if (o.reducedMotion) return;
      pointerIn = true;
      if (!o.hover && !down) { last = null; pearlAt = null; return; }
      if (e.pointerType === "touch" && !down) return;
      paintAt(e);
    }
    if (canvas.addEventListener) {
      canvas.addEventListener("pointerenter", onEnter); canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    }

    var api = {
      canvas: canvas, models: MODELS, palettes: PALETTES, ladder: LADDER,
      backend: function () { return be.kind; },
      engine: function () { return be; },        // the backend itself (tests and diagnostics)
      model: function () { return model; },
      params: function () { return P; },
      // choose a model, with parameter overrides; the field clears
      setModel: function (id, over) {
        var m = typeof id === "string" ? modelById(id) : id; if (!m) return api;
        var changed = m !== model; model = m; P = paramsFor(m, over);
        be.use(m, P); be.setParams(P);
        if (!qualityAuto && model.grid === "ladder" && !fixed) level = Math.min(capLevel, topRung());
        if (changed || model.grid === "pixels") { regrid(false); }
        reset(); reevaluate(); if (o.reducedMotion) chronogram(); else be.render(lut); emit("model"); emit("params"); return api;
      },
      setParam: function (key, v) { if (typeof v === "number" && !isNaN(v)) { P[key] = v; be.setParams(P); } reevaluate(); if (o.reducedMotion) chronogram(); emit("params"); return api; },
      setParams: function (a, b) {                 // the first and second user parameter, by position
        if (typeof a === "number" && !isNaN(a)) P[model.params[0].key] = a;
        if (typeof b === "number" && !isNaN(b)) P[model.params[1].key] = b;
        be.setParams(P); reevaluate(); if (o.reducedMotion) chronogram(); emit("params"); return api;
      },
      getParams: function () { return { p1: P[model.params[0].key], p2: P[model.params[1].key], timeScale: o.timeScale, dscale: o.dscale, model: model.id, feed: P.feed, kill: P.kill }; },
      setDiffusionScale: function (s) { if (typeof s === "number" && !isNaN(s) && s > 0) o.dscale = s; pushContext(); reevaluate(); if (o.reducedMotion) chronogram(); emit("params"); return api; },
      setStepScale: function (s) { if (typeof s === "number" && !isNaN(s) && s > 0) o.stepScale = s; reevaluate(); return api; },
      setHover: function (on) { o.hover = !!on; down = false; last = null; emit("hover"); return api; },
      hover: function () { return o.hover; },
      setFeed: function (v) { return api.setParams(v); },
      setKill: function (v) { return api.setParams(undefined, v); },
      setTimeScale: function (s) { if (typeof s === "number" && !isNaN(s)) o.timeScale = clamp(s, 0.005, 20); reevaluate(); emit("params"); return api; },
      setFade: function (start, end) { o.fadeStart = start; o.fadeEnd = end; return api; },
      setPalette: function (nameOrColors) {
        var colors = typeof nameOrColors === "string" ? (PALETTES[nameOrColors] || PALETTES.canopy).colors : nameOrColors;
        lut = buildLut(colors); be.render(lut); emit("palette"); return api;
      },
      lut: function () { return lut; },
      setSteps: function (n) { o.baseSteps = Math.max(1, n | 0); reevaluate(); return api; },
      setQuality: function (q) {
        qualityAuto = q === "auto";
        capLevel = qualityAuto ? LADDER.length - 1 : clamp(rungOf(q), 0, LADDER.length - 1);
        if (model.grid === "ladder" && !fixed) { if (!qualityAuto) setLevel(Math.min(capLevel, topRung()), true); else if (level > topRung()) setLevel(topRung(), true); }
        pushContext(); reevaluate(); emit("quality"); return api;
      },
      quality: function () { return { auto: qualityAuto, cap: capLevel, level: level, width: be.width(), height: be.height(), lattice: [be.latticeWidth(), be.latticeHeight()], grid: model.grid, radius: radius(), ms: msAvg, fps: fps, steps: o.baseSteps * o.timeScale * o.stepScale, backend: be.kind }; },
      pause: function () { paused = true; if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } emit("pause"); return api; },
      play: function () { paused = false; wake(); emit("play"); return api; },
      isPaused: function () { return paused; }, isAlive: function () { return alive; },
      clear: function () { reset(); if (o.reducedMotion) chronogram(); else be.render(lut); emit("clear"); return api; },
      seed: function (x, y, r) {
        if (o.reducedMotion) { chronogram(); return api; }
        if ((!marked || everyMark) && firstMark) return api.seedSpec(firstMark, undefined, { x: x, y: y });
        pending.push({ x: x, y: y, r: r || brushR() }); markSeeded(); wake(); return api;
      },
      setBrush: function (share) { if (typeof share === "number" && !isNaN(share)) o.brush = clamp(share, 0.002, 0.5); emit("brush"); return api; },
      brush: function () { return o.brush; },
      setChronoSpec: function (spec) { chronoSpec = spec; return api; },
      // the seeding a preset's first mark runs (null: the first mark is an ordinary mark); `every`: every Seed press
      // and every click runs it, not only the first (a drag still paints)
      setFirstMark: function (spec, every) { firstMark = spec; everyMark = !!every; return api; },
      seedSpec: function (spec, salt, center) {
        chronoSpec = spec;
        if (o.reducedMotion) { chronogram(spec); emit("seed"); return api; }
        if (spec.type === "stir") { stir = makeStir(spec); grow = null; markSeeded(); wake(); emit("seed"); return api; }
        var list = seedDiscList(be.width(), be.height(), spec, salt, 0, center);
        for (var i = 0; i < list.length; i++) pending.push(list[i]);
        if (spec.type === "grow" || spec.type === "pacemaker") { grow = spec; growN = 3; growTick = 0; growCenter = center || null; } else grow = null;
        markSeeded(); wake(); emit("seed"); return api;
      },
      seedRandom: function (count, salt) { return api.seedSpec({ type: "discs", n: count || 9, r: 3 }, salt); },
      still: function (spec) { chronogram(spec); return api; },
      setReducedMotion: function (on) {
        o.reducedMotion = !!on;
        if (on) { if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } chronogram(); }
        else { be.showState(); reset(); be.render(lut); }
        emit("motion"); return api;
      },
      reducedMotion: function () { return o.reducedMotion; },
      setPointer: function (inside) { pointerIn = !!inside; },
      tick: tick,
      fps: function () { return fps; },
      thumbSize: function () { return o.thumb; },
      on: function (fn) { listeners.push(fn); return api; },
      destroy: function () {
        if (rafId) global.cancelAnimationFrame(rafId);
        if (global.removeEventListener) global.removeEventListener("resize", onResize);
        if (canvas.removeEventListener) {
          canvas.removeEventListener("pointerenter", onEnter); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("pointermove", onMove);
          canvas.removeEventListener("pointerdown", onDown); canvas.removeEventListener("pointerup", onUp); canvas.removeEventListener("pointercancel", onUp);
        }
        be.destroy(); listeners.length = 0;
      }
    };

    api.setModel(o.model, o.params);
    return api;
  }

  // ---- thumbnails (processor, small) -----------------------------------------------------------------------
  // A thumbnail as a resumable job, so the page can advance it in idle slots and never runs a long task:
  // job.advance(n) runs n steps and returns true when done; job.result() is { V, W, H }, the display scalars.
  // A preset may ask for its tile at a finer grid (`thumbScale`) which the browser scales down, and for a
  // stirring stroke every few steps (`thumbStir`), as a visitor's strokes break fronts into rotors.
  // `useGpu`: compute on the graphics processor through an offscreen canvas (milliseconds, no main-thread cost);
  // the processor path is the fallback and the Node renderer.
  function thumbJob(preset, size, useGpu) {
    var m = modelById(preset.model), sc = preset.thumbScale || 1, w = Math.round(size.width * sc), h = Math.round(size.height * sc);
    var be = null, P = paramsFor(m, preset.params);
    if (useGpu && global.document && global.document.createElement) { try { be = gpuBackend(global.document.createElement("canvas")); } catch (e) { be = null; } }
    if (!be) be = cpuBackend(null);
    be.use(m, P); be.setParams(P);
    be.resize(w, h, false);
    var R = m.sized ? h * (P.crystal !== undefined ? P.crystal : 1 / 3) : 0;
    be.setContext(m.fade ? (preset.dscale || 1) : (P.noise !== undefined ? P.noise : (preset.dscale || 1)), R);
    if (m.randomize) { m.randomize(P, mulberry32(preset.id.length * 7919)); be.setParams(P); }
    be.seed(seedDiscList(w, h, preset.thumbSeed || preset.seed, 11, 55), 0.5);
    var left = preset.thumbSteps || size.steps, stir = preset.thumbStir, done = 0, salt = 21;
    return {
      advance: function (n) {
        var k = Math.min(n, left);
        while (k > 0) {
          var chunk = stir ? Math.min(k, stir.every - (done % stir.every)) : k;
          be.step(chunk); k -= chunk; done += chunk; left -= chunk;
          if (stir && done % stir.every === 0) be.seed(seedDiscList(w, h, stir.spec || { type: "strokes", n: stir.n || 1, r: stir.r || 2 }, salt++), 0.5);
        }
        return left <= 0;
      },
      result: function () { var r = { V: be.getDisplay(), W: w, H: h }; be.destroy(); return r; }
    };
  }
  function renderThumb(preset, size, useGpu) { var job = thumbJob(preset, size, useGpu); job.advance(1e9); return job.result(); }
  function paintArray(V, W, H, ctx, lut) {
    var img = ctx.createImageData(W, H), px = img.data, scale = 255 / VMAX;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) { var idx2 = (V[i] * scale) | 0; if (idx2 > 255) idx2 = 255; if (idx2 < 0) idx2 = 0; idx2 *= 3; px[p] = lut[idx2]; px[p + 1] = lut[idx2 + 1]; px[p + 2] = lut[idx2 + 2]; px[p + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }


  // ---- declarative controls ---------------------------------------------------------------------------------
  function fmtStep(v, step) { var d = step >= 1 ? 0 : Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))); return v.toFixed(d); }
  function fmt2(v) { return v.toFixed(2); }
  function $(scope, role) { return scope.querySelector("[data-rd='" + role + "']"); }
  function $$(scope, role) { return scope.querySelectorAll("[data-rd='" + role + "']"); }

  function bind(scope, field) {
    var familyBtns = $$(scope, "family"), presets = $$(scope, "preset"), notes = $$(scope, "note");
    var p1Range = $(scope, "feed-range"), p1Number = $(scope, "feed-number");
    var p2Range = $(scope, "kill-range"), p2Number = $(scope, "kill-number");
    var scaleRange = $(scope, "scale-range"), scaleNumber = $(scope, "scale-number");
    var pauseBtn = $(scope, "pause"), resetBtn = $(scope, "reset"), seedBtn = $(scope, "seed");
    var colorsToggle = $(scope, "colors-toggle"), colorsMenu = $(scope, "colors-menu"), paletteRadios = $$(scope, "palette-option");
    var motionBtn = $(scope, "motion"), motionCheck = $(scope, "motion-check"), quality = $(scope, "quality"), measure = $(scope, "measure"), stateLine = $(scope, "state");
    var hoverBtn = $(scope, "hover"), hoverCheck = $(scope, "hover-check");
    var modeWord = $(scope, "mode"), loading = $(scope, "loading"), brushSel = $(scope, "brush");
    var status = $(scope, "status"), steps = $(scope, "steps");
    var current = null, currentFamily = null, currentPalette = null, thumbs = [], seedClicks = 0;
    // Speed rides a logarithmic slider centred on the preset's own speed: the slider runs 0 … 1 and maps to
    // speedDef / 5 … speedDef × 5, so every preset starts mid-range (owner ruling 2026-10-09)
    var speedDef = DEFAULTS.timeScale, SPEED_K = 5;
    function speedFromSlider(s) { return speedDef * Math.pow(SPEED_K, (s - 0.5) * 2); }
    function sliderFromSpeed(v) { return clamp(0.5 + Math.log(v / speedDef) / Math.log(SPEED_K) / 2, 0, 1); }

    function say(text) { if (status) status.textContent = text; }
    function labelFor(el) { return el && el.id ? scope.querySelector("label[for='" + el.id + "']") : null; }
    var p1Label = labelFor(p1Range), p2Label = labelFor(p2Range), p1NumLabel = labelFor(p1Number), p2NumLabel = labelFor(p2Number);
    function familyName(id) { for (var i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].id === id) return FAMILIES[i].name; return id; }
    function paramsText() {
      var m = field.model(), P = field.params(), a = m.params[0], b = m.params[1];
      return a.label.toLowerCase() + " " + fmtStep(P[a.key], a.step) + ", " + b.label.toLowerCase() + " " + fmtStep(P[b.key], b.step) + ", speed " + fmt2(field.getParams().timeScale);
    }
    // the two sliders take the model's own parameters: names, ranges, steps. For a reaction–diffusion preset the
    // range is tailored to the preset: its default ± 40 %, so the default sits at the centre (owner, 2026-10-09)
    function setSliders(preset) {
      var m = field.model(), P = field.params();
      function range(el, d, lo, hi) { if (el) { el.min = String(lo); el.max = String(hi); el.step = String(d.step); } }
      m.params.forEach(function (d, i) {
        var lo = d.min, hi = d.max, def = P[d.key];
        if (preset && d.step < 1 && !d.fixedRange) { lo = Math.max(d.min, +(def * 0.6).toFixed(6)); hi = Math.min(d.max, +(def * 1.4).toFixed(6)); }
        range(i ? p2Range : p1Range, d, lo, hi); range(i ? p2Number : p1Number, d, lo, hi);
      });
      if (p1Label) p1Label.textContent = m.params[0].label + ":"; if (p2Label) p2Label.textContent = m.params[1].label + ":";
      if (p1NumLabel) p1NumLabel.textContent = m.params[0].label + ", exact value"; if (p2NumLabel) p2NumLabel.textContent = m.params[1].label + ", exact value";
      if (scaleRange) { scaleRange.min = "0"; scaleRange.max = "1"; scaleRange.step = "0.005"; }
      if (scaleNumber) { scaleNumber.min = String(+(speedDef / SPEED_K).toFixed(3)); scaleNumber.max = String(+(speedDef * SPEED_K).toFixed(3)); scaleNumber.step = "0.005"; }
    }
    function syncInputs() {
      var m = field.model(), P = field.params(), a = m.params[0], b = m.params[1], t = field.getParams().timeScale;
      if (p1Range) p1Range.value = fmtStep(P[a.key], a.step); if (p1Number) p1Number.value = fmtStep(P[a.key], a.step);
      if (p2Range) p2Range.value = fmtStep(P[b.key], b.step); if (p2Number) p2Number.value = fmtStep(P[b.key], b.step);
      if (scaleRange) scaleRange.value = sliderFromSpeed(t).toFixed(3); if (scaleNumber) scaleNumber.value = t.toFixed(3);
    }
    function currentName() { return current ? current.name : "custom"; }
    function updateState() {
      if (!stateLine) return;
      stateLine.textContent = (current ? familyName(current.family) + " · " + current.name + " pattern" : "Custom settings") + " · " + (currentPalette || "Canopy") + " colors · " +
        (field.reducedMotion() ? "Reduced motion on: one still frame, seed at the left, full emergence at the right" : (field.isPaused() ? "paused" : "animating"));
    }
    function markPreset(preset) {
      current = preset;
      for (var i = 0; i < presets.length; i++) presets[i].setAttribute("aria-pressed", preset && presets[i].getAttribute("data-rd-id") === preset.id ? "true" : "false");
      for (var j = 0; j < notes.length; j++) notes[j].hidden = !(preset && notes[j].getAttribute("data-rd-for") === preset.id);
      if (modeWord) modeWord.textContent = (preset ? familyName(preset.family).toUpperCase() + ": " + preset.name.toUpperCase() : "CUSTOM");
      updateState();
    }
    function selectOption(sel, value) { if (!sel) return; for (var i = 0; i < sel.options.length; i++) if (parseFloat(sel.options[i].value) === value) { sel.selectedIndex = i; return; } }
    // A tile selects: the field clears to black, the preset's recipe loads (model, parameters, speed, brush,
    // colours), and nothing appears until the visitor paints or presses Seed. In reduced motion the chronogram is
    // computed for the new regime from the preset's own seeding.
    function applyPreset(preset, announce) {
      field.setModel(preset.model, preset.params);
      speedDef = preset.timeScale || DEFAULTS.timeScale;
      field.setDiffusionScale(preset.dscale || 1); field.setStepScale(preset.stepScale || 1); field.setTimeScale(speedDef);
      var brush = preset.brush || DEFAULTS.brush; field.setBrush(brush); selectOption(brushSel, brush);
      var qual = preset.quality || 320; field.setQuality(qual); selectOption(quality, qual);
      if (preset.palette) { for (var r = 0; r < paletteRadios.length; r++) if (paletteRadios[r].value === preset.palette) { paletteRadios[r].checked = true; currentPalette = paletteRadios[r].getAttribute("data-rd-name") || preset.palette; field.setPalette(preset.palette); paintThumbs(); } }
      setSliders(preset); markPreset(preset); syncInputs();
      var spec = {}; for (var kk in preset.seed) spec[kk] = preset.seed[kk]; spec.chrono = preset.chrono;
      field.setChronoSpec(spec); field.setFirstMark(preset.firstSeed === "spec" || preset.firstSeed === "every" ? spec : null, preset.firstSeed === "every"); field.clear(); seedClicks = 0;
      if (announce) say(preset.name + " pattern selected: " + paramsText() + ". " + (field.reducedMotion() ? "Still image." : "The field is black; press Seed, or click and drag on it, to start."));
    }
    // the family row filters the tiles; choosing a family selects its default (or first) tile
    function showFamily(id, announce) {
      currentFamily = id;
      for (var i = 0; i < familyBtns.length; i++) familyBtns[i].setAttribute("aria-pressed", familyBtns[i].getAttribute("data-rd-id") === id ? "true" : "false");
      var first = null, def = null;
      for (var j = 0; j < presets.length; j++) {
        var pr = presetById(presets[j].getAttribute("data-rd-id")), li = presets[j].closest ? presets[j].closest("li") || presets[j] : presets[j], show = pr && pr.family === id;
        li.hidden = !show;
        if (show) { if (!first) first = pr; if (presets[j].hasAttribute("data-rd-default")) def = pr; }
      }
      if (def || first) applyPreset(def || first, announce);
    }
    for (var f = 0; f < familyBtns.length; f++) (function (btn) { btn.addEventListener("click", function () { showFamily(btn.getAttribute("data-rd-id"), true); }); })(familyBtns[f]);
    for (var i = 0; i < presets.length; i++) (function (btn) {
      var preset = presetById(btn.getAttribute("data-rd-id")); if (!preset) return;
      btn.addEventListener("click", function () { applyPreset(preset, true); });
      var thumb = btn.querySelector("[data-rd='thumb']");
      if (thumb && thumb.getContext) thumbs.push({ preset: preset, canvas: thumb, data: null });
    })(presets[i]);

    function paintThumbs() { var lut = field.lut(); for (var t = 0; t < thumbs.length; t++) { var th = thumbs[t]; if (th.data) paintArray(th.data.V, th.data.W, th.data.H, th.canvas.getContext("2d", { alpha: false }), lut); } }
    (function renderThumbsLazily() {               // never during page load: after `load`, one tile per idle slot on the graphics processor (a few ms of main-thread work per slot on the processor path)
      var i = 0, size = field.thumbSize(), job = null, BUDGET_MS = 8, useGpu = field.backend() === "gpu";
      var idle = global.requestIdleCallback ? function (fn) { global.requestIdleCallback(fn, { timeout: 1500 }); } : function (fn) { setTimeout(fn, 50); };
      function next() {
        if (i >= thumbs.length) { scope.setAttribute("data-rd-thumbs", "done"); return; }
        var th = thumbs[i], t0 = defaultClock(), done = false;
        if (!job) job = thumbJob(th.preset, size, useGpu);
        if (useGpu) done = job.advance(1e9);
        else do { done = job.advance(1); } while (!done && defaultClock() - t0 < BUDGET_MS);
        if (done) { th.data = job.result(); th.canvas.width = th.data.W; th.canvas.height = th.data.H; paintThumbs(); job = null; i++; }
        idle(next);
      }
      function start() { if (thumbs.length) idle(next); }
      if (global.document && global.document.readyState !== "complete" && global.addEventListener) global.addEventListener("load", start, { once: true }); else start();
    })();

    function onParam(which, el) {
      var v = parseFloat(el.value); if (isNaN(v)) return;
      if (which === "p1") field.setParams(v); else if (which === "p2") field.setParams(undefined, v); else field.setTimeScale(el === scaleRange ? speedFromSlider(v) : v);
      if (which !== "scale") markPreset(null); else updateState();
      syncInputs();
      say((which === "scale" ? currentName() + " pattern" : "Custom") + ": " + paramsText() + "." + (field.isAlive() ? "" : " The field is quiet; press Seed, paint on it, or choose a pattern."));
    }
    if (p1Range) p1Range.addEventListener("input", function () { onParam("p1", p1Range); });
    if (p1Number) p1Number.addEventListener("change", function () { onParam("p1", p1Number); });
    if (p2Range) p2Range.addEventListener("input", function () { onParam("p2", p2Range); });
    if (p2Number) p2Number.addEventListener("change", function () { onParam("p2", p2Number); });
    if (scaleRange) scaleRange.addEventListener("input", function () { onParam("scale", scaleRange); });
    if (scaleNumber) scaleNumber.addEventListener("change", function () { onParam("scale", scaleNumber); });

    function setPauseState(playing) { if (!pauseBtn) return; pauseBtn.textContent = playing ? "⏸ PAUSE" : "▶ PLAY"; pauseBtn.setAttribute("aria-label", playing ? "Pause the field" : "Play the field"); updateState(); }
    if (pauseBtn) { setPauseState(true); pauseBtn.addEventListener("click", function () { if (field.isPaused()) { field.play(); setPauseState(true); say("Playing."); } else { field.pause(); setPauseState(false); say("Paused."); } }); }
    if (resetBtn) resetBtn.addEventListener("click", function () { field.clear(); seedClicks = 0; say("Field reset to black."); });
    if (seedBtn) seedBtn.addEventListener("click", function () {
      var q = field.quality(), m = field.model(), first = seedClicks === 0;
      field.seed(first ? q.width / 2 : Math.random() * q.width, first ? q.height / 2 : Math.random() * q.height, (m.grid === "pixels" || m.sized) ? undefined : 4 * q.width / 320);
      seedClicks++; if (field.isPaused()) { field.play(); setPauseState(true); }
      say("Seeded" + (first ? " at the center" : " one point at random") + ": " + currentName() + ", " + paramsText() + ".");
    });

    function setColorsOpen(open) {
      if (!colorsToggle || !colorsMenu) return;
      colorsMenu.classList.toggle("is-open", open); colorsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var checked = colorsMenu.querySelector("input:checked") || colorsMenu.querySelector("input"); if (checked) checked.focus(); }
    }
    if (colorsToggle && colorsMenu) {
      colorsToggle.addEventListener("click", function () { setColorsOpen(colorsToggle.getAttribute("aria-expanded") !== "true"); });
      colorsMenu.addEventListener("keydown", function (e) { if (e.key === "Escape") { setColorsOpen(false); colorsToggle.focus(); } });
      scope.addEventListener("focusout", function (e) { var to = e.relatedTarget; if (colorsMenu.classList.contains("is-open") && to && !colorsMenu.contains(to) && to !== colorsToggle) setColorsOpen(false); });
      global.document.addEventListener("pointerdown", function (e) { if (colorsMenu.classList.contains("is-open") && !colorsMenu.contains(e.target) && e.target !== colorsToggle) setColorsOpen(false); });
    }
    for (var j = 0; j < paletteRadios.length; j++) (function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        currentPalette = radio.getAttribute("data-rd-name") || radio.value;
        field.setPalette(radio.value); paintThumbs(); updateState(); say("Colors: " + currentPalette + ".");
        if (colorsMenu && colorsMenu.classList.contains("is-open")) { setColorsOpen(false); if (colorsToggle) colorsToggle.focus(); }
      });
      if (radio.checked) { currentPalette = radio.getAttribute("data-rd-name") || radio.value; field.setPalette(radio.value); }
    })(paletteRadios[j]);

    function setMotionState() { var on = field.reducedMotion(); if (motionBtn) motionBtn.setAttribute("aria-pressed", on ? "true" : "false"); if (motionCheck) motionCheck.checked = on; updateState(); }
    function toggleMotion() { var on = !field.reducedMotion(); field.setReducedMotion(on); setMotionState(); say(on ? "Reduced motion on: one still frame, seed at the left, full emergence at the right." : "Reduced motion off: animating."); }
    if (motionBtn) motionBtn.addEventListener("click", toggleMotion);
    if (motionCheck) motionCheck.addEventListener("change", function () { if (motionCheck.checked !== field.reducedMotion()) toggleMotion(); });
    function setHoverState() { var on = field.hover(); if (hoverBtn) hoverBtn.setAttribute("aria-pressed", on ? "true" : "false"); if (hoverCheck) hoverCheck.checked = on; }
    function toggleHover() { var on = !field.hover(); field.setHover(on); setHoverState(); say(on ? "Hover mode on: moving the pointer over the field paints." : "Hover mode off: click and drag on the field to paint."); }
    if (hoverBtn) hoverBtn.addEventListener("click", toggleHover);
    if (hoverCheck) hoverCheck.addEventListener("change", function () { if (hoverCheck.checked !== field.hover()) toggleHover(); });
    setHoverState();
    if (quality) { quality.addEventListener("change", function () { field.setQuality(quality.value); say("Resolution " + quality.options[quality.selectedIndex].text + "."); }); field.setQuality(quality.value); }
    if (brushSel) brushSel.addEventListener("change", function () { field.setBrush(parseFloat(brushSel.value)); say("Brush width " + brushSel.options[brushSel.selectedIndex].text + "."); });
    if (steps) steps.addEventListener("change", function () { field.setSteps(parseInt(steps.value, 10)); });
    if (measure) (function readout() {
      var q = field.quality(), m = field.model();
      measure.textContent = q.lattice[0] + " × " + q.lattice[1] + (m.grid === "pixels" ? " px" : "") + " · " + (field.reducedMotion() ? "still" : (field.isAlive() ? Math.round(q.fps) + " fps" : "idle")) +
        " · brush " + (field.brush() * 100).toFixed(field.brush() < 0.01 ? 1 : 0) + "%" + (m.sized ? " · crystal " + Math.round(q.radius) + " px" : "");
      setTimeout(readout, 500);
    })();

    field.on(function (type) {
      if (type === "quiet") say("The pattern has faded; the field is quiet.");
      if (type === "motion") setMotionState();
      if (type === "clear") seedClicks = 0;
      if (loading && type === "busy") loading.hidden = false;
      if (loading && (type === "still" || type === "motion" && !field.reducedMotion())) loading.hidden = true;
    });

    // the initial state: the default family (data-rd-default on a family button, else the first), its default tile
    var initialFamily = null;
    for (var n = 0; n < familyBtns.length; n++) if (familyBtns[n].hasAttribute("data-rd-default")) initialFamily = familyBtns[n].getAttribute("data-rd-id");
    if (!initialFamily && familyBtns.length) initialFamily = familyBtns[0].getAttribute("data-rd-id");
    if (initialFamily) showFamily(initialFamily, false);
    else { var initial = null; for (var q2 = 0; q2 < presets.length; q2++) if (presets[q2].hasAttribute("data-rd-default")) initial = presetById(presets[q2].getAttribute("data-rd-id")); if (initial) applyPreset(initial, false); else { setSliders(null); syncInputs(); } }
    setMotionState();
    say((current ? current.name + " pattern: " : "") + paramsText() + ". The field is black until you press Seed or click and drag on it.");
  }


  // ---- the families and their presets ------------------------------------------------------------------------
  // A preset: { id, family, name, model, params (overrides), seed, firstSeed, palette, brush, timeScale,
  //   stepScale, dscale, chrono, thumbSeed, thumbSteps, thumbScale, thumbStir }.
  // firstSeed "spec": the first Seed press (or the first mark on the field) runs the preset's own seeding from
  // that point; every later press places one random point, as on every pattern (owner ruling 2026-10-09). A tile
  // itself only selects; the field stays black until the visitor acts.
  var FAMILIES = [
    { id: "rd", name: "Reaction–diffusion" },
    { id: "ca", name: "Cellular automata" }
  ];
  var PRESETS = [
    // —— reaction–diffusion: Gray–Scott in eight regimes, and the phase-field dendrite ——
    // the owner's defaults of 2026-10-09: palette, rates, speed (timeScale) and brush per pattern; each slider is
    // centred on these (the binding tailors the ranges), so every pattern starts mid-range
    { id: "malachite",   family: "rd", name: "Malachite",   model: "gray-scott", palette: "canopy",   params: { feed: 0.008, kill: 0.031 }, timeScale: 0.04, brush: 0.02, seed: { type: "pacemaker", n: 1, r: 3, every: 75 }, firstSeed: "spec", chrono: 420 },
    { id: "meandric",    family: "rd", name: "Meandric",    model: "gray-scott", palette: "physarum", params: { feed: 0.024, kill: 0.054 }, timeScale: 0.04, brush: 0.02, seed: { type: "spiral", n: 21, r: 3 }, chrono: 2400 },
    { id: "swarm",       family: "rd", name: "Swarm",       model: "gray-scott", palette: "neon",     params: { feed: 0.013, kill: 0.054 }, timeScale: 2.6,  brush: 0.05, seed: { type: "spiral", n: 21, r: 3 }, chrono: 1800 },
    { id: "xylem",       family: "rd", name: "Xylem",       model: "gray-scott", palette: "coastal",  params: { feed: 0.039, kill: 0.058 }, timeScale: 0.04, brush: 0.04, seed: { type: "spiral", n: 13, r: 4 }, chrono: 2400 },
    // Frost in this family is the phase-field dendrite: a reaction–diffusion system (Allen–Cahn plus heat)
    { id: "frost",       family: "rd", name: "Frost",       model: "dendrite",   params: {}, palette: "cherenkov", timeScale: 0.3, seed: { type: "center", r: 2 }, firstSeed: "spec", thumbSeed: { type: "spiral", n: 3, r: 1.5, spread: 0.75 }, thumbSteps: 5000, thumbScale: 4, chrono: 1600, brush: 0.004 },
    { id: "turbulence",  family: "rd", name: "Turbulence",  model: "gray-scott", palette: "accretion", params: { feed: 0.025, kill: 0.050 }, timeScale: 1.0, brush: 0.05, seed: { type: "discs", n: 7, r: 4 }, chrono: 1800 },
    { id: "mitosis",     family: "rd", name: "Mitosis",     model: "gray-scott", palette: "spectrum",  params: { feed: 0.036, kill: 0.065 }, timeScale: 2.6, brush: 0.02, quality: 240, seed: { type: "spiral", n: 8, r: 3 }, chrono: 2400 },
    // Phyllotaxis: `n` sets the head's spacing (144 spots fill the inscribed circle); `edge` keeps placing spots on the
    // golden angle past n until the spiral leaves the frame (owner ruling 2026-10-09)
    { id: "phyllotaxis", family: "rd", name: "Phyllotaxis", model: "gray-scott", palette: "orodruin", params: { feed: 0.030, kill: 0.062 }, timeScale: 1.25, brush: 0.03, seed: { type: "grow", n: 144, r: 1.6, every: 4, edge: true }, firstSeed: "spec", chrono: 1200 },
    // Vortex: feed 0.008, kill 0.039 (owner ruling 2026-10-09) — Pearson's ξ region, "large, sustained spirals similar to
    // the Belousov–Zhabotinsky reaction" (Munafo's classification, read 2026-10-09); the 3.2 diffusion scale that
    // reproduces jsexp's 5-point kernel at its 0.8 step is kept. The tile is stirred so broken fronts curl into rotors.
    // the opening is a "stir": five points and four curved slashes of varying length, at random places and moments
    // within one second, different every time (owner, 2026-10-09)
    // selfSustaining false: spiral waves in this regime live on broken fronts (the stir, the visitor's strokes) and a
    // single front runs off and dies, so the fade test records its survival without binding it to the window
    { id: "vortex",      family: "rd", name: "Vortex",      model: "gray-scott", palette: "aurora", params: { feed: 0.008, kill: 0.039 }, timeScale: 1.25, brush: 0.03, dscale: 3.2, selfSustaining: false, seed: { type: "stir", points: 5, slashes: 4, frames: 60, r: 2 }, firstSeed: "every", thumbSeed: { type: "strokes", n: 3, r: 2 }, thumbStir: { every: 150, n: 1, r: 2 }, thumbSteps: 1500, thumbScale: 2, chrono: 900 },

    // —— cellular automata ——
    { id: "ca-frost",     family: "ca", name: "Frost",       model: "snow",        params: {}, palette: "cherenkov", seed: { type: "center", r: 1 }, brush: 0.004, stepScale: 1, thumbSeed: { type: "spiral", n: 4, r: 1, spread: 0.8 }, thumbSteps: 900, thumbScale: 2, chrono: 3000 },
    { id: "lenia",        family: "ca", name: "Lenia",       model: "lenia",       params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.1, thumbSeed: { type: "fill" }, thumbSteps: 300, chrono: 600 },
    { id: "rotor",        family: "ca", name: "Rotor",       model: "rotor",       params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.3, thumbSeed: { type: "fill" }, thumbSteps: 260, thumbScale: 2, chrono: 400 },
    { id: "lichtenberg",  family: "ca", name: "Lichtenberg", model: "lichtenberg", params: {}, timeScale: 0.25, seed: { type: "center", r: 2 }, firstSeed: "spec", brush: 0.004, thumbSteps: 500, thumbScale: 1.5, chrono: 1200 },
    // Sandpile: falling sand (owner 2026-10-09: "give the sandpile gravity"); the drop point keeps dropping until Reset
    { id: "sandpile",     family: "ca", name: "Sandpile",    model: "sand",        params: {}, seed: { type: "pacemaker", n: 1, r: 1, every: 2 }, firstSeed: "spec", brush: 0.01, thumbSeed: { type: "center", r: 1 }, thumbStir: { every: 2, spec: { type: "center", r: 1 } }, thumbSteps: 900, thumbScale: 2, chrono: 1200 },
    { id: "conus",        family: "ca", name: "Conus",       model: "conus",       params: {}, seed: { type: "center", r: 1 }, firstSeed: "spec", brush: 0.004, stepScale: 0.35, thumbSeed: { type: "center", r: 1 }, thumbSteps: 108, thumbScale: 2, chrono: 300 },
    { id: "wildfire",     family: "ca", name: "Wildfire",    model: "wildfire",    params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.03, stepScale: 0.4, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 900 },
    { id: "grain",        family: "ca", name: "Grain",       model: "grain",       params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.5, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 1200 },
    { id: "wake",         family: "ca", name: "Wake",        model: "wake",        params: {}, timeScale: 1.5, seed: { type: "center", r: 9 }, firstSeed: "spec", brush: 0.004, thumbSeed: { type: "center", r: 6 }, thumbSteps: 600, thumbScale: 2, chrono: 1800 }
  ];
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }

  var registry = [];
  function auto(root) {
    root = root || global.document;
    var mq = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var canvases = root.querySelectorAll("canvas[data-morphogen],canvas[data-reaction-diffusion]");
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i]; if (get(c)) continue; var d = c.dataset;
      var preset = d.preset ? presetById(d.preset) : null;
      var field = mount(c, {
        model: preset ? preset.model : (d.model || undefined),
        params: preset ? preset.params : (d.feed !== undefined || d.kill !== undefined ? { feed: parseFloat(d.feed), kill: parseFloat(d.kill) } : undefined),
        timeScale: d.timeScale !== undefined ? parseFloat(d.timeScale) : undefined,
        fadeStart: d.fadeStart !== undefined ? parseFloat(d.fadeStart) : undefined, fadeEnd: d.fadeEnd !== undefined ? parseFloat(d.fadeEnd) : undefined,
        palette: d.palette, baseSteps: d.steps !== undefined ? parseInt(d.steps, 10) : undefined,
        stepScale: d.stepScale !== undefined ? parseFloat(d.stepScale) : undefined,
        brush: d.brush !== undefined ? parseFloat(d.brush) : undefined,
        dscale: d.dscale !== undefined ? parseFloat(d.dscale) : undefined,
        hover: d.hover === "on" || d.hover === "true",
        quality: d.quality === "auto" ? "auto" : (d.quality !== undefined ? parseInt(d.quality, 10) : undefined),
        gpu: d.gpu !== "off", reducedMotion: mq ? mq.matches : false
      });
      registry.push({ canvas: c, field: field });
      var scope = c.closest ? c.closest("[data-rd-scope]") : null; if (scope) bind(scope, field);
      if (mq) (function (fld) { var h = function (ev) { fld.setReducedMotion(ev.matches); }; if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h); })(field);
    }
  }
  function get(canvas) { for (var i = 0; i < registry.length; i++) if (registry[i].canvas === canvas) return registry[i].field; return null; }

  var Morphogen = { mount: mount, bind: bind, auto: auto, get: get, models: MODELS, modelOrder: MODEL_ORDER, families: FAMILIES, presets: PRESETS, palettes: PALETTES, ladder: LADDER, buildLut: buildLut, renderThumb: renderThumb, thumbJob: thumbJob, seedDiscList: seedDiscList, defineModel: defineModel, version: VERSION };
  global.Morphogen = Morphogen;
  global.ReactionDiffusion = Morphogen;   // the 1.x name, kept as an alias
  if (global.document && global.document.querySelectorAll) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { auto(); }); else auto(); }
})(typeof window !== "undefined" ? window : this);

