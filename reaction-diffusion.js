/*!
 * Morphogen — reaction-diffusion.js — a Gray–Scott reaction–diffusion field on a canvas.
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
 *   state (visible one-line state) · feed-range / feed-number · kill-range / kill-number ·
 *   scale-range / scale-number · pause · reset · seed · colors-toggle · colors-menu ·
 *   palette-option (radios) · motion (reduced-motion toggle) · quality (resolution select) ·
 *   measure (resolution / frame-rate readout) · status (live region) · steps
 * No dependencies.
 *
 * Two engines, one interface: WebGL2 (the simulation runs on the graphics processor,
 * every setting smooth on every machine) with the processor path as the fallback and
 * as the reference the tests run against. Both compute the same mathematics:
 *   U' = U + (Du·∇²U − g·U·V² + f·(1 − U))·dt       Du = 0.2097
 *   V' = V + (Dv·∇²V + g·U·V² − (f + k)·V)·dt       Dv = 0.105
 * (3×3 Laplacian: centre −1, edges 0.2, corners 0.05; dt = 1; g = autocatalytic gain, 1
 * unless an optional fade window is configured.)
 *
 * Time scale: steps per frame = baseSteps × timeScale, fractional values carried.
 * Resolution is adaptive: a ladder of widths, the height following the frame's shape;
 * climb while the frame's cost stays under budget, drop on cost or on dropped frames,
 * re-evaluated at once when a setting changes, never finer than the display.
 * Reduced motion shows a chronogram: one still whose left edge is the seed state and
 * whose right edge is full emergence, for the current settings.
 */
(function (global) {
  "use strict";

  var DU = 0.2097, DV = 0.105;
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  var PRESETS = [
    // chrono: simulation steps the reduced-motion chronogram spans, seed (left) → full development (right)
    { id: "malachite",   name: "Malachite",   feed: 0.010, kill: 0.035, seed: { type: "pacemaker", n: 3, r: 3, every: 75 }, chrono: 420 },
    { id: "meandric",    name: "Meandric",    feed: 0.029, kill: 0.057, seed: { type: "spiral",  n: 21, r: 3 }, chrono: 2400 },
    { id: "swarm",       name: "Swarm",       feed: 0.014, kill: 0.054, seed: { type: "spiral",  n: 21, r: 3 }, chrono: 1800 },
    { id: "honeycomb",   name: "Honeycomb",   feed: 0.039, kill: 0.058, seed: { type: "spiral",  n: 13, r: 4 }, chrono: 2400 },
    { id: "frost",       name: "Frost",       feed: 0.046, kill: 0.063, seed: { type: "spiral",  n: 8,  r: 3 }, chrono: 3000 },
    { id: "turbulence",  name: "Turbulence",  feed: 0.026, kill: 0.051, seed: { type: "discs",   n: 7,  r: 4 }, chrono: 1800 },
    { id: "mitosis",     name: "Mitosis",     feed: 0.037, kill: 0.065, seed: { type: "spiral",  n: 8,  r: 3 }, chrono: 2400 },
    { id: "phyllotaxis", name: "Phyllotaxis", feed: 0.030, kill: 0.062, seed: { type: "grow",    n: 144, r: 1.6, every: 4 }, chrono: 1200 },
    { id: "vortex",      name: "Vortex",      feed: 0.014, kill: 0.045, seed: { type: "strokes", n: 3,  r: 2 }, chrono: 900 }
  ];

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

  // Resolution ladder: grid widths. The height follows the frame's own aspect ratio.
  var LADDER = [320, 400, 480, 560, 640, 800, 1000, 1200, 1600];

  var DEFAULTS = {
    quality: "auto",
    feed: 0.010, kill: 0.035,
    baseSteps: 8,
    timeScale: 0.75,
    fadeStart: Infinity, fadeEnd: Infinity,
    vmax: 0.4,
    palette: "canopy",
    seedValue: 0.5,
    seedRadius: 3,
    seedSpeedGain: 0.25,
    seedRadiusMax: 12,
    aliveThreshold: 0.01,
    chronoSteps: 2400,           // simulation steps the reduced-motion chronogram spans, seed → emergence
    chronoStrips: 12,            // vertical strips, left early → right late
    budgetMs: 8, ceilingMs: 12,  // processor path: compute time per frame
    thumb: { width: 128, height: 72, steps: 420 },
    gpu: true,                   // try WebGL2 first
    reducedMotion: false,
    clock: null
  };

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

  // ---- seeding geometry (shared) ----------------------------------------------
  function spiralPoint(W, H, i, nMax) {
    var scale = 0.95 * Math.min(W, H) / 2 / Math.sqrt(nMax), rad = scale * Math.sqrt(i + 0.5), a = i * GOLDEN_ANGLE;
    return { x: W / 2 + rad * Math.cos(a), y: H / 2 + rad * Math.sin(a) };
  }
  // Returns the list of discs {x, y, r} a seeding spec places on a W×H grid (reference sizes scale with W).
  function seedDiscList(W, H, spec, salt, growCount) {
    var sc = W / 320, r = (spec.r || 3) * sc, list = [], i, p;
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
      for (i = 0; i < n; i++) { p = spiralPoint(W, H, i, spec.n); list.push({ x: p.x, y: p.y, r: r }); }
    } else if (spec.type === "pacemaker") {           // fixed points that fire again and again (see growStep)
      var rnd3 = mulberry32((salt || 3) * 2654435761);
      for (i = 0; i < spec.n; i++) list.push({ x: W * (0.2 + 0.6 * rnd3()), y: H * (0.2 + 0.6 * rnd3()), r: r });
    } else {
      var rnd2 = mulberry32((salt || 7) * 2654435761);
      for (i = 0; i < spec.n; i++) list.push({ x: W * (0.1 + 0.8 * rnd2()), y: H * (0.15 + 0.7 * rnd2()), r: r });
    }
    return list;
  }

  // Dense, even seeding of the whole field for the chronogram: a hexagonal lattice of the preset's
  // own seed kind, so every column of the chronogram holds pattern from the start.
  function latticeSeedList(W, H, spec) {
    var sc = W / 320, r = (spec.r || 3) * sc, s = 30 * sc, list = [], row = 0;
    for (var y = s * 0.6; y < H; y += s * 0.87, row++) {
      for (var x = (row % 2 ? s : s * 0.5); x < W; x += s) {
        if (spec.type === "strokes") { var a = (row % 2 ? 0.6 : -0.6) + 0.35 * Math.sin(x * 0.01), len = s * 0.55; for (var t = 0; t <= 1; t += 0.1) list.push({ x: x + Math.cos(a) * len * (t - 0.5), y: y + Math.sin(a) * len * (t - 0.5), r: r }); }
        else list.push({ x: x, y: y, r: r });
      }
    }
    return list;
  }

  // ---- processor backend --------------------------------------------------------
  function cpuBackend(canvas) {
    var ctx = (canvas && canvas.getContext) ? canvas.getContext("2d", { alpha: false }) : null;
    var W = 0, H = 0, N = 0, U, V, U2, V2, image, px, composite = null;

    function alloc(w, h) {
      W = w; H = h; N = w * h;
      U = new Float32Array(N); V = new Float32Array(N); U2 = new Float32Array(N); V2 = new Float32Array(N);
      U.fill(1);
      if (canvas) { canvas.width = w; canvas.height = h; }
      if (ctx) { image = ctx.createImageData(w, h); px = image.data; }
    }
    function resample(oU, oV, oW, oH) {
      for (var y = 0; y < H; y++) {
        var fy = (y + 0.5) * oH / H - 0.5, yi = Math.floor(fy), ty = fy - yi;
        var ya = Math.max(0, Math.min(oH - 1, yi)) * oW, yb = Math.max(0, Math.min(oH - 1, yi + 1)) * oW;
        for (var x = 0; x < W; x++) {
          var fx = (x + 0.5) * oW / W - 0.5, xi = Math.floor(fx), tx = fx - xi;
          var xa = Math.max(0, Math.min(oW - 1, xi)), xb = Math.max(0, Math.min(oW - 1, xi + 1)), i = y * W + x;
          U[i] = (oU[ya + xa] * (1 - tx) + oU[ya + xb] * tx) * (1 - ty) + (oU[yb + xa] * (1 - tx) + oU[yb + xb] * tx) * ty;
          V[i] = (oV[ya + xa] * (1 - tx) + oV[ya + xb] * tx) * (1 - ty) + (oV[yb + xa] * (1 - tx) + oV[yb + xb] * tx) * ty;
        }
      }
    }
    var be = {
      kind: "cpu",
      width: function () { return W; }, height: function () { return H; },
      resize: function (w, h, keep) { var oU = U, oV = V, oW = W, oH = H; alloc(w, h); if (keep && oU) resample(oU, oV, oW, oH); composite = null; },
      reset: function () { U.fill(1); V.fill(0); composite = null; },
      step: function (f, k, g, n) {
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) {
            var y0 = y * W, ym = (y > 0 ? y - 1 : y) * W, yp = (y < H - 1 ? y + 1 : y) * W;
            for (var x = 0; x < W; x++) {
              var xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, i = y0 + x, u = U[i], v = V[i];
              var lu = 0.2 * (U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x]) + 0.05 * (U[ym + xm] + U[ym + xp] + U[yp + xm] + U[yp + xp]) - u;
              var lv = 0.2 * (V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x]) + 0.05 * (V[ym + xm] + V[ym + xp] + V[yp + xm] + V[yp + xp]) - v;
              var uvv = g * u * v * v, un = u + (DU * lu - uvv + f * (1 - u)), vn = v + (DV * lv + uvv - (f + k) * v);
              U2[i] = un < 0 ? 0 : (un > 1 ? 1 : un); V2[i] = vn < 0 ? 0 : (vn > 1 ? 1 : vn);
            }
          }
          var tu = U; U = U2; U2 = tu; var tv = V; V = V2; V2 = tv;
        }
      },
      seed: function (discs, value) {
        for (var d = 0; d < discs.length; d++) {
          var cx = discs[d].x, cy = discs[d].y, r = discs[d].r, r2 = r * r;
          var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
          for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { var dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r2) { var i = y * W + x; if (V[i] < value) V[i] = value; } }
        }
      },
      maxV: function () { var m = 0, src = composite || V; for (var i = 0; i < N; i++) if (src[i] > m) m = src[i]; return m; },
      render: function (lut, vmax) {
        if (!ctx) return;
        var src = composite || V, scale = 255 / vmax;
        for (var i = 0, p = 0; i < N; i++, p += 4) { var idx = (src[i] * scale) | 0; if (idx > 255) idx = 255; idx *= 3; px[p] = lut[idx]; px[p + 1] = lut[idx + 1]; px[p + 2] = lut[idx + 2]; px[p + 3] = 255; }
        ctx.putImageData(image, 0, 0);
      },
      // chronogram: copy columns [x0, x1) of the current state into the composite shown instead of the state
      stripBegin: function () { composite = new Float32Array(N); },
      copyColumns: function (x0, x1) { for (var y = 0; y < H; y++) for (var x = x0; x < x1; x++) composite[y * W + x] = V[y * W + x]; },
      stripEnd: function () {},
      showState: function () { composite = null; },
      getV: function () { return V; },
      destroy: function () {}
    };
    return be;
  }

  // ---- graphics-processor backend (WebGL2, float textures) ------------------------
  var VS = "#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}";
  var FS_STEP = "#version 300 es\nprecision highp float;uniform sampler2D uS;uniform float uF,uK,uG;out vec4 o;\n" +
    "vec2 T(ivec2 p,ivec2 d,ivec2 s){return texelFetch(uS,clamp(p+d,ivec2(0),s-1),0).rg;}\n" +
    "void main(){ivec2 p=ivec2(gl_FragCoord.xy);ivec2 s=textureSize(uS,0);vec2 c=texelFetch(uS,p,0).rg;" +
    "vec2 l=0.2*(T(p,ivec2(-1,0),s)+T(p,ivec2(1,0),s)+T(p,ivec2(0,-1),s)+T(p,ivec2(0,1),s))+0.05*(T(p,ivec2(-1,-1),s)+T(p,ivec2(1,-1),s)+T(p,ivec2(-1,1),s)+T(p,ivec2(1,1),s))-c;" +
    "float a=uG*c.r*c.g*c.g;float u=c.r+(0.2097*l.r-a+uF*(1.0-c.r));float v=c.g+(0.105*l.g+a-(uF+uK)*c.g);o=vec4(clamp(u,0.0,1.0),clamp(v,0.0,1.0),0.0,1.0);}";
  var FS_SEED = "#version 300 es\nprecision highp float;uniform sampler2D uS;uniform vec3 uD[32];uniform int uN;uniform float uVal;out vec4 o;\n" +
    "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec2 c=texelFetch(uS,p,0).rg;vec2 q=vec2(p)+0.5;for(int i=0;i<32;i++){if(i>=uN)break;vec2 d=q-uD[i].xy;if(dot(d,d)<=uD[i].z*uD[i].z)c.g=max(c.g,uVal);}o=vec4(c,0.0,1.0);}";
  var FS_SHOW = "#version 300 es\nprecision highp float;uniform sampler2D uS;uniform sampler2D uL;uniform float uVmax;out vec4 o;\n" +
    "void main(){ivec2 s=textureSize(uS,0);ivec2 p=ivec2(int(gl_FragCoord.x),s.y-1-int(gl_FragCoord.y));float v=texelFetch(uS,p,0).g;o=vec4(texture(uL,vec2(clamp(v/uVmax,0.0,1.0),0.5)).rgb,1.0);}";
  var FS_RESAMPLE = "#version 300 es\nprecision highp float;uniform sampler2D uS;uniform ivec2 uNew;out vec4 o;\n" +
    "void main(){ivec2 s=textureSize(uS,0);vec2 p=gl_FragCoord.xy;vec2 f=(p/vec2(uNew))*vec2(s)-0.5;ivec2 i0=ivec2(floor(f));vec2 t=f-vec2(i0);" +
    "ivec2 a=clamp(i0,ivec2(0),s-1),b=clamp(i0+ivec2(1,0),ivec2(0),s-1),c=clamp(i0+ivec2(0,1),ivec2(0),s-1),d=clamp(i0+ivec2(1,1),ivec2(0),s-1);" +
    "vec2 v=mix(mix(texelFetch(uS,a,0).rg,texelFetch(uS,b,0).rg,t.x),mix(texelFetch(uS,c,0).rg,texelFetch(uS,d,0).rg,t.x),t.y);o=vec4(v,0.0,1.0);}";
  var FS_COPY = "#version 300 es\nprecision highp float;uniform sampler2D uS;out vec4 o;void main(){o=vec4(texelFetch(uS,ivec2(gl_FragCoord.xy),0).rg,0.0,1.0);}";
  var FS_MAX = "#version 300 es\nprecision highp float;uniform sampler2D uS;out vec4 o;\n" +
    "void main(){ivec2 s=textureSize(uS,0);ivec2 b=ivec2(gl_FragCoord.xy)*16;float m=0.0;for(int y=0;y<16;y++)for(int x=0;x<16;x++){ivec2 p=b+ivec2(x,y);if(p.x<s.x&&p.y<s.y)m=max(m,texelFetch(uS,p,0).g);}o=vec4(m,0.0,0.0,1.0);}";

  function gpuBackend(canvas) {
    var gl = canvas.getContext && canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    if (!gl || typeof gl.getExtension !== "function" || !gl.getExtension("EXT_color_buffer_float")) return null;
    function compile(type, src) { var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; }
    function program(fs) { var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
    var P;
    try { P = { step: program(FS_STEP), seed: program(FS_SEED), show: program(FS_SHOW), resample: program(FS_RESAMPLE), copy: program(FS_COPY), max: program(FS_MAX) }; }
    catch (e) { return null; }
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    // uniform locations, looked up once
    var L = {};
    for (var pn in P) { L[pn] = {}; ["uS", "uL", "uF", "uK", "uG", "uD", "uN", "uVal", "uVmax", "uNew"].forEach(function (u) { L[pn][u] = gl.getUniformLocation(P[pn], u); }); }
    var W = 0, H = 0, tex = [], fbo = [], cur = 0, comp = null, compFbo = null, showComp = false, maxTex = null, maxFbo = null, maxW = 0, maxH = 0, maxBuf = null;
    var lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var lutLoaded = null;

    function makeTex(w, h, fmt) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, fmt || gl.RG32F, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t: t, f: f };
    }
    function clearTex(tf, w, h, u, v) { gl.bindFramebuffer(gl.FRAMEBUFFER, tf.f); gl.viewport(0, 0, w, h); gl.clearColor(u, v, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    function draw(name, target, w, h, src) {
      gl.useProgram(P[name]); gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(L[name].uS, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function alloc(w, h) {
      var old = tex.length ? { t: tex[cur].t, w: W, h: H } : null;
      W = w; H = h; canvas.width = w; canvas.height = h;
      var a = makeTex(w, h), b = makeTex(w, h);
      clearTex(a, w, h, 1, 0); clearTex(b, w, h, 1, 0);
      if (old) { gl.useProgram(P.resample); gl.uniform2i(L.resample.uNew, w, h); draw("resample", a.f, w, h, old.t); }
      tex.forEach(function (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); });
      tex = [a, b]; cur = 0;
      if (comp) { gl.deleteTexture(comp.t); gl.deleteFramebuffer(comp.f); comp = null; }
      maxW = Math.ceil(w / 16); maxH = Math.ceil(h / 16);
      if (maxTex) { gl.deleteTexture(maxTex.t); gl.deleteFramebuffer(maxTex.f); }
      maxTex = makeTex(maxW, maxH, gl.RGBA32F); maxBuf = new Float32Array(maxW * maxH * 4);
      showComp = false;
    }
    var be = {
      kind: "gpu",
      width: function () { return W; }, height: function () { return H; },
      resize: function (w, h, keep) { if (!keep) tex.forEach(function (x) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); }), tex = []; alloc(w, h); },
      reset: function () { clearTex(tex[0], W, H, 1, 0); clearTex(tex[1], W, H, 1, 0); cur = 0; showComp = false; },
      step: function (f, k, g, n) {
        gl.useProgram(P.step); gl.viewport(0, 0, W, H); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(L.step.uS, 0);
        gl.uniform1f(L.step.uF, f); gl.uniform1f(L.step.uK, k); gl.uniform1f(L.step.uG, g);
        for (var s = 0; s < n; s++) {          // ping-pong: bind only what changes per step
          var nxt = 1 - cur;
          gl.bindFramebuffer(gl.FRAMEBUFFER, tex[nxt].f); gl.bindTexture(gl.TEXTURE_2D, tex[cur].t);
          gl.drawArrays(gl.TRIANGLES, 0, 3); cur = nxt;
        }
      },
      seed: function (discs, value) {
        var arr = new Float32Array(32 * 3);
        for (var i = 0; i < discs.length; i += 32) {
          var n = Math.min(32, discs.length - i);
          for (var j = 0; j < n; j++) { arr[j * 3] = discs[i + j].x; arr[j * 3 + 1] = discs[i + j].y; arr[j * 3 + 2] = discs[i + j].r; }
          gl.useProgram(P.seed); gl.uniform3fv(L.seed.uD, arr); gl.uniform1i(L.seed.uN, n); gl.uniform1f(L.seed.uVal, value);
          var nxt = 1 - cur; draw("seed", tex[nxt].f, W, H, tex[cur].t); cur = nxt;
        }
      },
      maxV: function () {
        var src = showComp && comp ? comp.t : tex[cur].t;
        draw("max", maxTex.f, maxW, maxH, src);
        gl.readPixels(0, 0, maxW, maxH, gl.RGBA, gl.FLOAT, maxBuf);
        var m = 0; for (var i = 0; i < maxBuf.length; i += 4) if (maxBuf[i] > m) m = maxBuf[i];
        return m;
      },
      render: function (lut, vmax) {
        if (lutLoaded !== lut) { gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 256, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, lut); lutLoaded = lut; }
        gl.useProgram(P.show); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, showComp && comp ? comp.t : tex[cur].t); gl.uniform1i(L.show.uS, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.uniform1i(L.show.uL, 1);
        gl.uniform1f(L.show.uVmax, vmax);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      stripBegin: function () { if (comp) { gl.deleteTexture(comp.t); gl.deleteFramebuffer(comp.f); } comp = makeTex(W, H); clearTex(comp, W, H, 1, 0); },
      copyColumns: function (x0, x1) {
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, 0, x1 - x0, H);
        draw("copy", comp.f, W, H, tex[cur].t);
        gl.disable(gl.SCISSOR_TEST);
      },
      stripEnd: function () { showComp = true; },
      showState: function () { showComp = false; },
      getV: null,
      destroy: function () { var ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); }
    };
    return be;
  }

  // ---- thumbnails (processor, small) ----------------------------------------------
  function renderThumb(preset, size) {
    var be = cpuBackend(null); be.resize(size.width, size.height, false);
    be.seed(seedDiscList(size.width, size.height, preset.seed, 11, 55), 0.5);
    be.step(preset.feed, preset.kill, 1, size.steps);
    return { V: be.getV(), W: size.width, H: size.height };
  }
  function paintArray(V, W, H, ctx, lut, vmax) {
    var img = ctx.createImageData(W, H), px = img.data, scale = 255 / vmax;
    for (var i = 0, p = 0; i < W * H; i++, p += 4) { var idx = (V[i] * scale) | 0; if (idx > 255) idx = 255; idx *= 3; px[p] = lut[idx]; px[p + 1] = lut[idx + 1]; px[p + 2] = lut[idx + 2]; px[p + 3] = 255; }
    ctx.putImageData(img, 0, 0);
  }

  // ---- the field -------------------------------------------------------------------
  function mount(canvas, options) {
    var o = {};
    for (var key in DEFAULTS) o[key] = DEFAULTS[key];
    for (var k2 in (options || {})) if (options[k2] !== undefined) o[k2] = options[k2];
    var now = o.clock || defaultClock;

    var be = (o.gpu && canvas.getContext) ? gpuBackend(canvas) : null;
    if (!be) be = cpuBackend(canvas);

    var f = o.feed, k = o.kill, gain = 1, leftAt = null, stepAcc = 0;
    var grow = null, growN = 0, growTick = 0;
    var lut = buildLut((PALETTES[o.palette] || PALETTES.canopy).colors);
    var paused = false, pointerIn = false, alive = false, rafId = 0, last = null, pending = [];
    var listeners = [];
    var frames = 0, fpsAt = 0, fps = 0, msAvg = 0, msSamples = 0, msHold = 0, lastTs = 0, dtAvg = 16.7, slowRing = new Uint8Array(30), slowCount = 0, sinceMax = 0;
    var level = 1, auto = true, capLevel = LADDER.length - 1;   // the resolution control sets a CEILING; the engine still adapts beneath it
    if (typeof o.quality === "number") { capLevel = Math.max(0, Math.min(LADDER.length - 1, o.quality)); level = Math.min(level, capLevel); }
    var aspect = measureAspect(), chronoJob = null;

    function emit(type) { for (var i = 0; i < listeners.length; i++) listeners[i](type, api); }
    function measureAspect() { var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null; return (r && r.width > 0 && r.height > 0) ? r.width / r.height : 16 / 9; }
    function dims(n) { var w = LADDER[n]; return [w, Math.max(16, Math.round(w / aspect))]; }
    function displayCap() {
      if (!canvas.getBoundingClientRect) return LADDER.length - 1;
      var devW = (canvas.getBoundingClientRect().width || 0) * (global.devicePixelRatio || 1);
      if (!devW) return LADDER.length - 1;
      var cap = 0; for (var n = 0; n < LADDER.length; n++) if (LADDER[n] <= devW) cap = n; return cap;
    }
    function setLevel(n, keep) {
      n = Math.max(0, Math.min(LADDER.length - 1, n));
      if (be.width() && n === level) return;
      level = n; var d = dims(n); be.resize(d[0], d[1], keep);
      msAvg = 0; msSamples = 0; msHold = 60; slowRing.fill(0); slowCount = 0;
      if (o.reducedMotion) chronogram(); else be.render(lut, o.vmax);
      emit("quality");
    }
    function reevaluate() { msHold = 0; msSamples = Math.min(msSamples, 10); }   // a setting changed: decide again soon
    var resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var a = measureAspect(); if (Math.abs(a / aspect - 1) < 0.02) return;
        aspect = a; var d = dims(level); be.resize(d[0], d[1], true);
        if (o.reducedMotion) chronogram(); else be.render(lut, o.vmax);
        emit("quality");
      }, 150);
    }
    if (global.addEventListener) global.addEventListener("resize", onResize);

    function reset() { be.reset(); alive = false; leftAt = null; gain = 1; grow = null; growN = 0; pending.length = 0; }
    function scaleR(r) { return r * be.width() / 320; }
    function markSeeded() { alive = true; leftAt = null; gain = 1; }
    function flushSeeds() { if (pending.length) { be.seed(pending, o.seedValue); pending.length = 0; } }
    function growStep() {
      if (!grow || ++growTick % grow.every !== 0) return;
      if (grow.type === "pacemaker") {             // the same points fire again: concentric target rings
        var pts = seedDiscList(be.width(), be.height(), grow, 3);
        for (var i = 0; i < pts.length; i++) pending.push(pts[i]);
        alive = true; return;
      }
      if (growN >= grow.n) return;
      var p = spiralPoint(be.width(), be.height(), growN++, grow.n);
      pending.push({ x: p.x, y: p.y, r: (grow.r || 3) * be.width() / 320 }); alive = true;
    }
    function updateGain(t) {
      if (pointerIn || o.fadeStart === Infinity) { leftAt = null; gain = 1; return; }
      if (leftAt === null) leftAt = t;
      var s = (t - leftAt) / 1000;
      gain = s <= o.fadeStart ? 1 : (s >= o.fadeEnd ? 0 : (function () { var x = 1 - (s - o.fadeStart) / (o.fadeEnd - o.fadeStart); return x * x * (3 - 2 * x); })());
    }

    // one frame of work, no scheduling
    function tick() {
      var t0 = now();
      updateGain(t0); growStep(); flushSeeds();
      stepAcc += o.baseSteps * o.timeScale;
      var n = Math.floor(stepAcc); stepAcc -= n;
      if (n) be.step(f, k, gain, n);
      be.render(lut, o.vmax);
      var wasAlive = alive;
      if (++sinceMax >= (be.kind === "gpu" ? 10 : 1)) { sinceMax = 0; alive = be.maxV() >= o.aliveThreshold || pending.length > 0; }
      if (!alive && wasAlive) { be.reset(); be.render(lut, o.vmax); leftAt = null; gain = 1; }
      var ms = now() - t0;
      msSamples++; msAvg += (ms - msAvg) / Math.min(msSamples, 30);
      var slot = msSamples % 30, wasSlow = slowRing[slot], isSlow = (ms > 16 || dtAvg > 24) ? 1 : 0;
      slowRing[slot] = isSlow; slowCount += isSlow - wasSlow;
      if (auto && msHold > 0) msHold--;
      else if (auto && msSamples >= 30) {
        var tooSlow = msAvg > o.ceilingMs || slowCount >= 2 || dtAvg > 24, top = Math.min(capLevel, displayCap());
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
      if (alive || pointerIn || pending.length) rafId = global.requestAnimationFrame(frame);
      else { lastTs = 0; if (r.wasAlive) emit("quiet"); }
    }
    function wake() { if (global.requestAnimationFrame && !rafId && !paused && !o.reducedMotion) rafId = global.requestAnimationFrame(frame); }

    // the reduced-motion chronogram: time runs continuously across the width — column x shows the
    // field at step T·x/W — from a dense, even seeding, so the still is the development from seed
    // (left edge) to the regime at full strength (right edge) with no seams
    function chronogram(spec) {
      if (chronoJob) { clearTimeout(chronoJob); chronoJob = null; }
      var W = be.width(), H = be.height();
      spec = spec || chronoSpec || { type: "spiral", n: 21, r: 3 };
      var T = spec.chrono || o.chronoSteps, per = Math.max(1, Math.floor(T / W)), ops = Math.ceil(T / per);
      be.reset(); be.seed(latticeSeedList(W, H, spec), o.seedValue);
      be.stripBegin();
      emit("busy");
      var i = 0;
      function op() {                                    // one op: `per` steps, then copy the columns whose time this is
        var x0 = Math.floor(W * i / ops), x1 = i === ops - 1 ? W : Math.floor(W * (i + 1) / ops);
        if (i) be.step(f, k, 1, per);
        if (x1 > x0) be.copyColumns(x0, x1);
        i++;
      }
      if (be.kind === "gpu") {
        while (i < ops) op();
        be.stripEnd(); be.render(lut, o.vmax); alive = true; emit("still"); return;
      }
      (function slice() {                                // processor path: a few ops per slice, the page stays responsive
        var budget = 12; while (i < ops && budget--) op();
        if (i < ops) chronoJob = setTimeout(slice, 0);
        else { be.stripEnd(); be.render(lut, o.vmax); alive = true; chronoJob = null; emit("still"); }
      })();
    }
    var chronoSpec = null;

    // ---- pointer: hover alone disturbs the field ----
    function gridPoint(e) { var rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) / rect.width * be.width(), y: (e.clientY - rect.top) / rect.height * be.height() }; }
    function onEnter() { pointerIn = true; last = null; wake(); }
    function onLeave() { pointerIn = false; last = null; }
    function onMove(e) {
      if (o.reducedMotion) return;
      pointerIn = true;
      var p = gridPoint(e), W = be.width(), speed = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
      var r = scaleR(Math.min(o.seedRadiusMax, o.seedRadius + o.seedSpeedGain * speed * 320 / W));
      if (last && speed > r) { var n = Math.ceil(speed / r); for (var i = 1; i <= n; i++) pending.push({ x: last.x + (p.x - last.x) * i / n, y: last.y + (p.y - last.y) * i / n, r: r }); }
      else pending.push({ x: p.x, y: p.y, r: r });
      markSeeded(); last = p; wake();
    }
    if (canvas.addEventListener) { canvas.addEventListener("pointerenter", onEnter); canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("pointermove", onMove); }

    var api = {
      canvas: canvas, presets: PRESETS, palettes: PALETTES, ladder: LADDER,
      backend: function () { return be.kind; },
      getParams: function () { return { feed: f, kill: k, timeScale: o.timeScale }; },
      setParams: function (feed, kill) {
        if (typeof feed === "number" && !isNaN(feed)) f = feed;
        if (typeof kill === "number" && !isNaN(kill)) k = kill;
        reevaluate(); if (o.reducedMotion) chronogram(); emit("params"); return api;
      },
      setFeed: function (v) { return api.setParams(v); },
      setKill: function (v) { return api.setParams(undefined, v); },
      setTimeScale: function (s) { if (typeof s === "number" && !isNaN(s)) o.timeScale = Math.max(0.1, s); reevaluate(); emit("params"); return api; },
      setFade: function (start, end) { o.fadeStart = start; o.fadeEnd = end; return api; },
      setPalette: function (nameOrColors) {
        var colors = typeof nameOrColors === "string" ? (PALETTES[nameOrColors] || PALETTES.canopy).colors : nameOrColors;
        lut = buildLut(colors); be.render(lut, o.vmax); emit("palette"); return api;
      },
      lut: function () { return lut; },
      setSteps: function (n) { o.baseSteps = Math.max(1, n | 0); reevaluate(); return api; },
      setQuality: function (q) {   // "auto" = up to the display; a number = up to that rung; the engine adapts beneath either
        capLevel = q === "auto" ? LADDER.length - 1 : Math.max(0, Math.min(LADDER.length - 1, parseInt(q, 10)));
        if (level > capLevel) setLevel(capLevel, true);
        reevaluate(); emit("quality"); return api;
      },
      quality: function () { return { auto: auto, cap: capLevel, level: level, width: be.width(), height: be.height(), ms: msAvg, fps: fps, steps: o.baseSteps * o.timeScale, backend: be.kind }; },
      pause: function () { paused = true; if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } emit("pause"); return api; },
      play: function () { paused = false; wake(); emit("play"); return api; },
      isPaused: function () { return paused; }, isAlive: function () { return alive; },
      clear: function () { reset(); if (o.reducedMotion) chronogram(); else be.render(lut, o.vmax); emit("clear"); return api; },
      seed: function (x, y, r) { if (o.reducedMotion) { chronogram(); return api; } pending.push({ x: x, y: y, r: r || scaleR(o.seedRadius) }); markSeeded(); wake(); return api; },
      seedSpec: function (spec, salt) {
        chronoSpec = spec;
        if (o.reducedMotion) { chronogram(spec); emit("seed"); return api; }
        var list = seedDiscList(be.width(), be.height(), spec, salt);
        for (var i = 0; i < list.length; i++) pending.push(list[i]);
        if (spec.type === "grow" || spec.type === "pacemaker") { grow = spec; growN = 3; growTick = 0; } else grow = null;
        markSeeded(); wake(); emit("seed"); return api;
      },
      seedRandom: function (count, salt) { return api.seedSpec({ type: "discs", n: count || 9, r: 3 }, salt); },
      still: function (spec) { chronogram(spec); return api; },
      setReducedMotion: function (on) {
        o.reducedMotion = !!on;
        if (on) { if (rafId) { global.cancelAnimationFrame(rafId); rafId = 0; } chronogram(); }
        else { be.showState(); reset(); be.render(lut, o.vmax); }
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
        if (canvas.removeEventListener) { canvas.removeEventListener("pointerenter", onEnter); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("pointermove", onMove); }
        be.destroy(); listeners.length = 0;
      }
    };

    if (Array.isArray(o.quality)) { auto = false; be.resize(o.quality[0], o.quality[1], false); }   // a fixed grid: tests and offline rendering
    else { var d0 = dims(level); be.resize(d0[0], d0[1], false); }
    reset();
    if (o.reducedMotion) chronogram(); else be.render(lut, o.vmax);
    return api;
  }

  // ---- declarative controls --------------------------------------------------------
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
    var colorsToggle = $(scope, "colors-toggle"), colorsMenu = $(scope, "colors-menu"), paletteRadios = $$(scope, "palette-option");
    var motionBtn = $(scope, "motion"), motionCheck = $(scope, "motion-check"), quality = $(scope, "quality"), measure = $(scope, "measure"), stateLine = $(scope, "state");
    var modeWord = $(scope, "mode"), loading = $(scope, "loading");
    var status = $(scope, "status"), steps = $(scope, "steps");
    var current = null, currentPalette = null, thumbs = [], seedClicks = 0;

    function say(text) { if (status) status.textContent = text; }
    function paramsText() { var p = field.getParams(); return "feed " + fmt(p.feed) + ", kill " + fmt(p.kill) + ", time scale " + fmt2(p.timeScale); }
    function currentName() { return current ? current.name : "custom"; }
    function updateState() {
      if (!stateLine) return;
      stateLine.textContent = (current ? current.name + " pattern" : "Custom settings") + " · " + (currentPalette || "Canopy") + " colors · " +
        (field.reducedMotion() ? "Reduced motion on: one still frame, seed at the left, full emergence at the right" : (field.isPaused() ? "paused" : "animating"));
    }
    function syncInputs() {
      var p = field.getParams();
      if (feedRange) feedRange.value = fmt(p.feed); if (feedNumber) feedNumber.value = fmt(p.feed);
      if (killRange) killRange.value = fmt(p.kill); if (killNumber) killNumber.value = fmt(p.kill);
      if (scaleRange) scaleRange.value = fmt2(p.timeScale); if (scaleNumber) scaleNumber.value = fmt2(p.timeScale);
    }
    function markPreset(preset) {
      current = preset;
      for (var i = 0; i < presets.length; i++) presets[i].setAttribute("aria-pressed", preset && presets[i].getAttribute("data-rd-id") === preset.id ? "true" : "false");
      for (var j = 0; j < notes.length; j++) notes[j].hidden = !(preset && notes[j].getAttribute("data-rd-for") === preset.id);
      if (modeWord) modeWord.textContent = preset ? preset.name.toUpperCase() : "CUSTOM";
      updateState();
    }
    function applyPreset(preset, seed) {
      field.setParams(preset.feed, preset.kill); markPreset(preset); syncInputs();
      if (seed) { field.clear(); seedClicks = 0; var spec = {}; for (var kk in preset.seed) spec[kk] = preset.seed[kk]; spec.chrono = preset.chrono; field.seedSpec(spec, 11); if (field.isPaused()) field.play(); setPauseState(true);
        say(preset.name + " pattern: " + paramsText() + ". " + (field.reducedMotion() ? "Still image." : "Animating.")); }
    }
    for (var i = 0; i < presets.length; i++) (function (btn) {
      var preset = presetById(btn.getAttribute("data-rd-id")) || { id: btn.getAttribute("data-rd-id"), name: btn.getAttribute("data-rd-name") || btn.textContent.trim(), feed: parseFloat(btn.getAttribute("data-rd-feed")), kill: parseFloat(btn.getAttribute("data-rd-kill")), seed: { type: "spiral", n: 21, r: 3 } };
      btn.addEventListener("click", function () { applyPreset(preset, true); });
      var thumb = btn.querySelector("[data-rd='thumb']");
      if (thumb && thumb.getContext) thumbs.push({ preset: preset, canvas: thumb, data: null });
    })(presets[i]);

    function paintThumbs() { var lut = field.lut(); for (var t = 0; t < thumbs.length; t++) { var th = thumbs[t]; if (th.data) paintArray(th.data.V, th.data.W, th.data.H, th.canvas.getContext("2d", { alpha: false }), lut, 0.4); } }
    (function renderThumbsLazily() {
      var i = 0, size = field.thumbSize();
      function next() {
        if (i >= thumbs.length) return;
        var th = thumbs[i++]; th.canvas.width = size.width; th.canvas.height = size.height; th.data = renderThumb(th.preset, size); paintThumbs();
        (global.requestIdleCallback || function (fn) { setTimeout(fn, 16); })(next);
      }
      if (thumbs.length) next();
    })();

    function onParam(which, el) {
      var v = parseFloat(el.value); if (isNaN(v)) return;
      if (which === "feed") field.setFeed(v); else if (which === "kill") field.setKill(v); else field.setTimeScale(v);
      if (which !== "scale") markPreset(null); else updateState();
      syncInputs();
      say((which === "scale" ? currentName() + " pattern" : "Custom") + ": " + paramsText() + "." + (field.isAlive() ? "" : " The field is quiet; hover it, seed it, or choose a pattern."));
    }
    if (feedRange) feedRange.addEventListener("input", function () { onParam("feed", feedRange); });
    if (feedNumber) feedNumber.addEventListener("change", function () { onParam("feed", feedNumber); });
    if (killRange) killRange.addEventListener("input", function () { onParam("kill", killRange); });
    if (killNumber) killNumber.addEventListener("change", function () { onParam("kill", killNumber); });
    if (scaleRange) scaleRange.addEventListener("input", function () { onParam("scale", scaleRange); });
    if (scaleNumber) scaleNumber.addEventListener("change", function () { onParam("scale", scaleNumber); });

    function setPauseState(playing) { if (!pauseBtn) return; pauseBtn.textContent = playing ? "⏸ PAUSE" : "▶ PLAY"; pauseBtn.setAttribute("aria-label", playing ? "Pause the field" : "Play the field"); updateState(); }
    if (pauseBtn) { setPauseState(true); pauseBtn.addEventListener("click", function () { if (field.isPaused()) { field.play(); setPauseState(true); say("Playing."); } else { field.pause(); setPauseState(false); say("Paused."); } }); }
    if (resetBtn) resetBtn.addEventListener("click", function () { field.clear(); seedClicks = 0; say("Field reset to black."); });
    if (seedBtn) seedBtn.addEventListener("click", function () {
      var q = field.quality(), first = seedClicks === 0;
      field.seed(first ? q.width / 2 : Math.random() * q.width, first ? q.height / 2 : Math.random() * q.height, 4 * q.width / 320);
      seedClicks++; if (field.isPaused()) { field.play(); setPauseState(true); }
      say("Seeded one point" + (first ? " at the centre" : "") + ": " + currentName() + ", " + paramsText() + ".");
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

    function setMotionState() {
      var on = field.reducedMotion();
      if (motionBtn) motionBtn.setAttribute("aria-pressed", on ? "true" : "false");
      if (motionCheck) motionCheck.checked = on;
      updateState();
    }
    function toggleMotion() {
      var on = !field.reducedMotion(); field.setReducedMotion(on); setMotionState();
      say(on ? "Reduced motion on: one still frame, seed at the left, full emergence at the right." : "Reduced motion off: animating.");
    }
    if (motionBtn) motionBtn.addEventListener("click", toggleMotion);
    if (motionCheck) motionCheck.addEventListener("change", function () { if (motionCheck.checked !== field.reducedMotion()) toggleMotion(); });
    if (quality) quality.addEventListener("change", function () { field.setQuality(quality.value); });
    if (steps) steps.addEventListener("change", function () { field.setSteps(parseInt(steps.value, 10)); });
    if (measure) (function readout() {
      var q = field.quality();
      measure.textContent = q.width + " × " + q.height + " · " + (field.reducedMotion() ? "still" : (field.isAlive() ? Math.round(q.fps) + " fps" : "idle")) + " · " + (q.backend === "gpu" ? "graphics processor" : "processor");
      setTimeout(readout, 500);
    })();

    field.on(function (type) {
      if (type === "quiet") say("The pattern has faded; the field is quiet.");
      if (type === "motion") setMotionState();
      if (type === "clear") seedClicks = 0;
      if (loading && type === "busy") loading.hidden = false;
      if (loading && (type === "still" || type === "motion" && !field.reducedMotion())) loading.hidden = true;
    });

    var initial = null;
    for (var n = 0; n < presets.length; n++) if (presets[n].hasAttribute("data-rd-default")) initial = presetById(presets[n].getAttribute("data-rd-id"));
    if (initial) applyPreset(initial, false); else syncInputs();
    setMotionState();
    say((initial ? initial.name + " pattern: " : "") + paramsText() + ". The field is black until it is disturbed.");
  }

  var registry = [];
  function auto(root) {
    root = root || global.document;
    var mq = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var canvases = root.querySelectorAll("canvas[data-reaction-diffusion]");
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i]; if (get(c)) continue; var d = c.dataset;
      var field = mount(c, {
        feed: d.feed !== undefined ? parseFloat(d.feed) : undefined, kill: d.kill !== undefined ? parseFloat(d.kill) : undefined,
        timeScale: d.timeScale !== undefined ? parseFloat(d.timeScale) : undefined,
        fadeStart: d.fadeStart !== undefined ? parseFloat(d.fadeStart) : undefined, fadeEnd: d.fadeEnd !== undefined ? parseFloat(d.fadeEnd) : undefined,
        palette: d.palette, baseSteps: d.steps !== undefined ? parseInt(d.steps, 10) : undefined,
        quality: d.quality !== undefined && d.quality !== "auto" ? parseInt(d.quality, 10) : "auto",
        gpu: d.gpu !== "off", reducedMotion: mq ? mq.matches : false
      });
      registry.push({ canvas: c, field: field });
      var scope = c.closest ? c.closest("[data-rd-scope]") : null; if (scope) bind(scope, field);
      if (mq) (function (fld) { var h = function (ev) { fld.setReducedMotion(ev.matches); }; if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h); })(field);
    }
  }
  function get(canvas) { for (var i = 0; i < registry.length; i++) if (registry[i].canvas === canvas) return registry[i].field; return null; }

  global.ReactionDiffusion = { mount: mount, bind: bind, auto: auto, get: get, presets: PRESETS, palettes: PALETTES, ladder: LADDER, buildLut: buildLut, renderThumb: renderThumb, seedDiscList: seedDiscList, version: "1.0.0" };
  if (global.document && global.document.querySelectorAll) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { auto(); }); else auto(); }
})(typeof window !== "undefined" ? window : this);
