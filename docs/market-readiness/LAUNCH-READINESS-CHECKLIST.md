# Launch-readiness checklist

**Assessment date:** 2026-10-02. `PASS` means evidenced at the assessed scope; repository design alone is normally `PARTIAL` for a live launch. Estimates begin only after the named owner and environment/customer prerequisites exist.

## Individual student launch gate

| Gate | Status | Owner | Exact remediation / evidence | Estimate | Blocks |
| --- | --- | --- | --- | --- | --- |
| accurate landing claims | PARTIAL | product + counsel | approve public copy against capability registry | 1–2 weeks | broad promotion |
| working onboarding and first win | PARTIAL | product | representative UAT with activation baseline | 2–3 weeks | broad promotion |
| reliable core workflow and recovery | PARTIAL | engineering | target mobile/keyboard/network/recovery acceptance | 1–2 weeks | launch |
| account/privacy/export/deletion clarity | PARTIAL | privacy + engineering | approved notice and target lifecycle acceptance | 2–4 weeks | launch |
| accessible critical flows | FAIL | accessibility owner | qualified manual review, remediation, retest | 2–6 weeks | launch |
| staffed support/contact | FAIL | support owner | queue, hours, rota, backup, drill | 1–2 weeks | launch |
| error monitoring/alerts | PARTIAL | engineering | production configuration and alert test | 1–2 weeks | launch |
| privacy-approved analytics | PARTIAL | privacy + product | approve events/retention/access and validate production | 1–2 weeks | measurement/promotion |
| terms/privacy/payments/refunds | FAIL | counsel + finance | approve public policies and payment operations | 2–6 weeks | paid launch |
| no P0 security/reliability issue | FAIL | security + engineering | current target review and closure report | 2–4 weeks | launch |

**Decision:** clearly labeled invitation beta is **YELLOW** after the applicable gates; broad or paid acquisition is **RED** today.

## Design-partner institutional gate

| Gate | Status | Owner | Exact remediation / evidence | Estimate | Blocks |
| --- | --- | --- | --- | --- | --- |
| individual-scope prerequisites | FAIL | cross-functional | close relevant rows above | variable | activation |
| bounded pilot scope/charter | PARTIAL | CEO + sponsor | signed cohort, workflow, exclusions, decision date | customer-dependent | activation |
| named owner/support process | FAIL | CEO + customer | accepted RACI, rota and escalation | 1 week | activation |
| implementation/data flow/roles | PARTIAL | engineering + privacy + customer IT | target exports and approvals | 1–2 weeks after tenant setup | activation |
| security/privacy overview | PASS | security + privacy | repository package exists; customer review still required | — | procurement review |
| audit/export/deletion/offboarding | PARTIAL | engineering + privacy | target rehearsal and reviewer sign-off | 1–2 weeks | activation |
| success scorecard/reporting | PARTIAL | product + sponsor | approved baseline, targets, sources and thresholds | 1 week | activation |
| agreement structure/legal review | FAIL | counsel | approved pilot agreement/DPA position | 2–6 weeks | any live customer data |
| limitation disclosures/UAT | PARTIAL | product + customer | signed known-limitations and representative acceptance | 2–3 weeks | activation |

**Decision:** bounded, accurately disclosed discovery, demos, evidence exchange, and planning are **GREEN**; customer activation is **RED** until every required row passes and launch council signs GO.

## Paid institutional pilot gate

| Gate | Status | Owner | Exact remediation / evidence | Estimate | Blocks |
| --- | --- | --- | --- | --- | --- |
| all design-partner gates | FAIL | cross-functional | close rows above | variable | paid launch |
| P0/P1 remediation | FAIL | engineering + security | zero open P0/P1 with verification | variable | paid launch |
| restore/rollback/incident tests | FAIL | engineering + security + support | dated target-environment drills | 1–3 weeks | paid launch |
| production monitoring ownership | FAIL | engineering | alerts, dashboards, retention/access, rota | 1–2 weeks | paid launch |
| tenant isolation/authorization proof | FAIL | security + engineering | target cross-tenant/role acceptance | 1–2 weeks | paid launch |
| procurement/trust pack | PARTIAL | security/privacy/accessibility/counsel | approved responses and attached external evidence | 2–6 weeks | contract |
| pricing/contract/insurance authority | FAIL | CEO + finance + counsel | approved price, paper, entity/tax/payment and insurance decision | 2–6 weeks | accepting payment |
| conversion/offboarding path | PARTIAL | CEO + sponsor | signed decision and exit terms | 1 week | launch |

**Decision:** **RED**.

## Broad enterprise sales gate

| Gate | Status | Owner | Exact remediation / evidence | Estimate | Blocks |
| --- | --- | --- | --- | --- | --- |
| repeatable multi-customer core | FAIL | product + engineering | multiple successful scoped deployments | pilot-dependent | enterprise sales |
| mature independent trust evidence | FAIL | security/privacy/accessibility | current assurance accepted by buyers | 2–9+ months | enterprise sales |
| staffed implementation/support | FAIL | CEO | capacity model and measured delivery | pilot-dependent | enterprise sales |
| identity/integration repeatability | FAIL | engineering + customer IT | approved live integrations and runbooks | customer-dependent | enterprise sales |
| outcome/reference evidence | FAIL | customer success | permissioned pilot results/references | pilot-dependent | enterprise sales |
| scale/data-separation evidence | FAIL | engineering + security | capacity/isolation/restore proof | pilot-dependent | enterprise sales |

**Decision:** **RED**. No broad enterprise selling is justified.

`NOT APPLICABLE` may be used only with written rationale and approver; it is not a way to waive a required gate. The detailed operational checklist is [GO-NO-GO-CHECKLIST.md](GO-NO-GO-CHECKLIST.md).
