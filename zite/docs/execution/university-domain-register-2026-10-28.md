# University domain replacement register — 28 Oct 2026 (owner source S-91)

S-91 asks for the university software inventory to become a domain-replacement register, not an app per vendor (§13), and names its first two backlog items: map what actually exists, and reconcile the inventory with existing Semester contracts so there are no duplicate domains or unowned workflows (§12 items 1–2).

## What was built

- The existing SIS/LMS register (`apps/semester/src/lib/replacementRegister.ts`) was extended rather than duplicated. It gains S-91's seventh readiness stage, `operationally_supported`. That stage joins `institution_authorized` and `production_enabled` as owner-only stages: each needs an `APPROVAL:` reference, and nothing in code sets one.
- `DOMAINS`: one row for each of the 43 domains in S-91 §3 A–D, plus student health and counseling, which is on hold. Each row carries:
  - the native scope, the apps involved and the accountable owner role;
  - S-91's first end-to-end proof;
  - the systems it would replace (as context only, never as requirements);
  - links to the detailed SIS/LMS capabilities and to the connection register;
  - the code files that exist, the evidence for each stage, and the open gaps.
- Vendor rankings ("dominant", "industry standard") were dropped, as S-91 §1 directs. Academic integrity (teaching side) and conduct/Title IX (restricted case work) are kept as separate domains. Hiring stays in HR, not faculty affairs. The finance domain is kept separate from Company OS commercial accounts.

## Guards (tests/replacementRegister.test.ts, 10 tests)

Every S-91 domain is present once and in order. No stage is skipped. No owner stage is claimed and nothing is marked deployed. Every linked capability and connection exists. No migration belongs to two domains. Every cited code file and tested-evidence file exists. A domain with code must be marked implemented, and a domain marked implemented must cite code.

The tests were proved to fail before they were trusted:

- The control test feeds in deliberately overclaiming rows and checks that each one is flagged.
- Pointing evidence at a non-existent file turned the existence test red; restoring the file turned it green again.
- The duplicate-migration guard caught a real conflict while the register was being written: `spgMigration.ts` had been listed under both admissions and CMS.

## Result

| Status | Domains |
|---|---|
| Tested (designed, implemented, database check or live run) | 24 |
| Implemented, no check yet | 7 (graduate, advising, advancement, family, finance, institutional research, CMS) |
| Not started | 12 (dual enrollment, course materials, travel and expenses, research administration, research ethics, core labs, faculty affairs, repository, space and events, safety alerts, conduct and Title IX, athletics) |
| On hold | 1 (clinical) |
| Deployed / institution-authorized / production-enabled / operationally supported | 0 |

All 35 database checks the register cites as "tested" were re-run today and pass (for example: registration race, official grades 32/32, holds, standing, submissions 27/27, library 33/33, IT 38/38, audit 38/38). Where a check carries mutants, those mutants still fail as they should.

"Tested" means the domain's own rules are checked. It does not mean S-91's first end-to-end proof was observed: that proof is tracked separately through the connection register, and most domains have no cross-app proof yet.

## Against S-91 §12

1. Map the apps to code, backend, identity and deployment. Code and backend: done in this register and in `connectionRegister.ts`. Deployment and identity configuration: NOT VERIFIED, because publishing is the owner's and the Zite permissions are unverified (`plat.permissions`).
2. Reconcile the inventory with existing contracts. Done (this increment).
3. Shared authorization and canonical data ownership. Partial: denial paths are tested across the database checks; positive staff paths need the third account.
4. Assignment submission and grading. Observed with two accounts (C03, C04).
5. Hold release and eligibility reevaluation. Observed (C02 fix, 28 Oct).
6. Enrollment concurrency and official-grade handoff. Race tested; the handoff by a real registrar NOT RUN.
7. Financial posting and reconciliation foundation. Not started. This is the largest gap: housing charges, payroll, research spending, gifts and aid disbursement all depend on it, and money movement stays disabled.
8–9. Expanding domain by domain, and running one institution's discovery. These need the owner's priorities and a real institution.

## Decisions needed

- Whether to build the institutional finance ledger next (S-91 wave 4), knowing it can post synthetic balanced entries but cannot move money.
- Which institution to use for the §10 discovery, and who owns each domain there.
- Clinical stays on hold until a clinical-boundary approval and a specialist review exist.
