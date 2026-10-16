# Decisions awaiting the user

Open questions, each with the options already laid out so a session can ask it cold. When one is settled it becomes a record in `docs/adr/` and leaves this file.

| Question | Options | Context |
|---|---|---|
| Which formatter, for all three repositories | Prettier (mainstream pairing with ESLint) · Biome (one tool, lint and format) · none | The rewrite reformats every line anyway; the folio currently runs no formatter. Raised 2026-10-15. |
| When TypeScript strict is adopted | with the engine rewrite · after the rewrite lands as 0.2.0 | Ruled as the direction on 2026-10-15; the timing is open. |
| Preset ids `ca-frost` and `cgl-turbulence` | drop the family prefixes · keep | Only these two carry old family prefixes. Noticed 2026-10-15. |
| Whether the atemporal class (D0: static constructions) gets its own button or sits under Stepwise | own button · under Stepwise as "constructions" | From the generator classification, now in the Atlas. |
| Final number of visual types in the user-friendly taxonomy | 24 (grid-friendly hypothesis) · whatever the coherence and diversity audit yields, at most 32 | Section VI of the taxonomy: a hypothesis to validate, not a decision. |
| ADR bind keywords: each record declaring the work it binds, with the index tool printing which records bind the current next action | adopt later · never | Borrowed from the folio's `gates/adr_map.py`; not needed until the folder grows. |
| Ask-rule syntax in `.claude/settings.json` | colon form (`Bash(git commit:*)`) · space form (`Bash(git commit *)`) | The project uses the space form, which prompted at the 2026-10-15 commit; the CS settings use the colon form. One read of the Claude Code permissions documentation settles it. Raised 2026-10-15. |
| Enforcing CLAUDE.md line 96 in settings | ask rules for every tool that writes, uses, edits, renames, moves, manipulates, downloads, installs, runs or opens: `Edit`, `Write`, `NotebookEdit`, `Bash`, `WebFetch`, `WebSearch`, `Agent` · leave the settings as they are | Raised 2026-10-15. |
| Atlas record ids: `DΔ-P-0105` encodes law and substrate, so a reclassified record changes id and breaks every link to it, and Greek letters do not survive file names (`DDDelta-`) | opaque stable ids with the address as data · keep the encoded ids | Blocks any reference to records from presets (adr-202610150311). Raised 2026-10-16. |
