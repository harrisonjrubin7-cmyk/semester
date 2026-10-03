# External evidence queue

**Assessment date:** 2026-10-03 (America/Chicago)
**Rule:** these gates cannot be closed by adding repository documents, tests, or status labels. The identified external authority or target environment must produce the evidence.

| ID | Evidence needed | Producer/acceptor | Preconditions | Acceptable record | Current state | Affected motion |
| --- | --- | --- | --- | --- | --- | --- |
| EXT-001 | Company/entity/IP/signing facts | Founder + corporate counsel | complete corporate and contributor records | dated counsel-reviewed fact sheet and authority matrix | OPEN | all paid/signature activity |
| EXT-002 | Counsel-approved public policies | privacy/consumer/education counsel | verified product/data behavior and business decisions | versioned approval and publication instruction | OPEN | broad individual launch |
| EXT-003 | Counsel-approved institutional paper | commercial/privacy/education counsel + customer counsel | frozen pilot scope, data roles, security/accessibility/support exhibits | approved forms plus executed agreement/order | OPEN | paid pilot |
| EXT-004 | Tax/accounting/revenue position | CPA/tax adviser | entity, jurisdictions, prices, processor, contract structure | written advice and implemented controls | OPEN | accepting payment |
| EXT-005 | Insurance decision/coverage | SaaS/edtech insurance broker + counsel | product/data/contract risk and requested limits | recommendation, coverage evidence, approved contract position | OPEN | contracted launch |
| EXT-006 | Independent security review/penetration test | Harrison Rubin coordinates; qualified independent assessor produces/validates | immutable release candidate and target scope | report, remediation log, validation; no open P0/P1 | OWNER ASSIGNED; ASSESSOR/SCOPE/DATE OPEN | paid pilot |
| EXT-007 | Current HawkScan/DAST evidence | Harrison Rubin owns; working runtime/credential required | candidate deployed to authorized test target | scan report, triage, fixes, clean rescan | OWNER ASSIGNED; BLOCKED: runtime/key unavailable | paid pilot |
| EXT-008 | Qualified accessibility evaluation | qualified accessibility assessor + counsel | frozen critical journeys and representative content | manual AT/keyboard/zoom report, remediation, ACR/status decision | OPEN | broad individual, paid pilot |
| EXT-009 | Staffed operating ownership | Harrison Rubin primary; backup personnel still required | role definitions, channels, coverage expectations | signed owner matrix, rota, tested escalation | PARTIAL: PRIMARY ASSIGNED; REPOSITORY TABLETOP COMPLETE; BACKUPS/ROTA/LIVE ESCALATION TEST OPEN | any supported launch |
| EXT-010 | Target-environment monitoring and alerting | Harrison Rubin owns Engineering/security/support coordination | deployed authorized environment | dashboard inventory, privacy review, alert-delivery tests, on-call acceptance | PARTIAL: 2026-10-03 PUBLIC PRODUCTION SMOKE PASSED; INSTITUTIONAL TARGET, RETENTION, ROUTING, BACKUP AND ALERT-ACK TEST OPEN | supported production |
| EXT-011 | Recovery/incident/data-rights drills | Harrison Rubin owns Engineering/privacy/security/support coordination | target environment and named owners | dated restore, rollback, incident, export, deletion, revocation, offboarding records | REPOSITORY INCIDENT TABLETOP COMPLETE; TARGET RESTORE/ROLLBACK/RIGHTS/REVOCATION/OFFBOARDING DRILLS OPEN | supported production |
| EXT-012 | Named-tenant authorization | Customer sponsor, IT, privacy, security, accessibility, procurement/counsel | exact cohort, data/integration/configuration scope | signed approvals and responsibility matrix | BLOCKED: no named customer | institutional activation |
| EXT-013 | Target-tenant role/isolation/audit acceptance | Customer IT/security + Semester engineering/security | configured tenant and test identities | signed cross-tenant/role/UAT results and audit export | BLOCKED | institutional activation |
| EXT-014 | Representative user acceptance | Product + customer champion + representative users | frozen scope and environment | signed critical-flow UAT, accessibility findings, remediation/acceptance | BLOCKED | institutional activation |
| EXT-015 | Outcome baseline and success authority | Customer sponsor/champion + product/success | agreed scorecard, privacy thresholds, data sources | signed baseline, guardrails, interpretation plan | BLOCKED | outcome claims/conversion |
| EXT-016 | Reference/testimonial permission | Customer authorized signatory + counsel | completed pilot and substantiated outcome | written permission specifying claim, logo/name, channel, and term | BLOCKED | public references |
| EXT-017 | Provider contracts/DPAs/regions/assurance | Vendor owner + privacy/security/counsel | approved production vendor/configuration list | executed terms, assurance records, region/access/renewal evidence | OPEN | affected features |
| EXT-018 | Production identity/integration acceptance | Customer IT/provider owners | approved credentials, scopes, reconciliation, recovery | dated acceptance and rollback evidence per connector | BLOCKED | integration claims |

## Evidence handling

- Bind every record to a date, version/environment, scope, owner, reviewer, validity/renewal date, and affected claims.
- Store sensitive evidence in an access-controlled system; repository summaries must not expose secrets, private customer data, or restricted reports.
- Expired, superseded, partial, self-attested, preview-only, or synthetic evidence must remain labeled accordingly.
- A blocked external gate keeps the affected launch decision RED regardless of repository-completion scores.
