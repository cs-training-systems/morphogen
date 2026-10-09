
  // ---- the families and their presets ------------------------------------------------------------------------
  // A preset: { id, family, name, model, params (overrides), seed, firstSeed, palette, brush, timeScale,
  //   stepScale, dscale, chrono, thumbSeed, thumbSteps, thumbScale, thumbStir }.
  // firstSeed "spec": the first Seed press (or the first mark on the field) runs the preset's own seeding from
  // that point; every later press places one random point, as on every pattern (owner ruling 2026-10-09). A tile
  // itself only selects; the field stays black until the visitor acts.
  var FAMILIES = [
    { id: "rd", name: "Reaction–diffusion" },
    { id: "ca", name: "Cellular automata" }
  ];
  var PRESETS = [
    // —— reaction–diffusion: Gray–Scott in eight regimes, and the phase-field dendrite ——
    // the owner's defaults of 2026-10-09: palette, rates, speed (timeScale) and brush per pattern; each slider is
    // centred on these (the binding tailors the ranges), so every pattern starts mid-range
    { id: "malachite",   family: "rd", name: "Malachite",   model: "gray-scott", palette: "canopy",   params: { feed: 0.008, kill: 0.031 }, timeScale: 0.04, brush: 0.02, seed: { type: "pacemaker", n: 1, r: 3, every: 75 }, firstSeed: "spec", chrono: 420 },
    { id: "meandric",    family: "rd", name: "Meandric",    model: "gray-scott", palette: "physarum", params: { feed: 0.024, kill: 0.054 }, timeScale: 0.04, brush: 0.02, seed: { type: "spiral", n: 21, r: 3 }, chrono: 2400 },
    { id: "swarm",       family: "rd", name: "Swarm",       model: "gray-scott", palette: "neon",     params: { feed: 0.013, kill: 0.054 }, timeScale: 2.6,  brush: 0.05, seed: { type: "spiral", n: 21, r: 3 }, chrono: 1800 },
    { id: "xylem",       family: "rd", name: "Xylem",       model: "gray-scott", palette: "coastal",  params: { feed: 0.039, kill: 0.058 }, timeScale: 0.04, brush: 0.04, seed: { type: "spiral", n: 13, r: 4 }, chrono: 2400 },
    // Frost in this family is the phase-field dendrite: a reaction–diffusion system (Allen–Cahn plus heat)
    { id: "frost",       family: "rd", name: "Frost",       model: "dendrite",   params: {}, palette: "cherenkov", timeScale: 0.3, seed: { type: "center", r: 2 }, firstSeed: "spec", thumbSeed: { type: "spiral", n: 3, r: 1.5, spread: 0.75 }, thumbSteps: 5000, thumbScale: 4, chrono: 1600, brush: 0.004 },
    { id: "turbulence",  family: "rd", name: "Turbulence",  model: "gray-scott", palette: "accretion", params: { feed: 0.025, kill: 0.050 }, timeScale: 1.0, brush: 0.05, seed: { type: "discs", n: 7, r: 4 }, chrono: 1800 },
    { id: "mitosis",     family: "rd", name: "Mitosis",     model: "gray-scott", palette: "spectrum",  params: { feed: 0.036, kill: 0.065 }, timeScale: 2.6, brush: 0.02, quality: 240, seed: { type: "spiral", n: 8, r: 3 }, chrono: 2400 },
    // Phyllotaxis: `n` sets the head's spacing (144 spots fill the inscribed circle); `edge` keeps placing spots on the
    // golden angle past n until the spiral leaves the frame (owner ruling 2026-10-09)
    { id: "phyllotaxis", family: "rd", name: "Phyllotaxis", model: "gray-scott", palette: "orodruin", params: { feed: 0.030, kill: 0.062 }, timeScale: 1.25, brush: 0.03, seed: { type: "grow", n: 144, r: 1.6, every: 4, edge: true }, firstSeed: "spec", chrono: 1200 },
    // Vortex: feed 0.008, kill 0.039 (owner ruling 2026-10-09) — Pearson's ξ region, "large, sustained spirals similar to
    // the Belousov–Zhabotinsky reaction" (Munafo's classification, read 2026-10-09); the 3.2 diffusion scale that
    // reproduces jsexp's 5-point kernel at its 0.8 step is kept. The tile is stirred so broken fronts curl into rotors.
    // the opening is a "stir": five points and four curved slashes of varying length, at random places and moments
    // within one second, different every time (owner, 2026-10-09)
    // selfSustaining false: spiral waves in this regime live on broken fronts (the stir, the visitor's strokes) and a
    // single front runs off and dies, so the fade test records its survival without binding it to the window
    { id: "vortex",      family: "rd", name: "Vortex",      model: "gray-scott", palette: "aurora", params: { feed: 0.008, kill: 0.039 }, timeScale: 1.25, brush: 0.03, dscale: 3.2, selfSustaining: false, seed: { type: "stir", points: 5, slashes: 4, frames: 60, r: 2 }, firstSeed: "every", thumbSeed: { type: "strokes", n: 3, r: 2 }, thumbStir: { every: 150, n: 1, r: 2 }, thumbSteps: 1500, thumbScale: 2, chrono: 900 },

    // —— cellular automata ——
    { id: "ca-frost",     family: "ca", name: "Frost",       model: "snow",        params: {}, palette: "cherenkov", seed: { type: "center", r: 1 }, brush: 0.004, stepScale: 1, thumbSeed: { type: "spiral", n: 4, r: 1, spread: 0.8 }, thumbSteps: 900, thumbScale: 2, chrono: 3000 },
    { id: "lenia",        family: "ca", name: "Lenia",       model: "lenia",       params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.1, thumbSeed: { type: "fill" }, thumbSteps: 300, chrono: 600 },
    { id: "rotor",        family: "ca", name: "Rotor",       model: "rotor",       params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.3, thumbSeed: { type: "fill" }, thumbSteps: 260, thumbScale: 2, chrono: 400 },
    { id: "lichtenberg",  family: "ca", name: "Lichtenberg", model: "lichtenberg", params: {}, timeScale: 0.25, seed: { type: "center", r: 2 }, firstSeed: "spec", brush: 0.004, thumbSteps: 500, thumbScale: 1.5, chrono: 1200 },
    // Sandpile: falling sand (owner 2026-10-09: "give the sandpile gravity"); the drop point keeps dropping until Reset
    { id: "sandpile",     family: "ca", name: "Sandpile",    model: "sand",        params: {}, seed: { type: "pacemaker", n: 1, r: 1, every: 2 }, firstSeed: "spec", brush: 0.01, thumbSeed: { type: "center", r: 1 }, thumbStir: { every: 2, spec: { type: "center", r: 1 } }, thumbSteps: 900, thumbScale: 2, chrono: 1200 },
    { id: "conus",        family: "ca", name: "Conus",       model: "conus",       params: {}, seed: { type: "center", r: 1 }, firstSeed: "spec", brush: 0.004, stepScale: 0.35, thumbSeed: { type: "center", r: 1 }, thumbSteps: 108, thumbScale: 2, chrono: 300 },
    { id: "wildfire",     family: "ca", name: "Wildfire",    model: "wildfire",    params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.03, stepScale: 0.4, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 900 },
    { id: "grain",        family: "ca", name: "Grain",       model: "grain",       params: {}, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.5, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 1200 },
    { id: "wake",         family: "ca", name: "Wake",        model: "wake",        params: {}, timeScale: 1.5, seed: { type: "center", r: 9 }, firstSeed: "spec", brush: 0.004, thumbSeed: { type: "center", r: 6 }, thumbSteps: 600, thumbScale: 2, chrono: 1800 }
  ];
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }

  var registry = [];
  function auto(root) {
    root = root || global.document;
    var mq = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)") : null;
    var canvases = root.querySelectorAll("canvas[data-morphogen],canvas[data-reaction-diffusion]");
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i]; if (get(c)) continue; var d = c.dataset;
      var preset = d.preset ? presetById(d.preset) : null;
      var field = mount(c, {
        model: preset ? preset.model : (d.model || undefined),
        params: preset ? preset.params : (d.feed !== undefined || d.kill !== undefined ? { feed: parseFloat(d.feed), kill: parseFloat(d.kill) } : undefined),
        timeScale: d.timeScale !== undefined ? parseFloat(d.timeScale) : undefined,
        fadeStart: d.fadeStart !== undefined ? parseFloat(d.fadeStart) : undefined, fadeEnd: d.fadeEnd !== undefined ? parseFloat(d.fadeEnd) : undefined,
        palette: d.palette, baseSteps: d.steps !== undefined ? parseInt(d.steps, 10) : undefined,
        stepScale: d.stepScale !== undefined ? parseFloat(d.stepScale) : undefined,
        brush: d.brush !== undefined ? parseFloat(d.brush) : undefined,
        dscale: d.dscale !== undefined ? parseFloat(d.dscale) : undefined,
        hover: d.hover === "on" || d.hover === "true",
        quality: d.quality === "auto" ? "auto" : (d.quality !== undefined ? parseInt(d.quality, 10) : undefined),
        gpu: d.gpu !== "off", reducedMotion: mq ? mq.matches : false
      });
      registry.push({ canvas: c, field: field });
      var scope = c.closest ? c.closest("[data-rd-scope]") : null; if (scope) bind(scope, field);
      if (mq) (function (fld) { var h = function (ev) { fld.setReducedMotion(ev.matches); }; if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h); })(field);
    }
  }
  function get(canvas) { for (var i = 0; i < registry.length; i++) if (registry[i].canvas === canvas) return registry[i].field; return null; }

  var Morphogen = { mount: mount, bind: bind, auto: auto, get: get, models: MODELS, modelOrder: MODEL_ORDER, families: FAMILIES, presets: PRESETS, palettes: PALETTES, ladder: LADDER, buildLut: buildLut, renderThumb: renderThumb, thumbJob: thumbJob, seedDiscList: seedDiscList, defineModel: defineModel, version: VERSION };
  global.Morphogen = Morphogen;
  global.ReactionDiffusion = Morphogen;   // the 1.x name, kept as an alias
  if (global.document && global.document.querySelectorAll) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { auto(); }); else auto(); }
})(typeof window !== "undefined" ? window : this);
