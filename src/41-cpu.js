
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
    function alloc(w, h, keep, cw, ch) {
      var old = keep ? st : null, oW = W, oH = H;
      CW = cw || w; CH = ch || h; W = w; H = hex ? hexRows(h) : h;
      st = state(W, H); fill(st, model.init(curP));
      if (old) resample(old, oW, oH);
      disp = new Float32Array(CW * CH); comp = null; showComp = false;
      if (canvas) { canvas.width = CW; canvas.height = CH; }
      if (ctx) { image = ctx.createImageData(CW, CH); px = image.data; }
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
      resize: function (w, h, keep, cw, ch) { alloc(w, h, keep && model.grid !== "pixels" && st, cw, ch); },
      latticeScale: function () { return CW ? W / CW : 1; },
      reseed: function (n) { X.rnd = mulberry32(n | 0); if (st) st.rnd = X.rnd; },   // a fresh random stream (every recorded run its own)
      reset: function () { fill(st, model.init(curP)); comp = null; showComp = false; if (glowP) glowP.fill(0); },
      step: function (n) { var per = model.stepsPerUnit || 1; for (var s = 0; s < n * per; s++) { stepIndex++; X.step = stepIndex; model.cpu.step(st, 1, curP, X); } },
      seed: function (discs, value) {                 // discs in canvas pixels → lattice units (see the graphics backend)
        var sc = W / CW, list = discs;
        if (sc !== 1) { list = []; for (var i = 0; i < discs.length; i++) { var rl = discs[i].r * sc; if (hex && rl < 0.6) rl = 0.6; list.push({ x: discs[i].x * sc, y: discs[i].y * sc, r: rl }); } }
        model.cpu.seed(st, list, value, X);
      },
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
