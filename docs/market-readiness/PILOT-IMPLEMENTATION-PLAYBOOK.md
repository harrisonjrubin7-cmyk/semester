# Pilot implementation playbook

## Delivery model

`discover → qualify → scope → trust review → agreement → configure → train → launch → review weekly → midpoint → outcomes → convert/expand/stop → offboard`

The implementation target is 30–60 days from signed scope to launch. Deep integrations are not on the critical path.

| Stage | Inputs | Semester accountable | Customer owner | Target | Exit criteria / documents | Principal risk and escalation |
| --- | --- | --- | --- | --- | --- | --- |
| Discover | problem, milestone, cohort, current workflow | founder | prospective sponsor | week 0 | discovery record; next meeting | solution looking for a problem → disqualify |
| Qualify | authority, urgency, budget path, data need | founder | sponsor | week 0 | qualification score ≥ threshold | no champion/date/budget → nurture, do not forecast |
| Scope | one workflow, 50–200 students, measures | product | champion | week 1 | signed scope and exclusions | scope growth → CEO/product review |
| Trust review | data flow, roles, controls, evidence gaps | security/privacy | CISO/privacy | weeks 1–2 | approved data scope; open-item log | P0/P1 → block |
| Agreement | proposal, price, DPA/pilot terms | founder | procurement/legal | weeks 1–3 | executed documents | unsupported commitment → deal-desk stop |
| Configure | tenant, cohort, flags, sandbox, roles | engineering | technical contact | weeks 2–4 | config export and acceptance | wrong tenant/data → incident path |
| Train | admin/operator/student materials | success | champion | weeks 3–5 | attendance and scenario completion | operator cannot recover flow → hold |
| Launch | UAT, support, baseline, go/no-go | operations | sponsor | weeks 4–8 | signed `GO`, invitations accepted | any P0/P1 or unsigned seat → no-go |
| Weekly review | privacy-thresholded metrics, issues, changes | success | champion | weekly | decision/action log | guardrail breach → pause/rollback |
| Midpoint | baseline comparison, qualitative findings | product | sponsor | halfway | signed midpoint record | weak evidence → no expansion claim |
| Final | outcomes, trust, economics, support load | founder | sponsor | agreed date | convert/expand/pause/stop decision | no signature → not final |
| Offboard | export, access revoke, deletion/retention | privacy | data owner | ≤30 days | completion record and exceptions | residual access/data → privacy escalation |

## RACI

| Work | CEO | Product | Eng/Ops | Security/Privacy/A11y | Success | Customer sponsor | Champion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| scope/price/contract | A | C | C | C | C | A | C |
| data/tenant/roles | C | C | R | A | I | I | C |
| UAT/accessibility/security | I | A | R | A | C | I | R |
| launch decision | A | R | R | R | R | A | R |
| weekly outcomes | I | R | C | C | A | A | R |
| offboarding | I | C | R | A | R | A | R |

`A` means accountable; two accountable parties indicate vendor/customer joint acceptance, not diluted ownership.

## Required communications

- kickoff: scope, owners, permitted use, channels, dates;
- prelaunch: what changes, known limits, support, privacy, opt-out/withdrawal;
- incident: impact, safe workaround, next update, resolution;
- weekly: aggregate measures, guardrails, issues, decisions;
- midpoint/final: evidence against the signed scorecard;
- offboarding: export, access revocation, deletion/retention and completion.

## Change control

Any new data class, integration, user group, metric, AI use, or write capability re-enters trust review and go/no-go. Urgency never expands authorized scope.
