---
tier: decision
status: accepted
made: 202610161023
supersedes: none
---
# The Morphospaces Atlas lives in atlas/ inside Morphogen, its data canonical, its site published from a publish-only repository

- Source: the user, 2026-10-16, choosing among three shapes and two hosting options; ratified by questionnaire the same day; the migration ran the same day.
- Scope: the Atlas, its data, tools, assets and site; Morphogen's records, map and version.
- Rationale, the user's: the Atlas is the centrepiece of what Morphogen's engine will be built on; one architecture, one rule set and one git must govern both; nothing deprecated migrates.

The Atlas is a folder of this repository, `atlas/`, under Morphogen's CLAUDE.md, records, map and version. Canonical data: `atlas/data/atlas.json` (v0.1.6 edition on import, 766 records); every HTML, CSV or other view is generated from it and checked against it by the build. The public site is built here and pushed to a publish-only repository that holds only the built site, created by a separately proposed external action. The name is Morphospaces Atlas; Pattern Generator Atlas and the edition labels are provenance. Imported untransformed: the data, 29 validated thumbnails, the renderer and build script, the edition's README and changelog; not imported: the HTML drafts, CSV views, duplicates. The Atlas is versioned with Morphogen under the one-version rule.