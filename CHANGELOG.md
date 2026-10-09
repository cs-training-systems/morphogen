# Changelog

All notable changes to Morphogen are recorded here. The format follows Keep a Changelog; the
project follows Semantic Versioning.

## [2.0.0-beta.2] — 2026-10-09

A correction release within the beta.

- **Three paces restored.** Malachite, Meandric and Xylem default to a speed of 0.1. Their 0.04 in
  beta.1 was dictated against a build whose speed floor was 0.1, so they had run at 0.1 when approved;
  beta.1 lowered the floor to 0.005 and took 0.04 literally, which made them 2.5 × slower than approved.
- **The speed slider shows real numbers.** Its range is the preset's own speed divided by five to
  multiplied by five, with the preset dead centre: the track is logarithmic, and the real speed is what
  is read — the value box, the min / default / max labels under the track, and the slider's value text.
- **Lichtenberg on the processor path no longer fills a block.** Its growth sweep updated the lattice
  in place, so a cell that had just broken down made its right and lower neighbours eligible in the
  same sweep. The sweep now reads a snapshot, as the graphics path always did.
- **Every automaton now has its own palette** (Frost Cherenkov, Lenia Aurora, Rotor Spectrum,
  Lichtenberg Orodruin, Sandpile Accretion, Conus Physarum, Wildfire Neon, Grain Canopy, Wake
  Coastal), applied when its tile is chosen, as the reaction–diffusion tiles already did.
- README: Lenia and Rotor rows carry the released defaults (0.133 / 0.011; 5 states, threshold 3).

## [2.0.0-beta.1] — 2026-10-09

The engine overhaul, as a pre-release: the architecture and the eighteen patterns are in place and
calibration continues; 2.0.0 follows when the patterns are judged finished. Morphogen becomes an
engine of emergent pattern formation: a model registry with two families, eighteen presets and nine
palettes, one visual language for all of them.

- **The engine is rebuilt around a model registry.** A model declares its family, its lattice (square
  or hexagonal), its state channels (up to three float textures), its two user parameters, its fixed
  extras, its step as fragment shaders for the graphics processor and as a function for the processor,
  its seeding, its display mapping, its liveness, its glow and its resolution policy. Two generic
  backends run any model; the core knows none. The source lives in `src/` (one file per model or
  group) and `tools/build.js` assembles the shipped script.
- **Renamed:** the script is `morphogen.js`, the stylesheet `morphogen.css`, the global `Morphogen`;
  `ReactionDiffusion` remains as an alias, and `canvas[data-reaction-diffusion]` still mounts. The
  `data-rd` roles and the `rd` class namespace are unchanged. Breaking: the 1.x mount options `feed`,
  `kill`, `rule`, `snow` and `aniso` become `model` and `params`; the Reiter snow rule is now the model
  `reiter` (no tile); the anisotropic Gray–Scott machinery of 1.0.1 is removed.
- **Two families, a family row (`data-rd="family"`), and the mode line "FAMILY: PATTERN".**
  Reaction–diffusion: Gray–Scott in eight regimes and the phase-field dendrite (Kobayashi 1993, in
  the form documented by NIST's FiPy), which takes Frost's place in this family as a true
  reaction–diffusion system. Cellular automata: the Gravner–Griffeath snow crystal (2008, Frost),
  Lenia (Chan 2019), the cyclic automaton (Rotor), dielectric breakdown (Lichtenberg), falling sand
  on the Margolus neighbourhood (Sandpile), Rule 30 (Conus), the forest fire (Wildfire), Potts grain
  growth (Grain) and a D2Q9 lattice-Boltzmann fluid (Wake). Every rule is cited at the head of its
  source and stated in the demo's note with its law in MathML; the Frost notes say which family each
  crystal belongs to and why.
- **The glow stage:** every model's display scalar passes through a Gaussian blur and a persistence
  field before the palette, so edges are never seen and every moving front leaves a trail that fades
  down the ramp, the automata speaking the same language as the reaction–diffusion field.
- **Resolution:** the ladder gains a 240 rung and takes widths (`setQuality(640)`); a chosen rung is
  the grid and the engine adapts only on Automatic; pixel-lattice models run at the canvas's device
  pixels; the snow crystal's lattice follows the rung with its blur scaled to the cell.
- **Presets carry their whole recipe** — palette, parameters, speed, brush, resolution, seeding — and
  the two sliders are centred on the preset's values (speed on a logarithmic slider). The owner's
  defaults for every pattern; Honeycomb is renamed **Xylem**; Vortex opens with a stir of five points
  and four curved slashes on every Seed press and click; Phyllotaxis grows its head from the first
  Seed press to the frame's edge; Malachite's pacemaker fires from the first press.
- **Palettes Orodruin** (red, orange, yellow) and **Coastal** (deep blue, cyan, buff), one palette per
  pattern in each family.
- **Thumbnails** are computed on the graphics processor through an offscreen canvas after load, in
  milliseconds, with no main-thread cost; **touch** always paints while the finger is on the field;
  the accessibility toggles are labelled check boxes; the number boxes show their whole value; the
  panel's spacing is on the host's scale.
- `npm test` builds and then runs the fade verifier for the Gray–Scott presets; `tools/render-media.js`
  renders the reaction–diffusion media in Node and `tools/capture.html` the automata stills on the
  graphics processor.

## [1.0.2] — 2026-10-08

Frost becomes a real snow crystal.

- **A second rule beside Gray–Scott: the snow rule**, Reiter's local cellular model for snow crystal
  growth (Chaos, Solitons & Fractals 23(4), 2005) on a hexagonal lattice, in both engines (two passes per
  step on the graphics processor) with true hexagonal rendering. Water on the lattice; receptive cells
  (ice, or touching ice) hold their water and gain γ each step; the rest diffuses toward the six-neighbour
  mean at α/2; the boundary holds the vapour level β; ice at s ≥ 1; a little vapour noise so every
  crystal branches differently.
- **Frost** runs it (α 1, β 0.5, γ 0.001, noise 0.02) at about one lattice step per frame (`stepScale`):
  six-fold, dendritic, from one seed; the field is black until seeded; the crystal wears the palette as a
  Gray–Scott pattern does (tips in the front color, older ice through the body color to the trail color at
  the core, the depletion halo in the trail color around it); a finished crystal stays on screen. The 1.0.1 anisotropic Gray–Scott Frost is gone
  (the anisotropy machinery remains available to presets).
- While Frost is selected the two chemistry sliders become **Vapor (β, 0.30–0.90)** and **Growth
  (γ, 0.0001–0.003)**; labels and ranges return with the next Gray–Scott pattern.
- API: `setRule("snow", { alpha, beta, gamma, noise })` / `setRule("rd")`, `rule()`, `setSnow({ beta, gamma })`,
  `snow()`, `setStepScale()`; canvas attributes `data-rule="snow"`, `data-alpha`, `data-beta`, `data-gamma`,
  `data-noise`, `data-step-scale`; the `center` seed type; `thumbSeed` and `thumbSteps` per preset.
- The fade test skips the snow rule; the media renderer carries a preset's whole recipe.
- Thumbnails are resumable jobs advanced in idle slices (no long task); a preset may ask for its tile at a
  finer lattice (`thumbScale`): Frost's tile is computed at 240 × 135 and scaled down by the browser.

## [1.0.1] — 2026-10-08

Interaction and regime fixes after the first live review.

- **Click and drag paints by default.** The pointer marks the field only while a button is held;
  the former hover-only behavior is now **Hover mode**, a toggle beside Reduced motion
  (`data-rd="hover"` / `hover-check`; `data-hover="on"` on the canvas; `setHover()` in the API).
- **Nothing is seeded until the visitor acts.** A pattern tile selects the regime and clears the
  field; Seed places the first point at the center and later ones at random until Reset or a new
  pattern; the first mark may also be a drag stroke.
- **Vortex** reworked: a per-preset diffusion scale (`dscale`, both diffusion rates multiplied;
  `setDiffusionScale()`, `data-dscale`) of 3.2 reproduces the 5-point kernel at a 0.8 time step
  that pmneila/jsexp's "Waves" preset runs on, and kill is raised 0.045 → 0.047 for more negative
  space between fronts, so broken strokes spin up spiral waves reliably.
- "Time scale" is now **Speed** in the demo's labels and the status strings.
- The Rate and Resolution groups lose their headings in the demo (they keep accessible names).
- The demo carries a photosensitivity notice.
- Spelling: center, behavior.

## [1.0.0] — 2026-10-08

First release.

- Gray–Scott reaction–diffusion field on a 2D canvas: one classic script, no dependencies.
- Hover-only seeding with speed-scaled discs; one-point Seed button (center first, then random);
  Pause/Play; Reset.
- Nine named regimes with live-rendered thumbnails and a note each: Malachite, Meandric, Swarm,
  Honeycomb, Frost, Turbulence, Mitosis, Phyllotaxis (a head that grows on the golden angle),
  Vortex (spiral waves from broken strokes).
- Seven color ramps with swatch previews: Canopy, Aurora, Spectrum, Neon, Accretion, Physarum,
  Cherenkov.
- Feed, kill and time-scale controls as slider-and-number pairs; time scale 0.5–2.5 on a base of
  8 steps per frame, fractional steps carried between frames.
- The simulation on the graphics processor (WebGL2, float textures) with the processor path as
  fallback and as the reference for the tests; identical mathematics on both.
- Adaptive resolution beneath a ceiling the user sets, by measured compute time and frame
  arrival, grid shape following the frame, bilinear resampling on change, re-evaluated at once on
  any setting change.
- Reduced motion as a chronogram: one still, seed at the left edge, full development at the
  right, for any settings; a visible state line and a note per pattern under the tool.
- A Controls panel beside the field: Accessibility, Rate (feed, kill, time scale), Resolution.
- Optional fade window (off by default) with a Node verifier, `tests/verify-fade.js`.
- Declarative `data-rd` control binding; programmatic API; reduced-motion still; Windows
  high-contrast support.
