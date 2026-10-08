/*!
 * Morphogen — reaction-diffusion.js — a Gray–Scott reaction–diffusion field on a 2D canvas.
 * Copyright (c) 2026 Christopher A. Stamplis. Released under the MIT License.
 * Source: https://github.com/cs-training-systems/morphogen   Version 1.0.0
 *
 * Written from the published equations — Gray & Scott (1984), Pearson (1993) —
 * with no borrowed code. Visual inspiration: pmneila/jsexp (BSD-3-Clause).
 *
 * Classic script. Defines ONE global, `ReactionDiffusion`, and auto-mounts every
 * `<canvas data-reaction-diffusion>` on DOMContentLoaded. Controls are declarative:
 * any element inside the same `[data-rd-scope]` container with a `data-rd` role is
 * bound automatically:
 *   preset (button; may hold a `thumb` canvas) · note (per-preset text, `data-rd-for`) ·
 *   feed-range / feed-number · kill-range / kill-number · scale-range / scale-number ·
 *   pause · reset · seed · colors-toggle · colors-menu · palette-option (radios) ·
 *   status (live region) · quality · steps
 * No dependencies.
 *
 * Model (per step, dt = 1, 3×3 Laplacian: centre −1, edges 0.2, corners 0.05):
 *   U' = U + (Du·∇²U − g·U·V² + f·(1 − U))·dt       Du = 0.2097
 *   V' = V + (Dv·∇²V + g·U·V² − (f + k)·V)·dt       Dv = 0.105
 * g is an optional autocatalytic gain used only when a fade window is configured
 * (off by default: patterns run until Reset).
 *
 * Time scale: steps per frame = baseSteps × timeScale, fractional values carried
 * between frames so any value runs smoothly.
 *
 * Resolution is adaptive: the engine measures its own compute time per frame and
 * climbs a resolution ladder while that stays under 8 ms (half a 60 fps frame), steps
 * down above 12 ms or when two of the last thirty frames exceed 16 ms, never simulates
 * more cells across than the canvas has device pixels, holds one second after each
 * change, and resamples the running state bilinearly so a change is invisible.
 */
(function (global) {
  "use strict";

  var DU = 0.2097, DV = 0.105, DT = 1;
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));   // 137.507…°, 360°/φ²

  // Named (f, k) pairs with the seeding that shows each regime at its best.
  //   seed.type: "spiral" (golden-angle phyllotaxis of n discs) · "strokes" (n short line
  //   strokes, whose broken ends can spin up spiral waves) · "discs" (n scattered discs)
  var PRESETS = [
    { id: "malachite",   name: "Malachite",   feed: 0.010, kill: 0.035, seed: { type: "discs",   n: 5,  r: 3 } },
    { id: "meandric",    name: "Meandric",    feed: 0.029, kill: 0.057, seed: { type: "spiral",  n: 21, r: 3 } },
    { id: "swarm",       name: "Swarm",       feed: 0.014, kill: 0.054, seed: { type: "spiral",  n: 21, r: 3 } },
    { id: "honeycomb",   name: "Honeycomb",   feed: 0.039, kill: 0.058, seed: { type: "spiral",  n: 13, r: 4 } },
    { id: "frost",       name: "Frost",       feed: 0.046, kill: 0.063, seed: { type: "spiral",  n: 8,  r: 3 } },
    { id: "turbulence",  name: "Turbulence",  feed: 0.026, kill: 0.051, seed: { type: "discs",   n: 7,  r: 4 } },
    { id: "mitosis",     name: "Mitosis",     feed: 0.037, kill: 0.065, seed: { type: "spiral",  n: 8,  r: 3 } },
    { id: "phyllotaxis", name: "Phyllotaxis", feed: 0.030, kill: 0.062, seed: { type: "grow",    n: 144, r: 1.6, every: 4 } },
    { id: "vortex",      name: "Vortex",      feed: 0.014, kill: 0.045, seed: { type: "strokes", n: 3,  r: 2 } }
  ];

  // Colour ramps, four colours each: ground (black, so a trailing edge fades into it),
  // trail, body, front. All from the brand set plus black and white.
  var PALETTES = {
    canopy:    { name: "Canopy",    colors: ["#000000", "#003E99", "#009149", "#FEEEA3"] },
    aurora:    { name: "Aurora",    colors: ["#000000", "#009149", "#7728A8", "#FFFFFF"] },
    spectrum:  { name: "Spectrum",  colors: ["#000000", "#003E99", "#D30011", "#FFFFFF"] },
    neon:      { name: "Neon",      colors: ["#000000", "#D30011", "#009149", "#FFFFFF"] },
    accretion: { name: "Accretion", colors: ["#000000", "#003E99", "#FD5F00", "#FFFFFF"] },
    physarum:  { name: "Physarum",  colors: ["#000000", "#003E99", "#FDD100", "#FFFFFF"] },
    cherenkov: { name: "Cherenkov", colors: ["#000000", "#7728A8", "#0095DA", "#FFFFFF"] }
  };
  var RAMP_STOPS = [0, 0.30, 0.62, 1];

  // Resolution ladder: grid WIDTHS. The height follows the frame's own aspect ratio, measured
  // from the canvas on screen, so the picture is never stretched: a 16:9 frame gets a 16:9 grid,
  // a square frame a square grid. The engine starts one rung up and moves by measurement.
  var LADDER = [320, 400, 480, 560, 640, 800];

  var DEFAULTS = {
    quality: "auto",             // "auto", a ladder index 0..5, or a [w, h] pair
    feed: 0.010, kill: 0.035,
    baseSteps: 8,                // steps per frame at time scale 1
    timeScale: 0.75,             // 0.5 … 2.5
    fadeStart: Infinity,         // seconds after the pointer leaves before the gain falls (Infinity = never)
    fadeEnd: Infinity,
    vmax: 0.4,                   // the V value drawn as the top of the palette
    palette: "canopy",
    seedValue: 0.5,
    seedRadius: 3,               // cells at the 320-wide reference, scaled with resolution
    seedSpeedGain: 0.25,
    seedRadiusMax: 12,
    aliveThreshold: 0.01,
    stillSteps: 600,
    budgetMs: 8,
    ceilingMs: 12,
    thumb: { width: 128, height: 72, steps: 420 },
    reducedMotion: false,
    clock: null
  };

  function hexToRgb(hex) {
    var h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function buildLut(colors, stops) {
    stops = stops || RAMP_STOPS;
    var lut = new Uint8ClampedArray(256 * 3);
    var rgb = colors.map(hexToRgb);
    for (var i = 0; i < 256; i++) {
      var t = i / 255, j = 0;
      while (j < stops.length - 2 && t > stops[j + 1]) j++;
      var span = stops[j + 1] - stops[j], u = span > 0 ? (t - stops[j]) / span : 0;
      if (u > 1) u = 1;
      lut[i * 3]     = rgb[j][0] + (rgb[j + 1][0] - rgb[j][0]) * u;
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

  // ---- the field: allocation, stepping, seeding (shared by the main field and thumbnails) ----
  function makeField(w, h) {
    var S = { W: w, H: h, N: w * h, U: new Float32Array(w * h), V: new Float32Array(w * h), U2: new Float32Array(w * h), V2: new Float32Array(w * h) };
    S.U.fill(1);
    return S;
  }

  function stepField(S, f, k, g) {
    var W = S.W, H = S.H, U = S.U, V = S.V, U2 = S.U2, V2 = S.V2;
    for (var y = 0; y < H; y++) {
      var y0 = y * W, ym = (y > 0 ? y - 1 : y) * W, yp = (y < H - 1 ? y + 1 : y) * W;
      for (var x = 0; x < W; x++) {
        var xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, i = y0 + x;
        var u = U[i], v = V[i];
        var lu = 0.2 * (U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x])
               + 0.05 * (U[ym + xm] + U[ym + xp] + U[yp + xm] + U[yp + xp]) - u;
        var lv = 0.2 * (V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x])
               + 0.05 * (V[ym + xm] + V[ym + xp] + V[yp + xm] + V[yp + xp]) - v;
        var uvv = g * u * v * v;
        var un = u + (DU * lu - uvv + f * (1 - u)) * DT;
        var vn = v + (DV * lv + uvv - (f + k) * v) * DT;
        U2[i] = un < 0 ? 0 : (un > 1 ? 1 : un);
        V2[i] = vn < 0 ? 0 : (vn > 1 ? 1 : vn);
      }
    }
    S.U = U2; S.U2 = U; S.V = V2; S.V2 = V;
  }

  function seedDisc(S, cx, cy, r, value) {
    var W = S.W, H = S.H, V = S.V, r2 = r * r;
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) { var i = y * W + x; if (V[i] < value) V[i] = value; }
    }
  }

  // Vogel's phyllotaxis: disc n sits at angle n·137.5° and radius ∝ √n — a sunflower head.
  function seedSpiral(S, n, r, spread, value) {
    var cx = S.W / 2, cy = S.H / 2, scale = (spread || 0.9) * Math.min(S.W, S.H) / 2 / Math.sqrt(n);
    for (var i = 0; i < n; i++) {
      var rad = scale * Math.sqrt(i + 0.5), a = i * GOLDEN_ANGLE;
      seedDisc(S, cx + rad * Math.cos(a), cy + rad * Math.sin(a), r, value);
    }
  }

  function seedStrokes(S, n, r, value, salt) {
    var rnd = mulberry32((salt || 5) * 2654435761);
    for (var i = 0; i < n; i++) {
      var x0 = S.W * (0.2 + 0.6 * rnd()), y0 = S.H * (0.2 + 0.6 * rnd()), a = rnd() * Math.PI, len = Math.min(S.W, S.H) * 0.28;
      for (var t = 0; t <= 1; t += 0.05) seedDisc(S, x0 + Math.cos(a) * len * (t - 0.5), y0 + Math.sin(a) * len * (t - 0.5), r, value);
    }
  }

  function seedDiscs(S, n, r, value, salt) {
    var rnd = mulberry32((salt || 7) * 2654435761);
    for (var i = 0; i < n; i++) seedDisc(S, S.W * (0.1 + 0.8 * rnd()), S.H * (0.15 + 0.7 * rnd()), r, value);
  }

  // One disc of a growing phyllotaxis: disc i of nMax, on the golden-angle spiral, sized so disc nMax reaches the edge.
  function spiralPoint(S, i, nMax) {
    var scale = 0.95 * Math.min(S.W, S.H) / 2 / Math.sqrt(nMax);
    var rad = scale * Math.sqrt(i + 0.5), a = i * GOLDEN_ANGLE;
    return { x: S.W / 2 + rad * Math.cos(a), y: S.H / 2 + rad * Math.sin(a) };
  }

  // Apply a preset's seeding spec; sizes are at the 320-wide reference and scale with the grid.
  // "grow" seeds only its first discs here; the field adds the rest over time (see tick).
  function applySeed(S, spec, value, salt, growCount) {
    var sc = S.W / 320, r = (spec.r || 3) * sc;
    if (spec.type === "spiral") seedSpiral(S, spec.n, r, spec.spread, value);
    else if (spec.type === "strokes") seedStrokes(S, spec.n, r, value, salt);
    else if (spec.type === "grow") { var n = growCount || 3; for (var i = 0; i < n; i++) { var p = spiralPoint(S, i, spec.n); seedDisc(S, p.x, p.y, r, value); } }
    else seedDiscs(S, spec.n, r, value, salt);
  }

  function paint(S, ctx, image, lut, vmax) {
    var px = image.data, V = S.V, N = S.N, maxV = 0, scale = 255 / vmax;
    for (var i = 0, p = 0; i < N; i++, p += 4) {
      var v = V[i];
      if (v > maxV) maxV = v;
      var idx = (v * scale) | 0;
      if (idx > 255) idx = 255;
      idx *= 3;
      px[p] = lut[idx]; px[p + 1] = lut[idx + 1]; px[p + 2] = lut[idx + 2]; px[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return maxV;
  }

  function resample(oldS, newS) {        // bilinear
    var oldW = oldS.W, oldH = oldS.H, W = newS.W, H = newS.H, oU = oldS.U, oV = oldS.V, U = newS.U, V = newS.V;
    for (var y = 0; y < H; y++) {
      var fy = (y + 0.5) * oldH / H - 0.5, yi = Math.floor(fy), ty = fy - yi;
      var ya = Math.max(0, Math.min(oldH - 1, yi)) * oldW, yb = Math.max(0, Math.min(oldH - 1, yi + 1)) * oldW;
      for (var x = 0; x < W; x++) {
        var fx = (x + 0.5) * oldW / W - 0.5, xi = Math.floor(fx), tx = fx - xi;
        var xa = Math.max(0, Math.min(oldW - 1, xi)), xb = Math.max(0, Math.min(oldW - 1, xi + 1));
        var i = y * W + x;
        U[i] = (oU[ya + xa] * (1 - tx) + oU[ya + xb] * tx) * (1 - ty) + (oU[yb + xa] * (1 - tx) + oU[yb + xb] * tx) * ty;
        V[i] = (oV[ya + xa] * (1 - tx) + oV[ya + xb] * tx) * (1 - ty) + (oV[yb + xa] * (1 - tx) + oV[yb + xb] * tx) * ty;
      }
    }
  }

  // ---- thumbnails: a small field per preset, rendered once, repainted per palette ----
  function renderThumb(preset, size) {
    var S = makeField(size.width, size.height);
    applySeed(S, preset.seed, 0.5, 11, 55);
    for (var s = 0; s < size.steps; s++) stepField(S, preset.feed, preset.kill, 1);
    return S;
  }

  function mount(canvas, options) {
    var o = {};
    for (var key in DEFAULTS) o[key] = DEFAULTS[key];
    for (var k2 in (options || {})) if (options[k2] !== undefined) o[k2] = options[k2];
    var now = o.clock || defaultClock;

    var ctx = canvas.getContext("2d", { alpha: false });
    var S, image;
    var f = o.feed, k = o.kill, gain = 1, leftAt = null, stepAcc = 0;
    var grow = null, growN = 0, growTick = 0;     // a "grow" seeding in progress
    var lut = buildLut((PALETTES[o.palette] || PALETTES.canopy).colors);
    var paused = false, pointerIn = false, alive = false, rafId = 0, last = null;
    var listeners = [];
    var frames = 0, fpsAt = 0, fps = 0, msAvg = 0, msSamples = 0, msHold = 0;
    var slowRing = new Uint8Array(30), slowCount = 0;
    var level = 1, auto = o.quality === "auto";
    if (!auto) level = typeof o.quality === "number" ? o.quality : 1;
    var aspect = measureAspect();

    function emit(type) { for (var i = 0; i < listeners.length; i++) listeners[i](type, api); }

    // the frame's shape on screen; 16:9 when it cannot be measured (tests, hidden canvases)
    function measureAspect() {
      var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      return (r && r.width > 0 && r.height > 0) ? r.width / r.height : 16 / 9;
    }
    function dims(n) { var w = LADDER[n]; return [w, Math.max(16, Math.round(w / aspect))]; }

    function allocate(w, h, keep) {
      var old = S;
      S = makeField(w, h);
      canvas.width = w; canvas.height = h;
      image = ctx.createImageData(w, h);
      if (keep && old) resample(old, S);
    }

    function setLevel(n, keep) {
      n = Math.max(0, Math.min(LADDER.length - 1, n));
      if (S && n === level) return;
      level = n;
      var d = dims(n);
      allocate(d[0], d[1], keep);
      msAvg = 0; msSamples = 0; msHold = 60; slowRing.fill(0); slowCount = 0;
      emit("quality");
    }

    // a resize that changes the frame's shape (a breakpoint, a rotation) re-shapes the grid in place
    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var a = measureAspect();
        if (Math.abs(a / aspect - 1) < 0.02) return;
        aspect = a;
        var d = dims(level);
        allocate(d[0], d[1], true); render(); emit("quality");
      }, 150);
    }
    if (global.addEventListener) global.addEventListener("resize", onResize);

    function displayCap() {
      if (!canvas.getBoundingClientRect) return LADDER.length - 1;
      var cssW = canvas.getBoundingClientRect().width || 0;
      var devW = cssW * (global.devicePixelRatio || 1);
      if (!devW) return LADDER.length - 1;
      var cap = 0;
      for (var n = 0; n < LADDER.length; n++) if (LADDER[n] <= devW) cap = n;
      return cap;
    }

    function reset() { S.U.fill(1); S.V.fill(0); alive = false; leftAt = null; gain = 1; grow = null; growN = 0; }

    // growth seeding: one more golden-angle disc every `every` frames until the head is complete
    function growStep() {
      if (!grow || growN >= grow.n) return;
      if (++growTick % grow.every !== 0) return;
      var p = spiralPoint(S, growN++, grow.n);
      seedDisc(S, p.x, p.y, (grow.r || 3) * S.W / 320, o.seedValue);
      alive = true;
    }
    function render() { return paint(S, ctx, image, lut, o.vmax); }

    function updateGain(t) {
      if (pointerIn || o.fadeStart === Infinity) { leftAt = null; gain = 1; return; }
      if (leftAt === null) leftAt = t;
      var s = (t - leftAt) / 1000;
      if (s <= o.fadeStart) gain = 1;
      else if (s >= o.fadeEnd) gain = 0;
      else { var x = 1 - (s - o.fadeStart) / (o.fadeEnd - o.fadeStart); gain = x * x * (3 - 2 * x); }
    }

    function tick() {
      var t0 = now();
      updateGain(t0);
      growStep();
      stepAcc += o.baseSteps * o.timeScale;
      var n = Math.floor(stepAcc); stepAcc -= n;
      for (var s = 0; s < n; s++) stepField(S, f, k, gain);
      var maxV = render();
      var ms = now() - t0;
      var wasAlive = alive;
      alive = maxV >= o.aliveThreshold;
      if (!alive && wasAlive) { S.V.fill(0); render(); leftAt = null; gain = 1; }
      msSamples++; msAvg += (ms - msAvg) / Math.min(msSamples, 30);
      var slot = msSamples % 30, wasSlow = slowRing[slot], isSlow = ms > 16 ? 1 : 0;
      slowRing[slot] = isSlow; slowCount += isSlow - wasSlow;
      if (auto && msHold > 0) msHold--;
      else if (auto && msSamples >= 30) {
        if ((msAvg > o.ceilingMs || slowCount >= 2) && level > 0) setLevel(level - 1, true);
        else if (msAvg < o.budgetMs && level < Math.min(LADDER.length - 1, displayCap())) setLevel(level + 1, true);
      }
      return { maxV: maxV, ms: ms, wasAlive: wasAlive, gain: gain };
    }

    function frame(ts) {
      rafId = 0;
      if (paused || o.reducedMotion) return;
      var r = tick();
      frames++;
      if (ts - fpsAt >= 1000) { fps = frames * 1000 / (ts - fpsAt); frames = 0; fpsAt = ts; }
      if (alive || pointerIn) rafId = global.requestAnimationFrame(frame);
      else if (r.wasAlive) emit("quiet");
    }

    function wake() { if (global.requestAnimationFrame && !rafId && !paused && !o.reducedMotion) rafId = global.requestAnimationFrame(frame); }

    function scaleR(r) { return r * S.W / 320; }
    function markSeeded() { alive = true; leftAt = null; gain = 1; }

    function still(spec) { reset(); applySeed(S, spec || { type: "spiral", n: 21, r: 3 }, o.seedValue, 11, 144); for (var s = 0; s < o.stillSteps; s++) stepField(S, f, k, 1); render(); }

    // ---- pointer: hover alone disturbs the field; no click is needed ----
    function gridPoint(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / rect.width * S.W, y: (e.clientY - rect.top) / rect.height * S.H };
    }
    function onEnter() { pointerIn = true; last = null; wake(); }
    function onLeave() { pointerIn = false; last = null; }
    function onMove(e) {
      if (o.reducedMotion) return;
      pointerIn = true;
      var p = gridPoint(e);
      var speed = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
      var r = scaleR(Math.min(o.seedRadiusMax, o.seedRadius + o.seedSpeedGain * speed * 320 / S.W));
      if (last && speed > r) {
        var n = Math.ceil(speed / r);
        for (var i = 1; i <= n; i++) seedDisc(S, last.x + (p.x - last.x) * i / n, last.y + (p.y - last.y) * i / n, r, o.seedValue);
      } else seedDisc(S, p.x, p.y, r, o.seedValue);
      markSeeded(); last = p;
      wake();
    }
    if (canvas.addEventListener) {
      canvas.addEventListener("pointerenter", onEnter);
      canvas.addEventListener("pointerleave", onLeave);
      canvas.addEventListener("pointermove", onMove);
    }

    var api = {
      canvas: canvas,
      presets: PRESETS,
      palettes: PALETTES,
      ladder: LADDER,
      getParams: function () { return { feed: f, kill: k, timeScale: o.timeScale }; },
      setParams: function (feed, kill) {
        if (typeof feed === "number" && !isNaN(feed)) f = feed;
        if (typeof kill === "number" && !isNaN(kill)) k = kill;
        if (o.reducedMotion) still();
        emit("params"); return api;
      },
      setFeed: function (v) { return api.setParams(v); },
      setKill: function (v) { return api.setParams(undefined, v); },
      setTimeScale: function (s) { if (typeof s === "number" && !isNaN(s)) o.timeScale = Math.max(0.1, s); emit("params"); return api; },
      setFade: function (start, end) { o.fadeStart = start; o.fadeEnd = end; return api; },
      setPalette: function (nameOrColors) {
        var colors = typeof nameOrColors === "string" ? (PALETTES[nameOrColors] || PALETTES.canopy).colors : nameOrColors;
        lut = buildLut(colors); render(); emit("palette"); return api;
      },
      lut: function () { return lut; },
      setSteps: function (n) { o.baseSteps = Math.max(1, n | 0); return api; },
      setQuality: function (q) {
        if (q === "auto") { auto = true; msSamples = 0; msHold = 0; }
        else { auto = false; setLevel(parseInt(q, 10), true); }
        emit("quality"); return api;
      },
      quality: function () { return { auto: auto, level: level, width: S.W, height: S.H, ms: msAvg, gain: gain, steps: o.baseSteps * o.timeScale }; },
      pause: function () { paused = true; if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } emit("pause"); return api; },
      play: function () { paused = false; wake(); emit("play"); return api; },
      isPaused: function () { return paused; },
      isAlive: function () { return alive; },
      clear: function () { reset(); render(); emit("clear"); return api; },
      seed: function (x, y, r) { seedDisc(S, x, y, r || scaleR(o.seedRadius), o.seedValue); markSeeded(); wake(); return api; },
      seedSpec: function (spec, salt) {
        applySeed(S, spec, o.seedValue, salt); markSeeded();
        if (spec.type === "grow") { grow = spec; growN = 3; growTick = 0; } else grow = null;
        if (o.reducedMotion) { for (var s = 0; s < o.stillSteps; s++) stepField(S, f, k, 1); render(); } else wake();
        emit("seed"); return api;
      },
      seedRandom: function (count, salt) { return api.seedSpec({ type: "discs", n: count || 9, r: 3 }, salt); },
      still: function (spec) { still(spec); return api; },
      setReducedMotion: function (on) {
        o.reducedMotion = !!on;
        if (on) { if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } still(); } else wake();
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
          canvas.removeEventListener("pointerenter", onEnter);
          canvas.removeEventListener("pointerleave", onLeave);
          canvas.removeEventListener("pointermove", onMove);
        }
        listeners.length = 0;
      }
    };

    if (Array.isArray(o.quality)) { auto = false; allocate(o.quality[0], o.quality[1], false); }
    else { var d0 = dims(level); allocate(d0[0], d0[1], false); }
    reset();
    if (o.reducedMotion) still(); else render();
    return api;
  }

  // ---- declarative controls ------------------------------------------------
  function fmt(v) { return v.toFixed(3); }
  function fmt2(v) { return v.toFixed(2); }
  function $(scope, role) { return scope.querySelector("[data-rd='" + role + "']"); }
  function $$(scope, role) { return scope.querySelectorAll("[data-rd='" + role + "']"); }
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }

  function bind(scope, field) {
    var presets = $$(scope, "preset"), notes = $$(scope, "note");
    var feedRange = $(scope, "feed-range"), feedNumber = $(scope, "feed-number");
    var killRange = $(scope, "kill-range"), killNumber = $(scope, "kill-number");
    var scaleRange = $(scope, "scale-range"), scaleNumber = $(scope, "scale-number");
    var pauseBtn = $(scope, "pause"), resetBtn = $(scope, "reset"), seedBtn = $(scope, "seed");
    var colorsToggle = $(scope, "colors-toggle"), colorsMenu = $(scope, "colors-menu");
    var paletteRadios = $$(scope, "palette-option");
    var status = $(scope, "status"), quality = $(scope, "quality"), steps = $(scope, "steps");
    var current = null, thumbs = [];

    function say(text) { if (status) status.textContent = text; }
    function paramsText() { var p = field.getParams(); return "feed " + fmt(p.feed) + ", kill " + fmt(p.kill) + ", time scale " + fmt2(p.timeScale); }
    function currentName() { return current ? current.name : "custom"; }
    function syncInputs() {
      var p = field.getParams();
      if (feedRange) feedRange.value = fmt(p.feed);
      if (feedNumber) feedNumber.value = fmt(p.feed);
      if (killRange) killRange.value = fmt(p.kill);
      if (killNumber) killNumber.value = fmt(p.kill);
      if (scaleRange) scaleRange.value = fmt2(p.timeScale);
      if (scaleNumber) scaleNumber.value = fmt2(p.timeScale);
    }
    function markPreset(preset) {
      current = preset;
      for (var i = 0; i < presets.length; i++) presets[i].setAttribute("aria-pressed", preset && presets[i].getAttribute("data-rd-id") === preset.id ? "true" : "false");
      for (var j = 0; j < notes.length; j++) notes[j].hidden = !(preset && notes[j].getAttribute("data-rd-for") === preset.id);
    }
    function applyPreset(preset, seed) {
      field.setParams(preset.feed, preset.kill);
      markPreset(preset); syncInputs();
      if (seed) {
        field.clear();
        field.seedSpec(preset.seed, 11);
        if (field.isPaused()) field.play();
        say(preset.name + " pattern: " + paramsText() + ". " + (field.reducedMotion() ? "Still image." : "Animating."));
      }
    }

    // preset buttons (+ thumbnails rendered lazily so the page is never blocked)
    for (var i = 0; i < presets.length; i++) (function (btn) {
      var preset = presetById(btn.getAttribute("data-rd-id")) || { id: btn.getAttribute("data-rd-id"), name: btn.getAttribute("data-rd-name") || btn.textContent.trim(), feed: parseFloat(btn.getAttribute("data-rd-feed")), kill: parseFloat(btn.getAttribute("data-rd-kill")), seed: { type: "spiral", n: 21, r: 3 } };
      btn.addEventListener("click", function () { applyPreset(preset, true); });
      var thumb = btn.querySelector("[data-rd='thumb']");
      if (thumb && thumb.getContext) thumbs.push({ preset: preset, canvas: thumb, S: null });
    })(presets[i]);

    function paintThumbs() {
      var lut = field.lut();
      for (var t = 0; t < thumbs.length; t++) {
        var th = thumbs[t];
        if (!th.S) continue;
        var c = th.canvas, cx = c.getContext("2d", { alpha: false });
        paint(th.S, cx, cx.createImageData(c.width, c.height), lut, 0.4);
      }
    }
    function renderThumbsLazily() {
      var i = 0, size = field.thumbSize();
      function next() {
        if (i >= thumbs.length) { paintThumbs(); return; }
        var th = thumbs[i++];
        th.canvas.width = size.width; th.canvas.height = size.height;
        th.S = renderThumb(th.preset, size);
        paintThumbs();
        (global.requestIdleCallback || function (fn) { setTimeout(fn, 16); })(next);
      }
      next();
    }
    if (thumbs.length) renderThumbsLazily();

    // feed · kill · time scale (slider and number track each other)
    function onParam(which, el) {
      var v = parseFloat(el.value);
      if (isNaN(v)) return;
      if (which === "feed") field.setFeed(v);
      else if (which === "kill") field.setKill(v);
      else field.setTimeScale(v);
      if (which !== "scale") markPreset(null);
      syncInputs();
      say((which === "scale" ? currentName() + " pattern" : "Custom") + ": " + paramsText() + "." + (field.isAlive() ? "" : " The field is quiet; hover it, seed it, or choose a pattern."));
    }
    if (feedRange) feedRange.addEventListener("input", function () { onParam("feed", feedRange); });
    if (feedNumber) feedNumber.addEventListener("change", function () { onParam("feed", feedNumber); });
    if (killRange) killRange.addEventListener("input", function () { onParam("kill", killRange); });
    if (killNumber) killNumber.addEventListener("change", function () { onParam("kill", killNumber); });
    if (scaleRange) scaleRange.addEventListener("input", function () { onParam("scale", scaleRange); });
    if (scaleNumber) scaleNumber.addEventListener("change", function () { onParam("scale", scaleNumber); });

    // in-field controls: PAUSE/PLAY (the site's reel-control convention), RESET, SEED, COLORS
    function setPauseState(playing) {
      if (!pauseBtn) return;
      pauseBtn.textContent = playing ? "⏸ PAUSE" : "▶ PLAY";
      pauseBtn.setAttribute("aria-label", playing ? "Pause the field" : "Play the field");
    }
    if (pauseBtn) {
      setPauseState(true);
      pauseBtn.addEventListener("click", function () {
        if (field.isPaused()) { field.play(); setPauseState(true); say("Playing."); }
        else { field.pause(); setPauseState(false); say("Paused."); }
      });
    }
    if (resetBtn) resetBtn.addEventListener("click", function () { field.clear(); seedClicks = 0; say("Field reset to black."); });
    // SEED: one point per click — the first at the centre, every later one placed at random
    var seedClicks = 0;
    field.on(function (type) { if (type === "clear") seedClicks = 0; });
    if (seedBtn) seedBtn.addEventListener("click", function () {
      var q = field.quality(), first = seedClicks === 0;
      var x = first ? q.width / 2 : Math.random() * q.width, y = first ? q.height / 2 : Math.random() * q.height;
      field.seed(x, y, 4 * q.width / 320);
      seedClicks++;
      if (field.isPaused()) { field.play(); setPauseState(true); }
      say("Seeded one point" + (first ? " at the centre" : "") + ": " + currentName() + ", " + paramsText() + ".");
    });

    function setColorsOpen(open) {
      if (!colorsToggle || !colorsMenu) return;
      colorsMenu.classList.toggle("is-open", open);
      colorsToggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var checked = colorsMenu.querySelector("input:checked") || colorsMenu.querySelector("input"); if (checked) checked.focus(); }
    }
    if (colorsToggle && colorsMenu) {
      colorsToggle.addEventListener("click", function () { setColorsOpen(colorsToggle.getAttribute("aria-expanded") !== "true"); });
      colorsMenu.addEventListener("keydown", function (e) { if (e.key === "Escape") { setColorsOpen(false); colorsToggle.focus(); } });
      // close when focus moves to something OUTSIDE the menu; a press on an option briefly drops
      // focus to nothing (relatedTarget null), which must not close the menu mid-click
      scope.addEventListener("focusout", function (e) {
        var to = e.relatedTarget;
        if (colorsMenu.classList.contains("is-open") && to && !colorsMenu.contains(to) && to !== colorsToggle) setColorsOpen(false);
      });
      global.document.addEventListener("pointerdown", function (e) {
        if (colorsMenu.classList.contains("is-open") && !colorsMenu.contains(e.target) && e.target !== colorsToggle) setColorsOpen(false);
      });
    }
    for (var j = 0; j < paletteRadios.length; j++) (function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        field.setPalette(radio.value); paintThumbs();
        say("Colors: " + (radio.getAttribute("data-rd-name") || radio.value) + ".");
        if (colorsMenu && colorsMenu.classList.contains("is-open")) { setColorsOpen(false); if (colorsToggle) colorsToggle.focus(); }
      });
      if (radio.checked) field.setPalette(radio.value);
    })(paletteRadios[j]);

    if (steps) steps.addEventListener("change", function () { field.setSteps(parseInt(steps.value, 10)); });
    if (quality) quality.addEventListener("change", function () { field.setQuality(quality.value); });

    field.on(function (type) {
      if (type === "quiet") say("The pattern has faded; the field is quiet.");
      if (type === "motion") say(field.reducedMotion() ? "Reduced motion: showing a still image." : "Animating.");
    });

    var initial = null;
    for (var n = 0; n < presets.length; n++) if (presets[n].hasAttribute("data-rd-default")) initial = presetById(presets[n].getAttribute("data-rd-id"));
    if (initial) applyPreset(initial, false); else syncInputs();
    say((initial ? initial.name + " pattern: " : "") + paramsText() + ". The field is black until it is disturbed.");
  }

  var registry = [];

  function auto(root) {
    root = root || global.document;
    var mq = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var canvases = root.querySelectorAll("canvas[data-reaction-diffusion]");
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      if (get(c)) continue;
      var d = c.dataset;
      var field = mount(c, {
        feed: d.feed !== undefined ? parseFloat(d.feed) : undefined,
        kill: d.kill !== undefined ? parseFloat(d.kill) : undefined,
        timeScale: d.timeScale !== undefined ? parseFloat(d.timeScale) : undefined,
        fadeStart: d.fadeStart !== undefined ? parseFloat(d.fadeStart) : undefined,
        fadeEnd: d.fadeEnd !== undefined ? parseFloat(d.fadeEnd) : undefined,
        palette: d.palette,
        baseSteps: d.steps !== undefined ? parseInt(d.steps, 10) : undefined,
        quality: d.quality !== undefined && d.quality !== "auto" ? parseInt(d.quality, 10) : "auto",
        reducedMotion: mq ? mq.matches : false
      });
      registry.push({ canvas: c, field: field });
      var scope = c.closest ? c.closest("[data-rd-scope]") : null;
      if (scope) bind(scope, field);
      if (mq) (function (fld) {
        var handler = function (ev) { fld.setReducedMotion(ev.matches); };
        if (mq.addEventListener) mq.addEventListener("change", handler); else if (mq.addListener) mq.addListener(handler);
      })(field);
    }
  }

  function get(canvas) {
    for (var i = 0; i < registry.length; i++) if (registry[i].canvas === canvas) return registry[i].field;
    return null;
  }

  var ReactionDiffusion = { mount: mount, bind: bind, auto: auto, get: get, presets: PRESETS, palettes: PALETTES, ladder: LADDER, buildLut: buildLut, renderThumb: renderThumb, version: "1.0.0" };
  global.ReactionDiffusion = ReactionDiffusion;

  if (global.document && global.document.querySelectorAll) {
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { auto(); });
    else auto();
  }
})(typeof window !== "undefined" ? window : this);
