# Stream 13 · Platform maturity

Turn Semester from a broad product architecture into a compounding education platform. Run after the pilot is live (streams 00–10).

## Inputs from the design project
- `docs/platform/*.md` (12 pillar standards, scorecard, risk register, 36-month roadmap, next 50 actions)
- `ui_kits/platform-maturity/`
- `docs/strategy/` (competitive audit, coherence test, implementation factory, AI differentiation, trust advantage)
- `docs/system/` (brand, UI grammar, component gaps, algorithm governance, workflow type, data classification, provenance)
- `docs/business/` (company OS, five business systems, systems of record)

## Tasks
1. Audit the repo against each pillar's capability record; write current evidence into docs/platform/*.md (repo beats design).
2. Re-score PLATFORM_READINESS_SCORECARD.md with evidence links; never raise a score without evidence.
3. Work the next 50 actions in order; each completed action links its PR or document.
4. Build the platform pieces in pillar order: daily experience standard checks in CI, graph canonical IDs + source authority, AI evaluation harness, connector certification suite, status page, public API beta.

5. Add the coherence test to the PR template and release checklist.
6. Implement the SemesterWorkflow type, universal state machine, data classification tags and provenance columns from docs/system/.
7. Build the missing components: PolicyBadge, ConsentBadge, HealthBadge, SupportHandoff, ApprovalBanner, ErrorSummary, PageHeader.

## Exit gates
- [ ] Scorecard re-scored from repo evidence
- [ ] Every pillar has a named owner and next action with a date
- [ ] Monthly scorecard review in the operating cadence

Follow the shared rules in any other stream file (branch `semester/platform`, PR + report, stop for review).
