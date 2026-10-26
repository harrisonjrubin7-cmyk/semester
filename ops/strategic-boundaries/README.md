# Strategic boundaries

<!-- Rendered from app/src/lib/ops/boundaries.ts by boundaries.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

What Semester does not build, whoever asks and however good the deal. These
are the company-level lines; the product-level anti-patterns (no custom
button, no unexplained score) are [`docs/DO-NOT-BUILD.md`](../../docs/DO-NOT-BUILD.md).
Together they protect focus, ethics, privacy, legal position and brand trust,
and they are the first thing to read before answering a request that begins
"could Semester also…".

Each line says how it is held. 8 of the 12 are held by a test that
fails the build; the rest by a decision or a document plus review, and the
line says which. A boundary held only by review is one somebody can talk
themselves out of, so the ones that can be mechanical are.

Changing a line is a decision, made in a pull request that edits
`app/src/lib/ops/boundaries.ts`, says why, and records a `D-nnn` in
[`docs/DECISION-LOG.md`](../../docs/DECISION-LOG.md). This page is rendered
from that data, so a boundary cannot be relaxed without the page changing in
the same diff.

## The lines

| # | Boundary | Held | Held by | Decisions |
| --- | --- | --- | --- | --- |
| 1 | **No behavioral student-risk scoring.** | review | [`docs/DO-NOT-BUILD.md`](../../docs/DO-NOT-BUILD.md)<br>[`app/src/lib/atrisk.ts`](../../app/src/lib/atrisk.ts)<br>[`app/src/lib/study-readiness.ts`](../../app/src/lib/study-readiness.ts) | `D-029`, `D-045` |
| 2 | **No mental-health inference.** | review | [`docs/ai-toolkit/CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md`](../../docs/ai-toolkit/CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md)<br>[`docs/CRISIS-RESPONSE-RUNBOOK.md`](../../docs/CRISIS-RESPONSE-RUNBOOK.md)<br>[`app/src/lib/governance/ai-lifecycle.ts`](../../app/src/lib/governance/ai-lifecycle.ts) | `D-029` |
| 3 | **No emotion or facial analysis.** | mechanical | [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts)<br>[`app/src/components/ScanIsbn.tsx`](../../app/src/components/ScanIsbn.tsx) | — |
| 4 | **No unapproved proctoring or surveillance.** | mechanical | [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts)<br>[`app/src/lib/rtc.ts`](../../app/src/lib/rtc.ts) | — |
| 5 | **No generic parent access to student records.** | mechanical | [`docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md`](../../docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md)<br>[`supabase/supportshares.check.sql`](../../supabase/supportshares.check.sql) | `D-037`, `D-038`, `D-039` |
| 6 | **No direct SIS production database connection.** | mechanical | [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts)<br>[`app/src/lib/integration/catalog.ts`](../../app/src/lib/integration/catalog.ts)<br>[`docs/architecture/0003-no-application-server.md`](../../docs/architecture/0003-no-application-server.md) | `D-007`, `ADR-0003` |
| 7 | **No service-role credentials in browsers.** | mechanical | [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts)<br>[`docs/architecture/0002-rls-is-the-authorization-boundary.md`](../../docs/architecture/0002-rls-is-the-authorization-boundary.md)<br>[`SECRETS.md`](../../SECRETS.md) | `ADR-0002` |
| 8 | **No official decision by AI.** | mechanical | [`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts)<br>[`docs/DO-NOT-BUILD.md`](../../docs/DO-NOT-BUILD.md)<br>[`docs/operating-model/AI-LIFECYCLE-GATES.md`](../../docs/operating-model/AI-LIFECYCLE-GATES.md) | `D-034`, `D-041` |
| 9 | **No fake data in production.** | mechanical | [`app/src/data/institutional-preview.test.ts`](../../app/src/data/institutional-preview.test.ts)<br>[`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](../../docs/MASTER-LAUNCH-READINESS-REGISTER.md) | — |
| 10 | **No hidden student-data sale or behavioral advertising.** | mechanical | [`app/src/donotbuild.test.ts`](../../app/src/donotbuild.test.ts)<br>[`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`](../../docs/PRODUCT-ANALYTICS-DATA-ETHICS.md)<br>[`ANALYTICS.md`](../../ANALYTICS.md) | `D-005` |
| 11 | **No custom per-tenant forks.** | review | [`docs/operating-model/CONFIGURATION-TIERS.md`](../../docs/operating-model/CONFIGURATION-TIERS.md)<br>[`app/src/lib/governance/scorecard.ts`](../../app/src/lib/governance/scorecard.ts) | — |
| 12 | **No unmoderated marketplace or public social feed.** | review | [`docs/VOLUNTEER-MODERATOR-PROGRAM.md`](../../docs/VOLUNTEER-MODERATOR-PROGRAM.md)<br>[`app/src/community/moderation.ts`](../../app/src/community/moderation.ts)<br>[`supabase/migrations/20260928032000_community.sql`](../../supabase/migrations/20260928032000_community.sql) | — |

## What each protects, and what holds it

### 1. No behavioral student-risk scoring.

A student is never a number a stranger can act on. Attendance arithmetic, deadline counts and the student’s own readiness mark are computed; a propensity or a risk tier about a person is not.

- [`docs/DO-NOT-BUILD.md`](../../docs/DO-NOT-BUILD.md) — Rule 3: nothing ranked or suggested without its reason, inputs and limits.
- [`app/src/lib/atrisk.ts`](../../app/src/lib/atrisk.ts) — The only file with "risk" in its name computes which of today’s classes a policy makes costly to miss, from the student’s own marks; it scores nobody.
- [`app/src/lib/study-readiness.ts`](../../app/src/lib/study-readiness.ts) — Readiness is the student’s mark; Semester only counts (D-045).

*Not a crossing:* app/src/lib/atrisk.ts is attendance arithmetic from lib/attend.ts and is silent for any course without a policy. The name predates this line; the behaviour does not cross it.

### 2. No mental-health inference.

Semester shows the crisis notice verbatim and routes to people; it never decides that a student is struggling from what they do in the app.

- [`docs/ai-toolkit/CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md`](../../docs/ai-toolkit/CLINICAL-LEGAL-FINANCIAL-BOUNDARIES.md) — The assistant refuses clinical territory and says where to go instead.
- [`docs/CRISIS-RESPONSE-RUNBOOK.md`](../../docs/CRISIS-RESPONSE-RUNBOOK.md) — The notice is shown verbatim on every report form; nothing is inferred to trigger it.
- [`app/src/lib/governance/ai-lifecycle.ts`](../../app/src/lib/governance/ai-lifecycle.ts) — AI gates: a use case that infers wellbeing has no gate to pass.

### 3. No emotion or facial analysis.

The camera reads a barcode and joins a study call. It never reads a face.

- [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No package depends on a face, emotion or affect library, and no source under app/src names a face-detection API.
- [`app/src/components/ScanIsbn.tsx`](../../app/src/components/ScanIsbn.tsx) — The one camera use outside calls: a barcode, decoded on device.

### 4. No unapproved proctoring or surveillance.

Screen capture exists for one reason — a student sharing their own screen in a study call they started — and nowhere else.

- [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — Screen capture appears only in the allow-listed file, and no source names proctoring as a feature.
- [`app/src/lib/rtc.ts`](../../app/src/lib/rtc.ts) — The allow-listed file: peer study calls, started and ended by the student.

*Not a crossing:* app/src/lib/learner-pathways.ts mentions proctoring once, as a checklist item reminding a student to confirm exam arrangements with their course. That is advice about the school’s proctoring, not Semester doing any.

### 5. No generic parent access to student records.

A supporter reads a confirmed copy of what the student chose to share, through one logged reader, for as long as the student says. There is no parent role and no family view.

- [`docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md`](../../docs/SUPPORTER-FAMILY-PRIVACY-MODEL.md) — The model, and the open policy decision on minors that blocks building more.
- [`supabase/supportshares.check.sql`](../../supabase/supportshares.check.sql) — A supporter share is created by the student, scoped, revocable, and re-checks the role on every read.

### 6. No direct SIS production database connection.

Institutional data arrives through a connector with a scope the institution approved, a freshness class and an audit trail — never through a database credential on a school’s system of record.

- [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No package depends on a relational database driver, and no source carries a database connection string.
- [`app/src/lib/integration/catalog.ts`](../../app/src/lib/integration/catalog.ts) — Provider domains, freshness and sync classes, and what no connector ingests by default.
- [`docs/architecture/0003-no-application-server.md`](../../docs/architecture/0003-no-application-server.md) — There is no server of Semester’s to hold such a connection.

### 7. No service-role credentials in browsers.

Row-level security is the authorization boundary. A service key in a bundle would be every student’s data on every device.

- [`app/src/lib/ops/boundaries.test.ts`](../../app/src/lib/ops/boundaries.test.ts) — No file under app/src, app/public or app/index.html names the service role, and no VITE_ variable does.
- [`docs/architecture/0002-rls-is-the-authorization-boundary.md`](../../docs/architecture/0002-rls-is-the-authorization-boundary.md) — Why the browser holds only the anon key.
- [`SECRETS.md`](../../SECRETS.md) — Where each secret lives, and that the service key lives only in Edge Functions.

### 8. No official decision by AI.

Nothing the assistant writes carries the institution’s label, grades a student, or approves anything. It compares, drafts and explains; a person decides.

- [`app/src/lib/source.test.ts`](../../app/src/lib/source.test.ts) — Only facts confirmed by the school’s system carry `institution_verified`; nothing the assistant writes may.
- [`docs/DO-NOT-BUILD.md`](../../docs/DO-NOT-BUILD.md) — Rule 7.
- [`docs/operating-model/AI-LIFECYCLE-GATES.md`](../../docs/operating-model/AI-LIFECYCLE-GATES.md) — Consequential actions need a person in the loop to pass a gate.

### 9. No fake data in production.

A demo record shown as a real one is a lie to the person reading it and to the register that counts it.

- [`app/src/data/institutional-preview.test.ts`](../../app/src/data/institutional-preview.test.ts) — Every preview record is marked synthetic, pilot-only and sandbox-explicit.
- [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](../../docs/MASTER-LAUNCH-READINESS-REGISTER.md) — PRG-008 and TRUST-005: what still separates preview data from production, and the gap.

### 10. No hidden student-data sale or behavioral advertising.

No ad or tracking SDK is loaded, three marks are the whole analytics record, and sponsorship is a separate opt-in that reads nothing about the student.

- [`app/src/donotbuild.test.ts`](../../app/src/donotbuild.test.ts) — Rule 10: none of the common ad or tracking hosts appears in the source.
- [`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`](../../docs/PRODUCT-ANALYTICS-DATA-ETHICS.md) — What is measured, what was promised never to be, and the test behind each.
- [`ANALYTICS.md`](../../ANALYTICS.md) — Three marks; a fourth is a decision, held by a check constraint.

### 11. No custom per-tenant forks.

One codebase, configured through versioned policies, entitlements, mappings and approved extensions. A fork is a second product with one customer.

- [`docs/operating-model/CONFIGURATION-TIERS.md`](../../docs/operating-model/CONFIGURATION-TIERS.md) — The tiers of variation, and that none is a fork.
- [`app/src/lib/governance/scorecard.ts`](../../app/src/lib/governance/scorecard.ts) — Configuration scores 0 when a request needs a code fork, which routes it to decline.

### 12. No unmoderated marketplace or public social feed.

Every community surface has a moderator, a queue and an audit event. There is no public feed and no listing that reaches students unreviewed.

- [`docs/VOLUNTEER-MODERATOR-PROGRAM.md`](../../docs/VOLUNTEER-MODERATOR-PROGRAM.md) — The program, its calibration and its audit tables.
- [`app/src/community/moderation.ts`](../../app/src/community/moderation.ts) — Who may decide, and the blind view a moderator sees.
- [`supabase/migrations/20260928032000_community.sql`](../../supabase/migrations/20260928032000_community.sql) — The moderation and volunteer tables, with their audit events.

## The mechanical checks

`boundaries.test.ts` scans the tree on every change:

- **Service role.** No file under `app/src`, `app/public` or `app/index.html`
  names the service role, and no `VITE_` variable carries `SERVICE`, `SECRET`
  or `PRIVATE_KEY`.
- **Faces.** No package manifest depends on a face, emotion or affect
  library, and no source names a face detector.
- **Screen capture.** `getDisplayMedia` appears only in:

```capture
src/lib/rtc.ts
```

- **Databases.** No manifest depends on a relational driver
  (`pg`, `pg-native`, `postgres`, `mysql`, `mysql2`, `oracledb`, `mssql`, `tedious`, `odbc`, `ibm_db`, `better-sqlite3`), and nothing that runs carries a
  database connection string.

Each check is shown a fixture it must catch before it is trusted to find
nothing, because a scan that finds nothing is also what a scan looking for
the wrong thing finds.
