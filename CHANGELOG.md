# Changelog

All notable changes to Morphogen are recorded here. The format follows Keep a Changelog; the
project follows Semantic Versioning 2.0.0.

## Versioning policy

In [CONTRIBUTING.md](CONTRIBUTING.md), Versioning.

## [Unreleased]

### Added

- Project records under `docs/`: decision records in `docs/adr/` with `ADR_README.md` (the rules: three tiers,
  one headline per record, timestamped file names, front matter, approval by questionnaire) and a generated
  `ADR_INDEX.md`; `STATUS.md` (priorities and the resume point), `PENDING.md`, `KNOWN-ISSUES.md`, `RISKS.md`,
  `PROVENANCE.md`, `RELEASES.md`.
- `tools/adr-index.js`: generates the record index from front matter, fails closed on a malformed record,
  `--check` for the test script, `--hook` for Claude Code.
- The project map in the README, directly under the introduction.
- `docs/taxonomy/user-friendly-taxonomy.md`: the visual-type taxonomy draft, moved from the repository root
  with its duplicated section and stray citation lines removed.
- `.editorconfig` (from cs-web-folio) and `.claude/settings.json` (ask before commit, tag and push; deny edits
  to CLAUDE.md; the record-index hook).
- `atlas/`: the Morphospaces Atlas, migrated on 2026-10-16 from its own folder into this repository: the canonical record database `atlas/data/atlas.json` (v0.1.6 edition, 766 records), the 29 validated archetype thumbnails, the imported renderer and build script, and the edition's README and changelog as provenance. The HTML drafts were not imported; the Atlas is versioned with Morphogen.
- `docs/ARCHITECTURE.md`: one page on the parts, the direction of dependence, the two classifications and where things live.

### Changed

- `npm test` also verifies that the record index is current.
- Boot cost no longer grows with the project's age: no record is read at boot (records are consulted by area through the index); `docs/STATUS.md` is the resume point only, its session log removed; `docs/PENDING.md`, `docs/KNOWN-ISSUES.md` and `docs/RISKS.md` hold one row per matter and open rows only; the versioning policy is stated once, in CONTRIBUTING; the model sources once, in `CITATION.cff` and the source headers. Record timestamps are military time, EST.
- Records: a Mandate fixes the Atlas as a faceted classification with a law-first citation order; a Decision places the Morphospaces Atlas inside this repository; Corrections on the record system (timestamps on the Eastern wall clock, named EST; a rule placed in CLAUDE.md is recorded by its commit; no record read at boot), on the presets record (preset rulings are provenance) and on the taxonomy-homes record (one copy); ADR_README gains an editing rule (section 12) and allows deletion of superseded text on the user's approval.

### Removed

- The twelve promoted-Mandate records (`adr-MC` files): a rule placed in CLAUDE.md is recorded by the commit that places it. The must-read list. The superseded attribution record, and from four records the passages their Corrections had overtaken and the declined or rejected alternatives they named.

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
