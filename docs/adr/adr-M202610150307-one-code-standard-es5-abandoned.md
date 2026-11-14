---
tier: mandate
status: accepted
made: 202610150307
supersedes: none
---
# One code standard for Morphogen, the Atlas and the folio: ESLint recommended with EditorConfig now, TypeScript strict as the direction; ES5 abandoned

- Source: the user, 2026-10-15. Ratified by questionnaire the same day.
- Scope: Morphogen, the Morphospaces Atlas and cs-web-folio.
- Rationale: three repositories share one standard, so the authoritative existing solution is the proportionate choice; the rewrite reformats every line anyway; a full opinionated style guide buys little beyond the recommended set plus a formatter.

Now: ESLint's recommended rule set in the flat configuration, with EditorConfig, exactly as cs-web-folio runs it under its decisions 0055 and 0078. Installing ESLint in this repository is a separate approved batch.

Direction: TypeScript in strict mode with ESLint recommended, adopted with or after the engine rewrite; the timing is open (see `docs/PENDING.md`).

ES5 and the classic-script source are abandoned for Morphogen and the Atlas; the source is modern JavaScript in ES modules. The shipped classic bundle remains an output of the build, not the source (see adr-202610150308).

Formatter undecided (see `docs/PENDING.md`).
