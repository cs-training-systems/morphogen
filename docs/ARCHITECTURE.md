# Architecture: how the parts fit

One page so that no session needs the programme explained. Decisions are in docs/adr/; this file only states what is.

## The parts and the direction of dependence

cs-web-folio depends on Morphogen (GUI and engine). Morphogen depends on the Morphospaces Atlas (classification and data). n-cell-tessellata (non-square automata) will feed Morphogen's engine.

- The Morphospaces Atlas (`atlas/`) is a faceted classification of computational visual generators: every record has an address of law architecture, substrate, mechanism family and subtype, in that order; mathematics occupies the top two levels, mechanism the third (the Mandate on the law-first citation order). Its canonical data is `atlas/data/atlas.json`; every view is generated from it. Its site is published from a separate publish-only repository.
- Morphogen's engine implements Atlas records as runnable models; each preset carries the Atlas address of the generator it runs (the decision record on presets as a JSON single source).
- Morphogen's GUI shows no technical vocabulary. It groups presets by user-friendly visual types, a single-level, appearance-first grouping defined in `docs/taxonomy/user-friendly-taxonomy.md`, Section VI. The visual types and the Atlas addresses are two classifications with two purposes, linked only through the preset.
- cs-web-folio consumes Morphogen as a dependency and loads it with one script tag.

## Where things live

| Thing | Home |
|---|---|
| Rules for sessions | `CLAUDE.md`, edited only through its temp copy and ruled splices; recorded by its commits |
| Decisions | `docs/adr/`, consulted by area through the index; none read at boot |
| Resume point | `docs/STATUS.md` |
| Open questions, defects, risks | `docs/PENDING.md`, `docs/KNOWN-ISSUES.md`, `docs/RISKS.md`, open rows only |
| Atlas data, assets, tools | `atlas/data/`, `atlas/assets/`, `atlas/tools/` |
| Engine source and presets | `src/`; presets move to `src/data/presets.json` at the rewrite |
| The visual taxonomy | `docs/taxonomy/` |

## What is not yet decided

The Morphogen GUI's layout and interaction (the user's picture, to be written as requirements); the Atlas's record schema and vocabularies; opaque record ids; the formatter and the TypeScript timing. See `docs/PENDING.md`.
