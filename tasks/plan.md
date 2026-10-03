# Implementation Plan: Semester Company and Product Finalization

## Overview

Extend the in-progress market-readiness program into the full company, legal, trust, product, engineering, commercial, institutional, and go/no-go package requested on 2026-10-02. Preserve the existing application and the uncommitted readiness work already in this worktree. Reuse verified evidence and canonical source documents, but create the requested directory structure and exact filenames only after reconciling each item with its existing equivalent.

This is an evidence-gated program, not a documentation-completion exercise. Repository implementation can establish implementation evidence; it cannot establish legal approval, a signed contract, insurance, tax treatment, production operation, institutional approval, accessibility conformance, a penetration test, certification, staffing, or customer outcomes.

## Current Baseline

- Initial worktree baseline: `codex/market-readiness-transformation` at `fc089134`, then matching `origin/main`; subsequent work is preserved in incremental commits on the same branch.
- Current decision: GREEN for controlled non-activation discovery, synthetic demonstrations, evidence exchange and scoping; YELLOW for invitation beta after applicable gates; NO-GO for institutional activation, paid institutional pilots and broad enterprise sales.
- Requested Markdown deliverables: 232 unique filenames.
- Exact-name inventory at planning time: 22 present, 210 absent. Many absent names have useful source material under `docs/market-readiness/`, `docs/legal/`, `docs/trust/`, `docs/operating-model/`, and other existing directories.
- Validation: typecheck, lint, build, focused browser/a11y checks passed in the prior run; exact full and shuffled test commands remained red because of load-sensitive timeouts. HawkScan could not run because the runtime and API key were absent.

## Dependency Graph

```text
Repository and external-fact inventory
    -> finalization baseline + evidence/claims registers
        -> company operating controls
        -> legal/commercial drafts
        -> trust/security/privacy/AI controls
        -> product/design requirements
        -> engineering operations
        -> commercial operating system
        -> institutional procurement package
            -> prioritized code/configuration remediation
                -> target-environment and external validation
                    -> final go/no-go package
```

## Architecture Decisions

- Use `FINALIZATION-BASELINE.md` at the worktree root as the executive truth layer. More detailed evidence remains in existing registers and matrices.
- Create the exact requested directories: `docs/company/`, `docs/legal-drafts/`, `docs/trust/`, `docs/engineering-operations/`, `docs/commercial/`, and `docs/institutional-readiness/`.
- Do not replace existing canonical material blindly. Each requested file must either become the canonical document or clearly identify and link the existing canonical source.
- Every legal-draft file begins with the exact required legal-review disclaimer. Unknown company, jurisdiction, commercial, retention, service, insurance, or operational facts remain bracketed decisions.
- Every substantive claim is labeled VERIFIED, CONDITIONAL, ROADMAP, or PROHIBITED and maps to code/configuration evidence, operational evidence, an owner, and missing proof.
- Code remediation is vertically sliced by launch-critical journey, with tests and HawkScan after each meaningful code batch.
- No beta-language removal, public publication, activation, customer communication, contract execution, payment enablement, or institutional rollout is authorized by document creation.

## Task List

Tasks are tracked in `tasks/todo.md`. Artifact batches contain at most five requested files; existing equivalents are reviewed before any new file is created.

### Phase 0 — Truth layer

- T00: Reconcile repository, deployment, operating, legal, commercial, and external-fact evidence.
- T01: Create the finalization baseline, requested-deliverable crosswalk, and evidence/claims control map.
- T02: Reconcile the launch risk register, owner matrix, and blocked-external-evidence queue.

### Phase 1 — Company operations (four batches)

- C01–C04: Create or reconcile requested company documents 1–20 in four five-file batches.
- Checkpoint C: every company fact is evidenced or explicitly assigned for founder/professional confirmation.

### Phase 2 — Legal and commercial drafts (twelve batches)

- L01–L04: public-facing legal documents 1–20.
- L05–L09: institutional/B2B legal documents 21–44.
- L10–L12: internal legal/compliance governance documents 45–56 plus `LEGAL-TRUTH-MAPPING.md`.
- Checkpoint L: disclaimer, placeholders, jurisdiction review, public-language summary, behavior mapping, and publication blockers verified for every draft.

### Phase 3 — Trust, security, privacy, and AI governance (nine batches)

- S01–S07: requested trust documents 1–34.
- S08–S09: requested AI-governance documents 35–42.
- Checkpoint S: every control is VERIFIED, PARTIAL, UNVERIFIED, NOT IMPLEMENTED, or NOT APPLICABLE with exact evidence and missing tests.

### Phase 4 — Product and design (three batches)

- D01–D03: requested design/product documents 1–11.
- Checkpoint D: first win, first proof, state coverage, responsive matrix, accessibility tests, performance budgets, and brand continuity are reviewable.

### Phase 5 — Engineering operations (five batches)

- E01–E05: requested engineering-operations documents 1–24.
- Checkpoint E: release, rollback, observability, support, database, dependency, performance, capacity, and disaster-recovery claims match actual implementation and test evidence.

### Phase 6 — Commercial operations (eight batches)

- R01–R08: requested commercial documents 1–40.
- Checkpoint R: pilot scope, buyer, price-approval status, funnel stages, implementation, support, success, renewal, and offboarding are coherent and non-deceptive.

### Phase 7 — Institutional readiness (six batches)

- I01–I06: requested institutional-readiness documents 1–27.
- Checkpoint I: every integration/capability is labeled available and verified, available with configuration, pilot-only, professional-services required, planned, or not supported.

### Phase 8 — Vertical implementation and validation

- P01: individual first-win path: onboarding -> limited academic plan -> Today/This Week -> support/recovery.
- P02: account and data-rights path: access -> consent/preferences -> export -> deletion/request -> recovery.
- P03: institutional first-proof path: scoped tenant/cohort -> role checks -> privacy-thresholded evidence -> export/offboarding.
- P04: public company-site truth pass: claims, legal links, beta status, pricing status, forms, analytics, and consent.
- P05: reliability and operations path: logging, monitoring, incident, rollback, restore, feature flags, and support escalation.
- P06: responsive/accessibility/performance pass across the required viewport, zoom, keyboard, reduced-motion, and failure-state matrix.
- P07: full validation: clean install in the owning package manager, typecheck, lint, unit/integration/E2E tests, build, gateway checks, secret scan, dependency/license inventory, HawkScan loop, and evidence capture.

Every P task is split again before implementation if it would touch more than five files. Each meaningful code batch requires focused regression tests and the autonomous HawkScan fix/rescan loop. External reviews and target-environment drills remain separate evidence gates.

### Phase 9 — Final decision (two batches)

- F01: requested final outputs 1–5.
- F02: requested final outputs 6–10 and executive consistency review.
- Checkpoint F: the four market motions receive evidence-backed GO, CONDITIONAL GO, or NO-GO decisions with blockers, owners, remediation, evidence, category, and sequencing.

## Verification Cadence

- After every artifact batch: exact filenames, required sections, disclaimer/placeholders where applicable, relative links, contradictions, prohibited-claim scan, and evidence citation check.
- After every two artifact batches: compare against `FINALIZATION-BASELINE.md`, the evidence register, capability registry, and current code/configuration.
- After every code batch: focused tests, typecheck/lint as applicable, browser or API acceptance, secret scan, HawkScan scan/fix/rescan, and diff review.
- Before any launch recommendation: full release matrix, target-environment evidence, external reviews, owner acceptance, and dated decision record.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing uncommitted work is overwritten or misattributed | High | Preserve all current changes; review each overlapping file before editing; use small patches and diff checks. |
| Hundreds of files create contradictory sources of truth | High | Maintain a deliverable crosswalk and designate one canonical source for every topic. |
| Draft volume is mistaken for operating maturity | High | Keep readiness labels, owners, tests, and external evidence gates in each applicable artifact. |
| Legal drafts imply sufficiency or execution | High | Exact disclaimer, explicit placeholders, counsel queue, no signature/publication claim. |
| Repository controls are mistaken for production operation | High | Separate source, test, target-environment, operational, independent-review, customer-acceptance, and approval evidence. |
| Code changes outrun reviewability | High | Vertical slices, maximum-five-file tasks, checkpoints, and HawkScan after meaningful code changes. |
| Exact full tests remain nondeterministic | High | Diagnose resource/timing cause without weakening assertions or deleting tests; require green release command evidence. |
| Scanner/runtime credentials remain unavailable | High | Retain NO-GO for affected sale gates and run scans only when the required runtime/credentials exist. |

## Open Decisions Requiring Human or Professional Authority

- Legal entity, jurisdiction, address, governing law, dispute terms, age posture, and counsel approval.
- Ownership, IP assignments, employment/contractor classification, tax, accounting, insurance, banking, and authorization thresholds.
- Approved pricing, payment processor/configuration, refunds, cancellation, renewal, revenue recognition, and sales authority.
- Production environment, named operational owners/backups, monitoring/on-call route, retention periods, incident notification commitments, and service levels.
- Named pilot customer, sponsor, cohort, data scope, integrations, accessibility/security reviewers, contract, implementation dates, and acceptance criteria.

## Planning Gate

This plan must be reviewed before expanding the existing uncommitted work into the 210 missing exact-name deliverables or beginning additional code remediation. Approval authorizes staged implementation; it does not authorize publication, signing, billing, customer activation, or unsupported claims.
