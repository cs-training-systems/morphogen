# Changelog

All notable changes to Morphogen are recorded here. The format follows Keep a Changelog; the
project follows Semantic Versioning 2.0.0.

## Versioning policy

Morphogen is in major version zero. The public interface (the `data-rd` roles, the mount options,
the global and the file names) is not yet the one that will be kept, so every release before 1.0.0
takes a **minor** bump when it adds or changes behaviour and a **patch** bump when it only fixes.
**1.0.0 is the release in which the full model set is signed off and the public interface is
declared stable; nothing earlier is 1.0.0.** After 1.0.0 the standard applies as written: patch for
fixes, minor for compatible additions, major only for an incompatible change to the public
interface. A tag is never moved or reused.

## [0.1.0] — 2026-10-12

First release: the framework of the 1.0 design on ten built models.

- **One classic script, no dependencies.** The simulation runs on the graphics processor (WebGL2, float
  textures) with the processor path as fallback and as the reference for the tests; identical mathematics on
  both. Adaptive resolution beneath a ceiling the user sets, by measured compute time and frame arrival.
- **Three categories, by the mathematics of the rule as written, never by appearance:** **Stepwise**
  (deterministic, discrete time), **Flowing** (deterministic, continuous time) and **Chance-driven** (the rule
  contains a probability law), the first two under a DETERMINISTIC header and the third under STOCHASTIC,
  divided. A definition sits beneath the row, with the rule that randomness in a seed does not make a model
  chance-driven and that a look belonging elsewhere is the computation, not the model.
- **The tiles are named models, nine slots per category.** Ten are built: Gray–Scott, Ginzburg–Landau
  (Flowing); Reiter snow crystal, the cellular automaton, Lenia, lattice Boltzmann, the cyclic automaton
  (Stepwise); dielectric breakdown, the Potts model, the forest fire (Chance-driven). The remaining slots are
  greyed, unclickable tiles naming the models in development (a `planned` role with `data-rd-category`).
- **Every model has presets**, chosen by a row of chips under the mode line: Gray–Scott carries eight named
  regimes (Malachite, Meandric, Swarm, Honeycomb, Turbulence, Mitosis, Phyllotaxis, Vortex) and the others
  theirs, among them Ginzburg–Landau defect turbulence, dielectric breakdown at η = 1 (aggregation) and the
  Potts model at q = 2 near criticality.
- **One cellular-automaton model with a dimension toggle:** in 1-D a Wolfram rule number (0–255) in a Rule
  box, rows stacking in time; in 2-D a Life-like B/S/C rule string on the Moore neighbourhood with dying
  states (Life, HighLife, Day and Night, Seeds and Brian's Brain as presets). The two are one lookup table on
  a lattice (Curtis–Hedlund–Lyndon).
- **Every control is the model's own variable, with its unit**, as many rows as the model declares; the
  binding reads a parameter's `unit`, and a `log` factor gives it a logarithmic track centred on the default.
  Each slider is centred on its preset's value. The lattice-Boltzmann viscosity runs 0.002 to 0.2 on a
  logarithmic track centred on 0.02.
- **The model's note stays while settings change**; a preset line under the chips names the preset, or
  "Custom settings", and says when a preset's slider box is provisional (hand-set, awaiting the range bench).
- **A seed value**, visible and enterable with a reroll: every random choice the engine makes (seed variation,
  stirs, streaks, soups, a crystal's orientation, the Seed button's random points) is drawn from it, and every
  clear restarts its stream, so the same value with the same actions repeats the same pattern. Reiter's
  crystal is deterministic, and crystals differ through the seed.
- **Seeding and playback:** hover-only seeding with speed-scaled discs; a Seed button; Pause/Play; Clear; a
  speed control on a base of 8 steps per frame times the model's pace, fractional steps carried between frames.
- **Colour:** named ramps with swatch previews and a glow stage; hexagonal lattices interpolated on display.
- **Accessibility:** reduced motion as a chronogram (one still, seed at the left edge, full development at the
  right), a visible state line, Windows high-contrast support, every control keyboard-operable.
- **Vocabulary:** `category`, `tile`, `chips`/`chip`, `preset-line`, `pN`/`pN-unit`, `rule`, `rule-label`,
  `dimension`, `model-controls`, `seed-value`, `seed-reroll`, `speed`, `ramp`, `ceiling`; the global
  `Morphogen` with `mount`, `categories`, `tiles`, `presets`, `parseLifeRule`, `lifeRuleString`; the field
  API with `setSeed`, `seedValue`, `random`; the mount option `seed` and attribute `data-seed`. Optional fade
  window (off by default) with a Node verifier, tests/verify-fade.js.
