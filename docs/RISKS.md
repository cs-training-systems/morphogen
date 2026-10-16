# Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| A tag is deleted or moved again, breaking a downstream pin. | low now that the rule is written | a dependent site fails to build | CONTRIBUTING's rule; the settings file asks before every `git tag`; RELEASES records every tag. | user |
| The engine rewrite changes the public interface (global, data attributes, `data-rd` roles) and breaks the folio or a host page. | medium | the course page stops working | The classic bundle keeps the global and roles; the folio is re-pinned only after `npm test` and a page check. | Claude proposes, user approves |
| A helper agent or research run exhausts the weekly allowance. | low with the rule in force | the session and the week are lost | CLAUDE.md's research section: no agent without the cost put in front of the user and a yes. | Claude |
