# Provenance

Where the things in this repository come from.

## Models

Every model is written from its published equations or rules, with no borrowed code except the public-domain random-number routine mulberry32, credited in the source. The sources are in `CITATION.cff` and at the head of each model's source file. Visual inspiration, not code: [pmneila/jsexp](https://github.com/pmneila/jsexp) (BSD-3-Clause).

## Media

- `docs/media/preset-*.png`, `*.gif`: rendered by `tools/render-media.js` from the engine's processor path in Node; reproducible, no screen recording.
- `docs/media/banner/*`: captured through `tools/capture.html` on the graphics-processor path.
- Thumbnails on the demo page: computed by the engine itself after the page loads.
- `atlas/assets/archetypes/*.png`: the 29 thumbnails of the Atlas's v0.1.6 edition; 21 rendered by `atlas/tools/render_thumbnail_batch_v0_1_6.py` from the stated mathematics, 8 preserved from an earlier batch; imported 2026-10-16, not re-rendered here. Converted on 2026-11-11 to opacity masks, in the files and in the data file's `thumbnail` fields: the drawn-in frames cropped (3 to 7 pixels), opacity taken as darkness between the paper level and the ink level `#17191B`, the empty margin trimmed to the drawing's bounding box, the result centred in a square with a 3% margin; nothing resampled. The Mandelbrot picture's grey ground was taken as its paper level, which drops its lighter boundary bands. The images as imported are in the owner's private backup of the pre-restart history (its commit e01a64d), not in the current repository.

## Documents

- `docs/taxonomy/user-friendly-taxonomy.md`: the user's draft of 2026-10-13/14, a critique, a Claude Opus 5.5 insights section of 2026-10-14 and the user's co-author response. Moved from the repository root on 2026-10-15 with its duplicated Section II and stray citation lines removed.
- `generator-classification.txt` (deleted 2026-10-15): the law-first generator taxonomy of 2026-10-13, superseded by the Morphospaces Atlas.
- `.editorconfig`: copied verbatim from cs-web-folio.
- `tools/adr-index.js`: written for this repository on 2026-10-15; the front-matter and fail-closed pattern follow the folio's `gates/adr_map.py`.
- `atlas/`: imported 2026-10-16 from `C:\dev\morphospaces-atlas`, the v0.1.6 package of 2026-10-14. The classification scheme and its definitions are the user's; the data serialisation, the renderer, the build script and the HTML of that edition were produced by GPT at the user's direction. The four HTML drafts (v1.3, v1.7, v0.1.5, v0.1.6) stayed in the source folder and were not imported.
- `atlas/index.html`, `atlas/atlas.css`, `atlas/atlas.js`: written for this repository on 2026-11-11. The page's own text, and its plain-language lines for the laws and substrates in `atlas.js`, are written from the Atlas README, the Mandate on the law-first citation order and the data file's definitions; everything else on the page is read from `atlas/data/atlas.json`.
- `atlas/data/atlas.json` was migrated on 2026-11-13 by a one-off script, run once and not kept, to the notation ruled on 2026-11-12 and 2026-11-13. Each record's id became its four-digit number, and the id it had before is kept as `former_id`. Each `law` value became the class name, with the class's sign stored once under `laws`. The Symbolic carrier's letter changed from C to S. Routes mentioned in entry text were rewritten in the form `Δ-L`. Every cross-reference was checked to resolve before the file was written. The 29 picture files in `atlas/assets/archetypes/` were renamed to their record numbers.
