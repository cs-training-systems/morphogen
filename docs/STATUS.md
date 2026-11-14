# Status

The resume point: priorities, the next action, open threads. A session starts here after CLAUDE.md and the map rows, and ends by updating it. Programme-level priorities for the three repositories (Morphogen, the Morphospaces Atlas, cs-web-folio) are kept here by ruling of 2026-10-15 (adr-202610150312); the other two repositories' status files hold only their own work and point back to this file. History lives in git log and CHANGELOG.md, not here.

## Priorities, in order

| # | Item | State | Notes |
|---|---|---|---|
| 0 | Remove the personal address from the public commit history; then repository restructure and housekeeping | the repair: in progress (Stage A done 2026-11-14; Stages B and C pending); housekeeping: in progress | The repair comes before everything else and is described under "Priority 0" below. Housekeeping: records, map, settings and tooling committed as d362ed2 and aa81f26 on 2026-10-15. The boot-cost restructure of 2026-10-15 (no record read at boot, closed rows leave the files, duplicates consolidated, promoted-Mandate records retired) and the Atlas migration were committed as 280cae0 and pushed on 2026-10-16. Left: the publish-only repository for the Atlas's site. |
| 1 | Morphospaces Atlas: polished, comprehensive, accurate, internally mapped, in the folio's visual standard, thumbnails made | in progress | Migrated into `atlas/` on 2026-10-16: 756 primary records, 29 imaged and sourced; `atlas/data/atlas.json` is canonical. The Atlas page went live on 2026-11-11 (e01a64d): it reads the data file at load and holds no copy of it. The 29 pictures were converted to opacity masks the same day. On 2026-11-12 and 2026-11-13 the law classes were renamed and given signs, record ids became numbers, and the page gained a wall of squares, address links and a locator map (adr-202611121453, adr-202611130204, adr-202611130238, adr-M202611121453); committed on 2026-11-14, not pushed. Prerequisite for building Morphogen correctly. |
| 2 | User-friendly taxonomy: polished to a ratified visual-type catalog | in progress | `docs/taxonomy/user-friendly-taxonomy.md`. Prerequisite with item 1. Section VI of that file states the governing principle. |
| 3 | Engine rewrite: ES modules, one build producing a classic bundle and a module build, presets as a JSON single source, generated catalog, ESLint recommended + EditorConfig, TypeScript later | not started | Depends on 1 and 2 for the model and preset set. Becomes the 0.2.0 line. |
| 4 | cs-web-folio re-pinned to the next Morphogen tag | not started | Its lockfile pins a deleted tag; see KNOWN-ISSUES. |

## Priority 0: remove the personal address from the public history

**Why.** This project is published as "CS - Training Systems", under the hidden address GitHub issues for that account. The owner's personal email address must not be attached to it, and it is. Every commit from 6ac0cc3 through e01a64d (20 commits) carries the real address in both its author field and its committer field; 19 of them carry the owner's personal name in those fields and one a second spelling; 14 carry a co-author trailer. GitHub shows this on each commit's page and in its `.patch` view, and credits those commits to a different GitHub account. The address is in no file of the repository, at any commit. The first commit (cdd87d7) carries the project identity as author and GitHub's own web-commit identity as committer. The cause: git on this machine had no identity set, and sessions supplied one by hand or copied the last commit's author. The commit-identity rule the owner approved on 2026-11-13 forbids both.

**Ruled by the owner.**

- 2026-11-14: the history is restarted, not rewritten. A fresh repository holds the files as of 2026-11-14 in one commit under the project identity; nothing of the old history exists in it. The owner's private copy of the whole present folder, made first, is the only place the old history survives. This replaces the ruling of 2026-11-13 that the 20 commits were re-made each keeping its message and dates.
- 2026-11-14: in the commit fields, name and address are both the project identity; the co-author trailers go with the history; no legacy branch.
- 2026-11-14: the owner's name stays in every copyright notice (LICENSE, the two README notices, both pages, the script header) and in package.json's author field. The notices' year is a range from 2026, the year of first publication, to the current year: computed at load on the two pages, written at build into `morphogen.js`, written into LICENSE and README by the bump protocol.
- 2026-11-14: no tag until the next bump. `v0.1.0` cannot be re-made truthfully; `docs/RELEASES.md` records its removal.
- 2026-11-14: nothing is pushed to the present GitHub repository before it is deleted.
- 2026-11-13: the restarted history goes to a fresh GitHub repository of the same name: the owner deletes the present one and creates it again. It has no forks, stars, watchers or issues to lose.
- 2026-11-13, folder ruled 2026-11-14: two git hooks in `tools/githooks/`, switched on per clone by `git config core.hooksPath tools/githooks`: `pre-commit` refuses any commit not under the project identity, `commit-msg` any attribution line. Tested on a real refused commit before called working.
- 2026-11-14: the record that closes the known issue follows the verified push, as a second commit.

**Procedure.** Never print the address; mask it in the output of every command that could show one.

Stage A, this folder, done 2026-11-14: the hooks written; the year-range mechanism in the two pages, the prelude and the build; the records updated; `npm test` passing.

Stage B, the fresh repository: (1) the owner copies the whole folder, `.git` included, to a private place outside it; (2) the owner carries `temp/temp-editable-CLAUDE.md` into `CLAUDE.md`; (3) Claude confirms no personal address in any tracked file, deletes `.git`, runs `git init -b main`; (4) the owner sets the project identity and the hooks path in the new repository; (5) Claude stages everything, shows the staged list, makes one deliberately wrong-identity commit attempt that the hook must refuse, then the one commit; (6) proof: one commit, one reflog entry, project identity in both fields.

Stage C, GitHub: (1) the owner deletes the repository (Settings, Danger Zone, "Delete this repository", type the name). GitHub's documentation, read 2026-11-14: a deleted repository is restorable by its owner within 90 days, becomes restorable up to an hour after deletion, and deleting a public repository does not delete forks (there are none); it does not state what happens to Pages or whether the name can be reused at once. (2) The owner creates the repository again, empty, same name, and turns Pages back on. (3) Claude adds the remote and pushes `main`. (4) The demo page and the Atlas page are checked. (5) The known-issue row leaves and this section is reduced to its outcome, in a second commit.

**Consequence for cs-web-folio.** Its lockfile pins commit `7ba1c60`, which will not exist on GitHub; the folio cannot install Morphogen until re-pinned (priority 4, under the folio rules in CLAUDE.md).

## Next action

First: priority 0, Stage B, described above.

The token-safety rules: the six changes the user approved on 2026-11-13 are in `CLAUDE.md`. The risks row and `docs/USAGE.md` are written. Three questions on this subject wait in `docs/PENDING.md`.

Then the Atlas (priority 1). The user has further ideas for its interface to work through: one page only, with tabs that change what is on screen.

Awaiting the user's rulings: the order of the five law classes; whether Stochastic and Nondeterministic carry their own time structure; how each difference from the web portfolio's style is resolved (check of 2026-11-12); on the wall, whether 38 pixels and the 8% free space stay and what a square shows on hover.

Then, from a fresh session and only after the six research setup decisions: a pilot on one mechanism family, giving each entry its exact definition, its source and a picture computed from its own mathematics, by a renderer of ours with one engine per family; then the remaining families, the named models owed for the thin routes, and a library page for the entries.

Still owed from earlier: declare the record schema; normalise the record-type and temporal vocabularies by tool; move the project map to `docs/MAP.md`. The attribution trailers and the unpushed commit of 2026-11-14 are settled by the history restart (priority 0). The taxonomy (priority 2) alongside, on the user's brief.

## Open threads

- Synthesis queue: empty.
- The Atlas's own site: a publish-only repository that receives the built site, not yet created (an external action, proposed separately). The source folder `C:\dev\morphospaces-atlas` is retired by the user when ready; its HTML drafts were not imported. The Atlas is versioned with Morphogen unless ruled otherwise.
