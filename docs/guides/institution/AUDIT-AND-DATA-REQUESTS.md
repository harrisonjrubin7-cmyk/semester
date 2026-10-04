# Audit and data requests

> **Type:** how-to · **Audience:** institution-admins, implementers · **Owner:** `privacy` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page tells an institutional administrator what Semester records about changes and access, what can be exported from a screen today, and how a student's rights request is worked; stop reading if you need a legal answer to a rights request, which belongs to counsel.

**Status:** `PARTIAL`. Audit events exist as several tables and one envelope that has two producers; there is no audit-log export screen for an institution. Rights requests can be filed and tracked by the student in the app; answering them is a Semester operator process that has been written and not yet rehearsed with a customer.

<!-- status: Audit events = PARTIAL -->
<!-- status: Data-subject requests = PARTIAL -->
<!-- capabilities: audit:read, data_request:handle -->
<!-- roles: university_admin, data_steward -->
<!-- labels: app/src/components/DataRightsRequests.tsx :: Your privacy requests -->
<!-- labels: app/src/components/institutional/StandardsAudit.tsx :: Export evidence pack, Export RFP questionnaire -->
<!-- labels: app/src/components/institutional/IntegrationDashboard.tsx :: Export health summary -->
<!-- labels: app/src/screens/University.tsx :: Trust, Integrations -->

## What is audited

| Record | What it holds | Who can read it | Kept |
| --- | --- | --- | --- |
| `tenant_policy_audit_event` | Draft, save, publish and discard of configuration and workflows; policy and feature changes; the actor's grant | A holder of `audit:read` at your school (`university_admin`) | See [`RETENTION.md`](../../../RETENTION.md) |
| `provisioning_audit_event` | Every SCIM mutation, accepted or refused. Immutable | A holder of `audit:read`; there is no admin view of SCIM traffic, so an auditor reads the table | 3 years |
| `role_grant_audit_event` | Grants and revocations of roles | A holder of `audit:read` at your school | 3 years |
| `audit_event` envelope | Pseudonymous events. Two producers today: a rights request raised, and an account export | A holder of `audit:read` at your school, for rows tagged with your school | 3 years |
| `gateway_audit` | Metadata of gateway calls; never source text, prompts or model prose | Semester operators | 180 days |
| `support_access_event` | Each time support reads a student's record under a student-approved grant | The student; kept with the records it concerns | Not swept |

The row-level policies on the four tables above all test `audit:read` at school scope; none of them has a screen. Only two producers write to the `audit_event` envelope today, and its migration is not applied to any project in the truth table's reading; the other audit tables are separate and not yet migrated to it ([`FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md), Audit events). Retention periods are in [`DATA-RETENTION-EXPORT-DELETION.md`](../../DATA-RETENTION-EXPORT-DELETION.md). A school whose agreement needs longer changes one interval in `sweep_audit_retention()` and one in `audit_purge_allowed()`.

## What you can export from a screen

| Export | Where | Contents |
| --- | --- | --- |
| `Export health summary` | University, `Integrations` tab | Counts and states of your connections only |
| `Export evidence pack` | University, `Trust` tab | A JSON control-evidence pack from the current register. It is Semester's capability assessment, not tenant evidence |
| `Export RFP questionnaire` | University, `Trust` tab | A CSV of procurement questions |
| Suppressed CSV | University, `Operations` tab | An aggregate measure with cells under ten suppressed |

There is no screen that exports your school's audit events. To obtain them, ask Semester, name the tables above and the period, and state who is requesting. Semester reads them through a trusted session; the repository does not describe a delivery format or a response time, so agree both in writing.

## Rights requests from your students

A signed-in student files an access, correction, restriction or assisted-erasure request under **Privacy and your rights**, in the section `Your privacy requests`. They can ask for an export of their own account and delete their own account without anyone's approval. Filing a request does not change or delete anything.

The runbook ([`DATA-RIGHTS-REQUEST-RUNBOOK.md`](../../DATA-RIGHTS-REQUEST-RUNBOOK.md)) fixes these facts:

1. The request starts `received` with a thirty-day due date. A second open request of the same kind returns the first and does not reset the clock.
2. The server derives the subject and tenant. The browser does not assert either.
3. The queue is worked by the named privacy owner or a delegated `data_steward` (who holds `data_request:handle`), checked at least each business day, in a trusted service session.
4. Before an export, restriction or erasure the operator verifies identity, checks legal holds and is not the requester. A hold changes the response and does not disappear silently.
5. A refusal must name the reason and the appeal route. Students cannot edit status, due date, verification, resolution or tenant.

What your institution does:

- Decide, in your agreement, who at your institution is told when a request concerns records you hold. The repository records no such routing; agree it before launch.
- Route a request that arrives at your helpdesk to the student's own **Privacy and your rights** screen, or to Semester's privacy contact. Do not collect passwords, payment details or another person's records.
- Hold your own copies in your own systems to your own retention rules. Semester's erasure removes what the account owns in Semester; it does not delete what your institution holds in its systems.

Guardian and institution-originated requests are modelled in the schema but have no verified workflow. Treat them as a manual conversation with counsel.

## Evidence to ask for

The runbook names the evidence it retains: request id, kind, tenant, timestamps, status, the verification fact and the resolution; the pseudonymous audit events; an export manifest or erasure receipt where applicable. It asks for a quarterly rehearsal with two synthetic accounts in different tenants, stored under `docs/evidence/privacy/`. A written runbook is not rehearsal evidence; ask for the dated result.

## Known disagreement

[`DATA-RETENTION-EXPORT-DELETION.md`](../../DATA-RETENTION-EXPORT-DELETION.md) and the truth table say there is no screen for rights requests. The Privacy screen mounts `DataRightsRequests` (`app/src/screens/Privacy.tsx`), so the student side exists. The code wins. What remains absent is a staff-facing screen to answer them.
