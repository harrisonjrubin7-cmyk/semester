# Institutional Known Limitations

| Control | Value |
| --- | --- |
| Status | **CONTROLLED CURRENT LIMITATIONS — REQUIRED IN SALES, PROCUREMENT, PILOT AND GO-LIVE REVIEW** |
| Owner | Harrison Rubin — company-side product/evidence owner; customer acceptance owners and specialist reviewers unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../launch/KNOWN-LIMITATIONS.md`](../launch/KNOWN-LIMITATIONS.md), [`INSTITUTIONAL-CAPABILITY-MATRIX.md`](INSTITUTIONAL-CAPABILITY-MATRIX.md), and [`GO-LIVE-CHECKLIST.md`](GO-LIVE-CHECKLIST.md) |

## Disclosure rule

Present each applicable limitation beside the affected capability, demo, proposal, questionnaire answer, implementation plan, training material and launch decision. Do not bury a limitation in a separate attachment or convert it into a roadmap promise. The target record may narrow a limitation only with current scoped evidence and authorized acceptance; it may not delete the historical record.

## Current institutional limitations

| Area | Current limitation | Operational consequence / safe posture | Evidence needed to change status |
| --- | --- | --- | --- |
| named institutional readiness | no institution-specific scope, executed authority, accepted target or activation is established by this package | discovery, synthetic demos and preparation only | executed authority, target evidence, customer acceptance and activation record |
| tenant isolation | defined institutional paths have repository negative tests; older product tables may be account/user-scoped rather than institution-keyed | do not claim universal school isolation; constrain scope and test every target path | complete data-path inventory, target two-tenant/role tests and independent/customer acceptance |
| identity | SAML/SCIM controls exist but no real IdP acceptance; SCIM is off by default; institutional OIDC is absent | use invitations/manual setup or accepted SAML/SCIM configuration only | target IdP/claims/groups/JML/rotation acceptance; OIDC implementation if required |
| LTI | launch, Deep Linking and gated AGS are repository-tested; no real LMS acceptance; NRPS absent; unbound legacy behavior requires disposition | sandbox only; bind registrations; keep grade writes off unless separately approved | real-LMS UAT, key lifecycle, unbound-path closure, write reconciliation and acceptance |
| OneRoster/SIS/LMS APIs | OneRoster is not implemented; production adapter registry has no real SIS/LMS adapter | manual/synthetic or separately approved bounded read-only path | connector/profile, provider tests, mapping/reconciliation and target acceptance |
| official records/writes | SIS/LMS/registrar remain authoritative; general institutional writes are not approved; AGS is a separately gated exception path | source-label guidance; no registration/form/record submission and no grade passback by default | explicit record authority, preview/approval, idempotency, audit, reconciliation, rollback and customer acceptance |
| data/privacy/legal | draft maps/registers/policies exist; entity roles, legal bases, notices, DPA, provider terms/regions and customer schedules are unresolved | minimize data; do not activate institutional processing on drafts alone | qualified review, executed terms, approved target map/schedule/notices and exercised rights/offboarding |
| security/assurance | broad repository controls exist; exact-target assurance, independent penetration testing, complete current scan set and accepted residual risk are incomplete | make control-specific dated statements only | exact-candidate/target evidence, remediation/retest, independent assessment and customer security acceptance |
| accessibility | automation/self-assessment exists; no formal conformance claim, VPAT/ACR or complete recorded manual assistive-technology evaluation | disclose testing scope and provide a tested barrier/accommodation route before pilot | qualified workflow evaluation, remediation, AT/manual evidence, ACR decision and customer acceptance |
| logging/monitoring | distributed event and smoke/health controls exist; complete coverage, target sinks, alert delivery and operated review are unproved | no 24/7, real-time detection, complete-audit or guaranteed-response claim | target coverage/export/retention, alert/escalation exercise, staffed rota and customer acceptance |
| recovery/reliability | plans and partial drills exist; full provider-backed target restore, complete path recovery and approved measured objectives are absent | no uptime/SLA/RTO/RPO promise; retain safe fallback/rollback | timed scoped restore/recovery/rollback, monitoring, results and authorized objectives |
| support/operations | proposed procedures exist; channels, hours, backup rota, customer contacts and sustained performance are unproved | no staffed/24×7/dedicated/response-time promise | operated queue/routes, trained primary/backups, exercises, measurements and customer acceptance |
| AI | governance and selected controls exist; exact provider/model/terms/data authority/evaluation/monitoring and customer approval are incomplete | institutional data use remains off unless specifically approved; human authority stays with authorized people | provider/terms, data map, evaluation, oversight, incident/kill exercise and customer acceptance |
| outcomes/commercial | no institutional customer, accepted pilot result, reference, approved price, annual conversion, revenue or outcome is established | use blank templates and proposed terms; do not present targets/demos as traction | executed commercial evidence, observed approved results and specific reference permission |
| team/capacity | named company-side ownership is concentrated and many backups/specialists are unassigned | do not promise resilient coverage or parallel institutional delivery | staffed/trained backups, specialist authority, capacity exercise and accepted coverage |

## Target limitation record

For each relevant row record the exact capability/workflow; target/environment/version; affected users/data; user/customer-facing disclosure; workaround/fallback; severity and risk owner; remediation or permanent boundary; test evidence; customer acceptance; expiry/review trigger; and the materials in which it must appear.

## Evidence state

**Repository evidence.** Capability, trust, integration, operations, commercial and launch sources substantiate the limitations above as of the stated revision/date.

**Operational evidence.** No named customer has accepted these limitations, and no target-specific record authorizes narrowing them. Absence from this list would not prove absence of another limitation.

**Missing test/proof.** Revalidate against the exact candidate and target; add discovered limitations; map each to disclosures/fallback/owner; obtain specialist and customer acceptance; keep remediation/retest and change history.

## Claim ceiling

Semester may disclose these current limitations and describe evidence-gated remediation plans without dates. A limitation may be narrowed only for the exact scope supported by current accepted evidence.

## Prohibited claims

Do not claim no known limitations, enterprise/GA/institution readiness, full replacement/parity, universal interoperability, compliance/certification, live connections, staffed support, SLA/recovery achievement, customer validation or outcomes while the corresponding limitation remains open.
