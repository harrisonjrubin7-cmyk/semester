# Proof calendar

<!-- Rendered from app/src/lib/ops/proofcalendar.ts by proofcalendar.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The schedule for producing the evidence needed to sell. The
[master readiness register](MASTER-LAUNCH-READINESS-REGISTER.md) lets no row
above `tested` until it cites an artifact under `docs/evidence/`, and one
does: the AI kill switch, on the drill of 29 September. This is the order in
which the rest get made: three months of
them, then a quarterly cycle, so that enterprise readiness is a recurring
discipline and not a push before each procurement.

Each item names the seat that produces it, the artifact it files, what the
artifact contains, the register rows it would move, and where it already
lives in the [90-day program](90-DAY-LAUNCH-PROGRAM.md) or the
[operating rhythm](operating-model/OPERATING-RHYTHM.md). The clock starts
with day 1 of the 90-day program; no date is invented here.

## Where it stands

**0 of 19 artifacts filed.** `docs/evidence/` holds only the AI drills of 29 September, which this calendar does not schedule. The test reads the directory, so this line changes when the first artifact here lands.

## Month 1

| Proof | Owner | Artifact | Contains | Moves | 90-day task | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Auth/RLS test report | `security` | `docs/evidence/auth-rls-test-report.md` | Every policy check under supabase/*.check.sql run against a fresh project, the run recorded with its commit, and each role’s positive and negative case named | `IAM-006`, `IAM-007`, `IAM-008`, `IAM-009` | `data-inventory` | due |
| Accessibility baseline | `accessibility` | `docs/evidence/accessibility-baseline.md` | The golden path with a screen reader, keyboard only, 320px and 200% zoom, by a person, with each failure filed against the WCAG scorecard | `A11Y-001`, `A11Y-002`, `A11Y-003`, `A11Y-004`, `A11Y-005` | `a11y-core` | due |
| Backup restore drill | `engineering` | `docs/evidence/restore-drill.md` | A restore into a disposable project per RESTORE.md, timed, with the row counts before and after | `SRE-004`, `SRE-005` | `restore-rehearsal` | due |
| Support/incident tabletop | `success` | `docs/evidence/incident-tabletop.md` | One P1 walked through from first report to customer notice, who did what, and the gaps found in the runbooks | `SEC-007`, `SUP-001` | `support-ready` | due |

## Month 2

| Proof | Owner | Artifact | Contains | Moves | 90-day task | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Student workflow usability study | `product` | `docs/evidence/student-usability-study.md` | Five or more students through Today, My Path, registration and the plan, tasks timed, and whether they could say where each fact came from | `STU-001`, `STU-003`, `STU-005`, `STU-010`, `TRUST-001` | — | due |
| Load test | `engineering` | `docs/evidence/load-test.md` | A registration-morning profile against a preview project, the rate limits observed, and the point at which the journeys’ SLOs would break | `SRE-007`, `SRE-009` | — | due |
| HECVAT evidence inventory | `security` | `docs/evidence/hecvat-evidence-inventory.md` | Each HECVAT question with the artifact that answers it or the word none, so the response is written from evidence and not from hope | `SEC-001`, `SEC-011` | `trust-outline` | due |
| DPA/Trust Center review | `privacy` | `docs/evidence/dpa-trust-center-review.md` | Counsel’s read of the DPA checklist and the trust package, each [DECIDE] resolved or assigned | `SEC-009`, `SEC-013`, `LEG-002` | `trust-outline` | due |

## Month 3

| Proof | Owner | Artifact | Contains | Moves | 90-day task | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Institution UAT | `champion` | `docs/evidence/institution-uat.md` | The golden-path script run by the pilot institution’s own students and staff, results signed by the champion | `IMP-001` | `uat` | due |
| SSO/integration test | `data` | `docs/evidence/sso-integration-test.md` | Sign-in through the school’s IdP and one connector’s sync, observed end to end, with the freshness class it met | `IAM-003`, `INT-001`, `INT-014` | `identity` | due |
| VPAT/ACR | `accessibility` | `docs/evidence/vpat-acr.md` | The conformance report, by someone qualified, over the piloted screens, with each partial support explained | `A11Y-007` | — | due |
| Pilot outcome baseline | `success` | `docs/evidence/pilot-outcome-baseline.md` | The charter’s two or three measures read before launch, so the midpoint report has something to be compared with | `SUP-003` | `launch-metrics` | due |

## Every quarter

| Proof | Owner | Artifact | Contains | Moves | Rhythm row | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Access review | `security` | `docs/evidence/access-review-{quarter}.md` | Every privileged grant re-justified or revoked, read from the role-grant audit | `IAM-011` | Access review | due |
| Vendor review | `privacy` | `docs/evidence/vendor-review-{quarter}.md` | docs/SUBPROCESSORS.md re-read against what actually runs, and each vendor’s assurance current | `SEC-010` | Vendor and subprocessor review | due |
| AI evaluation | `product` | `docs/evidence/ai-evaluation-{quarter}.md` | Each enabled AI use case re-run through its G5 review: risk, value, cost and incidents this quarter | `AI-001`, `AI-011` | AI governance board | due |
| Accessibility review | `accessibility` | `docs/evidence/accessibility-review-{quarter}.md` | The scorecard re-walked over what shipped this quarter, and the blocker rate | `A11Y-006` | Security, privacy and accessibility review | due |
| DR exercise | `engineering` | `docs/evidence/dr-exercise-{quarter}.md` | A restore into another region or project, timed against the recovery objective | `SRE-006` | Disaster-recovery exercise | due |
| Security/risk review | `security` | `docs/evidence/security-risk-review-{quarter}.md` | Open vulnerabilities by age, the risk register read row by row, and each acceptance renewed or retired | `SEC-001`, `SEC-004` | Security, privacy and accessibility review | due |
| Customer advisory review | `success` | `docs/evidence/customer-advisory-{quarter}.md` | Themes from the advisory conversations, and which reached the roadmap | `SUP-003` | Customer advisory input | due |

## How an artifact counts

1. The owner produces it and files it at the path above (a quarterly one
   with its cycle, `access-review-2027Q1.md`).
2. The register rows it moves are re-read, and the ones it now supports go
   to `evidenced` in `app/src/lib/masterregister.ts`, citing the artifact.
   The register’s test refuses `evidenced` without a `docs/evidence/` path.
3. `npm run registers` rewrites this page and the register.

An artifact that is not filed is not evidence, however thoroughly the work
was done. That is the whole point of the directory.

## How this page is held

[`app/src/lib/ops/proofcalendar.test.ts`](../app/src/lib/ops/proofcalendar.test.ts) fails when an item names a
register row, a 90-day task or a rhythm row that does not exist, when a
quarterly item lacks a cycle in its artifact name, when `filed()` cannot tell
a filed artifact from a near miss, or when this page is stale.
