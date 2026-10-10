
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
      // the seed carries a few per cent of random variation (no real seed is uniform), so a centred seed on a symmetric
      // stencil does not grow a mirror-symmetric pattern (owner 2026-10-10: a recorded Turbulence run read as mirrored)
      seed: "c.g=max(c.g,uVal*(0.94+0.12*hash(p,uQ.w)));",
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
            var dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r2) { var i = y * W + x, v = value * (0.94 + 0.12 * st.rnd()); if (V[i] < v) V[i] = v; }
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

  // ---- the complex Ginzburg–Landau equation --------------------------------------------------------------
  // I. S. Aranson and L. Kramer, Rev. Mod. Phys. 74 (2002) 99–143 (read at source 2026-10-09), the normal form of
  // every reaction–diffusion system just past the onset of oscillation: one complex amplitude A = u + iv,
  //   ∂A/∂t = A + (1 + iα) ∇²A − (1 + iβ) |A|² A
  // with α the linear and β the nonlinear dispersion (Aranson & Kramer write b and c; the keys below keep those letters).
  // Plane waves are stable while 1 + αβ > 0 (Benjamin–Feir–Newell);
  // past that line the field falls into phase and defect turbulence. A phase singularity is a spiral wave, a source
  // whose waves travel outward; near onset, with b > c, the phase velocity turns inward and the spiral is an ANTISPIRAL
  // (S. Nicola, L. Brusch, M. Bär, 2004: antispirals when c1 + c3 > 0 in their convention). The field is zero until
  // seeded; a disc of random phase invades the dark field as a front and its singularities spin up into rotors.
  // Explicit Euler on the isotropic 9-point Laplacian at spacing dx and step dt (stable for |b| ≤ 2 at dt 0.03, dx 0.6).
  defineModel({
    id: "cgl", family: "rd", name: "Complex Ginzburg–Landau", lattice: "square", channels: 2, grid: "ladder", keeps: true,
    source: "I. S. Aranson and L. Kramer, Rev. Mod. Phys. 74 (2002) 99–143; S. Nicola, L. Brusch and M. Bär, J. Phys. Chem. B 108 (2004)",
    params: [
      // owner 2026-10-10: α 1.75 and β −0.65 are the defaults, each at the centre of a fixed track one unit each way; the
      // sliders carry the equation's own letters (α on the diffusion term, β on the nonlinear term; Aranson & Kramer's b and c)
      { key: "b", label: "α", min: 0.75, max: 2.75, step: 0.05, def: 1.75, fixedRange: true },
      { key: "c", label: "β", min: -1.65, max: 0.35, step: 0.05, def: -0.65, fixedRange: true }
    ],
    extra: { dx: 0.6, dt: 0.03 },
    init: function () { return [[0, 0, 0, 1]]; },
    gpu: {
      passes: [{ fs:
        "void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec2 a=S(p).rg;float b=uP.x,c=uP.y,dx=uP.z,dt=uP.w;" +
        "vec2 e=S(p+ivec2(1,0)).rg,w=S(p+ivec2(-1,0)).rg,n=S(p+ivec2(0,1)).rg,so=S(p+ivec2(0,-1)).rg,ne=S(p+ivec2(1,1)).rg,nw=S(p+ivec2(-1,1)).rg,se=S(p+ivec2(1,-1)).rg,sw=S(p+ivec2(-1,-1)).rg;" +
        "vec2 l=(4.0*(e+w+n+so)+(ne+nw+se+sw)-20.0*a)/(6.0*dx*dx);float m2=dot(a,a);" +
        "vec2 dif=vec2(l.x-b*l.y,l.y+b*l.x);vec2 nl=m2*vec2(a.x-c*a.y,a.y+c*a.x);" +
        "o0=vec4(a+dt*(a+dif-nl),0.0,1.0);}" }],
      // a disc of random phase at a modest amplitude; the brush does the same
      seed: "float ph=hash(p+ivec2(17,31),uQ.w)*6.2831853;float am=0.6*uVal;c.rg=vec2(am*cos(ph),am*sin(ph));",
      // the real part over the amplitude: black where the field is quiet, dark at a spiral's core, the ramp along the wave
      display: "float display(vec4 c,ivec2 p){float m=length(c.rg);return 0.5*VMAX*max(m+c.r,0.0);}",
      alive: "bool alive(vec4 c,ivec2 p){return dot(c.rg,c.rg)>1e-4;}"
    },
    cpu: {
      step: function (st, n, P) {
        var W = st.W, H = st.H, U = st.p[0][0], V = st.p[0][1], U2 = st.aux[0], V2 = st.aux[1], b = P.b, c = P.c, k = 1 / (6 * P.dx * P.dx), dt = P.dt;
        for (var s = 0; s < n; s++) {
          for (var y = 0; y < H; y++) {
            var y0 = y * W, ym = (y > 0 ? y - 1 : y) * W, yp = (y < H - 1 ? y + 1 : y) * W;
            for (var x = 0; x < W; x++) {
              var xm = x > 0 ? x - 1 : x, xp = x < W - 1 ? x + 1 : x, i = y0 + x, u = U[i], v = V[i];
              var lu = (4 * (U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x]) + (U[ym + xm] + U[ym + xp] + U[yp + xm] + U[yp + xp]) - 20 * u) * k;
              var lv = (4 * (V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x]) + (V[ym + xm] + V[ym + xp] + V[yp + xm] + V[yp + xp]) - 20 * v) * k;
              var m2 = u * u + v * v;
              U2[i] = u + dt * (u + (lu - b * lv) - m2 * (u - c * v));
              V2[i] = v + dt * (v + (lv + b * lu) - m2 * (v + c * u));
            }
          }
          var t = U; U = U2; U2 = t; t = V; V = V2; V2 = t;
        }
        st.p[0][0] = U; st.p[0][1] = V; st.aux[0] = U2; st.aux[1] = V2;
      },
      seed: function (st, discs, value) { discSeed(st, discs, function (i) { var ph = st.rnd() * 2 * Math.PI, am = 0.6 * value; st.p[0][0][i] = am * Math.cos(ph); st.p[0][1][i] = am * Math.sin(ph); }); },
      display: function (st, i) { var u = st.p[0][0][i], v = st.p[0][1][i]; return 0.5 * VMAX * Math.max(Math.hypot(u, v) + u, 0); },
      alive: function (st) { var U = st.p[0][0], V = st.p[0][1], n = 0; for (var i = 0; i < st.N; i++) if (U[i] * U[i] + V[i] * V[i] > 1e-4) n++; return n; }
    }
  });
