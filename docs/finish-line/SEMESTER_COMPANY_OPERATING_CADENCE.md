# Semester company operating cadence

| | |
| --- | --- |
| **Version** | 0.1 |
| **As of** | 2026-10-05 |
| **Owner** | Harrison Rubin |
| **Status** | **Proposed, not adopted.** `docs/company/leadership-system/09-calendar.md` is also "PROPOSED — NOT ADOPTED". Adoption is a founder decision; until then this is the shape, not the practice. |

## Principles

- One person holds every seat today. A meeting with oneself is a written
  record. The cadence exists to produce dated evidence and to force decisions,
  not to simulate a company.
- Every review has an input (a named artifact), an output (a dated record) and a
  place where the record lives. A review that leaves no record did not happen.
- A review that finds nothing new is recorded as "no change" in one line. It is
  not skipped.
- Reviews never escalate scope. New work enters through the register, the risk
  list or a decision file.

## Existing rhythm to reuse

- The weekly program status (`docs/program/STATUS-2026-10-04.md` and `-2.md`;
  next due **2026-10-11**) and `docs/program/04-RITUALS-STATUS-ESCALATION.md`.
- The monthly register review (`SEMESTER-OPERATING-SYSTEM.md`; the evidence
  register's "operating-system register review" record is 30 days).
- The evidence ladder for expiry: 30 days owning seat notified; 7 days security
  and privacy seats and the weekly review; at expiry superseded
  (`ops/operations-console/README.md`).

## Weekly

| Review | Input | Output | Decision rights | Time |
| --- | --- | --- | --- | --- |
| Product and engineering | `main` status, CI run history, register diffs, open PRs, duplicates check (`CLAUDE.md`) | Weekly program status; register rows moved with evidence | What ships; what is reverted | 45 min |
| Revenue and pipeline | CRM tables, discovery evidence log | Pipeline counts by stage; conversations held; next five asks | Which accounts to pursue | 30 min |
| Customer success | Pilot metrics, health snapshots, tickets | Cohort adoption and risk list per pilot (blank until a pilot exists) | Outreach; scope change requests | 30 min |
| Support | Ticket queue age, status page, feedback | Queue summary; macros added; escalations | Severity calls | 20 min |
| Security and reliability | Probe results, advisor warnings, Dependabot, secret scan, `main` protection state | Findings opened or closed; error-budget view once measured | Patch priority; freeze | 30 min |
| Operations inbox | Support address, lead intake, legal queue, vendor mail | Everything answered or filed | Triage | 20 min |

Total about 3 hours a week. The first five weeks may run shorter because most
inputs are empty. An empty input is a finding: it appears on the risk list.

## Monthly

| Review | Input | Output | Record location |
| --- | --- | --- | --- |
| Finance and runway | bank balance (human), spend, model assumptions | cash, burn and runway statement; model assumptions updated | `docs/finance/` |
| Trust and compliance | claims register, evidence register expiries, legal queue, HECVAT draft | claims confirmed or withdrawn; expiring evidence renewed | `docs/EVIDENCE-REGISTER.md` source, `docs/claim-withdrawals/` |
| Access review | role grants, console grants, GitHub, Google, Supabase, Stripe, provider consoles | dated review record; attestations renewed | `docs/evidence/security/` |
| Vendor risk | `docs/SUBPROCESSORS.md`, DPAs, incident notices | register updated; open DPAs listed | `docs/SUBPROCESSORS.md` |
| Outcome measurement | pilot metrics against baseline | outcome note; metrics that cannot be measured named | `docs/evidence/` |
| Hiring and capacity | open risks, ticket load, roadmap | which bottleneck, if any, has a measurable cost | `docs/finance/12-GATED-HIRING-SCHEDULE.md` |
| Register re-read | this directory | rows re-verified against `origin/main`; stale rows listed | `SEMESTER_RELEASE_READINESS_REGISTER.md` |

## Quarterly

| Review | Input | Output |
| --- | --- | --- |
| OKRs | prior quarter results, [90-day plan](SEMESTER_90_DAY_FINISH_LINE_PLAN.md) | next quarter's objectives, each tied to a register row or a gate |
| Roadmap | register, domain gates | the next quarter's domain gates to work, with the one reason each |
| Risk review | [risk burn-down](SEMESTER_RISK_BURN_DOWN.md) | scores re-set; risks closed with evidence; new risks |
| Board and investor | metrics, runway, risks, decisions | an update, even without a board (`BOARD-OR-ADVISOR-UPDATE-TEMPLATE.md`); advisor, if named |
| Domain replacement review | [domain gates](SEMESTER_DOMAIN_AUTHORITY_GATES.md) | which gate each domain works next; any gate newly passed with evidence |
| Market and competitive | `docs/COMPETITION.md`, `MARKET-POSITION.md`, buyer conversations | claims against competitors re-checked |

## Dashboards

Defined in the PDF; built here as documents and queries first.

| Dashboard | Owner seat | Frequency | Source today |
| --- | --- | --- | --- |
| Revenue and pipeline | Founder / GTM | weekly | `gtm_*` tables (no UI) |
| Pilot delivery | Customer success | weekly | `gtm_pilot_metrics` (no UI) |
| Product and engineering | Product / engineering | weekly | CI history, register |
| Reliability and SLO | Engineering / SRE | weekly | probe data on `status-data` branch; SLOs defined, unmeasured |
| Security and privacy | Security / privacy | monthly | findings register, advisor reads |
| Finance and runway | Finance / founder | monthly | `docs/finance/dashboard.html` on model inputs |
| Customer health and renewal | Customer success | weekly | `compute_account_health()` (no accounts) |
| Trust and compliance | Security / legal | monthly | evidence register |
| Hiring and capacity | Founder / operations | monthly | hiring schedule |
| Strategy and OKR | Leadership | quarterly | this directory |

A dashboard row is `built` only when a person can open it and it reads real
data. Seven of the ten read nothing real today.

## Escalation

An item that breaches its clock appears in the next weekly record and is
escalated to the founder's decision list. Because the founder holds every seat,
escalation outside the founder is **to a named advisor or counsel**, which is
why assigning one is item 6 in [the founder's decision list](SEMESTER_COMMERCIAL_READINESS.md#what-the-founder-must-decide).

## Adoption

Adopted when the founder records, in one dated line under this table, the day
the cadence starts. The first monthly register re-read is then due 30 days
later. Start date: **not yet recorded.**
