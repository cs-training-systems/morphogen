---
tier: decision
status: accepted
made: 202610150311
supersedes: none
---
# Presets have one source, a JSON data file, and the catalog is generated from it

- Source: the user, 2026-10-15, choosing among three options Claude laid out. Ratified by questionnaire the same day.
- Scope: the engine, the presets catalog and the migration of `src/70-presets.js`. Done at priority 3 of `docs/STATUS.md`.

`src/data/presets.json` holds categories, tiles and presets with the reproducibility fields (generator id and version, parameters, initial conditions, seed policy, boundary and resolution, temporal window, rendering, external input) and the prose fields (description, visual type, Atlas address, provenance). The engine imports it.

`tools/catalog.js` renders `docs/catalog/presets.md`, headed as generated and never edited by hand.

`src/70-presets.js` is split in the rewrite: its data to the JSON file, its rule parser and auto-mount to their own modules; the owner-ruling comments inside it become provenance entries.

Presets kept in code with a prose sidecar is kept only as the fallback if the migration must be smaller.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Correction 202610161023: the preset rulings are provenance entries, not records

- Refines: adr-202610150311
- Status: accepted
- Source: the user, 2026-10-16; ratified by questionnaire the same day.

The dated owner-ruling comments in src/70-presets.js and the model files are data provenance. At the rewrite they move into the provenance fields of src/data/presets.json; none becomes a record, so the headline's "become records or provenance entries" reads "become provenance entries". Some describe presets that will not be kept and some are erroneous; the migration judges each.