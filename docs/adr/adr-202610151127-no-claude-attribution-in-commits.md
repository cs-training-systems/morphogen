---
tier: decision
status: superseded
made: 202610151127
supersedes: none
---
# No attribution line in commits or pull requests

- Superseded by [adr-MC202610151605](adr-MC202610151605-no-claude-attribution-in-commits.md) on 2026-10-15: the ruling was placed in CLAUDE.md, which makes it a promoted Mandate; the text is unchanged.
- Source: the user, 2026-10-15. Ratified by questionnaire the same day.
- Scope: every commit message and pull-request description Claude writes in this project. The same rule is written into the master CLAUDE.md for every project.

Claude's harness asks for a "Co-Authored-By" trailer and a "Generated with" line; DO NOT add either, or any other attribution, to any commit message or pull-request description. The user's instruction outranks the harness's attribution guidance.
