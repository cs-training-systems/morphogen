# Contributing to Morphogen

Thank you for looking under the hood. Morphogen is deliberately small: one classic script, one
stylesheet, no dependencies, no build step. Contributions that keep it that way are welcome.

## Fork and run

1. Fork the repository on GitHub and clone your fork.
2. There is nothing to install. Open `index.html` from any local web server (for example
   `python -m http.server 8090` in the folder, then `http://localhost:8090/`). Opening the file
   directly also works, because the script is a classic script, not a module.
3. Run the test: `npm test` (Node 18 or later). It proves every preset dies inside the optional
   fade window when that window is switched on, with an injected clock, in about half a minute.

## Making a change

- Keep `reaction-diffusion.js` dependency-free and a classic script (one global,
  `ReactionDiffusion`). The declarative `data-rd` roles are the public interface; add roles rather
  than changing existing ones.
- Keep the accessibility contract: every control is a native element with a visible name; status
  changes go through the live region; nothing depends on a pointer or on color alone; motion
  honors `prefers-reduced-motion`.
- A new preset needs: a `(feed, kill)` pair and a seeding spec in `PRESETS`; a button and a note in
  `index.html`; a run of `npm test`; and, ideally, a still rendered with `tools/render-media.js`.
- A new palette needs: four colors (ground, trail, body, front) in `PALETTES` and a radio row with
  four swatches in `index.html`.

## Pull requests

Open a pull request against `main` with a short description of what changed and why, and the
output of `npm test`. Small, focused pull requests are easiest to review.

## Reporting problems

Open an issue with the browser and version, the device, what you did, what you expected, and what
happened. If the field stutters, include the "Measured" readout from the demo page.
