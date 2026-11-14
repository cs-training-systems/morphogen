
  // ---- categories, tiles and presets --------------------------------------------------------------------------
  // CATEGORIES (owner ruling 2026-10-11): the top-level split is by the mathematics of the rule as written, never by
  // appearance. DETERMINISTIC rules are split by the time they are written in; every STOCHASTIC rule shares one button.
  //   stepwise  — deterministic, discrete time: every bounded stretch of time holds finitely many instants
  //   flowing   — deterministic, continuous time: a differential equation, integrated in steps only to compute it
  //   chance    — the rule itself contains a probability law (randomness in the SEED does not count: that is instance data)
  var CATEGORIES = [
    { id: "stepwise", name: "Stepwise", formal: "discrete time", group: "deterministic" },
    { id: "flowing",  name: "Flowing",  formal: "continuous time", group: "deterministic" },
    { id: "chance",   name: "Chance-driven", formal: "probabilistic", group: "stochastic" }
  ];
  // A TILE is a named model (owner ruling 2026-10-11: "those buttons become NAMED MODELS, period"). Its presets are
  // whole recipes inside that model; the first listed is the default. Order inside a category is the order shown.
  var TILES = [
    { id: "gray-scott",          category: "flowing",  model: "gray-scott",  name: "Gray–Scott",            presets: ["malachite", "meandric", "swarm", "xylem", "turbulence", "mitosis", "phyllotaxis", "vortex"] },
    { id: "ginzburg-landau",     category: "flowing",  model: "cgl",         name: "Ginzburg–Landau",       presets: ["antispiral", "cgl-turbulence"] },
    { id: "reiter",              category: "stepwise", model: "reiter",      name: "Reiter snow crystal",   presets: ["ca-frost"] },
    { id: "cellular-automaton",  category: "stepwise", model: "ca",          name: "Cellular automaton",    presets: ["rule30", "rule110", "rule90", "life", "highlife", "daynight", "seeds", "brain"] },
    { id: "lenia",               category: "stepwise", model: "lenia",       name: "Lenia",                 presets: ["lenia"] },
    { id: "lattice-boltzmann",   category: "stepwise", model: "wake",        name: "Lattice Boltzmann",     presets: ["wake"] },
    { id: "cyclic-automaton",    category: "stepwise", model: "rotor",       name: "Cyclic automaton",      presets: ["rotor"] },
    { id: "dielectric-breakdown", category: "chance",  model: "lichtenberg", name: "Dielectric breakdown",  presets: ["lichtenberg", "dla"] },
    { id: "potts",               category: "chance",   model: "grain",       name: "Potts model",           presets: ["grain", "potts-critical"] },
    { id: "forest-fire",         category: "chance",   model: "wildfire",    name: "Forest fire",           presets: ["wildfire"] }
  ];
  // A preset: { id, tile, name, model, params (overrides), seed, firstSeed, palette, brush, timeScale, stepScale, dscale,
  //   quality, logRange, chrono, thumbSeed, thumbSteps, thumbScale, thumbStir, provisional }.
  // firstSeed "spec": the first Seed press (or the first mark on the field) runs the preset's own seeding from that
  // point; every later press places one random point (owner ruling 2026-10-09). A tile selects its default preset; the
  // field stays black until the visitor acts. `provisional`: the slider box around this preset is hand-set and awaits the
  // dead-range bench (owner ruling 2026-10-11: provisional ranges now, measured ranges next unit).
  var PRESETS = [
    // —— Gray–Scott: the eight regimes that were tiles in 0.4–0.6 are now this one model's presets (owner ruling 2026-10-11) ——
    // the owner's defaults of 2026-10-09/10 (palette, rates, speed, brush) per preset; every slider is centred on them
    { id: "malachite",   tile: "gray-scott", name: "Malachite",   model: "gray-scott", palette: "canopy",    params: { feed: 0.008, kill: 0.031 }, timeScale: 0.5, brush: 0.02, seed: { type: "pacemaker", n: 1, r: 3, every: 75 }, firstSeed: "spec", chrono: 420, provisional: true },
    { id: "meandric",    tile: "gray-scott", name: "Meandric",    model: "gray-scott", palette: "physarum",  params: { feed: 0.026, kill: 0.055 }, timeScale: 0.4, brush: 0.02, quality: 480, logRange: 2.2, seed: { type: "spiral", n: 21, r: 3 }, chrono: 2400, provisional: true },   // speed 0.400 (owner 2026-10-11)
    { id: "swarm",       tile: "gray-scott", name: "Swarm",       model: "gray-scott", palette: "neon",      params: { feed: 0.013, kill: 0.054 }, timeScale: 2.6, brush: 0.05, seed: { type: "spiral", n: 21, r: 3 }, chrono: 1800, provisional: true },
    { id: "xylem",       tile: "gray-scott", name: "Xylem",       model: "gray-scott", palette: "canopy",    params: { feed: 0.039, kill: 0.058 }, timeScale: 0.3, brush: 0.04, seed: { type: "spiral", n: 13, r: 4 }, chrono: 2400, provisional: true },   // speed 0.300, Canopy (owner 2026-10-11)
    { id: "turbulence",  tile: "gray-scott", name: "Turbulence",  model: "gray-scott", palette: "accretion", params: { feed: 0.025, kill: 0.050 }, timeScale: 1.0, brush: 0.05, seed: { type: "discs", n: 7, r: 4 }, chrono: 1800, provisional: true },
    // Mitosis (owner 2026-10-10): F 0.037, k 0.065, speed 1.750, Resolution 320; the first Seed press is the centre point plus a
    // petri-dish streak toward one quadrant, later presses single random points
    { id: "mitosis",     tile: "gray-scott", name: "Mitosis",     model: "gray-scott", palette: "spectrum",  params: { feed: 0.037, kill: 0.065 }, timeScale: 1.75, brush: 0.02, quality: 320, seed: { type: "streak", r: 2, legs: 7, len: 0.18 }, firstSeed: "spec", chrono: 2400, provisional: true },
    // Phyllotaxis: `n` sets the head's spacing; `edge` keeps placing spots on the golden angle until the spiral leaves the frame.
    // Speed 0.125 (owner 2026-10-11: "0.250 is about 200 % of where it should be"); the Fibonacci overhaul is a later unit
    { id: "phyllotaxis", tile: "gray-scott", name: "Phyllotaxis", model: "gray-scott", palette: "orodruin",  params: { feed: 0.030, kill: 0.062 }, timeScale: 0.125, brush: 0.03, seed: { type: "grow", n: 144, r: 1.6, every: 4, edge: true }, firstSeed: "spec", chrono: 1200, provisional: true },
    // Vortex: feed 0.008, kill 0.039 (owner 2026-10-09), the 3.2 diffusion scale; the opening is a stir of five points and four
    // curved slashes within one second, drawn from the seed value, on every Seed press and click
    { id: "vortex",      tile: "gray-scott", name: "Vortex",      model: "gray-scott", palette: "aurora",    params: { feed: 0.008, kill: 0.039 }, timeScale: 1.25, brush: 0.03, dscale: 3.2, selfSustaining: false, seed: { type: "stir", points: 5, slashes: 4, frames: 60, r: 2 }, firstSeed: "every", thumbSeed: { type: "strokes", n: 3, r: 2 }, thumbStir: { every: 150, n: 1, r: 2 }, thumbSteps: 1500, thumbScale: 2, chrono: 900, provisional: true },

    // —— complex Ginzburg–Landau ——
    // owner 2026-10-10: Neon, α 1.75, β −0.65, speed 1.5, Resolution 800 (the model's defaults carry b and c)
    { id: "antispiral",     tile: "ginzburg-landau", name: "Antispiral",  model: "cgl", params: {}, palette: "neon", timeScale: 1.5, brush: 0.03, quality: 800, seed: { type: "center", r: 14 }, firstSeed: "spec", thumbSeed: { type: "center", r: 16 }, thumbSteps: 1500, thumbScale: 2, chrono: 1200 },
    // past the Benjamin–Feir line (1 + αβ < 0): defect turbulence. The owner's recording setting of 2026-10-10 (α 1.90, β −2.00, Canopy, speed 0.250)
    { id: "cgl-turbulence", tile: "ginzburg-landau", name: "Defect turbulence", model: "cgl", params: { b: 1.90, c: -2.00 }, palette: "canopy", timeScale: 0.25, brush: 0.03, quality: 320, seed: { type: "fill" }, firstSeed: "spec", thumbSeed: { type: "fill" }, thumbSteps: 1200, thumbScale: 2, chrono: 1200, provisional: true },

    // —— Reiter snow crystal (owner 2026-10-09: "we use Reiter's model and we make it polished") ——
    // brush 0.2 %: the brush here is the void's width around a pinpoint nucleus (see the field); Coastal; stepScale 1/3: two lattice
    // steps per frame at the default speed; quality "auto": one lattice cell per screen pixel; 320 … 1600 are coarser to finer lattices.
    // Vapour noise is ZERO (owner ruling 2026-10-11: the model sits under DETERMINISTIC · STEPWISE; variety comes from the seed)
    { id: "ca-frost", tile: "reiter", name: "Frost", model: "reiter", params: {}, palette: "coastal", quality: "auto", seed: { type: "center", r: 0.6 }, brush: 0.002, stepScale: 1 / 3, thumbSeed: { type: "spiral", n: 4, r: 0.6, spread: 0.8 }, thumbSteps: 2400, thumbScale: 2, chrono: 3000 },

    // —— the cellular automaton: one model, one dimension toggle (owner ruling 2026-10-11: Wolfram's and Conway's rules are one
    // mathematical object, a finite lookup table on a lattice). 1-D presets: the rule number; 2-D presets: the B/S(/C) string ——
    // 1-D (Wolfram): speed 0.100 (owner 2026-10-11), the live row at the bottom scrolling up; the brush and Seed act on that row
    { id: "rule30",   tile: "cellular-automaton", name: "Rule 30",  model: "ca", params: { rule: 30,  dim: 1 }, palette: "neon",      timeScale: 0.1, brush: 0.004, seed: { type: "center", r: 1 }, firstSeed: "spec", thumbSeed: { type: "center", r: 1 }, thumbSteps: 108, thumbScale: 2, chrono: 300, provisional: true },
    { id: "rule110",  tile: "cellular-automaton", name: "Rule 110", model: "ca", params: { rule: 110, dim: 1 }, palette: "neon",      timeScale: 0.1, brush: 0.004, seed: { type: "fill" }, firstSeed: "spec", thumbSeed: { type: "fill" }, thumbSteps: 108, thumbScale: 2, chrono: 300, provisional: true },
    { id: "rule90",   tile: "cellular-automaton", name: "Rule 90",  model: "ca", params: { rule: 90,  dim: 1 }, palette: "neon",      timeScale: 0.1, brush: 0.004, seed: { type: "center", r: 1 }, firstSeed: "spec", thumbSeed: { type: "center", r: 1 }, thumbSteps: 108, thumbScale: 2, chrono: 300, provisional: true },
    // 2-D (Life-like): a random soup at the given density within the brush or the whole field; the glow stage lays the vapour tails
    { id: "life",     tile: "cellular-automaton", name: "Life",          model: "ca", params: { dim: 2, bmask: 8,   smask: 12,  states: 2, density: 0.35 }, palette: "aurora", timeScale: 0.25, brush: 0.08, seed: { type: "fill" }, firstSeed: "spec", thumbSeed: { type: "fill" }, thumbSteps: 200, thumbScale: 2, chrono: 400, provisional: true },   // B3/S23
    { id: "highlife", tile: "cellular-automaton", name: "HighLife",      model: "ca", params: { dim: 2, bmask: 72,  smask: 12,  states: 2, density: 0.35 }, palette: "aurora", timeScale: 0.25, brush: 0.08, seed: { type: "fill" }, firstSeed: "spec", thumbSeed: { type: "fill" }, thumbSteps: 200, thumbScale: 2, chrono: 400, provisional: true },   // B36/S23
    { id: "daynight", tile: "cellular-automaton", name: "Day and Night", model: "ca", params: { dim: 2, bmask: 456, smask: 472, states: 2, density: 0.5 },  palette: "aurora", timeScale: 0.25, brush: 0.08, seed: { type: "fill" }, firstSeed: "spec", thumbSeed: { type: "fill" }, thumbSteps: 200, thumbScale: 2, chrono: 400, provisional: true },   // B3678/S34678
    { id: "seeds",    tile: "cellular-automaton", name: "Seeds",         model: "ca", params: { dim: 2, bmask: 4,   smask: 0,   states: 2, density: 0.05 }, palette: "aurora", timeScale: 0.25, brush: 0.08, seed: { type: "center", r: 3 }, firstSeed: "spec", thumbSeed: { type: "center", r: 3 }, thumbSteps: 60, thumbScale: 2, chrono: 200, provisional: true },   // B2/S
    { id: "brain",    tile: "cellular-automaton", name: "Brian's Brain", model: "ca", params: { dim: 2, bmask: 4,   smask: 0,   states: 3, density: 0.3 },  palette: "aurora", timeScale: 0.25, brush: 0.08, seed: { type: "fill" }, firstSeed: "spec", thumbSeed: { type: "fill" }, thumbSteps: 120, thumbScale: 2, chrono: 300, provisional: true },   // B2/S/C3

    // —— Lenia (owner 2026-10-10: Aurora, μ 0.136, σ 0.011, speed 0.250) ——
    // thumbScale 3: on the 96 × 54 tile grid the kernel (radius 13) spans half the height and the soup dies within the 300 steps,
    // which is why the tile was black on the earlier demo; at 288 × 162 creatures emerge as on the field (finding, 2026-10-12)
    { id: "lenia", tile: "lenia", name: "Orbium", model: "lenia", params: { mu: 0.136, sigma: 0.011 }, palette: "aurora", timeScale: 0.25, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.1, thumbSeed: { type: "fill" }, thumbSteps: 300, thumbScale: 3, chrono: 600 },

    // —— lattice Boltzmann (owner 2026-10-10: Spectrum, flow 0.130, viscosity 0.005; speed 1.00 ruled 2026-10-11) ——
    { id: "wake", tile: "lattice-boltzmann", name: "Wake", model: "wake", params: {}, palette: "spectrum", timeScale: 1.0, seed: { type: "center", r: 9 }, firstSeed: "spec", brush: 0.004, thumbSeed: { type: "center", r: 6 }, thumbSteps: 600, thumbScale: 2, chrono: 1800 },

    // —— the cyclic automaton (owner 2026-10-10: Accretion, 5 states, threshold 2.0, speed 0.275) ——
    { id: "rotor", tile: "cyclic-automaton", name: "Rotor", model: "rotor", params: { states: 5, threshold: 2 }, palette: "accretion", timeScale: 0.275, seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.3, thumbSeed: { type: "fill" }, thumbSteps: 260, thumbScale: 2, chrono: 400 },

    // —— dielectric breakdown (owner 2026-10-10: Physarum, η 2.4, rate 1.6, speed 0.175, Resolution 480) ——
    { id: "lichtenberg", tile: "dielectric-breakdown", name: "Lightning", model: "lichtenberg", params: { eta: 2.4, rate: 1.6 }, palette: "physarum", timeScale: 0.175, quality: 480, seed: { type: "center", r: 2 }, firstSeed: "spec", brush: 0.004, thumbSteps: 500, thumbScale: 1.5, chrono: 1200 },
    // η = 1 is diffusion-limited aggregation by definition (Niemeyer, Pietronero and Wiesmann 1984): the dense coral
    { id: "dla",         tile: "dielectric-breakdown", name: "Aggregation", model: "lichtenberg", params: { eta: 1.0, rate: 1.6 }, palette: "physarum", timeScale: 0.175, quality: 480, seed: { type: "center", r: 2 }, firstSeed: "spec", brush: 0.004, thumbSteps: 500, thumbScale: 1.5, chrono: 1200, provisional: true },

    // —— the Potts model ——
    { id: "grain",          tile: "potts", name: "Grain growth", model: "grain", params: {}, palette: "canopy", seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.5, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 1200 },
    // q = 2 is the Ising model; the temperature here is in units of the coupling on the eight-neighbour lattice, and the value
    // below is a HAND-SET starting point for the critical fog, to be measured by the bench (owner 2026-10-11: provisional)
    { id: "potts-critical", tile: "potts", name: "Ising, critical", model: "grain", params: { states: 2, temperature: 1.9 }, palette: "cherenkov", seed: { type: "fill" }, firstSeed: "spec", brush: 0.08, stepScale: 0.5, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 1200, provisional: true },

    // —— the forest fire ——
    { id: "wildfire", tile: "forest-fire", name: "Wildfire", model: "wildfire", params: {}, palette: "neon", seed: { type: "fill" }, firstSeed: "spec", brush: 0.03, stepScale: 0.4, thumbSeed: { type: "fill" }, thumbSteps: 400, thumbScale: 2, chrono: 900 }
  ];
  function presetById(id) { for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i]; return null; }
  function tileById(id) { for (var i = 0; i < TILES.length; i++) if (TILES[i].id === id) return TILES[i]; return null; }
  function categoryById(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i]; return null; }
  // the B/S(/C) rule string of the 2-D automaton ↔ the bit masks the shader reads ("B3/S23", "B36/S23", "B2/S/C3")
  function parseLifeRule(str) {
    var m = /^\s*B(\d*)\s*\/\s*S(\d*)\s*(?:\/\s*C?(\d+))?\s*$/i.exec(str || ""); if (!m) return null;
    var b = 0, s = 0, i;
    for (i = 0; i < m[1].length; i++) b |= 1 << parseInt(m[1][i], 10);
    for (i = 0; i < m[2].length; i++) s |= 1 << parseInt(m[2][i], 10);
    return { bmask: b, smask: s, states: m[3] ? Math.max(2, parseInt(m[3], 10)) : 2 };
  }
  function lifeRuleString(bmask, smask, states) {
    var b = "", s = "", i;
    for (i = 0; i <= 8; i++) { if ((bmask >> i) & 1) b += i; if ((smask >> i) & 1) s += i; }
    return "B" + b + "/S" + s + (states > 2 ? "/C" + states : "");
  }

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
        seed: d.seed !== undefined ? parseInt(d.seed, 10) : undefined,
        quality: d.quality === "auto" ? "auto" : (d.quality !== undefined ? parseInt(d.quality, 10) : undefined),
        gpu: d.gpu !== "off", reducedMotion: mq ? mq.matches : false
      });
      registry.push({ canvas: c, field: field });
      var scope = c.closest ? c.closest("[data-rd-scope]") : null; if (scope) bind(scope, field);
      if (mq) (function (fld) { var h = function (ev) { fld.setReducedMotion(ev.matches); }; if (mq.addEventListener) mq.addEventListener("change", h); else if (mq.addListener) mq.addListener(h); })(field);
    }
  }
  function get(canvas) { for (var i = 0; i < registry.length; i++) if (registry[i].canvas === canvas) return registry[i].field; return null; }

  var Morphogen = { mount: mount, bind: bind, auto: auto, get: get, models: MODELS, modelOrder: MODEL_ORDER, categories: CATEGORIES, tiles: TILES, presets: PRESETS, palettes: PALETTES, ladder: LADDER, buildLut: buildLut, renderThumb: renderThumb, thumbJob: thumbJob, seedDiscList: seedDiscList, defineModel: defineModel, parseLifeRule: parseLifeRule, lifeRuleString: lifeRuleString, version: VERSION };
  Morphogen.families = CATEGORIES;   // the 0.4–0.6 name of the top-level row, kept as an alias
  global.Morphogen = Morphogen;
  global.ReactionDiffusion = Morphogen;   // the 0.1–0.3 name, kept as an alias
  if (global.document && global.document.querySelectorAll) { if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", function () { auto(); }); else auto(); }
})(typeof window !== "undefined" ? window : this);
