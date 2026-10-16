# Status

The resume point: priorities, the next action, open threads. A session starts here after CLAUDE.md and the map rows, and ends by updating it. Programme-level priorities for the three repositories (Morphogen, the Morphospaces Atlas, cs-web-folio) are kept here by ruling of 2026-10-15 (adr-202610150312); the other two repositories' status files hold only their own work and point back to this file. History lives in git log and CHANGELOG.md, not here.

## Priorities, in order

| # | Item | State | Notes |
|---|---|---|---|
| 0 | Repository restructure and housekeeping | in progress | Records, map, settings and tooling committed as d362ed2 and aa81f26 on 2026-10-15. The boot-cost restructure of 2026-10-15 (no record read at boot, closed rows leave the files, duplicates consolidated, promoted-Mandate records retired) is applied and awaits its commit. |
| 1 | Morphospaces Atlas: polished, comprehensive, accurate, internally mapped, in the folio's visual standard, thumbnails made | in progress | Migrated into `atlas/` on 2026-10-16: 756 primary records, 29 imaged and sourced; `atlas/data/atlas.json` is canonical and the HTML is to be generated from it. Prerequisite for building Morphogen correctly. |
| 2 | User-friendly taxonomy: polished to a ratified visual-type catalog | in progress | `docs/taxonomy/user-friendly-taxonomy.md`. Prerequisite with item 1. Section VI of that file states the governing principle. |
| 3 | Engine rewrite: ES modules, one build producing a classic bundle and a module build, presets as a JSON single source, generated catalog, ESLint recommended + EditorConfig, TypeScript later | not started | Depends on 1 and 2 for the model and preset set. Becomes the 0.2.0 line. |
| 4 | cs-web-folio re-pinned to the next Morphogen tag | not started | Its lockfile pins a deleted tag; see KNOWN-ISSUES. |

## Next action

The Atlas (priority 1), from a fresh session: declare the record schema; normalise the record-type and temporal vocabularies by tool; a tool of ours for the CSV views and the HTML; then plan the audit under the research rules. The taxonomy (priority 2) alongside, on the user's brief. Before that, this session's end: the synthesis turn, which places the session's rulings by CLAUDE.md, Where a ruling is written, and the commit.

## Open threads

- Synthesis queue: empty.
- `temp/temp-editable-CLAUDE.md` carries the ruled texts for the user to copy into the live file.
- The uncommitted diff of 2026-10-15 and the Atlas migration of 2026-10-16 await a commit proposal.
- The Atlas's own site: a publish-only repository that receives the built site, not yet created (an external action, proposed separately). The source folder `C:\dev\morphospaces-atlas` is retired by the user when ready; its HTML drafts were not imported. The Atlas is versioned with Morphogen unless ruled otherwise. Everything under `atlas/` becomes public at the next push, which the push proposal must state.
