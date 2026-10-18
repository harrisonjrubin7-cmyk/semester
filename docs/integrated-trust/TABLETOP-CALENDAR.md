# Tabletop and drill calendar

<!-- Rendered from app/src/lib/ops/incidentplaybooks.ts by incidentplaybooks.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

The schedule on which the incident playbooks are rehearsed. It carries weeks after the day the founder starts the programme, not dates: the start is a decision, and no date is invented here. An exercise counts as held when its file exists under `docs/evidence/operations/` stating the day it was held, and not before; the master register reads the same rule. The one rehearsal so far, [the founder readiness walkthrough of 3 October](../evidence/operations/2026-10-03-founder-readiness-tabletop.md), was a read of documents and the repository, and says it does not close the exercise gates.

| ID | Week | Form | Playbooks | In the room | Passes when | Finds out | Files |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| TT-01 | 2 | tabletop | IR-01 | founder, security, engineering | Walked through with the real contact tree and the real switch list; every step names who does it and what tool; every gap is a remediation item. | Whether anyone but the founder can contain a cross-tenant event. | `docs/evidence/operations/{date}-cross-tenant-tabletop.md` |
| TT-02 | 4 | drill | IR-04 | founder, engineering, trust | The AI switch engaged, observed refusing, released by a second reviewer, and the timeline filed. | The two-person release rule, which has never been exercised because the second reviewer is unassigned. | `docs/evidence/operations/{date}-ai-switch-two-person-drill.md` |
| TT-03 | 6 | restore | IR-07 | operations, engineering, data | A provider backup restored into a second project; fingerprints, row counts and row-level security compared; recovery time and point measured and recorded. | The first measured recovery time and point; whether point-in-time recovery is bought. | `docs/evidence/operations/{date}-provider-restore-drill.md` |
| TT-04 | 8 | tabletop | IR-02, IR-14 | security, engineering, success | Account takeover and secret rotation walked; a secret actually rotated and logged. | Whether there is any way to sign every session out. | `docs/evidence/operations/{date}-credential-incident-tabletop.md` |
| TT-05 | 10 | game-day | IR-06, IR-15 | engineering, operations | Read-only mode engaged on production for a stated window; page rollback performed; the status page posted and resolved through its validated file. | The read-only switches and the incident posting path, neither of which has run in production. | `docs/evidence/operations/{date}-outage-game-day.md` |
| TT-06 | 12 | tabletop | IR-12 | privacy, data, engineering | A synthetic request taken from intake to closure with a verified requester, a held account blocking it, and the due date monitored. | The operator side of the request workflow, which does not yet exist. | `docs/evidence/operations/{date}-privacy-request-tabletop.md` |
| TT-07 | 14 | tabletop | IR-03, IR-10 | founder, data, finance | A record-integrity and a billing-error scenario walked against the ledger and processor records. | Whether the correction workflow can be carried out by someone other than the author. | `docs/evidence/operations/{date}-record-and-billing-tabletop.md` |
| TT-08 | 16 | tabletop | IR-08 | security, privacy, founder | A staff-misuse scenario; the break-glass grant opened, reviewed by a different person, and the access effect observed. | Whether break-glass widens any access, which today it does not. | `docs/evidence/operations/{date}-staff-access-tabletop.md` |
| TT-09 | 18 | tabletop | IR-11 | accessibility, engineering, success | A reported barrier on a critical journey traced from email to fix, with the accessible alternative offered inside the exercise. | Whether the barrier route reaches a person other than the founder. | `docs/evidence/operations/{date}-accessibility-incident-tabletop.md` |
| TT-10 | 20 | tabletop | IR-05 | engineering, success, champion | A failed-sync scenario with an institution contact on the call, against fixtures. | The first conversation with a customer contact. | `docs/evidence/operations/{date}-integration-failure-tabletop.md` |
| TT-11 | 22 | tabletop | IR-09 | trust, privacy, founder | A self-harm and a known-abuse-media scenario walked with counsel and the campus safety contact; the result is a go or no-go on enabling Community. | Whether Community can be enabled at all. | `docs/evidence/operations/{date}-community-safety-tabletop.md` |
| TT-12 | 26 | game-day | IR-01, IR-04, IR-07 | founder, security, engineering, operations, privacy, trust | A staffed half-day with a scenario no participant has seen, communications drafted through the composer and sent to a test list, and the post-incident review held within five business days. | Everything together, including key-person absence: one named participant is told they are unavailable. | `docs/evidence/operations/{date}-half-year-game-day.md` |
| TT-13 | 30 | tabletop | IR-13 | trust, finance, founder | Run only if a marketplace is proposed; otherwise recorded as not applicable with the date. | Whether the marketplace controls exist before it is built. | `docs/evidence/operations/{date}-marketplace-fraud-tabletop.md` |

## After the first year

- **monthly.** One playbook, rotating, as a one-hour tabletop; the artifact is the findings list.
- **quarterly.** One cross-functional exercise that includes a communication to a test list and a restore or switch drill.
- **yearly.** A staffed game day, an external review of the playbooks, and a re-read of this calendar against the register.
- **perRelease.** A high-risk release rehearses the lever of the playbook it could trigger.

## Coverage

| Playbook | Scenario | Rehearsed by |
| --- | --- | --- |
| IR-01 | Suspected cross-tenant access | TT-01, TT-12 |
| IR-02 | Compromised account or credential stuffing | TT-04 |
| IR-03 | Official record or grade integrity | TT-07 |
| IR-04 | AI data leak, unsafe advice or policy bypass | TT-02, TT-12 |
| IR-05 | Integration failure or bad synchronization | TT-10 |
| IR-06 | Platform outage, failed deploy or migration | TT-05 |
| IR-07 | Data loss and provider restore | TT-03, TT-12 |
| IR-08 | Staff or support access misuse | TT-08 |
| IR-09 | Community safety: threat, self-harm, abuse material | TT-11 |
| IR-10 | Payment or billing error | TT-07 |
| IR-11 | Accessibility barrier on a critical journey | TT-09 |
| IR-12 | Privacy request failure or over-deletion | TT-06 |
| IR-13 | Marketplace or partner fraud | TT-13 |
| IR-14 | Key or secret compromise | TT-04 |
| IR-15 | Provider failure | TT-05 |

Every exercise puts the commander of each playbook it rehearses in the room, and the test fails if one does not. The seats that have no holder today (security, trust, data, finance and the pilot champion) cannot attend as themselves, which is the first thing the exercises will find.

