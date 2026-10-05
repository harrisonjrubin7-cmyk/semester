# Vanderbilt Accessibility, Legal and Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for the release-gate validator. This work prepares review; it does not impersonate an accessibility, legal, privacy or Vanderbilt approval.

**Goal:** Produce complete reviewer-ready evidence, accurate outreach drafts and a machine-validated release ledger that prevents unsupported production claims.

**Architecture:** Markdown packets reference generated evidence and named owners; a JSON gate ledger records state/evidence/expiry; a validator rejects invalid transitions or claims. Human findings remain human-authored and externally signed.

### Task 1: Create the release-gate ledger and validator

**Files:** Create `docs/vanderbilt/release-gates.json`, `app/scripts/validate-release-gates.mjs`, `app/scripts/validate-release-gates.test.mjs`; modify `app/package.json`.

- [ ] Write failing fixtures for missing evidence, invalid state, production-verified before authorized, expired evidence, unresolved blocking finding and unsupported “Vanderbilt connected/approved” copy.
- [ ] Define all 12 specification gates with owner, state, evidence links, last checked, expiry and blocker fields.
- [ ] Add `pnpm run check:release-gates`; it validates structure and scans launch/readiness documents for claims inconsistent with the ledger.
- [ ] Run validator tests and commit `Add truthful production release ledger`.

### Task 2: Build the independent accessibility review packet

**Files:** Create `docs/vanderbilt/accessibility-review-packet.md`, `accessibility-issue-ledger.csv`, `accessibility-test-script.md`; modify `docs/market-readiness/ACCESSIBILITY_READINESS.md` and `docs/institutional-rollout/generated/publication/accessibility-conformance-plan.md` only to link current evidence.

- [ ] Inventory critical journeys for student, faculty, TA, advisor, administrator, applicant, authorized family and alumni roles.
- [ ] Include VoiceOver/Safari, NVDA/Chrome, JAWS/Edge, keyboard-only, 200%/400% reflow, reduced motion, mobile screen reader, errors/loading and exports.
- [ ] Seed the issue ledger headers only: WCAG 2.2 criterion, severity, evidence, role, owner, remediation and retest. Do not pre-fill passing results.
- [ ] Run current automated accessibility suites and attach dated outputs as automated evidence, explicitly not a VPAT/ACR.
- [ ] Commit `Prepare Vanderbilt accessibility review packet`.

### Task 3: Build legal, privacy and procurement packet

**Files:** Create `docs/vanderbilt/legal-privacy-review-packet.md`, `data-inventory.md`, `subprocessors.md`, `recording-consent.md`, `outreach-drafts.md`; update stale `docs/market-readiness/PROCUREMENT_CHECKLIST.md`, `PRIVACY_READINESS.md`, `SECURITY_READINESS.md` from verified repository evidence.

- [ ] Document data flows, purposes, minimization, FERPA allocation proposal, retention/deletion/export, legal holds, deprovisioning, incident terms and prohibited AI data.
- [ ] List OpenAI, Supabase and Vercel with service purpose and approval status; do not invent executed DPAs, regions, certifications or ZDR.
- [ ] Separate classroom/advising recording notice, participant consent and institutional policy questions from implemented capture controls.
- [ ] Draft concise messages to Vanderbilt Data Governance (`privacy@vanderbilt.edu`), Office of General Counsel, Web Accessibility Coordinator and an independent auditor. Label every draft `NOT SENT`.
- [ ] Run link and release-ledger validation; commit `Prepare Vanderbilt legal and privacy review packet`.

### Task 4: Reconcile evidence and go/no-go process

**Files:** Create `docs/vanderbilt/staging-acceptance-runbook.md`, `go-no-go-template.md`; modify `docs/market-readiness/GO_LIVE_CHECKLIST.md`, `EXECUTIVE_READINESS.md`.

- [ ] Map every automated and manual acceptance step to one gate and one evidence location.
- [ ] Require named sign-off, date, scope and exceptions; accessibility/legal findings cannot be self-cleared by changing JSON.
- [ ] Add explicit go, conditional-go and no-go criteria plus tenant-disable/rollback owner.
- [ ] Run `pnpm run check:release-gates` and repository-wide verification; commit `Reconcile Vanderbilt go-live evidence`.

**External gate:** Outreach is sent only after separate user authorization. Production requires written Vanderbilt privacy/legal/security/procurement approval and an independent accessibility report with launch blockers resolved or formally excluded.
