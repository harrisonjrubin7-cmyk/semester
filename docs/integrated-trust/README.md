# Integrated trust

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

Security, privacy, trust and safety, accessibility, reliability, support and incident response, read as one system and mapped to the thirteen product domains. It joins what already exists under `docs/trust/`, `docs/engineering-operations/`, `docs/accessibility/` and `supabase/*.check.sql`, and adds what was missing: a register that says which controls a build would notice losing, a per-domain statement of what each domain needs, a combined risk review keyed by capability, playbooks tied to rehearsals, and an ordered plan for the gaps.

**The ceiling.** No page here evidences certification, and none shows that Semester is secure, private, accessible, reliable or ready for an institution. It is a map of what the repository enforces, what it only describes, and what is absent, written so that a gap cannot be recorded without a plan and a claim cannot be made without a file. The master register lets no row past `tested` without a file under `docs/evidence/`, and this package follows the same rule. Where a legal conclusion would follow, the page says *requires qualified human counsel review* and does not state one.

## What is here

Pages marked *rendered* are generated from typed data in `app/src/lib/ops/` and held by tests; edit the data, then run `npm run registers` from `app/`. The others are hand-written and are held by `trustdocs.test.ts` for working links and claim language.

| Page | What it is |
| --- | --- |
| [Control framework](CONTROL-FRAMEWORK.md) *rendered* | Every control, the product domains it covers, and whether a test, check or workflow fails without it |
| [Domain requirements](DOMAIN-REQUIREMENTS.md) *rendered* | For each domain: threat model, privacy review, accessibility review, objective, support route, incident playbook, and the standing of each |
| [Threat models](THREAT-MODELS.md) | Eight models for the domains that had none, drafted and not reviewed |
| [Combined risk review](COMBINED-RISK-REVIEW.md) *rendered* | The template required before release, its evaluator's rules, and the five reviews opened |
| [Accessibility program](ACCESSIBILITY-PROGRAM.md) | Automated, manual, assistive-technology, cognitive and mobile testing, the register, the gates |
| [Reliability program](RELIABILITY-PROGRAM.md) | Objectives, error budgets, dashboards, alerts, capacity, load, chaos, backup and recovery |
| [Incident response](INCIDENT-RESPONSE.md) | Roles, the first fifteen minutes, communications, evidence handling, what counsel decides |
| [Incident playbooks](INCIDENT-PLAYBOOKS.md) *rendered* | Fifteen scenarios and the severity crosswalk |
| [Tabletop calendar](TABLETOP-CALENDAR.md) *rendered* | Thirteen exercises over the first thirty weeks and the cadence after |
| [Trust and safety](TRUST-AND-SAFETY.md) | Policy framework for community, marketplace, AI, reporting and moderator access |
| [Data rights operations](DATA-RIGHTS-OPERATIONS.md) | Requests, consent, retention, deletion and legal holds as an operating procedure |
| [Support routes](SUPPORT-ROUTES.md) | Where each kind of request goes and when it becomes an incident |
| [Procurement evidence](PROCUREMENT-EVIDENCE.md) | The artifacts a reviewer asks for, the truth status of each, and how to answer |
| [Remediation sequence](REMEDIATION-SEQUENCE.md) *rendered* | Forty-nine items, ordered by when each must be done, with a test that no gap goes untracked |

## The findings that decide the order

1. **The nightly contrast sweep could not fail.** It piped through `tee` with no `pipefail`; every run was green while the log said `FINDINGS: 159`. Fixed in this change and guarded for every workflow (RM-01). One line of text on the Work screen accounts for 156 of the 159 (RM-02).
2. **No objective has a measured value, and the only alert is AI spend.** Everything reliability-related rests on RM-27 and RM-07.
3. **One person holds every role.** Four seats are vacant, so four sections of the risk review are unpassable until they are filled (RM-12).
4. **Break-glass is a record that widens nothing.** The console map marks it done (RM-14).
5. **Data-subject requests can be raised and not handled** (RM-20).
6. **Community is built and must stay off** until its prerequisites exist (RM-11, RM-34 to RM-36).
7. **The registers contradict each other** in ways a reviewer will find (RM-04).

## How this plugs into the existing system

- **Capabilities** are the sixty `CAP-nnn` ids in `rollout-capabilities.ts`; the risk review is keyed by them and refers to risks (`risk.ts`) and playbooks.
- **Owners** are the twelve seats in `launchreadiness.ts`; a vacant seat cannot sign a review.
- **Evidence** is a file under `docs/evidence/` cited from `ops/evidence.ts`; an exercise or a drill counts when its file exists and states its date.
- **Decisions** are `docs/decisions/D-<pull request number>.md`; the scale choice in RM-06 and the gate in RM-49 each need one.
- **Not yet wired.** The risk review's evaluator is read by its own test; no release profile, workflow or activation check consults it (RM-49).
