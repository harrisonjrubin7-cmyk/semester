# 05 · Cross-functional acceptance and evidence tracking

> Part of the [program pack](README.md). The evidence itself lives under
> `docs/evidence/` and is dated and expired by the
> [evidence register](../EVIDENCE-REGISTER.md), which is rendered from code and
> tested. This page does not keep a second register. It states, per workstream,
> what must be true before a gate closes, what exists today, and why that is
> not yet enough.

## Acceptance criteria by workstream

"Producer" and "acceptor" follow the [owner matrix](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md):
Harrison Rubin may produce internal evidence across seats but cannot act as his
own counsel, assessor, evaluator or customer approver.

| Workstream | Criterion that must hold | Required artifact | Independent acceptor | Node |
| --- | --- | --- | --- | --- |
| Engineering | One immutable SHA with a finished green hosted CI run, PostgreSQL 17 policy, load, deploy-rehearsal and restore suites passing, and the run links retained | run URLs and logs bound to the SHA | hosted CI; the owner as engineering seat | PGM-01 |
| Engineering | An authorized target environment exists and is the one the other evidence names | environment record | the owner; the customer for a named tenant | PGM-02 |
| Security | A scan of the candidate on an authorized target, findings triaged, fixed and rescanned clean | scan report, triage, clean rescan | the owner owns; an independent reviewer validates | EXT-007 |
| Security | An independent review and penetration test with no open P0 or P1 | assessor's report, remediation log, validation | qualified independent assessor | EXT-006 |
| Reliability | Restore, rollback, incident, export, deletion, revocation and offboarding exercised on the target, timed, with a named witness | dated drill records | a witness other than the operator | EXT-011 |
| Operations | Backups named, a rota, tested channels, an acknowledged alert | owner matrix; alert-delivery test; escalation exercise | a person other than the primary | EXT-009, EXT-010 |
| Accessibility | Critical journeys evaluated with assistive technology, keyboard and zoom by a qualified evaluator; remediation retested; status language approved | evaluation report; approved statement or ACR | qualified evaluator, with counsel on the claim | EXT-008 |
| Privacy | Data inventory and flow match the code; retention and legal-hold decided; provider terms executed | approved data map; register; executed terms | qualified counsel | EXT-017, EXT-011 |
| Legal | Company facts confirmed; public policies and institutional paper approved and, for paper, executed | fact sheet; versioned approvals; executed agreement | qualified counsel; the customer's counsel | EXT-001, EXT-002, EXT-003 |
| Finance | Price, tax, accounting, payment controls and insurance decided in writing | written advice; coverage evidence | CPA or tax adviser; broker | EXT-004, EXT-005 |
| AI | Kill switch and injection resistance demonstrated against the candidate; high-impact actions confirmed by a person; tenant policy set | drill and red-team artifacts for the candidate | the AI governance board | PGM-08, PGM-07 |
| Product | A representative student, then the customer's users, complete the critical flows; outcomes and stop criteria agreed | signed UAT; baseline scorecard | representative users; customer champion | PGM-04, EXT-014, EXT-015 |
| Customer | Named sponsor and approvers; cohort, data and integration scope approved; tenant isolation and roles accepted | signed approvals and responsibility matrix; signed results | the customer's seven approver seats | PGM-03, EXT-012, EXT-013 |
| Integrations | Each enabled connector has approved credentials, scopes, reconciliation, rollback and readback | per-connector acceptance | customer IT and provider owner | EXT-018 |
| Go-to-market | Every public and customer claim rests on a current evidence row; no reference without written permission | claims register; permission letter | counsel; the customer's signatory | EXT-016 |

## What exists today, and why it does not close the gate

All rows come from the [evidence register](../EVIDENCE-REGISTER.md) as it stands on
2026-10-04. "Expires" is the register's date. None of these is independent,
target-environment or customer evidence.

| Artifact | Expires | Moves | Does not cover |
| --- | --- | --- | --- |
| Production dependency audit | 2026-11-01 | an input to PGM-01 | DAST, SAST, penetration test or unknown vulnerabilities |
| Working-tree secret scan | 2026-11-01 | an input to PGM-01 | provider-side secrets, rotation |
| Market-readiness repository verification | 2026-11-01 | an input to PGM-01 | independent assurance, legal, a named tenant, staffed operation |
| Founder repository assurance run | 2026-11-02 | an input to PGM-01 and EXT-006 scoping | target DAST, penetration test, deployment proof |
| Public production smoke | 2026-11-02 | an input to EXT-010 | availability history, gateway monitoring, alert delivery |
| AI kill-switch drill; prompt-injection run | 2026-12-29 | AI criterion | the institution gateway, which was not deployed or observed; one model, one run |
| Logical restore rehearsal (local); offboarding rehearsal (hosted preview, synthetic) | 2026-12-21; 2026-12-30 | inputs to EXT-011 | a production restore, a second operator, a witness |
| Founder incident tabletop | 2027-01-02 | an input to EXT-009 and EXT-011 | target alerting, staffed escalation, customer communication |
| Plus billing lifecycle acceptance | 2027-10-03 | the individual paid path only | annual charge, refund, failed renewal, dispute, tax, institution access |
| HECVAT draft | 2027-09-28 | an input to EXT-017 | it has not been sent |

Nothing in the register moves EXT-001 to EXT-006, EXT-008, EXT-012 to EXT-016 or
EXT-018. That is the position the gates were set to produce, and it is why the
program's critical path in 02 is made of outside parties.

## How evidence is tracked

1. **Filing.** An artifact goes under `docs/evidence/` with its own date, scope, SHA or
   environment, producer and reviewer, and a renewal date. It then joins the
   evidence register, which states that every file there is a record.
2. **Mapping.** The weekly program review names the node an artifact moves, in
   the status report, with the acceptor. A file that moves no node is filed but
   not reported as progress.
3. **Binding.** Candidate-bound evidence names the tag or SHA (PDR-01). A record bound to a
   superseded candidate is stale for any gate that needs the new one.
4. **Expiry.** The register's steps apply at 30, 7 and 0 days. The program's
   addition: an artifact within 7 days of expiry that a pending gate still needs
   is reported as a blocker, not as an upcoming renewal.
5. **Withdrawal.** Evidence a reviewer, owner or customer withdraws returns its
   node to open the same day, and the affected motion to NO-GO, per the decision's
   rule that conditions are gates, not a schedule promise.
6. **Sensitive records.** Reports with customer or security detail are kept in an access-controlled
   system, with a summary only in the repository, as the queue directs.
