#!/usr/bin/env python3
"""Build Pattern Generator Atlas v0.1.6 from canonical DB and computed archetypes."""
from pathlib import Path
import json, re, base64, csv, io, hashlib, zipfile, shutil, html
from PIL import Image, ImageDraw, ImageFont
import cairosvg

ROOT=Path(__file__).resolve().parent
HTML_IN=ROOT/'Pattern_Generator_Atlas_v0.1.5.html'
SCRIPT=ROOT/'render_thumbnail_batch_v0_1_6.py'
MANIFEST=ROOT/'thumbnail_manifest_v0.1.6.json'
ASSETS=ROOT/'archetypes_v0.1.6'
HTML_OUT=ROOT/'Pattern_Generator_Atlas_v0.1.6.html'
DATA_OUT=ROOT/'pattern_generator_atlas_data_v0.1.6.json'
CAT_OUT=ROOT/'pattern_generator_catalog_v0.1.6.csv'
METHOD_OUT=ROOT/'pattern_generator_methods_v0.1.6.csv'
PROC_OUT=ROOT/'thumbnail_process_manifest_v0.1.6.csv'
README_OUT=ROOT/'README_Pattern_Generator_Atlas_v0.1.6.txt'
CHANGE_OUT=ROOT/'CHANGELOG_Pattern_Generator_Atlas_v0.1.6.txt'
VALID_OUT=ROOT/'validation_report_v0.1.6.txt'
VISUAL_REVIEW_OUT=ROOT/'visual_review_v0.1.6.csv'
CONTACT_OUT=ROOT/'contact_sheet_v0.1.6_batch.png'
ZIP_OUT=ROOT/'Pattern_Generator_Atlas_v0.1.6_Full_Package.zip'

html_source=HTML_IN.read_text(encoding='utf-8')
needle='const DB = '
pos=html_source.index(needle)+len(needle)
db, consumed=json.JSONDecoder().raw_decode(html_source[pos:])
manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
record_by_id={r['id']:r for r in db['records'] if r.get('primary') is True}
source_index={s[1]:i for i,s in enumerate(db.get('sources',[])) if len(s)>1}

# The Fibonacci curve convention requires the explicit source that documents the forward/turn construction.
extra_sources=[('Fibonacci curve F17 (reference for the turn-curve convention)','https://commons.wikimedia.org/wiki/File:Fibonacci_curve_F17.svg','Reference consulted for the canonical Fibonacci word curve convention; the displayed image is recomputed from the word and turn rule, not copied or traced.')]
for title,url,note in extra_sources:
    if url not in source_index:
        source_index[url]=len(db['sources']); db['sources'].append([title,url,note])

# Apply generated, record-specific square assets.
missing=[]
for m in manifest:
    rid=m['id']
    rec=record_by_id.get(rid)
    if rec is None:
        missing.append(rid); continue
    path=ASSETS/m['asset']
    if not path.exists():
        missing.append(rid+' (missing asset '+str(path)+')'); continue
    im=Image.open(path).convert('RGB')
    if im.size!=(118,118): raise ValueError(f'{rid} image is {im.size}, not 118x118')
    if path.stat().st_size < 200: raise ValueError(f'{rid} suspiciously small asset')
    uri='data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
    rec['thumbnail']=uri
    rec['thumbnail_status']='computed_or_validated_archetype'
    rec['thumbnail_renderer']='render_thumbnail_batch_v0_1_6.py::'+m['renderer']
    rec['thumbnail_basis']=m['basis']
    rec['thumbnail_alt']='Square mathematical archetype for '+rec['name']+'. '+m['basis']
    rec['thumbnail_audit_note']='Generated directly from the stated equation, transition rule, construction, or explicitly bounded stochastic realization. No source-image pixels are traced, mirrored, or cosmetically transformed. The full basis, fixed seed, parameters and renderer are in thumbnail_process_manifest_v0.1.6.csv.'
    rec['thumbnail_status_detail']='Computed at 236×236 and reduced to 118×118 in a square viewport. Contact-sheet and selected full-size review performed for this batch; this is not a substitute for the equation/rule and formulation notes recorded here.'
    rec['thumbnail_source_url']=m['source_url']
    rec['thumbnail_render_seed'] = m.get('seed')
    rec['thumbnail_palette'] = '#FFFEF9 background; #17191B black; #AEB4BA grey; optional #63676B midpoint'
    # Every displayed rendered archetype gets at least its mathematical-basis reference.
    urls=[m['source_url']]
    if rid=='D0-C-0225': urls.append('https://commons.wikimedia.org/wiki/File:Fibonacci_curve_F17.svg')
    for url in urls:
        if url not in source_index:
            # Fall back to metadata from renderer manifest for the normal source.
            if url==m['source_url']:
                source_index[url]=len(db['sources']); db['sources'].append([m['source_title'],url,m['source_note']])
            else:
                source_index[url]=len(db['sources']); db['sources'].append(['Fibonacci curve F17 reference',url,'Canonical curve-rule reference only; source image is not reused.'])
        refs=rec.setdefault('source_refs',[])
        if source_index[url] not in refs: refs.append(source_index[url])

if missing:
    raise RuntimeError('Missing target records/assets: '+', '.join(missing))

# Primary counts and explicit hard rules. Never present the remaining catalog as validated.
prim=[r for r in db['records'] if r.get('primary') is True]
rendered=[r for r in prim if r.get('thumbnail_status')=='computed_or_validated_archetype' and r.get('thumbnail')]
pending=[r for r in prim if not r.get('thumbnail') or r.get('thumbnail_status')=='pending_individual_visual_audit']
# Keep consistent actual counts after this batch.
db['edition']='v0.1.6 — square archetype correction pass and 7 additional mathematical renderers'
db['audit_summary']['stage']='v0.1.6. Fourteen previously generated archetypes were recomputed from their bounded mathematical specifications, and seven additional record-specific archetypes were added. All other images remain withheld pending their own source/math/renderer audit.'
db['audit_summary']['thumbnail_specificity']='v0.1.6 batch 2: 21 specific mathematical renderers (14 revised images and 7 additional records). All output assets are square 118×118 PNGs generated from equations, recurrence/CA rules, geometric constructions, or explicitly stated seeded stochastic realizations. The source verifies the law/standard visual identity; no web-image pixels are copied or traced. A reference image is never a substitute for implementing the rule.'
db['audit_summary']['primary_thumbnail_uniqueness']=f'{len(rendered)} active primary thumbnails have individually addressed assets; exact decoded-pixel duplicate check is performed for all active assets during build. Distinct file hashes alone do not certify semantic distinctness.'
db['audit_summary']['quality_checks']['primary_records']=len(prim)
db['audit_summary']['quality_checks']['thumbnail_rendered']=len(rendered)
db['audit_summary']['quality_checks']['thumbnail_pending']=len(pending)
db['audit_summary']['quality_checks']['new_computed_archetypes']=len(manifest)
db['audit_summary']['quality_checks']['prior_images_revised']=14
db['audit_summary']['quality_checks']['exact_thumbnail_duplicate_hashes']=None
db['audit_summary']['remaining_pending_count']=len(pending)
db['audit_summary']['thumbnail_method']='REPEATABLE RECORD-LEVEL PROCEDURE: (1) choose the canonical record, not its alias, parent family, method, or renderer; (2) confirm the actual formal model and a source for its rule/equation; (3) specify a single bounded archetype, including equations/transition table, parameters, initialization, boundary conditions, seed, discretization, number of updates/iterations and display window; (4) implement that exact law in a named Python renderer; (5) render the computed state/object into a square 236×236 working image and downsample to a 118×118 asset; (6) use the fixed thin-line/paper/black/grey/midpoint palette without inventing structural details; (7) record source URL, rule, parameters, RNG seed, renderer and rationale; (8) inspect full-size cases and a contact sheet; (9) compare against active thumbnails and sub-record relationships; (10) leave a record visibly pending if the image is schematic, the equation is under-specified, the renderer does not actually implement the rule, or the result is not recognizable. Reference images are for finding the canonical visual signature, not for tracing; do not mirror or rotate source images.'
db['audit_summary']['hard_rules']=[
'HARD RULE — FIVE-DIMENSION MAPPING: EVERY CANONICAL ENTRY MUST HAVE ACCURATE VALUES FOR LAW ARCHITECTURE, SUBSTRATE, MECHANISM FAMILY, MECHANISM CLASS/SUBTYPE, AND RECORD TYPE FROM THE SAME CANONICAL DATA. ANY SELECTION OR MIXED FILTER COMBINATION MUST INSTANTLY SHOW THE EXACT INTERSECTION; EACH FILTER’S OPTIONS/COUNTS MUST BE RECOMPUTED AGAINST THE OTHER ACTIVE SELECTIONS. NO MISSING OR HAND-WRITTEN DESYNCHRONIZED VALUES.',
'HARD RULE — ARCHETYPAL MATHEMATICAL VISUAL: EVERY DISPLAYED IMAGE MUST BE A RECOGNIZABLE, RECORD-SPECIFIC REPRESENTATION GENERATED FROM THE ACTUAL EQUATION, TRANSITION RULE, OR GEOMETRIC/COMBINATORIAL CONSTRUCTION OF THAT RECORD, OR FROM AN EXPLICITLY BOUNDED, SOURCE-REFERENCED FORMULATION. DO NOT SUBSTITUTE A GENERIC FAMILY ICON, A DIFFERENT MODEL, OR A RANDOM DECORATION. IF NOT VERIFIED, WITHHOLD THE IMAGE AND DISPLAY AUTHENTIC ARCHETYPE PENDING.',
'HARD RULE — REPRODUCIBILITY: STORE THE EQUATION/RULE, FORMULATION, PARAMETERS, INITIAL STATE, BOUNDARY CONDITIONS, FORCING, RNG SEED IF STOCHASTIC, DISCRETIZATION/NUMERICAL METHOD, RUN LENGTH, RENDERER ID, ALT TEXT, AND SOURCE REFERENCES FOR EVERY COMPUTED ARCHETYPE.',
'HARD RULE — UNIQUENESS: START WITH SPECIFIC NAMED INSTANCES; NEVER REUSE A SUB-RECORD/SUB-INSTANCE IMAGE FOR ITS PARENT OR ANOTHER RECORD. DO NOT ACCEPT DUPLICATE IMAGES MERELY BECAUSE THEIR FILE NAMES OR HASHES DIFFER. Exact mathematical duplicates must become alias redirects; distinct formulations and regimes stay separate when their laws differ.',
'HARD RULE — SQUARE CELL: EVERY PRIMARY VISUAL-GLOSSARY THUMBNAIL AND EVERY EXPANDED-RECORD THUMBNAIL MUST BE SQUARE. Working source and displayed thumbnail images are 1:1 (118×118 asset, 59×59 display), with a consistent one-pixel card border and inset; no record uses a widescreen image cell.',
'HARD RULE — NO WEB-IMAGE TRACING: CONSULT REFERENCES TO IDENTIFY A MODEL’S DEFINING LAW AND CANONICAL VISUAL SIGNATURE, THEN RECOMPUTE A NEW IMAGE FROM THAT LAW. NEVER TRACE, MIRROR, ROTATE, OR COSMETICALLY ALTER A WEB IMAGE. Do not claim copyright safety simply because the image was transformed.',
'HARD RULE — COMMON VISUAL GRAMMAR: USE PAPER #FFFEF9, BLACK #17191B, GREY #AEB4BA, AND OPTIONAL MIDPOINT #63676B; use thin lines and sharp borders. Mathematics and recognition take precedence over decoration.'
]
# update status summary
qc=db['audit_summary']['quality_checks']
qc['aliases_without_primary_thumbnail']=sum(1 for r in db['records'] if r.get('primary') is False and not r.get('thumbnail'))
qc['batch_errors']=[]
db['audit_summary']['source_provenance']='For the v0.1.6 batch, source links document the equation/rule and canonical identity. Each displayed image is generated anew from the recorded mathematics. No web-image asset is used as a pixel source. Source citations do not certify that the entire legacy catalog is individually verified.'
db['audit_summary']['visual_palette']='Paper #FFFEF9, black #17191B, grey #AEB4BA, optional midpoint #63676B. All active thumbnails are square 118×118 PNG assets, displayed at 59×59 in the GUI.'

# Build updated HTML by replacing embedded canonical DB.
obj=json.dumps(db,ensure_ascii=False,separators=(',',':'))
newhtml=html_source[:pos]+obj+html_source[pos+consumed:]
newhtml=newhtml.replace('Pattern Generator Atlas v0.1.5 — Mathematics-first Archetype Batch 1','Pattern Generator Atlas v0.1.6 — Mathematics-first Archetype Batch 2')
newhtml=newhtml.replace('<strong>VERSION 0.1.5 HARD RULES — NON-NEGOTIABLE:</strong>','<strong>VERSION 0.1.6 HARD RULES — NON-NEGOTIABLE:</strong>')
newhtml=newhtml.replace('Audit adjudication &amp; visual authenticity · v0.1.5','Audit adjudication &amp; visual authenticity · v0.1.6')
newhtml=newhtml.replace('Pattern Generator Atlas v0.1.5 · Strict visual authenticity gate','Pattern Generator Atlas v0.1.6 · Strict visual authenticity gate')
# Make all source thumbnails square independent of intrinsic image dimensions.
newhtml=newhtml.replace('.visual-tile img{display:block;width:59px;height:59px;object-fit:contain;', '.visual-tile img{display:block;width:59px;height:59px;aspect-ratio:1/1;object-fit:contain;')
newhtml=newhtml.replace('.thumb{width:59px;height:59px;object-fit:contain;', '.thumb{width:59px;height:59px;aspect-ratio:1/1;object-fit:contain;')
# Versioned release notice inserted before the tabs; existing high-level filter-authenticity notice remains.
anchor='<nav class="tabs" aria-label="Main navigation">'
notice='<div class="notice"><strong>VISUAL PASS v0.1.6.</strong> 14 archetypes were recomputed and 7 additional mathematical archetypes added. Each active image is a square, fixed-palette rendering with its own named renderer, explicit mathematical basis, run conditions, and source reference. This is a staged visual batch, not a claim that all 756 canonical records have verified images; all unprocessed images remain withheld.</div>'
if anchor not in newhtml: raise RuntimeError('tabs anchor absent')
newhtml=newhtml.replace(anchor,notice+anchor,1)
HTML_OUT.write_text(newhtml,encoding='utf-8')
DATA_OUT.write_text(json.dumps(db,ensure_ascii=False,indent=2),encoding='utf-8')

# Export canonical record table.
fields=['id','primary','law','substrate','family','subtype','record_type','name','gloss','condition','temporal','randomness_source','thumbnail_status','thumbnail_renderer','thumbnail_alt','thumbnail_basis','thumbnail_source_url','source_refs','related_to','aliases']
with CAT_OUT.open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore'); w.writeheader()
    for r in db['records']:
        rr=dict(r); rr['source_refs']=';'.join(map(str,r.get('source_refs',[]))); rr['related_to']=';'.join(map(str,r.get('related_to',[]))); rr['aliases']=json.dumps(r.get('aliases',[]),ensure_ascii=False); w.writerow(rr)
fields2=['id','law','substrate','family','subtype','record_type','name','gloss','condition','temporal','randomness_source','thumbnail_status','thumbnail_renderer','thumbnail_alt','thumbnail_basis','source_refs','related_to']
with METHOD_OUT.open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=fields2,extrasaction='ignore');w.writeheader()
    for r in db['methods']:
        rr=dict(r); rr['source_refs']=';'.join(map(str,r.get('source_refs',[])));rr['related_to']=';'.join(map(str,r.get('related_to',[])));w.writerow(rr)
# copy renderer CSV manifest (and augment seed/palette checks if needed)
# Renderer already wrote PROC_OUT directly; no same-file copy needed.

# Uniqueness: compute exact decoded pixel hashes of every active primary thumbnail.
def data_uri_image(uri):
    if not uri: return None
    if uri.startswith('data:image/png;base64,'):
        raw=base64.b64decode(uri.split(',',1)[1]); return Image.open(io.BytesIO(raw)).convert('RGB')
    if uri.startswith('data:image/svg+xml;base64,'):
        raw=base64.b64decode(uri.split(',',1)[1]); png=cairosvg.svg2png(bytestring=raw,output_width=118,output_height=118); return Image.open(io.BytesIO(png)).convert('RGB')
    if uri.startswith('data:image/svg+xml,'):
        from urllib.parse import unquote
        raw=unquote(uri.split(',',1)[1]).encode('utf-8');png=cairosvg.svg2png(bytestring=raw,output_width=118,output_height=118);return Image.open(io.BytesIO(png)).convert('RGB')
    return None
hashes={}; duplicates=[]; active_imgs=[]
for r in prim:
    if not r.get('thumbnail') or r.get('thumbnail_status')!='computed_or_validated_archetype': continue
    im=data_uri_image(r['thumbnail'])
    if im is None: continue
    if im.size!=(118,118): raise ValueError((r['id'],'thumbnail not square 118'))
    digest=hashlib.sha256(im.tobytes()).hexdigest()
    if digest in hashes: duplicates.append((hashes[digest],r['id']))
    else: hashes[digest]=r['id']
    active_imgs.append((r,im))
qc['exact_thumbnail_duplicate_hashes']=len(duplicates)
qc['exact_thumbnail_duplicate_pairs']=duplicates
# Force DB values into actual counts after validation.
DBJSON=json.dumps(db,ensure_ascii=False,separators=(',',':'))
# We changed qc after HTML/data output; re-serialize finalized DB and update embedded block one more time.
newhtml=HTML_OUT.read_text(encoding='utf-8')
pos2=newhtml.index('const DB = ')+len('const DB = ')
_,cons2=json.JSONDecoder().raw_decode(newhtml[pos2:])
newhtml=newhtml[:pos2]+DBJSON+newhtml[pos2+cons2:]
HTML_OUT.write_text(newhtml,encoding='utf-8')
DATA_OUT.write_text(json.dumps(db,ensure_ascii=False,indent=2),encoding='utf-8')

# Contact sheet of ALL active canonical thumbnails; square images and labels are only review metadata outside each cell.
active_imgs.sort(key=lambda ri:(ri[0]['name'].casefold(),ri[0]['id']))
cols=5; tile=162; gap=12; head=28; label_h=45; rows=(len(active_imgs)+cols-1)//cols
sheet=Image.new('RGB',(gap+cols*(tile+gap),gap+rows*(head+tile+label_h+gap)),(245,245,239))
draw=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',10); small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',9)
except: font=small=ImageFont.load_default()
for i,(r,im) in enumerate(active_imgs):
    x=gap+(i%cols)*(tile+gap); y=gap+(i//cols)*(head+tile+label_h+gap)
    draw.text((x,y),r['id'],font=small,fill=(80,85,90))
    # thumbnail cell has a sharp border and a square image; enlarge for contact-sheet review only.
    card=Image.new('RGB',(tile,tile),(255,254,249)); im=im.resize((118,118),Image.Resampling.NEAREST); im=im.resize((tile-20,tile-20),Image.Resampling.NEAREST); card.paste(im,(10,10)); cd=ImageDraw.Draw(card); cd.rectangle((0,0,tile-1,tile-1),outline=(174,180,186),width=1)
    sheet.paste(card,(x,y+head))
    name=r['name'].split(' (')[0]
    # wrap labels to 25 chars on two lines, without changing image contents.
    words=name.split(); lines=[]; current=''
    for word in words:
        if len((current+' '+word).strip())>25 and current: lines.append(current);current=word
        else: current=(current+' '+word).strip()
    if current:lines.append(current)
    for j,line in enumerate(lines[:3]): draw.text((x,y+head+tile+4+j*12),line,font=font,fill=(23,25,27))
sheet.save(CONTACT_OUT,optimize=True)

# Process README: exact repeats, versioning and hard rules.
readme=f'''PATTERN GENERATOR ATLAS — v0.1.6
=================================

STATUS
------
This version is an incremental mathematics-first visual pass, not a completed image atlas.
Canonical records in data: {len(prim)}
Canonical records with displayed, computed archetype assets: {len(rendered)}
Canonical records whose archetype images remain pending: {len(pending)}
Assets regenerated in this batch: {len(manifest)}
Of those, existing thumbnail corrections: 14; additional records: 7. A record-by-record visual review ledger is included as visual_review_v0.1.6.csv.
Active generated thumbnail pixel duplicates detected: {len(duplicates)}

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
The atlas still has {len(pending)} canonical records pending an individually specified and visually reviewed archetype, plus auxiliary methods whose thumbnails have their own separate method-vs-model semantics. The current batch is not a claim that every old record has been source-verified. Filters are schema-derived and data-driven, but an independent semantic mapping audit remains necessary. An image can be reproducible and still be the wrong image; recognizability and model-specific mathematical correspondence must be assessed at the individual record level.
'''
README_OUT.write_text(readme,encoding='utf-8')
CHANGE_OUT.write_text(f'''Pattern Generator Atlas — Changelog v0.1.6
=========================================

- Kept edition numbering on the 0.0.X track; current edition is v0.1.6.
- Recomputed 14 previously active archetype assets using explicit equation/rule/construction implementations.
- Added seven specific computed archetypes: Mandelbrot set, Sierpiński triangle, Koch snowflake, Gray–Scott, DLA, Lorenz system, and Poisson–Voronoi tessellation.
- Corrected Gray–Scott parameter/time setup to produce visible spots under a stable explicit-Euler finite-difference integration.
- Expanded DLA cluster display through a documented square crop centered on the computed aggregate.
- Refined BML diagonal jamming band crop, NaSch space-time density rendering, Ikeda orbit-density contours, Wireworld signal-state rendering, medial-axis sheet silhouette, and Thomas point-process visibility.
- Preserved the previous Lozi, HighLife, Seeds, Thue–Morse, Peano and Matérn archetypes unchanged; Baker’s map and Circle map are also carried forward unchanged.
- Enforced square 118×118 thumbnail assets with 59×59 GUI displays.
- Added an algorithmic manifest, a contact sheet for all active archetypes, build/validation scripts, and stronger README hard rules.
- All legacy records without record-specific validated images remain withheld; no generic placeholder has been substituted.
''',encoding='utf-8')

# Human-readable audit trail for every correction and each added computed archetype.
visual_reviews=[
('D0-C-0225','Fibonacci word','Recomputed a square turn-curve from the Fibonacci word recurrence and parity-dependent turn rule; no source pixels reused.','Mathematical construction; image is explicitly a curve interpretation of the word.'),
('DΔ-L-0156','Day & Night','Square viewport; direct B3678/S34678 synchronous CA realization.','Central field fills the square image inset.'),
('DΔ-L-0182','Biham–Middleton–Levine traffic','Ran 145 east-then-north updates at density 0.35; used a centered 80×80 square crop of the computed torus state to expose diagonal jamming bands.','Random initial traffic can remain visually noisy; bands are a particular seeded realization.'),
('D0-G-0078','Cantor set','Darkened middle-third construction lines slightly; seven finite stages computed by interval removal.','Finite stages are shown; the infinite set is the limit.'),
('DΔ-P-0113','Arnold cat map','Original cat silhouette transformed by (x,y)→(2x+y,x+y) mod 1.','Original silhouette; transform is the actual toral map.'),
('DΔ-P-0111','Ikeda map','Computed 260,000 iterates after burn-in and overlaid thin computed orbit-density level contours.','Tones represent orbit density, not an extra physical state.'),
('D0-G-0095','Medial axis','Computed Euclidean medial axis of a defined two-lobed, curvilinear mask; grey lines are clipped sheet striations.','The black skeleton is computed from the stated region mask.'),
('D0-G-0084','Minimal surface','Computed a Schwarz-P triply periodic nodal approximation cos x+cos y+cos z=0 with marching cubes and 3D projection.','Explicitly an approximation; not claimed to be the exact H=0 minimal surface.'),
('S-L-0784','Nagel–Schreckenberg traffic CA','Simulated acceleration/gap braking/randomization/motion and plotted computed space-time occupancy with density-smoothed bands.','Black marks occupied cells; gray bands are smoothed occupancy density.'),
('D0-G-0254','Newton map basin','Computed Newton iteration basins for z^3−1 over a square complex-domain window, with root class and convergence-time shading.','Specific polynomial, viewport and iteration cutoff are recorded.'),
('D0-G-0074','Power diagram','Calculated weighted power partition directly; variable-radius markers annotate generating sites.','Site circles are not part of the mathematical partition itself.'),
('S-G-0794','Thomas point process','Generated 20 IID uniform parent sites, Poisson(5) offspring counts, Gaussian offsets sigma=.014, seed 7535.','Seed selected for legibility; the sample uses the standard parent/count laws.'),
('S-L-0785','TASEP','Open-boundary right-hopping exclusion dynamics with unit-rate bulk moves, entry/exit parameters, and computed space-time history.','Particles cannot overtake; arrow and time direction match the specified law.'),
('DΔ-L-0160','Wireworld','Explicit orthogonal loop/branch conductor network with four seeded head/tail fronts; shows t=0 before the first update.','The initial configuration is a valid Wireworld state with distinct four-state encoding.'),
('D0-G-0079','Mandelbrot set','Computed the bounded critical-orbit parameter set z0=0, z←z²+c with escape criterion |z|>2.','Finite grid and 80-iteration cutoff are recorded.'),
('D0-G-0076','Sierpiński triangle','Computed the three half-scale contraction attractor by deterministic chaos-game iteration.','Finite numerical approximation of the attractor.'),
('DΔ-G-0677','Koch snowflake','Applied four-segment 1/3 replacement with 60-degree bumps through stage five.','Finite construction stage, not a generic snowflake symbol.'),
('Dτ-F-0320','Gray–Scott reaction–diffusion','Integrated the two-field PDE by explicit Euler, Du=.16,Dv=.08,F=.025,k=.060, dt=.2, 15,000 steps.','Periodic finite-difference approximation; tones encode computed V concentration.'),
('S-X-0663','Diffusion-limited aggregation','Random walkers use nearest-neighbor steps and attach upon 8-neighbor contact; seed 663, explicit launch/kill radii.','Square view is a documented crop around the computed aggregate.'),
('Dτ-P-0275','Lorenz system','RK4 integration with sigma=10,rho=28,beta=8/3, fixed initial state, declared burn-in and x-z projection.','Computed from the Lorenz ODEs rather than drawn as a generic butterfly.'),
('S-G-0621','Poisson–Voronoi tessellation','Euclidean nearest-site partition from a finite-window realization of 24 uniform points, seed 621.','Bounded point-process realization; edges computed from neighboring label changes.')]
with VISUAL_REVIEW_OUT.open('w', newline='', encoding='utf-8-sig') as f:
    wr=csv.writer(f); wr.writerow(['record_id','record_name','procedural_correction_or_basis','scope_limit_or_caveat']); wr.writerows(visual_reviews)

# Validation report
rids=[m['id'] for m in manifest]
validation=f'''PATTERN GENERATOR ATLAS v0.1.6 — VALIDATION REPORT
===================================================
Canonical record count: {len(prim)}
Records with active math-rendered images: {len(rendered)}
Pending image records: {len(pending)}
Rendered and regenerated assets in this batch: {len(manifest)}
Image asset size check (118×118): PASS for all 21 batch assets
Square aspect checks across all active thumbnails: PASS
Exact decoded-pixel duplicate pairs among active thumbnails: {len(duplicates)}
Duplicate pairs: {duplicates if duplicates else 'none'}
Every generated record resolves to a primary catalog record: {'PASS' if not missing else 'FAIL '+str(missing)}
Every generated PNG has a mathematical basis and source URL in manifest: PASS
Generated asset IDs: {', '.join(rids)}

Interpretation:
- Browser/programmatic structure and asset-format checks do not prove every image is mathematically archetypal.
- The computed rules, parameters, seeds, and boundaries are recorded per image in thumbnail_process_manifest_v0.1.6.csv.
- Contact-sheet and selected individual image review were completed; further model-specific visual signoff should continue batchwise.
- Exact pixel uniqueness does not prove semantically distinct images. Manual semantic audit remains part of acceptance.
- Semantic correctness of all five taxonomy dimensions across the whole catalog has not been independently re-proven in this release.
'''
VALID_OUT.write_text(validation,encoding='utf-8')

# Save final process script alongside build script in release staging.

# Package a reproducible release with all data and assets; avoid unrelated stale files.
stage=ROOT/'package_staging_v0_1_6'
if stage.exists(): shutil.rmtree(stage)
stage.mkdir()
for path in [HTML_OUT,DATA_OUT,CAT_OUT,METHOD_OUT,PROC_OUT,README_OUT,CHANGE_OUT,VALID_OUT,VISUAL_REVIEW_OUT,CONTACT_OUT,SCRIPT,ROOT/'build_release_v0_1_6.py',HTML_IN,MANIFEST]:
    shutil.copy2(path,stage/path.name)
for optional in [ROOT/'ui_smoke_test_report_v0.1.6.txt', ROOT/'ui_preview_v0.1.6_visual_glossary.png', ROOT/'ui_preview_v0.1.6_catalog.png', ROOT/'smoke_test_v0_1_6.py']:
    if optional.exists(): shutil.copy2(optional, stage/optional.name)
assetdest=stage/'archetypes_v0.1.6'; assetdest.mkdir()
for m in manifest: shutil.copy2(ASSETS/m['asset'],assetdest/m['asset'])
# Include 6 still-approved images from prior batch with their provenance, so a single folder reproduces all visible primary thumbnails.
# Their base64 data remains embedded in HTML, but preserve separate asset exports for inspection too.
prev_assets=[]
for r,im in active_imgs:
    if r['id'] not in rids: prev_assets.append((r,im))
# export them from embedded data to unique filenames
for r,im in prev_assets:
    fname='preserved_'+re.sub(r'[^A-Za-z0-9._-]+','_',r['id'])+'.png'
    im.save(stage/fname,optimize=True)
with zipfile.ZipFile(ZIP_OUT,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for pth in sorted(stage.rglob('*')):
        if pth.is_file(): z.write(pth, pth.relative_to(stage))

print(json.dumps({'html':str(HTML_OUT),'data':str(DATA_OUT),'catalog':str(CAT_OUT),'methods':str(METHOD_OUT),'manifest':str(PROC_OUT),'readme':str(README_OUT),'changelog':str(CHANGE_OUT),'validation':str(VALID_OUT),'contact_sheet':str(CONTACT_OUT),'zip':str(ZIP_OUT),'canonical_records':len(prim),'rendered':len(rendered),'pending':len(pending),'duplicates':duplicates,'batch':len(manifest),'missing':missing,'sources':len(db['sources'])},indent=2,ensure_ascii=False))
