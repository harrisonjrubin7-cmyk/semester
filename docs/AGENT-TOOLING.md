# Agent and test tooling: what was adopted, what was not

Evaluated 4 October from the tools' own READMEs; nothing here has been run
against Semester yet.

## Adopted
- **addyosmani/agent-skills** (MIT): three plain-text skills vendored under
  `.claude/skills/`, pinned in `.claude/skills/VENDORED.md`.

## Pilot, by hand, not in CI
- **tester-army/e2e** (Apache 2.0): natural-language end-to-end tests on
  Playwright. Needs an LLM key. Try one flow on a throwaway branch with
  `npx e2e init`; adding it as a dependency goes through the supply-chain
  workflow like any other package. Do not add it to `package.json` until the
  pilot shows it catches something `ci.yml`'s Playwright steps do not.
- **usestrix/strix** (Apache 2.0): AI pentester. Needs Docker and an LLM key.
  Run only against your own local or staging build, never production or a
  system you do not own. It overlaps CodeQL and HawkScan, so it stays a manual
  pre-pilot run.

## Not adopted
- **gstack**: registers hooks in `~/.claude/settings.json`, makes update-check
  network calls, and its `/ship` competes with this repository's PR flow.
- **claude-mem**: captures every tool call into a local store (optional cloud
  sync). A personal tool for a home directory, not for a repository that holds
  student data.
- **ponytail**: overlaps the `simplify` skill.
- **caddy**, **Modern-CPP-Programming**, **text-to-cad**: no use in this app.
