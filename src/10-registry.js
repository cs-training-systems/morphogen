
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
