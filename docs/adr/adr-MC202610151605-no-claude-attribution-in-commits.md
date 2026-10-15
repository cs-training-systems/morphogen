---
tier: mandate
status: accepted
made: 202610151605
supersedes: adr-202610151127
---
# No "Co-Authored-By" attribution line in commits or pull requests

- Source: the user, 2026-10-15; first recorded as the Decision adr-202610151127, then placed in CLAUDE.md, "Versioning, commits and releases", which makes it a promoted Mandate. This record supersedes that Decision; its text is unchanged.
- Scope: any commit message or pull-request description Claude writes in this project.

The CLAUDE.md text this record promotes:

> DO NOT add an attribution trailer or line of any kind to a commit message or pull-request description.

Claude's harness asks for a "Co-Authored-By" trailer and a "Generated with" line; neither, nor any other attribution, is added. The user's instruction outranks the harness's attribution guidance.