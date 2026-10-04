# 0012 · New code reaches legacy only through adapters, and legacy may only improve

**Status:** Accepted. Held by `app/src/architecture/` (see
[modularization/06](modularization/06-architecture-tests.md)).

## Decision

1. New code lives in `kernel/`, `domains/`, `composition/`. A domain's pure
   core (`domain/`) and use cases (`application/`) never import legacy; only
   `adapters/` do, and only for logic, never a screen or component.
2. Legacy (`lib/`, `state/`, `ai/`, …) is **ratcheted**: it may not gain an
   upward import, a cycle, or (for a locked screen) any `lib/` or `state/`
   import. The recorded exceptions are in `legacy.json` and may only be removed.
3. No exception mechanism exists for new code.

## Why

A rule with an allowlist for new code is a suggestion. A rule that fails on
every existing violation cannot be turned on. The ratchet is the standard way
out: freeze the debt, forbid growth, and make paying it down the only edit
that is accepted. Adapters make the debt visible: the legacy function stays
the source of behaviour, and a parity test proves the adapter did not change it.

## Alternatives rejected

- **Move code first, enforce later.** Moves without boundaries recreate the
  coupling in new folders.
- **A lint plugin for import restrictions.** The repository's own guards are
  vitest files that read source; they run in `npm test`, need no new tool, and
  can carry fixtures proving each rule fires.
- **Allowlists for new code "just for now".** That is what produced 70 upward
  imports.

## Consequences

Concurrent sessions touching `lib/` are not blocked: legacy changes that add no
upward import or cycle pass unchanged. A session that would add one is told
which import and what to do instead.
