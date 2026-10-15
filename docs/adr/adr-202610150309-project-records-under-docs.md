---
tier: decision
status: accepted
made: 202610150309
supersedes: none
---
# Project records live under docs/, files for small concerns and folders for growing ones

- Source: the user, 2026-10-15, on Claude's proposal. Ratified by questionnaire the same day.
- Scope: this repository's records and their enforcement.
- Rationale: CLAUDE.md's "sized to the project", "minimum sufficient complexity" and "keep what a session must read small".

Homes: `docs/STATUS.md` (task and status, the resume point), `docs/PENDING.md` (decisions awaiting the user), `docs/adr/` (decision records), `docs/KNOWN-ISSUES.md`, `docs/RISKS.md`, `docs/PROVENANCE.md`, `docs/RELEASES.md`, `CHANGELOG.md` (Keep a Changelog, Unreleased on top), `docs/taxonomy/`, `docs/catalog/` (planned, generated). `docs/evidence/`, a requirements file, a glossary and a data dictionary are created when their first entry exists; the map lists only what exists.

Standards named: Conventional Commits for commit messages; Keep a Changelog; decision records per adr-M202610150306; the code standard per adr-M202610150307.

Enforcement: `.claude/settings.json` asks before `git commit`, `git tag` and `git push` and denies edits to CLAUDE.md.
