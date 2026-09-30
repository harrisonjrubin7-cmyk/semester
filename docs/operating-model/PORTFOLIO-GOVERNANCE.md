# Product portfolio governance

Semester has enough ideas that the scarce decision is what **not** to build or enable. A full platform becomes unusable
when every capability competes for the same attention. This document is the process for making that decision, and
[`app/src/lib/governance/scorecard.ts`](../../app/src/lib/governance/scorecard.ts) and
[`charters.ts`](../../app/src/lib/governance/charters.ts) are the parts of it that code can hold.

## The Portfolio Council

**Members:** product lead (chair), engineering lead, privacy/security owner, accessibility lead, customer success lead,
and finance when cost or pricing is in question. **Cadence:** every two weeks for intake, and each quarter for the
portfolio review (see [OPERATING-RHYTHM.md](OPERATING-RHYTHM.md)). **Quorum:** product, engineering and one of
privacy/security.

The rule over intake is in [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md): no new module launches
unless it replaces, improves, or connects an existing student or institution workflow with measurable value. The nine
questions it asks of every addition are in the pull-request template, and a request that cannot answer them does not
reach the scorecard.

### Decision workflow

```text
New request (student, faculty, tenant, sales, internal)
→ User and job-to-be-done validation
→ Student value and institutional value assessment
→ Privacy, security, accessibility, policy and cost review
→ Governance scorecard (0–3 × 11 criteria)
→ Build / partner / integrate / defer / decline
→ Owner, success metric, feature flag, release gate, sunset/review date
→ Pilot and evaluate
→ Scale, revise, or retire
```

Every decision is a row in `governance_decisions` with its scorecard. The database computes the total and the route
from the scores, refuses an incomplete card, refuses `build` on a route that doesn't support it, and never lets a
decision be edited: a revisited decision is a new row that `supersedes` the old one. Decisions about the platform's
own architecture still go in `DECISIONS.md` as well.

## Governance scorecard

Score each proposed capability or tenant request from 0 to 3 on every criterion before implementation. The rubric is
`RUBRIC` in `scorecard.ts`.

| Criterion | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Reusability | Only one customer needs it | Likely limited reuse | Could serve a segment | Broad reusable capability |
| Security | Weakens controls | New risk needs major review | Fits existing controls | Strengthens platform control |
| Privacy | Uses unnecessary/sensitive data | Needs special data agreement | Fits classification rules | Improves minimization/transparency |
| Accessibility | Breaks established patterns | Needs substantial remediation | Meets component standards | Improves shared accessibility |
| Integration | One-off brittle connector | Custom transform required | Uses adapter/mapping framework | Reusable provider connector |
| Operations | No owner/support plan | High manual burden | Standard runbook | Fully observable/self-service |
| Cost | Unbounded AI/compute/support cost | Requires special pricing | Known bounded cost | Efficient/shared economics |
| Configuration | Requires code fork | Needs scoped extension | Tenant config/flag | Standard product setting |
| Auditability | No trace | Partial logs | Versioned/audited | Full policy/evidence trail |
| Rollback | Irreversible | Manual rollback | Flag/config rollback | Instant kill switch/revert |
| Adoption value | Unclear | One sponsor request | Validated workflow | Repeatable measurable outcome |

### Decision thresholds

| Total / 33 | Decision |
| --- | --- |
| 27–33 | Build as core reusable platform capability |
| 21–26 | Build as configurable module or approved extension |
| 15–20 | Pilot behind tenant flag with explicit SOW and sunset/review date |
| Under 15 | Partner, integrate, defer, or decline |
| **Any 0** | **Reject, or redesign until nothing scores 0**, whatever the total |

The last row is an addition to the thresholds as first proposed, and here is why. The criteria are not fungible. A
request that needs a code fork, or can't be rolled back, does not become acceptable because it also scores 3 on
reuse and cost. If scores were simply summed, a lot of enthusiasm on other criteria could buy past a single
irreversible one. `assess()` also refuses a card with any criterion unscored, because a blank means nobody checked. It
does not mean the request passed.

## Every module owes

| Requirement | Why it matters | Where |
| --- | --- | --- |
| Named product owner | Prevents orphaned features | Charter `owners.product` |
| Target user and job-to-be-done | Avoids vague "platform" features | Charter `primaryUser`, `jobToBeDone` |
| Source-of-truth dependency | Prevents invented data | Charter `sourceDependency`; data contract |
| Data classification | Keeps sensitive flows bounded | Charter `classification` (T0–T6) |
| Accessibility acceptance criteria | Stops remediation debt | Charter `accessibilityAcceptance` |
| Cost model | AI, media and compute features can become margin traps | Charter `costModel` |
| Adoption hypothesis | Distinguishes a feature from an outcome | Charter `buyerAndAdoptionHypothesis` |
| Kill switch | Allows safe rollback | Charter `killSwitch`; flag `killSwitches` |
| Sunset/review date | Avoids permanent feature clutter | Charter `reviewAt` ≤ flag `reviewAt` |
| Support owner | Prevents unsupported launch | Charter `owners.support` |
| Build/partner/integrate decision | Keeps Semester from rebuilding every specialist tool | Charter `decision`, `route` |

`charters.test.ts` fails when a `module.*` or `ops.*` flag has no charter, when a charter has an empty field, when a
charter reviews later than its flag, or when a `build` decision rests on a `partner_or_decline` or
`reject_or_redesign` route. Connectors are chartered by their data contract (see
[DATA-STEWARDSHIP.md](DATA-STEWARDSHIP.md)).

Chartered today: `module.core_mode`, `module.integration_dashboard`, `module.source_freshness_cards`, `module.institutional_operations`,
`module.campaign_manager`, `module.sponsorship`, `module.dining`, `ops.external_ai_generation`,
`ops.data_upload`, `ops.code_sandbox_enabled`.

## Product charter template

```text
PRODUCT CHARTER

Name:                 [Feature/module/workflow]
Problem:              [Specific student/staff/institutional problem]
Primary user:         [Role and segment]
Secondary stakeholders: [Buyer, staff, faculty, partner, administrator]
Job to be done:       When [situation], I want to [motivation], so I can [outcome].

Success metrics:      • Product behavior  • Workflow outcome  • Institutional/service outcome
Non-goals:            • [What this will not do]

Source/system dependencies: • Source of truth • Integration maturity • Fallback behavior
Data and privacy:     • Classification • Minimum fields • Consent • Retention • Prohibited uses
Security:             • Roles/capabilities • Threats • Audit requirements • Kill switch
Accessibility:        • WCAG acceptance criteria • Alternative formats/input • Device/reflow
Configuration:        • Brand/workflow/policy/integration/extension settings (tier)
Cost model:           • AI/compute/storage/support cost • Capacity limits • Pricing implication
Operational ownership: • Product • Engineering • Support • Data • Privacy/security
Rollout:              • Feature flag • Pilot tenants • Training • Documentation • Rollback plan
Review/sunset:        • Review date • Sunset/renewal decision
```

## Tenant customization hierarchy

```text
Core platform
  → Tenant configuration
  → Feature/module flags
  → Versioned workflows and policy rules
  → Integration mappings
  → Approved extension framework
  → Paid, time-bounded exceptional custom work
  → Never: tenant fork of core codebase
```

| Request type | Correct implementation |
| --- | --- |
| Logo, colors, campus labels, help links | Brand/content configuration (Tier 1) |
| Notification cadence, service routing, action templates | Workflow configuration (Tier 2) |
| AI policy, retention, marketplace setting | Tenant policy engine (Tier 3) |
| Course catalog field mapping, freshness SLA | Integration mapping (Tier 4) |
| New campus tool/provider | Approved connector/extension (Tier 5) |
| New reusable student workflow | Core module behind flag, via this council |
| One customer's unusual report | Export/template or paid scoped service |
| Arbitrary custom automation | Approved extension only; never tenant script in core runtime |
| Security/privacy exception | Reject, or formal legal/security approval, never a config toggle |

## Sunset process

A feature is sunset for any of three reasons: its review date passes and no decision is recorded, its adoption stays
under its hypothesis for two consecutive terms, or a partner does the job better.

1. **Propose** at the quarterly portfolio review, with adoption data and the support cost.
2. **Announce** to affected tenants a full term ahead, using the `feature_rollback` incident template, since students
   need to know what they will see instead.
3. **Export** so students keep their data (see [DEFENSIBILITY.md](DEFENSIBILITY.md): portability, not lock-in).
4. **Flag off**, then after one term remove the code, the flag, the charter and the registry row in one commit.
5. **Record** the decision and what was learned in `DECISIONS.md`.
