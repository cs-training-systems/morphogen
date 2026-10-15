# Known issues

| Issue | Effect | Found | Status |
|---|---|---|---|
| cs-web-folio pins Morphogen at `github:cs-training-systems/morphogen#v2.0.0-beta.2`, a tag that no longer exists on GitHub. | The folio still builds because its lockfile resolved the tag to commit `7ba1c60`, which is still in history. Any re-resolution of the tag (`npm update morphogen`, a lockfile rebuild) fails. The folio runs an engine six releases behind. | 2026-10-15 | open; re-pin at the next Morphogen tag (STATUS priority 4) |
| The 0.6.0 renumbering removed the earlier tags (v1.0.0 … v2.0.0-beta.3), against CONTRIBUTING's rule that a tag is never moved or reused. Only `v0.1.0` exists. | Downstream pins to the old tags break on re-resolution; the CHANGELOG's mapping is the only record of the old numbers. | 2026-10-15 | recorded; no repair possible without recreating tags, which is a ruling for the user |
| CHANGELOG 0.1.0 names a Gray–Scott preset "Honeycomb"; the README and the code call it "Xylem" (`xylem`). | A reader of the changelog cannot find the preset. | 2026-10-14 | open; see PENDING |
| The README's navigation links to `#families-and-patterns`, but the heading is "Categories, models and presets". | The link lands on nothing. | 2026-10-14 | open; see PENDING |
| The version is declared in five places (package.json, CITATION.cff, the script header, the README install line, the CHANGELOG heading) with no bump tool. | A bump must be hand-edited in five files, against CLAUDE.md's one-source rule. | 2026-10-15 | open; a bump tool is part of the engine rewrite batch |
