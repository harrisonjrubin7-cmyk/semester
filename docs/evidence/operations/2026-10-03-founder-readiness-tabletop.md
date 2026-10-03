# Founder-led readiness tabletop — 2026-10-03

- **Status:** `COMPLETED — DOCUMENT/REPOSITORY TABLETOP; TARGET EXERCISE STILL OPEN`
- **Primary:** Harrison Rubin
- **Backup/on-call rota:** `UNASSIGNED`
- **Scenario:** a report alleges that an AI-assisted institutional request returned information from the wrong tenant while a provider/model change may have occurred
- **Documents exercised:** incident response plan/runbook, AI incident/kill-switch runbook, monitoring standard, rollback/restore runbook, owner matrix, and external evidence queue

## Walkthrough result

| Step | Expected action | Tabletop finding |
| --- | --- | --- |
| detect/open | open incident ID, preserve minimum evidence, identify environment/tenant/route/model | procedure is clear; no demonstrated automated alert-to-case route |
| command | assign incident commander, Security, Privacy, Product, Operations, communications and customer contact | Harrison can hold internal primary seats; backup, second reviewer and customer contact are absent |
| contain | disable narrow tenant/feature or global AI; stop tools/writes; revoke exposed credentials | repository kill-switch and refusal behavior are tested; target gateway/provider containment not exercised |
| verify | prove blocked AI request and unaffected non-AI workflow; capture audit evidence | repository tests cover decisions; no authorized target/environment record exists |
| assess/notify | determine data/people/tenants and legal/contract duties; issue verified updates | templates exist; counsel, customer contacts and applicable clocks remain external |
| recover | fix, regression-test, reconcile actions/data, staged release with two-person review | focused repository suite passed 296 tests; two-person recovery approval and target rollback remain blocked |
| close/learn | timeline, root cause, notices, residual risk and corrective actions | record format exists; no real incident or corrective-action closure sample |

## Decisions

- A credible cross-tenant allegation is a P0 until disproven.
- Harrison Rubin may engage the narrowest reliable kill switch immediately and may broaden containment when tenant scope or control integrity is uncertain.
- Harrison may not release a production/customer AI scope alone where the runbook requires two-person review.
- No customer, regulator, or public notification deadline is promised by this exercise; qualified legal/contract review is required.
- No restore over production is authorized for rehearsal. A real provider backup must first be restored into an isolated target and independently validated.

## Gaps and treatment

| Gap | Owner | Treatment | Gate |
| --- | --- | --- | --- |
| no backup/second reviewer | Harrison Rubin | recruit and train named backup; test escalation and recovery approval | supported launch |
| no alert-to-case operation | Harrison Rubin | configure target signals/routes and perform delivery/acknowledgement test | supported production |
| DAST runtime/key unavailable | Harrison Rubin | provision authorized target/runtime/credential; scan, remediate, rescan | paid pilot |
| no independent penetration test | Harrison Rubin coordinates | freeze scope/candidate and engage qualified independent assessor | paid pilot |
| no provider-backup restore | Harrison Rubin | retain current no-retry-on-billing decision until explicitly changed; then approve cost and run isolated restore | any RTO/RPO claim; supported pilot |
| no named institution/accounts | Harrison Rubin coordinates with customer | obtain customer seats, tenant config and two-account/two-tenant UAT | institutional activation |
| counsel/accessibility/customer approvals absent | Harrison Rubin coordinates | engage qualified authorities and retain dated acceptance/remediation evidence | affected broad/paid motions |

## Evidence ceiling

This closes the “no tabletop at all” gap for a repository/document walkthrough only. It does not close target incident exercise, staffed escalation, customer communication, live kill-switch, provider recovery, legal-notice, or institutional acceptance gates.
