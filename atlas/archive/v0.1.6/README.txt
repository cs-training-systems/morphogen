PATTERN GENERATOR ATLAS — v0.1.6
=================================

STATUS
------
This version is an incremental mathematics-first visual pass, not a completed image atlas.
Canonical records in data: 756
Canonical records with displayed, computed archetype assets: 29
Canonical records whose archetype images remain pending: 727
Assets regenerated in this batch: 21
Of those, existing thumbnail corrections: 14; additional records: 7. A record-by-record visual review ledger is included as visual_review_v0.1.6.csv.
Active generated thumbnail pixel duplicates detected: 0

NON-NEGOTIABLE HARD RULES (MUST HOLD THROUGHOUT THE ENTIRE PROJECT)
==================================================================
EVERY CANONICAL ENTRY MUST BE PERFECTLY MAPPED TO ALL FIVE DIMENSIONS: LAW ARCHITECTURE, MATHEMATICAL SUBSTRATE, MECHANISM FAMILY, MECHANISM CLASS/SUBTYPE, AND RECORD TYPE. EVERY SINGLE COMBINATION OF FILTER SELECTIONS MUST INSTANTLY RETURN THE EXACT INTERSECTION OF THE CANONICAL DATA; AVAILABLE OPTIONS/COUNTS MUST RECOMPUTE AGAINST ALL OTHER ACTIVE SELECTIONS. NO HAND-MAINTAINED VOCABULARY MAY DRIFT FROM THE DATA.

EVERY DISPLAYED IMAGE MUST BE A MATHEMATICALLY AUTHENTIC, ARCHETYPALLY RECOGNIZABLE, RECORD-SPECIFIC IMAGE GENERATED FROM THE ACTUAL EQUATION, RULE, OR GEOMETRIC/COMBINATORIAL CONSTRUCTION OF THAT RECORD, OR FROM AN EXPLICITLY BOUNDED AND SOURCE-REFERENCED FORMULATION. A GENERIC GLYPH, A DIFFERENT MODEL, OR DECORATIVE NOISE IS UNACCEPTABLE. IF THE REQUIRED MATHEMATICS AND VISUAL SIGNATURE ARE NOT IMPLEMENTED AND CHECKED, WITHHOLD THE IMAGE AND LABEL IT AUTHENTIC ARCHETYPE PENDING.

EVERY THUMBNAIL MUST BE SQUARE. SOURCE ASSETS ARE 118×118 PX AND DISPLAYED AT 59×59 PX, WITH A SHARP ONE-PIXEL BORDER AND CONSISTENT INSET. NO WIDESCREEN THUMBNAIL CELL IS PERMITTED. ZOOM OR CROP MUST BE DOCUMENTED AND MUST NOT CHANGE THE MODEL'S MATHEMATICS.

NO EXACT DUPLICATE IMAGES OR REUSED PARENT/SUB-RECORD IMAGES. BEGIN WITH SPECIFIC NAMED INSTANCES, NOT GENERIC PLACEHOLDERS. An image can be reused only where the records are the same mathematical object and are explicit aliases; otherwise compute a separate record-specific depiction.

DO NOT TRACE, MIRROR, ROTATE, OR COSMETICALLY ALTER A WEB IMAGE. Reference images may be consulted to identify the canonical visual signature and to verify the math, but all published thumbnails must be recomputed from the actual mathematical specification. Underlying mathematical structures are not copyrightable in the same way an artist's particular fixed expression may be; that does not make cosmetic transformation of a source figure an acceptable workflow.

EVERY GENERATED IMAGE MUST HAVE A REPEATABLE PROCEDURE: exact record ID; formal equation or transition/construction rule; parameter values; initial condition; boundary condition; external forcing; random seed and random-law convention if stochastic; discretization/numerical algorithm; number of steps/iterations; display/crop rule; renderer name/version; output dimensions; source references; and an audit rationale. Any approximation (for example, an implicit nodal surface used to evoke a minimal-surface family) must be explicitly called an approximation rather than mislabeled as an exact solution.

COMMON VISUAL GRAMMAR: #FFFEF9 paper, #17191B black, #AEB4BA grey, and optional #63676B midpoint; thin lines, sharp edges, square framing. Mathematical recognizability is more important than forcing every model into identical decoration.

REPRODUCIBLE PROCESS
--------------------
1. Start from the canonical record ID; reject aliases, methods, family-only records, or child instances unless the image is explicitly about that object type.
2. Read the record's scope/formulation and select a source that defines the actual equation/rule or geometric construction. A general model name is not sufficient when formulations differ.
3. Write down the math and choose one canonical example: initial state; parameters; domain; boundary condition; stochastic law/seed; time/update convention; approximation and run length.
4. Implement the math as a named Python function in render_thumbnail_batch_v0_1_6.py. Do not copy source pixels. A reference image is for identity-checking only.
5. Compute the trajectory/state/object directly from the stated math. Render a square, use the standard palette/line styling, and maintain exact 1:1 aspect.
6. Record the full basis and source URL in thumbnail_process_manifest_v0.1.6.csv. The PNG asset, HTML data URI, canonical record, and manifest must agree.
7. Inspect the individual result and contact sheet. Check that the named visual feature is present, the image is not a generic family resemblance, and no already-used image represents a different model.
8. Validate output dimensions, successful deterministic replay from fixed seed/parameters, source mapping, image-hash duplicates, GUI rendering, and filter behavior. A pixel hash check only detects exact raster duplicates; it does not prove semantic uniqueness or mathematical truth.
9. If any criterion fails, correct the renderer or withhold the image. Never use a provisional drawing while displaying a validation badge.

THIS BATCH (v0.1.6)
-------------------
Updated from specified math/rules: Fibonacci word curve; Day & Night; Biham–Middleton–Levine traffic; Cantor set; Arnold cat map; Ikeda map; medial axis of two rippled sheet lobes; Schwarz-P nodal approximation; Nagel–Schreckenberg traffic; Newton basin for z^3−1; power diagram; Thomas Gaussian-offspring cluster process; open-boundary TASEP; Wireworld. Seven additional computed archetypes: Mandelbrot set, Sierpiński triangle, Koch snowflake construction, Gray–Scott reaction–diffusion, diffusion-limited aggregation, Lorenz attractor, and Poisson–Voronoi tessellation.

Important bounded choices:
- Fibonacci curve: a word-generated turn curve. Fibonacci words are not inherently graphical; this record's image is explicitly this canonical turn-curve interpretation.
- Arnold cat map: a custom project-designed cat silhouette mapped by (x,y) → (2x+y,x+y) mod 1; the silhouette is original and the transformation is the actual toral map.
- Minimal surface: a Schwarz-P triply periodic minimal-surface archetype approximated by the nodal equation cos x + cos y + cos z = 0 and extracted via marching cubes. This nodal approximation is NOT claimed to be the exact H=0 minimal surface.
- Thomas process: one fixed seed, 20 IID Uniform([0,1]^2) parent locations, Poisson(5) offspring counts, Gaussian offset σ=0.014; seed chosen for legible clusters. This is a selected sample, not statistical evidence about the law.
- Gray–Scott: stated two-field PDE with Du=.16, Dv=.08, F=.025, k=.060; periodic 128×128 finite-difference grid, central perturbation, dt=.2, 15,000 steps.
- DLA: finite lattice random walk/attachment realization; view is a documented square crop around the actual cluster.
- Power diagram: rings mark generating sites for legibility; rings are graphical annotations, not part of the weighted Voronoi partition itself.
- Ikeda and Newton visuals use computed orbit/basin density with a grayscale encoding; tone does not represent an additional physical state.

REGENERATING THIS BATCH
-----------------------
Environment: Python 3, Pillow, NumPy, SciPy, scikit-image, CairoSVG (used only for contact-sheet ingestion of existing SVG thumbnails). Run:
  python render_thumbnail_batch_v0_1_6.py
Extract the full ZIP into a single writable directory, preserving the base HTML and JSON manifest included in the archive. Run both scripts from that directory:
  python render_thumbnail_batch_v0_1_6.py
  python build_release_v0_1_6.py
The renderer writes square PNG assets and a manifest next to the script. The build checks canonical IDs, square 118×118 assets, source links and exact pixel-hash duplicates; embeds generated assets into the HTML/JSON; exports CSV views; and rebuilds the contact sheet and ZIP.

SCOPE HONESTY
-------------
The atlas still has 727 canonical records pending an individually specified and visually reviewed archetype, plus auxiliary methods whose thumbnails have their own separate method-vs-model semantics. The current batch is not a claim that every old record has been source-verified. Filters are schema-derived and data-driven, but an independent semantic mapping audit remains necessary. An image can be reproducible and still be the wrong image; recognizability and model-specific mathematical correspondence must be assessed at the individual record level.
