
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
