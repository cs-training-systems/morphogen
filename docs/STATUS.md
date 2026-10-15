# Status

The resume point. A session starts here after the boot reads, and ends by updating it. Programme-level priorities for the three repositories (Morphogen, the Morphospaces Atlas, cs-web-folio) are kept here by ruling of 2026-10-15; the other two repositories' status files hold only their own work and point back to this file.

## Priorities, in order

| # | Item | State | Notes |
|---|---|---|---|
| 0 | Repository restructure and housekeeping | in progress | Batch 1 (record structure) and batch 2 (eight records for the 2026-10-15 rulings, the must-read list) done 2026-10-15. Left: the user pastes the CLAUDE.md project section; the first commit, proposed separately. |
| 1 | Morphospaces Atlas: polished, comprehensive, accurate, internally mapped, in the folio's visual standard, thumbnails made | not started | Lives in `C:\dev\morphospaces-atlas`. Prerequisite for building Morphogen correctly. |
| 2 | User-friendly taxonomy: polished to a ratified visual-type catalog | not started | `docs/taxonomy/user-friendly-taxonomy.md`. Prerequisite with item 1. Section VI of that file states the governing principle. |
| 3 | Engine rewrite: ES modules, one build producing a classic bundle and a module build, presets as a JSON single source, generated catalog, ESLint recommended + EditorConfig, TypeScript later | not started | Depends on 1 and 2 for the model and preset set. Becomes the 0.2.0 line. |
| 4 | cs-web-folio re-pinned to the next Morphogen tag | not started | Its lockfile pins a deleted tag; see KNOWN-ISSUES. |

## Next action

The user pastes the CLAUDE.md project section (draft delivered 2026-10-15); then the first commit of the restructure is proposed as its own batch under Conventional Commits; then priority 1, the Morphospaces Atlas, begins in its own repository.

## Session log

- **2026-10-15** · Read every document in full; CLAUDE.md installed by the user; rulings made on the ADR system, the record structure, the code standard, the presets source, the taxonomy home and the priority order; batch 1 written: `docs/adr/` with ADR_README and the generated index, `tools/adr-index.js`, this file, PENDING, KNOWN-ISSUES, RISKS, PROVENANCE, RELEASES, the taxonomy moved to `docs/taxonomy/`, `.editorconfig`, `.claude/settings.json`, the README project map, the CHANGELOG Unreleased section, the test script. `generator-classification.txt` deleted (superseded by the Atlas). Batch 2 written: eight records in `docs/adr/` (two Mandates, six Decisions, one Correction), every tier and text ratified by questionnaire; the must-read list filled with the two Mandates. Nothing committed.
- **2026-10-14** · Project familiarisation: README, CONTRIBUTING, CHANGELOG, CITATION, package.json, LICENSE, both taxonomy drafts read in full.
