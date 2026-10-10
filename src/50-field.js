
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
    pearlMs: 1000,               // crystal fields: the time between two nuclei dropped by a stroke
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
    var paused = false, pointerIn = false, alive = false, rafId = 0, last = null, pearlAt = null, pearlT = 0, pending = [], pendingErase = [];
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
    // a hexagonal lattice on the ladder is shown on the canvas's own pixels (the backend interpolates); on Automatic its
    // lattice IS the canvas's pixels, one cell per pixel, and the explicit rungs are coarser lattices: bigger features
    function hexLadder() { return model.lattice === "hex" && model.grid === "ladder" && !fixed; }
    function deviceDims() { var w = devWidth() || 400, cap = be.kind === "gpu" ? o.pixelCap : o.cpuPixelCap; w = clamp(w, 320, cap); return [w, Math.max(16, Math.round(w / aspect))]; }
    function gridDims() {
      if (fixed) return fixed;
      if (model.grid === "pixels" || (hexLadder() && qualityAuto)) return deviceDims();
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
      var d = gridDims(), cv = hexLadder() ? deviceDims() : null;
      be.resize(d[0], d[1], keep, cv && cv[0], cv && cv[1]); pushContext();
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
        var a = measureAspect(), pix = (model.grid === "pixels" || hexLadder()) && !fixed;
        if (!pix && Math.abs(a / aspect - 1) < 0.02) return;
        aspect = a; regrid(!pix);
        if (o.reducedMotion) chronogram(); else be.render(lut);
        emit("quality");
      }, 150);
    }
    if (global.addEventListener) global.addEventListener("resize", onResize);

    function reset() {
      if (model.randomize) { model.randomize(P, Math.random); be.setParams(P); }   // a model may draw fresh randomness for every clear (a crystal's orientation)
      be.reset(); alive = false; leftAt = null; gain = 1; grow = null; growN = 0; stir = null; marked = false; pending.length = 0; pendingErase.length = 0;
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
    var NUCLEUS_R = 0.6;         // a crystal's seed: the one lattice cell under the point (a hexagonal cell's centre is never farther than 0.58 away)
    function brushR() { return Math.max(1, o.brush * be.height() / 2); }   // the mark's radius in pixels
    function markSeeded() { alive = true; leftAt = null; gain = 1; marked = true; }
    function flushSeeds() {
      if (pendingErase.length) { be.seed(pendingErase, -1); pendingErase.length = 0; }   // the eraser lane first, so a pearl dropped inside it survives
      if (pending.length) { be.seed(pending, o.seedValue); pending.length = 0; }
    }
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
      else if (auto && qualityAuto && msSamples >= 30 && model.grid === "ladder" && !fixed && !hexLadder()) {   // the ladder adapts only on Automatic; a chosen rung is the grid; a hexagonal lattice on Automatic is the screen's pixels
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
      if (model.crystal) {
        // the brush on a crystal field (owner 2026-10-09): a VOID — the brush wipes ice back to vapour along the stroke — with a
        // single PINPOINT NUCLEUS at its centre, one cell, dropped when the stroke begins and then once every `pearlMs` while it
        // continues, whatever the brush size: "the nucleus of a hydrogen atom". Never a string, never a disc of ice. The crystals
        // are permanent and grow together where they meet.
        var rs = brushR(), tNow = now();
        if (last) { var dd = Math.hypot(p.x - last.x, p.y - last.y), m = Math.max(1, Math.ceil(dd / Math.max(1, rs * 0.5))); for (var j2 = 1; j2 <= m; j2++) pendingErase.push({ x: last.x + (p.x - last.x) * j2 / m, y: last.y + (p.y - last.y) * j2 / m, r: rs }); }
        else pendingErase.push({ x: p.x, y: p.y, r: rs });
        if (!pearlAt || tNow - pearlT >= o.pearlMs) { pending.push({ x: p.x, y: p.y, r: NUCLEUS_R }); pearlAt = p; pearlT = tNow; }
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
        if (hexLadder()) { if (!qualityAuto) level = Math.min(capLevel, topRung()); regrid(true); if (o.reducedMotion) chronogram(); else be.render(lut); }   // Automatic ↔ a rung always changes a hexagonal lattice's grid
        else if (model.grid === "ladder" && !fixed) { if (!qualityAuto) setLevel(Math.min(capLevel, topRung()), true); else if (level > topRung()) setLevel(topRung(), true); }
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
        pending.push({ x: x, y: y, r: r || (model.crystal ? NUCLEUS_R : brushR()) }); markSeeded(); wake(); return api;
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
