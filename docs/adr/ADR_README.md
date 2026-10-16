# How decisions are recorded

Every consequential decision in this project is recorded as an architecture decision record (ADR) in this folder. This file states how records are named, structured, written and read. It is Layer 2: read when a record is written or consulted. The generated list of every record is [ADR_INDEX.md](ADR_INDEX.md).

## 1. Three tiers

- A **Mandate** shapes the project for a long time.
- A **Decision** is an ordinary settled ruling.
- A **Correction** is a small ruling that only makes sense beside a Decision or a Mandate.

Claude proposes the tier from the surrounding context at the moment the ruling is made, the user confirms it, and it is written at once. A tier is never assigned later from memory.

## 2. One headline per record

Each record holds exactly one Mandate or one Decision: its headline. A Correction never opens a record. A new Decision or Mandate always opens a new record, whatever the timing.

## 3. Where a Correction lands

1. Every Correction refines exactly one headline, named by that record's id. The reference is the Correction's first field: `refines: adr-M202610151430`.
2. Claude finds the parent by searching the headlines in this folder (the index is the quickest way), proposes the parent by name, and the user confirms it in the same questionnaire that approves the Correction's text.
3. If no parent exists, the ruling is not a Correction. It is a Decision and opens its own record.
4. If the Correction would change what the headline means, it is not a Correction either. It is a superseding Decision: a new record that names the old one in `supersedes`, after which the old record's status becomes `superseded` with a link forward.
5. A Correction never refines another Correction. Every record is therefore one headline plus a flat list of Corrections that each point at that headline, so the folder cannot tangle.
6. A Correction arriving within about thirty minutes of a record being written is appended to that record if it refines that record's headline. If it refines an older record, it goes there instead.

## 4. File names

`adr-` then `M` for a Mandate or nothing for a Decision, then a twelve-digit timestamp, then a hyphenated slug:

- `adr-202610151430-presets-single-source.md` (a Decision)
- `adr-M202610151430-abandon-es5.md` (a Mandate)

The timestamp is year, month, day, hour, minute in EST, twenty-four-hour (military) clock. Lowercase letters, digits and hyphens only; no parentheses. The slug is at most fifty characters and the whole file name at most eighty.

## 5. Rules that live in CLAUDE.md

A rule that governs how Claude works is placed in CLAUDE.md by the user and is recorded by the commit that places it. It has no record in this folder. A Mandate here is a long-lived ruling about the project that does not belong in CLAUDE.md.

## 6. Inside a record

The record opens with a front-matter block, then the headline as the first heading, then the headline's fields and text, then two lines of tildes, then the Corrections, newest first.

```
---
tier: decision
status: accepted
made: 202610151430
supersedes: none
---
# Presets live in one JSON file

- Source: the user, in conversation, 2026-10-15.
- Scope: the engine and the presets catalog.
- Rationale: one authoritative source; the catalog is generated from it.

(the ruling, concise, every nuance kept)

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Correction 202610151512
- Refines: adr-202610151430
- Status: accepted
- Source, scope, rationale as above.

(the correction)
```

`tier` is `mandate` or `decision`; `status` is `proposed`, `accepted` or `superseded`; `made` repeats the file name's timestamp; `supersedes` is `none` or the id of the record this one replaces. Each Correction carries its own timestamp in the same form. The headline is not necessarily the newest item in the file.

## 7. Wording

Sentence case throughout, titles included. Concise, with every nuance kept: what is required or prohibited, when it applies, its conditions and exceptions, and what is still undecided. Direct quotes from the user are welcome once cleaned to plain, grammatically correct English. Profanity and hostility are never recorded. When the user's intent is in doubt, Claude proposes the exact wording for the user to ratify rather than guessing.

## 8. Approval

No record text is written to disk until the user has approved it through the questionnaire: the tier, the parent if it is a Correction, and the exact text. This applies to headlines and Corrections alike. A ruling is recorded in the turn it is made, and this is checked again at session end. A record's draft may wait in the project's `temp` folder for that approval; it is written to the records folder only after it has been approved by the user.

## 9. Status

One of `proposed`, `accepted`, `superseded`. Superseded or deprecated text and documents are deleted on the user's approval; git holds every past version. Retiring a kind of record, as the promoted Mandates were retired on 2026-10-15, is done by commit; git holds the files.

## 10. The index

`ADR_INDEX.md` is generated by `node tools/adr-index.js` from the front matter of every record, newest first, and is never edited by hand. It is regenerated automatically after any record is written from Claude Code, and `npm test` fails if it is stale.

## 11. Documents that are not records

Any other document is assessed when it is written or changed: does it contain a ruling? If so, the ruling gets a record and the document links to it.

## 12. Editing a record

Upon editing any ADR, always read that ADR and any it refers to in full, carefully looking for any superseded or deprecated ruling. When any is found or discovered, output the full list as proposed for deletion/removal of the superseded or deprecated sections and/or documents. Do this in the questionnaire for the user's approval.

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## Reading

No record is read at boot. A session consults [ADR_INDEX.md](ADR_INDEX.md) and reads the records whose headlines touch its task. This file is read when a record is written.
