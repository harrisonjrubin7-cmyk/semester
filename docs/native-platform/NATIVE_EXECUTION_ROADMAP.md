# Native execution roadmap

**As of** 2026-10-05 · **Status** Phase 0. Branch 1 is this reconciliation. Branches 2–10 are not started.

Each branch is one reviewable change. Before pushing, rebase onto `origin/main` and grep for the thing itself (`CLAUDE.md`). Gates, from `app/` after a root `npm ci`:

```
npx tsc -b
npm run lint
npm run check:university
npm test
npm run test:shuffle
npm run build
npm run design-system:check
```

`npm run typecheck`, `test:a11y`, `test:responsive`, `test:design`, `security`, and `secrets` are not scripts in `app/package.json`. Accessibility, responsive, and design coverage is inside `npm test` and `design-system:check`. Security advisor work is a read-only Supabase call, not an npm script.

Production `supabase db push`, deploys, and billing changes need an explicit owner confirmation and are outside these branches.

## First 10 branches

The PDF's longer branch list is the backlog beyond these ten. These ten are the ones that can start without pretending a domain is authoritative.

| # | Branch | Acceptance criteria |
| ---: | --- | --- |
| 1 | `audit/native-semester-master-reconciliation` | This folder. Classifications cite a file or a measured count. No domain marked pilot-ready, production-ready, or authoritative. No migration applied. |
| 2 | `feat/native-foundation-identity-policy-trust` | Tasks 3–6 and 21. Anon policy outcomes written. Definer functions classified. F-01 has a red-then-green test or a written compensating control. Module flags default off for gradebook, registration commands, family, community, dining. No new role system. |
| 3 | `design/live-semester-token-and-shell` | Task 19. Six pilot screens use `look.ts` tokens and existing unity components. Ink and parchment remain grounds. Indigo stays optional (D-1293). `design-system:check` does not grow the raw-value ledger. No second shell. |
| 4 | `feat/native-student-os-p0` | Tasks 7, 8, 14, 20. Today, path, readiness, account, ask, support, privacy. Source labels. Support handoff. 320px and keyboard tests. Seeded data cannot look institution-verified. |
| 5 | `feat/native-plan-registration-p0` | Tasks 9 and 22. Enrol, drop, and withdraw refuse a closed window, a hold, and a failed prerequisite, proven by a test that fails when the check is reverted. UI hands off to the SIS. Shadow receipt is sandbox-only. |
| 6 | `feat/native-course-studio-learning-p1` | Task 11 and 24's constraint. Gradebook says the LMS is the record. No rubric builder and no question-bank UI until release is capability-checked. Study packs stay student-owned. |
| 7 | `feat/native-governed-ai-p1` | Tasks 12–13. Gateway refuses a completion when consent or classification fails. Registration and grade answers cite a source and disclaim authority. Spend meter records usage without storing prompt content in the audit table (existing AI-audit tests stay green). |
| 8 | `feat/native-student-success-support-p1` | Task 23. Caseload query returns nothing without an advisor grant. Check-in and success plan wait on that grant. No risk score stored. |
| 9 | `feat/native-registrar-academic-core-p2` | Task 10. `gradebook_release` and `registrar_decide` require capability, approval, and an audit row. Co-requisites and time-ticket issuance are specified and still default off. No transcript function. |
| 10 | `feat/native-campus-community-career-p2` | Dining, community, and career stay flag-off. A test proves `dining_place_order` and community post creation refuse when the module is off. No employer "verified" label. Housing maintenance is specified, not shipped, until an office owner exists. |

### Later branches (not in the first ten)

`feat/native-family-finance-p2`, `feat/native-institution-control-plane`, `feat/native-integration-migration-factory`, `feat/native-trust-security-compliance`, `feat/native-company-gmt-customer-success`, `feat/native-ops-command-center`, `feat/native-developer-marketplace-global`, `feat/native-finish-line-evidence`.

Family and finance wait on branch 2's privacy review. The control plane waits on F-01. The migration factory waits on a dual-run plan (task 22). Marketplace waits on task 25's hold. Finish-line evidence already has `docs/finish-line/`; a new branch updates that register rather than copying it.

## 90 days, as a sequence rather than a calendar promise

1. Branches 1–4. Individual invitation path only.
2. Branches 5–7. Readiness and governed answers. SIS and LMS still authoritative.
3. Branches 2's security leftovers, then 8–10 behind flags.

A named institutional pilot is not in this sequence. It starts only when the pilot exit table in the gap register is filled.

## 12-month shape

After the ten branches: one sandbox section in dual-run (still external-authoritative), advisor grants with caseloads, family grants reviewed, dining only with a contracted partner, console tenant read models fed by the outbox. Still no transcript, no aid decision, no marketplace, no conformance claim.

## 36-month shape

Authority moves one domain at a time through the cutover sequence in the data-authority matrix. Likely order if an institution asks: student-owned workspace (already S), then a single course's study layer, then registration for one window, then gradebook for one course, then the record ledger. Campus commerce, career verification, and a developer marketplace stay bridges until their own gates pass.

## Readiness scorecard

| Question | Score |
| --- | --- |
| One codebase and one design authority | Yes |
| Schema sketched for most PDF domains | Yes (321 public tables, RLS on) |
| Data present for an operating institution | No (estimates are seed-scale) |
| Student OS usable for invited individual validation | Conditional, per existing go/no-go. Not re-litigated here |
| Any domain native-authoritative | No |
| Pilot signed | No |
| Production institutional claim allowed | No |
