# Provenance

Where the things in this repository come from.

## Models

Every model is written from its published equations or rules, with no borrowed code. The citation sits at the head of each model's source file and in `CITATION.cff`:

| Model | Source |
|---|---|
| Gray–Scott | Gray & Scott 1984; Pearson 1993 |
| Complex Ginzburg–Landau | Aranson & Kramer 2002; Nicola, Brusch & Bär 2004 |
| Phase-field dendrite | Kobayashi 1993 |
| Reiter snow crystal | Reiter 2005 |
| Gravner–Griffeath snow crystal | Gravner & Griffeath 2008 |
| Lenia | Chan 2019 |
| Cyclic automaton | Fisch, Gravner & Griffeath 1991 |
| Dielectric breakdown | Niemeyer, Pietronero & Wiesmann 1984 |
| Falling sand | Toffoli & Margolus 1987 |
| Abelian sandpile | Bak, Tang & Wiesenfeld 1987 |
| Elementary cellular automaton | Wolfram 1983 |
| Forest fire | Drossel & Schwabl 1992 |
| Potts grain growth | Anderson, Srolovitz, Grest & Sahni 1984 |
| Lattice Boltzmann | Qian, d'Humières & Lallemand 1992 |

Visual inspiration, not code: [pmneila/jsexp](https://github.com/pmneila/jsexp) (BSD-3-Clause).

## Media

- `docs/media/preset-*.png`, `*.gif`: rendered by `tools/render-media.js` from the engine's processor path in Node; reproducible, no screen recording.
- `docs/media/banner/*`: captured through `tools/capture.html` on the graphics-processor path.
- Thumbnails on the demo page: computed by the engine itself after the page loads.

## Documents

- `docs/taxonomy/user-friendly-taxonomy.md`: the user's draft of 2026-10-13/14, a critique, a Claude Opus 5.5 insights section of 2026-10-14 and the user's co-author response. Moved from the repository root on 2026-10-15 with its duplicated Section II and stray citation lines removed.
- `generator-classification.txt` (deleted 2026-10-15): the law-first generator taxonomy of 2026-10-13, superseded by the Morphospaces Atlas.
- `.editorconfig`: copied verbatim from cs-web-folio.
- `tools/adr-index.js`: written for this repository on 2026-10-15; the front-matter and fail-closed pattern follow the folio's `gates/adr_map.py`.
