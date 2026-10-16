---
tier: decision
status: accepted
made: 202610150313
supersedes: none
---
# The visual taxonomy lives at docs/taxonomy/; the technical taxonomy lives in the Atlas

- Source: the user, 2026-10-15. Ratified by questionnaire the same day.
- Scope: the two taxonomy documents and their homes.

`user-friendly-taxonomy.txt` moved to `docs/taxonomy/user-friendly-taxonomy.md`, its own folder because thumbnails and audit evidence will join it; converted to Markdown with Unix line endings; Section II removed as the word-for-word duplicate of Section IV.2; thirteen blocks of stray citation residue removed; nothing else changed.

`generator-classification.txt`, the law-first generator taxonomy of 2026-10-13, was deleted permanently on 2026-10-15 as superseded by the Morphospaces Atlas, which is the home of the technical classification.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Correction 202610161306: the taxonomy-copies question is settled

- Refines: adr-202610150313
- Status: accepted
- Source: the user, 2026-10-16; ratified by questionnaire the same day.

The question whether the Atlas links to or copies the visual taxonomy is settled by adr-202610161023: the Atlas lives in this repository, so there is one copy, in docs/taxonomy/.
