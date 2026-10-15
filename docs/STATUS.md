# Status

The resume point. A session starts here after the boot reads, and ends by updating it. Programme-level priorities for the three repositories (Morphogen, the Morphospaces Atlas, cs-web-folio) are kept here by ruling of 2026-10-15; the other two repositories' status files hold only their own work and point back to this file.

## Priorities, in order

| # | Item | State | Notes |
|---|---|---|---|
| 0 | Repository restructure and housekeeping | in progress | Batches 1 and 2 done and committed as d362ed2 on 2026-10-15; CLAUDE.md applied by the user the same day with the universal edits and the project section; twelve Mandate records written for the rulings placed in CLAUDE.md. Left: the second commit. |
| 1 | Morphospaces Atlas: polished, comprehensive, accurate, internally mapped, in the folio's visual standard, thumbnails made | not started | Lives in `C:\dev\morphospaces-atlas`. Prerequisite for building Morphogen correctly. |
| 2 | User-friendly taxonomy: polished to a ratified visual-type catalog | not started | `docs/taxonomy/user-friendly-taxonomy.md`. Prerequisite with item 1. Section VI of that file states the governing principle. |
| 3 | Engine rewrite: ES modules, one build producing a classic bundle and a module build, presets as a JSON single source, generated catalog, ESLint recommended + EditorConfig, TypeScript later | not started | Depends on 1 and 2 for the model and preset set. Becomes the 0.2.0 line. |
| 4 | cs-web-folio re-pinned to the next Morphogen tag | not started | Its lockfile pins a deleted tag; see KNOWN-ISSUES. |

## Next action

Next session: repository tidiness first, then the Morphospaces Atlas and the user-friendly taxonomy.

## Session log

- **2026-10-15** · Read every document in full; CLAUDE.md installed by the user; rulings made on the ADR system, the record structure, the code standard, the presets source, the taxonomy home and the priority order; batch 1 written: `docs/adr/` with ADR_README and the generated index, `tools/adr-index.js`, this file, PENDING, KNOWN-ISSUES, RISKS, PROVENANCE, RELEASES, the taxonomy moved to `docs/taxonomy/`, `.editorconfig`, `.claude/settings.json`, the README project map, the CHANGELOG Unreleased section, the test script. `generator-classification.txt` deleted (superseded by the Atlas). Batch 2 written: eight records in `docs/adr/` (two Mandates, six Decisions, one Correction), every tier and text ratified by questionnaire; the must-read list filled with the two Mandates. Committed as `d362ed2` (CLAUDE.md left out until its new text is applied). Twelve Mandate records (adr-MC…) written by the user for the rulings placed in CLAUDE.md; adr-202610151127 superseded by its Mandate; the project ADR_README's approval section and the README map's two rows (.gitignore, temp/) updated. Session end: the old attribution record's front matter corrected, the index regenerated to 21 records by the hook, two ask rules (bump-my-version, Agent) added to .claude/settings.json; second commit proposed.
- **2026-10-14** · Project familiarisation: README, CONTRIBUTING, CHANGELOG, CITATION, package.json, LICENSE, both taxonomy drafts read in full.
