# Interoperability roadmap

<!-- Rendered from app/src/lib/interop.ts by interop.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The standards Semester supports or intends to, in the order the brief sets,
each with the status word the public claims register gives it — the same
word `/platform/integrations/` prints — and the principles each is
implemented under. Nothing here claims a certification; stage 3 says so.

## The standards

| Priority | Standard | Used for | Direction | Timing | Status | Rests on | Documentation |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | LTI 1.3 / LTI Advantage | Secure launch from the learning system, roles, course context; deep linking and grade services where a faculty workflow justifies them. | LMS → Semester | foundation | Planned | `INT-002` | [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](LTI-1.3-LAUNCH-RUNBOOK.md) |
| 1 | LTI Advantage services (Deep Linking, AGS, NRPS) | Placing Semester content from the LMS picker and returning a grade; roster membership deliberately not requested. | LMS ⇄ Semester | foundation | Planned | `INT-004`, `INT-005` | [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](LTI-1.3-LAUNCH-RUNBOOK.md) |
| 1 | OneRoster 1.2 | Roster, course, class and enrollment exchange where the institution supports it — an authorised feed, never an open source. | SIS → Semester | foundation | Planned | `INT-006` | [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](FERPA-COPPA-1EDTECH-READINESS.md) |
| 1 | OAuth 2.0 / OpenID Connect / SAML / SCIM | Secure identity, single sign-on, lifecycle provisioning and deprovisioning. | Identity provider → Semester | foundation | In preparation | `IAM-003` | [`docs/INSTITUTIONAL-SSO-ARCHITECTURE.md`](INSTITUTIONAL-SSO-ARCHITECTURE.md) |
| 1 | SCIM provisioning | Accounts created, changed and retired from the identity provider. | Identity provider → Semester | foundation | In preparation | `IAM-004` | [`docs/SCIM-LIFECYCLE-MANAGEMENT.md`](SCIM-LIFECYCLE-MANAGEMENT.md) |
| 1 | REST APIs, webhooks and versioned data contracts | Customer, partner and internal integration architecture. | Semester ⇄ institution | foundation | Planned | `INT-013`, `INT-012` | [`docs/data-contract.md`](data-contract.md) |
| 1 | Read-only student-system connections | Registration windows, holds and dates, read-only and reconciled before first production sync. | SIS → Semester | foundation | Planned | `INT-001`, `INT-009` | [`docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md`](INTEGRATION-QUALITY-AND-RECONCILIATION.md) |
| 2 | Caliper Analytics | Standards-aligned learning events, only with transparent governance and minimal collection. | Semester → institution | after core value | Planned | `UOS-008` | [`docs/PRODUCT-ANALYTICS-DATA-ETHICS.md`](PRODUCT-ANALYTICS-DATA-ETHICS.md) |
| 2 | QTI | Portable assessment items, once Semester holds assessment content. | LMS ⇄ Semester | when assessment is real | Planned | `INT-007`, `INT-008` | [`docs/LMS-LEARNING-ROADMAP.md`](LMS-LEARNING-ROADMAP.md) |
| 2 | CASE | Competency, outcome and skills frameworks, once competency mapping is real. | Institution → Semester | when competency mapping is real | Planned | `INT-007`, `INT-008` | [`docs/LMS-LEARNING-ROADMAP.md`](LMS-LEARNING-ROADMAP.md) |
| 3 | Open Badges 3.0 | Verifiable individual achievement assertions, issuer-controlled and learner-held. | Issuer → learner | credential phase | Planned | `UOS-004` | [`docs/CREDENTIAL-WALLET.md`](CREDENTIAL-WALLET.md) |
| 3 | Comprehensive Learner Record (CLR) and W3C Verifiable Credentials | A portable, learner-controlled record across academic, co-curricular, skills and work experience. | Learner-controlled | credential phase | Planned | `UOS-004` | [`docs/CREDENTIAL-WALLET.md`](CREDENTIAL-WALLET.md) |

## Principles

### LTI

- LTI 1.3, never a legacy version.
- Platform registration and key rotation.
- Validate issuer, audience, deployment, nonce, state and the JWT signature.
- Every launch is tenant- and context-scoped.
- Minimal personal data in launch claims.
- Course and role context, and the institution’s configuration, are respected.
- Launch events are logged without storing unnecessary payloads.
- Deep linking only where there is a clear faculty workflow.
- A write to the LMS is opt-in, explicit, previewable and audited.
- A graceful fallback when LTI is unavailable.

### OneRoster

- An authorised roster and context feed, never an open data source.
- Data mapping, source freshness, field minimisation and customer approval.
- Last successful sync, errors, records affected and remediation steps are shown.
- Student work is never silently deleted when a roster status changes.
- Adds, drops, term transitions and historical records are handled deliberately.
- A reconciliation report before the first production sync.

### Caliper

- Only events tied to a clear product or institutional purpose.
- Event types and fields are documented.
- Aggregation and suppression in institution dashboards.
- Operational analytics are separate from research.
- No hidden personal trait is inferred and no high-impact risk score is created.
- Institution-level policy controls and student transparency.
- Events are retained under an explicit schedule.

## The credential lifecycle

1. Achievement definition
2. Issuer authorisation
3. Criteria
4. Evidence attachment
5. Learner acceptance and control
6. Verifiable assertion
7. Export, share and revoke lifecycle
8. CLR aggregation

## The 1EdTech plan

### Stage 1: Join and learn

- Become a 1EdTech member.
- Join the LTI, OneRoster, TrustEd Apps, CLR and data-privacy workstreams.
- Build relationships with procurement and interoperability leaders.

**Where it stands:** Not started. No membership; nothing here needs code.

### Stage 2: Build correctly

- Implement the first standards with automated conformance tests.
- An internal interoperability test tenant and a synthetic-data suite.
- Publish implementation guides and data maps.
- Track standards and version support publicly.

**Where it stands:** Under way: LTI 1.3 launch, deep linking and grade services are tested against a test platform; the public registry is this page; the synthetic tenant is designed.

### Stage 3: Certify only when ready

- Pursue LTI and OneRoster certification after a stable implementation.
- Complete TrustEd Apps privacy and security readiness.
- Never claim a certification before it is awarded.

**Where it stands:** Not started, and the site says so: no certification is claimed anywhere.

### Stage 4: Turn interoperability into proof

- Publish supported standards, versions, data flows, limitations and customer settings.
- Include migration and export capability in procurement materials.
- Make interoperability a customer right, not an enterprise upsell.

**Where it stands:** Begun with this registry and the availability matrix; export is on every plan.
