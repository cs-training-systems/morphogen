# Decisions awaiting the user

Open questions, each with the options already laid out so a session can ask it cold. When one is settled it becomes a record in `docs/adr/` and leaves this file.

| Question | Options | Context |
|---|---|---|
| Which formatter, for all three repositories | Prettier (mainstream pairing with ESLint) · Biome (one tool, lint and format) · none | The rewrite reformats every line anyway; the folio currently runs no formatter. Raised 2026-10-15. |
| When TypeScript strict is adopted | with the engine rewrite · after the rewrite lands as 0.2.0 | Ruled as the direction on 2026-10-15; the timing is open. |
| Preset ids `ca-frost` and `cgl-turbulence` | drop the family prefixes · keep | Only these two carry old family prefixes. Noticed 2026-10-15. |
| "Honeycomb" in CHANGELOG 0.1.0 versus "Xylem" in the README and the code | correct the CHANGELOG · leave the historical entry | The preset id is `xylem`. |
| README anchor `#families-and-patterns` versus the heading "Categories, models and presets" | rename the heading · fix the links | Both are in the README's own navigation line. |
| Whether the atemporal class (D0: static constructions) gets its own button or sits under Stepwise | own button · under Stepwise as "constructions" | From the generator classification, now in the Atlas. |
| Final number of visual types in the user-friendly taxonomy | 24 (grid-friendly hypothesis) · whatever the coherence and diversity audit yields, at most 32 | Section VI of the taxonomy: a hypothesis to validate, not a decision. |
| ADR bind keywords: each record declaring the work it binds, with the index tool printing which records bind the current next action | adopt later · never | Borrowed from the folio's `gates/adr_map.py`; not needed until the folder grows. |
| Taxonomy copies: whether the Atlas repository also holds the user-friendly taxonomy | one copy here, the Atlas links to it · a copy in each | Drift risk recorded in RISKS. |
