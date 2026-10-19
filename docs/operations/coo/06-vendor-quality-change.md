# 06 · Vendor management, quality operations and change management

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NOT YET OPERATED** |
| Owner seat | `operations` for vendors and change; `engineering` and `operations` jointly for quality; `finance` for vendor spend |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`PROCUREMENT-AND-VENDOR-MANAGEMENT-POLICY`](../../company/PROCUREMENT-AND-VENDOR-MANAGEMENT-POLICY.md), [`VENDOR-RISK-ASSESSMENT-TEMPLATE`](../../company/VENDOR-RISK-ASSESSMENT-TEMPLATE.md), [`SUBPROCESSORS`](../../SUBPROCESSORS.md), [`SUPPLY-CHAIN`](../../SUPPLY-CHAIN.md), [`QUALITY-MANAGEMENT`](../../operating-model/QUALITY-MANAGEMENT.md), [`RELEASE-GATES`](../../RELEASE-GATES.md), [`DEFINITION-OF-DONE`](../../DEFINITION-OF-DONE.md), [`CHANGE-MANAGEMENT`](../../operating-model/CHANGE-MANAGEMENT.md), [`CONFIGURATION-TIERS`](../../operating-model/CONFIGURATION-TIERS.md) |
| Claim ceiling | Semester may say it has a vendor policy draft, a subprocessor register and gated release controls. It may not claim completed vendor assessments, certifications of vendors, or change-control operation until records exist. |

## Vendor management

The policy sets *what* must be assessed. This section sets the operating loop: who does what, how often, what the register holds, and how a vendor leaves.

### Lifecycle

```
Intake → Classify → Diligence → Contract (counsel) → Onboard → Monitor → Review and renew → Exit
```

| Step | Owner seat | Output | Time target (SL0) |
| --- | --- | --- | --- |
| Intake | Requester, `operations` | Purpose, owner, alternatives, cost, data and system access, AI use, region, subcontractors, exit plan | Complete before any trial that touches company, student or customer data |
| Classify | `operations` | Tier ([below](#tiers)) | 2 business days |
| Diligence | `security`, `privacy`, `finance`, `accessibility` as the tier requires | Review record ([TPL-15](templates.md#tpl-15-vendor-review-record)) | Critical: 15 business days; important: 10; low: 3 |
| Contract | `privacy` (counsel), `finance` | Terms reviewed by counsel; data-processing terms where data flows | Per counsel |
| Onboard | `operations`, `engineering` | Register entry; subprocessor-list update if a data destination; least-privilege access; secrets in the vault; monitoring and status subscription | Before first production use |
| Monitor | `operations` | Scorecard; status and incident intake; assurance renewals | Monthly check; annual deep review |
| Review and renew | `finance`, `operations` | Renew, renegotiate, replace or exit | Review starts 90 days before renewal |
| Exit | `operations`, `privacy` | Data export and deletion confirmed; access revoked; register closed; subprocessor list updated | Per the exit plan |

No vendor receives student data without a data-processing agreement, a subprocessor entry and minimum-necessary scope. A free trial or an employee-created account counts.

### Tiers

The policy's tiers, with operating consequences:

| Tier | Test | Examples in Semester's stack | Review depth | Cadence |
| --- | --- | --- | --- | --- |
| **V1 critical** | Holds or processes student or customer content; has privileged production access; is a sole critical service for tier 2 or tier 3 journeys | Database, authentication and functions host; static hosting; payment provider; AI model providers; email delivery | Security, privacy, legal, finance, accessibility where user-facing, continuity, executive approval | Annual deep review; monthly status check; exit plan tested |
| **V2 important** | Supports operations without student content, or is replaceable within weeks | Source hosting and CI, error and uptime monitoring, support tooling, design tools | Security questionnaire, privacy terms, finance | Annual review |
| **V3 low** | No company data or access beyond a login | Office tools without customer data, content tools | Basic terms and spend | At renewal |

An AI provider is V1 even for a small feature, because it can see prompts. Its terms must exclude training on customer data, state retention and region, and permit the tenant controls the AI governance board requires.

### Diligence matrix

X = required, o = as relevant.

| Evidence | V1 | V2 | V3 |
| --- | --- | --- | --- |
| Independent security assurance (a current audit report or equivalent) | X | o | — |
| Security questionnaire answered and read | X | X | — |
| Data-processing terms; subprocessors; data location; retention; deletion | X | o | — |
| Prohibition on training on customer data (AI and analytics vendors) | X | X | — |
| Incident-notification terms and contact | X | X | — |
| Business-continuity and disaster-recovery posture; uptime history | X | o | — |
| Financial viability and concentration risk | X | o | — |
| Accessibility conformance for user-facing parts | X | o | — |
| Insurance | o | — | — |
| Exit and portability: export format, timing, deletion proof | X | X | — |
| Pricing, term, renewal and notice dates in the calendar | X | X | X |

Counsel reviews every V1 contract and any contract with data-processing, liability, indemnity, IP or termination terms. Nothing here is a legal conclusion.

### The vendor register

One row per vendor in the private operations system; the public subset is [`SUBPROCESSORS`](../../SUBPROCESSORS.md).

| Field | Notes |
| --- | --- |
| Name, legal entity, owner seat | Owner is a seat, not a person |
| Tier, service, journeys depended on | Links to the continuity dependency map in [05](05-incident-and-continuity.md#dependency-map-for-continuity) |
| Data classes and systems accessed; region | Matches the data inventory |
| Subprocessors and AI use | |
| Contract: start, term, renewal, notice date, termination rights | A calendar entry for the notice date, 90 days ahead |
| Assurance: last report, date, exceptions noted | Renewal due date |
| Last review, next review, findings open | |
| Exit plan: alternative, export path, time to switch, last tested | Mandatory for V1 |
| Cost per month and per active user | Feeds the margin dashboard |
| Incident history and service-level record | |

The quarterly control review reads the register against what actually runs ([01](01-operating-cadence.md#quarterly-control-review-half-day)). A destination found running and not listed is a finding.

### Monitoring and vendor incidents

| Signal | Action |
| --- | --- |
| Vendor status page degraded | Subscribe at onboarding; the health sweep reads it; the commander decides if it is an incident |
| Vendor security notice | The security seat triages within one business day; if it touches student data it is SEV1 or SEV2 with `EXPOSURE` until disproven |
| Vendor change of terms, subprocessor or region | Counsel reviews; customers notified under the contract and the subprocessor policy before the change takes effect |
| Assurance report expired or with exceptions | A finding; remediation date or a risk acceptance (P2 or P3 only) |
| Cost above forecast by more than 20% for two months | Finance reviews; the dashboard flags it |
| Vendor outage that breaks a continuity tier | Continuity plan activation criteria in [05](05-incident-and-continuity.md#activation-priority-and-recovery-order) |

### Concentration and exit

No V1 vendor may be a silent single point of failure. For each, the exit plan names the alternative, the export path and format, the time to switch, the data that cannot move, and the last time the path was tested. Where Semester depends on one vendor for a tier 2 or tier 3 journey, the risk register carries a concentration risk with an owner and a trigger. A restore or export exercise per V1 vendor runs at least annually.

### Software supply chain

Licences, third-party Actions and dependencies are governed by [`SUPPLY-CHAIN`](../../SUPPLY-CHAIN.md), and `app/src/lib/supplychain.test.ts` fails on a licence or Action nobody has named. This page adds no parallel list.

## Quality operations

Quality is a property of five things, each with its own owner and measure.

| Layer | What quality means | Mechanism | Owner seat |
| --- | --- | --- | --- |
| **Product** | The golden journeys work, accessibly, securely and recoverably | Definition of Done; release gates G1–G10; the engineering gates | `engineering`, `product` |
| **Service** | Cases are resolved correctly, safely and quickly | Support QA ([04](04-support-operating-model.md#quality-assurance)) | `operations` |
| **Delivery** | Tenants move through phases with evidence | Gate adherence and rework ([02](02-implementation-methodology.md#quality-of-the-method-itself)) | `success` |
| **Data** | Sources are fresh, mapped and reconciled | Reconciliation reports; freshness labels; connector health | `data` |
| **Knowledge** | Documents say what is true and are findable | Freshness rule ([07](07-knowledge-training-enablement.md)) | `operations` |

### Engineering gates (the code-level floor)

Every command runs from `app/`: `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`. `test:shuffle` is not a duplicate of `test`; green `test` and red `test:shuffle` means tests depend on one another. A guard that has never failed is not known to be a guard: revert the fix beneath the new test and watch it go red, then restore ([`CLAUDE.md`](../../../CLAUDE.md)). Operations relies on these but does not restate them.

### Defect taxonomy

| Severity | Test | Fix target (SL0) | Release rule |
| --- | --- | --- | --- |
| **S1 critical** | Security, privacy, tenant isolation, data loss, official-record or ledger integrity, or an inaccessible critical journey | Mitigate in 1 business day; fix in 5 | Blocks release and launch; cannot be waived |
| **S2 major** | A core workflow broken with no good workaround | 10 business days | Blocks release unless the founder accepts for a bounded time with disclosure |
| **S3 moderate** | A workflow impaired with a workaround | 30 days | Does not block |
| **S4 minor** | Cosmetic, copy, polish | Backlog | Does not block |

Every defect carries its **origin** (requirement, design, code, configuration, data, integration, documentation) and its **detection point** (design review, test, release gate, canary, customer). A defect found by a customer that a gate should have caught is an **escape**.

### Escape analysis and quality metrics

For each S1 and S2 escape, answer in writing: which gate should have caught it, why it did not, and what changes. The change is a test, a gate, a checklist line or a monitor, owned by one person with a date. Metrics ([09 D4](09-dashboards-and-indicators.md#d4-support-and-quality) and [D5](09-dashboards-and-indicators.md#d5-reliability-and-incidents)): escape rate (S1 and S2 found after release ÷ all S1 and S2), change failure rate, rework rate, reopen rate, QA score, and documentation freshness.

### Corrective and preventive action (CAPA)

```
Identify → Contain → Find root cause → Correct → Prevent recurrence → Verify effectiveness → Close
```

A CAPA ([TPL-26](templates.md#tpl-26-corrective-and-preventive-action)) opens from an S1 or S2 escape, an incident review, a failed internal audit, an audit or customer finding, or a repeat of a support problem. **Effectiveness** is checked at 30 and 90 days by the person who did not fix it: did the failure recur, and did the new control catch the test case. A CAPA closed without an effectiveness check is not closed.

### Internal audit

Each quarter the operations seat samples three processes from this set and checks what was done against what the page says. A finding is a *gap between the page and the practice*; the fix is to change one of them, never to ignore it. The audit covers cadence records, a sample of incident or case records, a sample of change records, and one handoff. Results go to the quarterly control review.

### Test data and environments

Non-production environments use synthetic tenant data. Production data enters a non-production environment only with the privacy seat's approval, minimum scope and a deletion date. Preview environments use isolated tenants. Each tenant's UAT uses the data authority the charter records.

## Change management

Five kinds of change run through different doors. A change belongs to exactly one.

| Kind | Examples | Door | Primary reference |
| --- | --- | --- | --- |
| **Release** | New code, flags, migrations | Pull request, gates, rings | [`RELEASE-GATES`](../../RELEASE-GATES.md); [`DEPLOYMENT-AND-RELEASE-RUNBOOK`](../../engineering-operations/DEPLOYMENT-AND-RELEASE-RUNBOOK.md) |
| **Tenant configuration** | Roles, policies, flags, branding, connector scope for one tenant | Change request with the customer's approval | [`CONFIGURATION-TIERS`](../../operating-model/CONFIGURATION-TIERS.md) |
| **Infrastructure and vendor** | Environments, secrets, providers, scheduler | Infrastructure as code; recorded change | [`ENVIRONMENT-AND-CONFIGURATION-MANAGEMENT`](../../engineering-operations/ENVIRONMENT-AND-CONFIGURATION-MANAGEMENT.md) |
| **Policy, process, document** | A policy, a runbook, this operating system | Pull request with a decision file | [01 rules](01-operating-cadence.md#rules) |
| **Customer organizational** | Adoption, training, workflow change at the customer | The implementation method and institutional change management | [`INSTITUTIONAL-CHANGE-MANAGEMENT`](../../INSTITUTIONAL-CHANGE-MANAGEMENT.md) |

### Change classes

| Class | Definition | Author | Reviewer | Approver | Notice | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| **Standard** | Pre-approved, low risk, repeatable, with a written procedure: a flagged-off feature, a content update, a non-production secret rotation | Anyone trained | Automated checks | None; logged | None | Pipeline record |
| **Normal** | Reviewed before release: most releases, configuration, infrastructure | Author | A second person where one exists; otherwise automated checks plus the next-day independent read | `engineering` or `success` as the class says | Per [SL-CHG-01](04-support-operating-model.md#delivery-success-trust-and-partners) | Gate results, rollback step |
| **Major** | Touches a policy, permission, retention rule, data flow, AI behaviour, migration or tenant-visible workflow | Author | Security, privacy and accessibility as relevant | The accountable seat in [03](03-raci-and-decision-rights.md); council for launch-affecting changes | 14 days for a material change to a live tenant | Change advisory answers; rollback rehearsed; communications drafted |
| **Emergency** | Needed to stop or prevent a SEV1 or SEV2 | Technical lead | Incident commander | Incident commander | As soon as safe | Reviewed within 5 business days |

Every change answers the questions in the pull-request template's *Change advisory*: design (what changes visibly), privacy (what it holds about a person), accessibility (how it was checked), data owner (who owns the data and knows), and rollback (the exact step, and whether the schema can go back). A change above the lowest configuration tier answers them *before* merge.

### Rings and rollout

Release in rings with stop conditions: internal tenant, then a design-partner tenant, then a low-risk cohort, then staged percentages (1, 10, 25, 50, 100). Each ring has an automatic halt on SLO burn, an error-rate or authorization-denial anomaly, an integrity mismatch or a customer-impact signal. Feature flags and kill switches exist before the ring opens ([`FEATURE-FLAG-AND-KILL-SWITCH-STANDARD`](../../engineering-operations/FEATURE-FLAG-AND-KILL-SWITCH-STANDARD.md)).

#### Migration safety

Additive schema first; code that reads old and new; idempotent backfill; reconcile counts and samples; new write path behind a flag; observe; migrate readers; archive after the retention period; remove old columns in a separately approved release. Never combine a destructive change with a release that depends on it without a tested recovery plan and restore evidence. The migration runbook is authoritative ([`MIGRATION-AND-ROLLBACK-RUNBOOK`](../../engineering-operations/MIGRATION-AND-ROLLBACK-RUNBOOK.md)).

### The change calendar

A single calendar holds: every tenant's term, add/drop, registration, grade-release, billing and finals dates ([the overlay](01-operating-cadence.md#the-academic-calendar-overlay)); scheduled maintenance; release candidates; vendor changes; planned exercises; and customer go-lives. Rules:

- **Freeze windows** are per tenant. A change inside one needs emergency-class approval for that tenant.
- **No customer-affecting change on Friday** unless it is an emergency.
- **No two Major changes touching the same journey** in the same week.
- **A go-live never follows a freeze by less than three business days.**
- The calendar is read at the weekly release and change review and again before each release candidate is promoted.

### Measuring change

| Metric | Definition | Target (SL0) |
| --- | --- | --- |
| Change failure rate | Releases or changes causing a SEV1 to SEV3 incident or a rollback ÷ all | at most 10% (measured) |
| Emergency share | Emergency changes ÷ all changes | at most 5% |
| Rollback time | Decision to restored | recorded per class, then a target |
| Notice compliance | Customer notices sent inside lead time ÷ required | 100% |
| Freeze violations | Changes made inside a tenant freeze without approval | 0 |

## Related

[Templates TPL-14, TPL-15, TPL-26](templates.md) · [Handoff H-15](handoffs.md#h-15-engineering-to-support-and-success-release-readiness) · [05 Continuity](05-incident-and-continuity.md) · [09 Dashboards](09-dashboards-and-indicators.md)
