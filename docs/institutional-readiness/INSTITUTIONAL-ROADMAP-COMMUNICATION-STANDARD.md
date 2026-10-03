# Institutional Roadmap Communication Standard

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STANDARD — NO ROADMAP ITEM IS A DELIVERY COMMITMENT** |
| Owner | Harrison Rubin — company-side product/communications owner; legal, commercial, engineering and customer governance approvers unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../trust/CHANGE-MANAGEMENT-POLICY.md`](../trust/CHANGE-MANAGEMENT-POLICY.md), [`../operating-model/CHANGE-MANAGEMENT.md`](../operating-model/CHANGE-MANAGEMENT.md), and [`INSTITUTIONAL-KNOWN-LIMITATIONS.md`](INSTITUTIONAL-KNOWN-LIMITATIONS.md) |

## Standard

Roadmap communication must distinguish current verified capability, conditional configuration, active discovery, approved development, target validation, planned candidate, deferred concept and unsupported boundary. A roadmap is a prioritization and discovery instrument—not a contract, purchase inducement, availability claim, acceptance record or promise of a date, scope, certification, outcome or compatibility.

Only an authorized executed agreement may create a delivery obligation. Even then, product completion, deployment, entitlement, customer acceptance and activation remain separate evidence states unless the agreement explicitly and lawfully says otherwise.

## Allowed status words

| Status | Permitted meaning | Required evidence / language |
| --- | --- | --- |
| `available in repository` | exact implementation exists at a cited revision | state environment/tests and missing target/operation evidence |
| `conditional configuration` | implementation requires named provider/tenant setup and approval | list dependencies; never say currently enabled |
| `in discovery` | problem/use case is being investigated | no solution/date/scope promise |
| `approved for development` | internal decision and owner exist | state dependencies/risks; target date only if authorized and qualified |
| `in development` | work has started | completion, release and acceptance remain uncertain |
| `target validation` | candidate is being tested in named non-production scope | no production availability or acceptance claim |
| `planned candidate` | prioritized hypothesis without execution proof | use approximate sequence, not commitment language |
| `deferred` | not currently prioritized | no implied date |
| `not supported` | deliberate current boundary | do not invent workarounds or imply future support |

Avoid `done`, `shipped`, `production-ready`, `committed`, `guaranteed`, `will`, `by [date]`, `certified`, `compliant`, `partnered`, `fully integrated` or `enterprise-ready` unless the exact authoritative evidence and approval support that exact meaning.

## Roadmap-item record

| Field | Required entry |
| --- | --- |
| item / problem / users | `[BOUNDED DESCRIPTION]` |
| current status / evidence | `[ALLOWED STATUS + LINK/REVISION/DATE]` |
| value hypothesis / non-goals | `[HYPOTHESIS / EXCLUSIONS]` |
| dependencies | `[LEGAL, SECURITY, PRIVACY, A11Y, PROVIDER, DATA, CUSTOMER, STAFFING]` |
| acceptance / evidence required | `[TESTS, TARGET UAT, CUSTOMER DECISION]` |
| owner / backup / decision authority | `[NAMES/FUNCTIONS]` |
| target window / confidence | `[OPTIONAL AUTHORIZED RANGE + LOW/MEDIUM/HIGH]` |
| customer specificity / confidentiality | `[PUBLIC/SHARED/RESTRICTED]` |
| change history / next review | `[DECISION LOG / DATE]` |

## Audience controls

- **Public:** only approved current capability and broad themes; no customer-specific item, confidential dependency or unsupported date.
- **Prospect/procurement:** known limitations and dependencies adjacent; responses match RFP/HECVAT and contract authority.
- **Pilot/customer governance:** target-specific hypotheses, owners, evidence gates and changes; no side-channel commitment by an unauthorized participant.
- **Internal:** uncertainty, capacity, technical debt and declined options remain visible; internal priority still is not an external promise.
- **Press/analyst/investor:** use approved fact/forward-looking language and authorized company/customer facts; correct misunderstandings promptly.

## Communication and change control

1. Verify the audience, purpose, confidentiality and speaker authority.
2. Reconcile the item to capability/limitations/evidence registers and current delivery state.
3. Classify the statement using the allowed statuses; attach dependencies and claim ceiling.
4. Review legal/commercial/security/privacy/accessibility/provider/customer implications as applicable.
5. Record what was shared, version/date/recipient, questions, requested commitments and follow-up owner.
6. When status/scope/window changes, update the controlled source and notify affected authorized recipients without hiding the prior statement.
7. Route requested contractual commitments through authorized deal/legal/change review; never accept them in ordinary roadmap discussion.

## Evidence state

**Repository evidence.** Capability, known-limitations, change, claims, RFP, HECVAT and communication artifacts support evidence-bounded roadmap discussion.

**Operational evidence.** No approved public roadmap, customer roadmap, committed release, delivery schedule, customer acceptance, or history of operated roadmap communications is evidenced.

**Missing test/proof.** Adopt owners/approvers/status vocabulary; build the current item register; review all existing external statements; rehearse customer questions/corrections; retain communication/change records and acceptance where required.

## Claim ceiling

Semester may discuss prioritized hypotheses and evidence-gated direction using the controlled statuses and prominent dependencies. It may not turn intention into present availability or contractual commitment.

## Prohibited claims

Do not promise delivery dates, scope, compatibility, certification/compliance, integrations, staffing, SLA/recovery, institutional activation or outcomes without specific authority and evidence; do not imply customer endorsement or disclose customer-confidential roadmap information.
