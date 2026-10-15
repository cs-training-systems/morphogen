---
tier: decision
status: accepted
made: 202610150308
supersedes: none
---
# Morphogen ships a classic bundle and a module build from one modern source

- Source: the requirement is the user's, 2026-10-15; the mechanism is Claude's proposal, ratified by questionnaire the same day.
- Scope: the engine rewrite and every host page.

Requirement: all Morphogen work must be directly plug-and-play with cs-web-folio and with any HTML page served from GitHub Pages. The folio loads Morphogen as a classic script tag and copies the file as a hashed static asset.

Mechanism: `src/` is written as ES modules; one build produces a classic script that keeps the `Morphogen` global, the canvas data attributes and the `data-rd` roles, and a module entry. Host pages that use a script tag work unchanged, so "no build step for the page that uses it" stays true. The bundler is chosen at the rewrite; Vite's library mode is the candidate, since the folio uses Vite, to be verified at Vite's documentation.

The rewrite is the 0.2.0 line under the existing versioning policy.
