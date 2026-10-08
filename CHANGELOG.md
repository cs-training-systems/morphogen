# Changelog

All notable changes to Morphogen are recorded here. The format follows Keep a Changelog; the
project follows Semantic Versioning.

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
