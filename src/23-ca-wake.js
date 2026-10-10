
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
      // owner 2026-10-10: flow 0.130 and viscosity 0.005 are the defaults and sit at the centre of their tracks. Fixed ranges,
      // because the lattice-Boltzmann method is only stable for a flow below about 0.16 and a relaxation time τ = 3ν + ½ above ½
      { key: "flow", label: "Flow", min: 0.10, max: 0.16, step: 0.005, def: 0.130, fixedRange: true },
      { key: "viscosity", label: "Viscosity", min: 0.004, max: 0.006, step: 0.0005, def: 0.005, fixedRange: true }
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
