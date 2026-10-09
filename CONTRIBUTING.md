# Contributing to Morphogen

Thank you for looking under the hood. Morphogen is deliberately small: one shipped classic script,
one stylesheet, no dependencies, no build step for the page that uses it. Contributions that keep
it that way are welcome.

## Fork and run

1. Fork the repository on GitHub and clone your fork.
2. There is nothing to install. Open `index.html` from any local web server (for example
   `python -m http.server 8090` in the folder, then `http://localhost:8090/`).
3. The shipped script, `morphogen.js`, is assembled from the modules in `src/` by
   `node tools/build.js` (Node 18 or later; no dependencies). Edit `src/`, run the build, and commit
   both. `npm test` runs the build and then `tests/verify-fade.js`, which proves every Gray–Scott
   preset dies inside the optional fade window when that window is switched on.

## How the source is laid out

- `src/00-prelude.js` — palettes, the resolution ladder, seeding and hexagonal-lattice geometry.
- `src/10-registry.js` — the model registry and the shader head every model's passes share.
- `src/2x-*.js` — one file per model or group: a model declares its family, lattice, state
  channels, its two user parameters, its step (fragment shaders for the graphics processor and a
  function for the processor), its seeding, its display mapping, its liveness, and its glow.
- `src/40-gpu.js`, `src/41-cpu.js` — the two generic backends. They know nothing about any model.
- `src/50-field.js` — the field: mount, the frame loop, resolution, pointer and touch, the
  reduced-motion chronogram, thumbnails.
- `src/60-bind.js` — the declarative controls. `src/70-presets.js` — the families and presets.

## Making a change

- Keep the shipped script dependency-free and a classic script (one global, `Morphogen`;
  `ReactionDiffusion` stays as an alias). The declarative `data-rd` roles are the public interface;
  add roles rather than changing existing ones.
- Keep the accessibility contract: every control is a native element with a visible name; status
  changes go through the live region; nothing depends on a pointer or on color alone; motion
  honors `prefers-reduced-motion`.
- A new model is one file in `src/`, written from its published rule and cited in a comment at the
  top, with both the graphics-processor and the processor step. Never copy code from another
  implementation.
- A new preset needs: an entry in `src/70-presets.js` (model, parameter overrides, seeding, palette,
  brush, speed), a tile and a note in `index.html`, and a run of `npm test`.
- A new palette needs: four colors (ground, trail, body, front) in `src/00-prelude.js` and a radio
  row with four swatches in `index.html`.

## Pull requests

Open a pull request against `main` with a short description of what changed and why, and the
output of `npm test`. Small, focused pull requests are easiest to review.

## Reporting problems

Open an issue with the browser and version, the device, what you did, what you expected, and what
happened. If the field stutters, include the measure line from the demo page.
