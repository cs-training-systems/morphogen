
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
