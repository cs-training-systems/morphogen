# Changelog

All notable changes to Morphogen are recorded here. The format follows Keep a Changelog; the
project follows Semantic Versioning.

## [1.0.0] — 2026-10-08

First release.

- Gray–Scott reaction–diffusion field on a 2D canvas: one classic script, no dependencies.
- Hover-only seeding with speed-scaled discs; one-point Seed button (centre first, then random);
  Pause/Play; Reset.
- Nine named regimes with live-rendered thumbnails and a note each: Malachite, Meandric, Swarm,
  Honeycomb, Frost, Turbulence, Mitosis, Phyllotaxis (a head that grows on the golden angle),
  Vortex (spiral waves from broken strokes).
- Seven colour ramps with swatch previews: Canopy, Aurora, Spectrum, Neon, Accretion, Physarum,
  Cherenkov.
- Feed, kill and time-scale controls as slider-and-number pairs; time scale 0.5–2.5 on a base of
  8 steps per frame, fractional steps carried between frames.
- Adaptive resolution by measured compute time, grid shape following the frame, bilinear
  resampling on change.
- Optional fade window (off by default) with a Node verifier, `tests/verify-fade.js`.
- Declarative `data-rd` control binding; programmatic API; reduced-motion still; Windows
  high-contrast support.
