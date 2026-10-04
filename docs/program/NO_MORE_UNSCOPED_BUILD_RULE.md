# No more unscoped build — rule

**Effective:** on adoption by the owner. **Proposed:** 2026-10-04. **Status:** PROPOSAL (it records no decision; adoption is a decision for the owner and takes its pull request's number as `docs/decisions/D-<PR#>.md` per `CLAUDE.md`).

## Why

Main took sixteen merges in one hour on 15 September and two duplicate fixes were built before anyone noticed (`CLAUDE.md`). Phase 0 found 306 documents in `docs/`, ≈603 top-level `lib` modules, ≈119 screens and 180 migrations, most of it built and held, much of it ahead of the evidence that would let it be used. More code does not close any launch gate; the gates are evidence, authority and staffing (`docs/program/README.md`).

## The rule

From adoption until the Phase 1 gate is PASS, a change may be merged only if it carries a **scope line** naming exactly one of:

| Scope | What it must cite |
| --- | --- |
| **S1 Gate evidence** | the gap ID in [`READINESS_GAP_MATRIX.md`](READINESS_GAP_MATRIX.md) it closes, and the evidence file or test it adds |
| **S2 Risk closure** | the risk ID in [`RISK_REGISTER.md`](RISK_REGISTER.md) or `LAUNCH-RISK-REGISTER.md` (FR-xxx) it reduces |
| **S3 Defect** | a failing test, reproduced, with the revert-and-watch-it-fail proof `CLAUDE.md` requires |
| **S4 Truth repair** | the contradiction ID (baseline §6) or claim ID it corrects |
| **S5 Phase 1 step** | the numbered Phase 1 step it implements |

Anything else is **unscoped**, and unscoped means one of: park it, or get the owner to add it to the register first.

## Specifically out of scope until Phase 1 PASS

- New screens, new product modules, new `lib/` feature modules, new Edge Functions.
- New flags that default on. (All 21 `FLAGS` are `defaultEnabled:false`; keep it so.)
- New pricing, plan names or published numbers: price authority is open (`COMPANY_LIVE_STATUS.md` §3).
- Any change that flips `individualPaidAcquisitionApproved` or opens a paid motion.
- New public copy that is not in `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`.
- New connectors beyond the first approved adapter (Phase 1 does not build any; Phase 8 does).
- Re-tuning numbers somebody has argued for and merged (`CLAUDE.md`).

## Always allowed

Fixes to a failing gate; tests that make an existing guard real; security fixes; dependency security updates; documentation that corrects a verified contradiction; registers kept in step with code.

## How a reviewer applies it

1. Is there a scope line? No → request one.
2. Does the cited ID exist in the register on the PR's base? No → the PR is unscoped.
3. Does the PR reduce what the ID says it reduces, with evidence? No → not closed; the register row does not change.
4. A guard that has never failed is not a guard: show it red against the revert (`CLAUDE.md`).

## Exceptions

An exception is a dated row in [`../../operations/GO_NO_GO_SCORECARD.md`](../../operations/GO_NO_GO_SCORECARD.md) §6 with an owner and an expiry. There is no standing exception.
