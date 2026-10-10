
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
    id: "rotor", family: "ca", name: "Cyclic automaton", lattice: "square", channels: 2, grid: "ladder", keeps: true, glow: { blur: 2.2, decay: 0.94 },
    source: "R. Fisch, J. Gravner and D. Griffeath, Statistics and Computing 1 (1991) 23–39",
    params: [
      // the owner's centres and ranges (2026-10-09): 5 states at threshold 3; a half-step threshold means "at least the
      // next whole number of neighbours" (measured on the eight-neighbour lattice: threshold 1 fixates or locks the whole field)
      { key: "states", label: "States", min: 3, max: 7, step: 1, def: 5 },
      { key: "threshold", label: "Threshold", min: 1.5, max: 2.5, step: 0.5, def: 2, fixedRange: true }   // owner 2026-10-10: 2.0 at the centre
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
    id: "lichtenberg", family: "ca", name: "Dielectric breakdown", lattice: "square", channels: 4, grid: "ladder", keeps: true, glow: { blur: 1.6, decay: 0.985 },
    source: "L. Niemeyer, L. Pietronero and H. J. Wiesmann, Phys. Rev. Lett. 52 (1984) 1033–1036",
    params: [
      { key: "eta", label: "Exponent", min: 1.0, max: 6.0, step: 0.1, def: 2.1 },     // owner's centre points, 2026-10-09
      { key: "rate", label: "Rate", min: 0.1, max: 4.0, step: 0.1, def: 1.3 }
    ],
    // sweeps: the Jacobi relaxations of the potential per step on the graphics path (3, the demo's look). OPEN FINDING
    // (2026-10-10, measured at 480 × 269 over 840 steps from a centred seed): the two paths do not agree at equal sweeps —
    // graphics 1/3/8 sweeps grew 11,427 / 2,170 / 4,414 cells, the processor path 129,594 / 16,719 / 497 — and the cause was
    // not found by reading. `sweepsCpu` 4 is the processor count that reproduces the graphics path's growth (1,892 cells), a
    // calibrated equivalence used by the recorder and the fallback, not an explanation. Next session: find the divergence.
    extra: { sweeps: 3, sweepsCpu: 4 },
    init: function () { return [[1, 0, 0, 1]]; },
    gpu: {
      passes: [
        { repeat: function (P) { return P.sweeps; }, fs:
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
        var W = st.W, H = st.H, F = st.p[0][0], G = st.p[0][1], F2 = st.aux[0], G0 = st.aux[1], rnd = st.rnd, eta = P.eta, rate = P.rate, sweeps = P.sweepsCpu || P.sweeps || 3;
        for (var s = 0; s < n; s++) {
          for (var it = 0; it < sweeps; it++) {
            for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
              var i = y * W + x;
              if (G[i] > 0) { F2[i] = 0; continue; }
              if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { F2[i] = 1; continue; }
              F2[i] = 0.25 * (F[i + 1] + F[i - 1] + F[i + W] + F[i - W]);
            }
            F.set(F2);
          }
          // the growth sweep reads a SNAPSHOT of the discharge (G0), as the graphics path reads the previous state: a cell
          // that breaks down in this sweep must not make its right and lower neighbours eligible in the same sweep, or the
          // discharge cascades into a solid block toward the far corner (the defect ADR 0292 §4 recorded; fixed here, 2026-10-10)
          G0.set(G);
          for (var y2 = 1; y2 < H - 1; y2++) for (var x2 = 1; x2 < W - 1; x2++) {
            var j = y2 * W + x2; if (G0[j] > 0) continue;
            if ((G0[j + 1] > 0 || G0[j - 1] > 0 || G0[j + W] > 0 || G0[j - W] > 0) && rnd() < rate * Math.pow(Math.max(F[j], 0), eta)) { G[j] = X.step; F[j] = 0; }
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
    id: "sandpile", family: "ca", name: "Abelian sandpile", lattice: "square", channels: 2, grid: "ladder", stepsPerUnit: 8, keeps: true, glow: { blur: 1.3, decay: 0.9 },
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
    id: "sand", family: "ca", name: "Falling sand", lattice: "square", channels: 2, grid: "ladder", stepsPerUnit: 2, keeps: true, glow: { blur: 1.2, decay: 0.9 },
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
    id: "conus", family: "ca", name: "Elementary automaton", lattice: "square", channels: 2, grid: "ladder", keeps: true, seedAll: true, glow: { blur: 1.0, decay: 0 },   // its history is its own trail: blur only
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
    id: "wildfire", family: "ca", name: "Forest fire", lattice: "square", channels: 2, grid: "ladder", keeps: true, glow: { blur: 1.6, decay: 0.96 },
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
    id: "grain", family: "ca", name: "Potts grain growth", lattice: "square", channels: 2, grid: "ladder", keeps: true, glow: { blur: 1.6, decay: 0.85 },
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
