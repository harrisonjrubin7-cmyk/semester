# Design ADRs 0030-0040

Proposed 2026-10-04 by phase D0 of the design-system adoption
([../DESIGN_SYSTEM_ADOPTION_AUDIT.md](../DESIGN_SYSTEM_ADOPTION_AUDIT.md)).
All are **Proposed**; none is accepted, and none has changed behaviour.

## Where these live and why

The numbers 0030-0040 were asked for by name. They are kept in this folder, not
in `docs/architecture/`, because `app/src/lib/docs/developers.test.ts` (the
"next architecture record number" test) pins `docs/architecture/` to a
contiguous series whose next number is `0013`, and `lib/ops/boundaries.test.ts`
resolves `ADR-nnnn` citations against that folder. Putting 0030 there would
break both and strand 0013-0029. If the series should be unified, renumber
these in the PR that accepts them.

The repository also numbers *decisions* by pull request (`docs/decisions/D-<PR>.md`,
CLAUDE.md). When one of these is accepted, record the acceptance as
`D-<pull request number>` and link it here.

| ADR | Decision | Blocking? |
|---|---|---|
| [0030](ADR-0030-adopt-reference-as-contract.md) | Adopt the Semester Design System Reference as the implementation contract | Needs the PDF and U-1..U-6 |
| [0031](ADR-0031-ink-chrome-parchment-content.md) | Ink chrome and Parchment content grounds | Needs decision U-1, U-5, U-6 |
| [0032](ADR-0032-provenance-first-class.md) | Source-aware provenance as a first-class UI requirement | No |
| [0033](ADR-0033-glyph-word-tone-status.md) | Glyph plus word plus tone for all status | Tone hues need U-4 |
| [0034](ADR-0034-accessibility-token-driven.md) | Accessibility settings token-driven and brand-exempt | No |
| [0035](ADR-0035-five-destination-nav.md) | Five-destination mobile navigation and grouped desktop rail | Needs decision: "Tasks", label hiding |
| [0036](ADR-0036-ai-response-governance.md) | AI response presentation | No |
| [0037](ADR-0037-restrict-tenant-branding.md) | Restrict tenant branding from safety UI | Status hues need U-4 |
| [0038](ADR-0038-no-card-nesting.md) | No card nesting, no decorative clutter | Needs render harness |
| [0039](ADR-0039-consequence-previews.md) | Consequence previews for high-impact actions | No |
| [0040](ADR-0040-token-only-ci.md) | Token-only visual primitives and design CI | No (recommended first) |

## The six open visual decisions (U-1..U-6)

See adoption audit §3: default ground, default action colour, brass role,
distinct status hues versus the one-colour rule, flat chrome, white cards.
