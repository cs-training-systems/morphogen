---
tier: mandate
status: accepted
made: 202610150306
supersedes: none
---
# Decisions are recorded as architecture decision records in docs/adr/

- Source: the user, in conversation, 2026-10-15. Ratified by questionnaire the same day.
- Scope: every consequential decision in this project. The same scheme is intended for the Morphospaces Atlas and cs-web-folio, each ruling that for itself.
- Rationale, the user's: the time in the name improves organisation; one folder; the headline always floats above its Corrections.

All records live in one folder, `docs/adr/`. There are three tiers: a Mandate shapes the project for a long time; a Decision is an ordinary settled ruling; a Correction is a small ruling that only makes sense beside a Decision or a Mandate.

One Mandate or Decision per record, as its headline. A Correction never opens a record. It refines exactly one headline, named by id as its first field. If no parent exists, it is a Decision. If it would change the headline's meaning, it is a superseding Decision. A Correction never refines a Correction. Within about thirty minutes of a record being written, a Correction that refines that record joins it; one that refines an older record goes there.

File names: `adr-`, then `M` for a Mandate, then a twelve-digit timestamp (year, month, day, hour, minute, America/New_York, twenty-four-hour clock), then a hyphenated lowercase slug of at most fifty characters; the whole name at most eighty. A Mandate whose text is also placed in CLAUDE.md or README.md carries `MC` or `MR` and holds the headline only.

Inside: front matter (tier, status, made, supersedes), the headline as the first heading with its fields and text, two lines of tildes, then the Corrections newest first, each timestamped. The headline is not necessarily the newest item.

Wording: sentence case throughout; concise with every nuance kept; the user's words quoted once cleaned to plain, grammatically correct English; profanity and hostility never recorded; when intent is in doubt, Claude proposes the exact wording for ratification.

Approval: Claude proposes the tier at the moment of the ruling; no record text is written until the user has approved the tier, the parent if a Correction, and the exact text by questionnaire. Status is proposed, accepted or superseded; nothing is deleted.

The procedure in full is [ADR_README.md](ADR_README.md), Layer 3. Undecided: bind keywords (see `docs/PENDING.md`).

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Correction 202610150314: the record index is generated and kept current automatically

- Refines: adr-M202610150306
- Status: accepted
- Source: the user, 2026-10-15 ("ADR_INDEX.md is a fantastic idea if you can make it automatically updating"); ratified by questionnaire.

`tools/adr-index.js` generates `docs/adr/ADR_INDEX.md` from the front matter of every record, newest first, and fails closed on a malformed record. A Claude Code hook in `.claude/settings.json` regenerates it after any write under `docs/adr/`; `npm test` fails if it is stale. The index is never edited by hand.

The front-matter and fail-closed pattern follow the folio's `gates/adr_map.py`; that gate's bind-keyword feature is deferred (see `docs/PENDING.md`).
