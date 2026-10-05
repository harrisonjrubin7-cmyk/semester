# Runbooks

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The documents somebody reads while something is going wrong, or while
switching something on for the first time. They were real before this page
and scattered across three directories; this is the index, so that the person
on call opens one page and not a search box.

`app/src/lib/runbooklinks.test.ts` holds every relative link in the
operational set to a file that exists, and this page is in that set. A runbook
whose status line says **NOT BUILT** is a plan for one, kept here so that the
gap is visible where the runbook would be.

## When something is wrong

| Situation | Read | What it is |
| --- | --- | --- |
| A deploy made the live app worse | [`ROLLBACK.md`](../ROLLBACK.md) | Who puts the code back, how, and how long it takes |
| Data is lost or wrong | [`RESTORE.md`](../RESTORE.md) | Getting the data back, and the restore drill the register waits on |
| Something may be going wrong quietly | [`MONITORING.md`](../MONITORING.md) | What is watched, where, and by whom; the weekly look |
| An incident, once noticed | [`docs/trust/APM-RUNBOOK.md`](trust/APM-RUNBOOK.md) | Target telemetry and alert thresholds, marked with what exists; the incident runbook |
| Telling people about an incident | [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md) | By audience: students, staff, the institution, the public |
| Who is paged, and where the alert goes | [`docs/vanderbilt/incident-routing.md`](vanderbilt/incident-routing.md) | Routing for the first tenant; destinations stay out of the repository |
| A report of someone at risk | [`docs/CRISIS-RESPONSE-RUNBOOK.md`](CRISIS-RESPONSE-RUNBOOK.md) | The notice shown verbatim, and what a moderator does |
| A security report or a leaked secret | [`SECURITY.md`](../SECURITY.md), [`SECRETS.md`](../SECRETS.md) | Disclosure handling; where every secret lives and how it is rotated |
| A school’s connector is failing or must stop | [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) | Onboarding, health, stopping in an incident, answering a student or a lawyer |
| Support cannot answer without data access | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) | Tiers, what a supporter may see, the seven-day access window |
| Abuse, spam or a flood | [`docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md`](SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md) | What exists, what is measured, and the rate limits |
| A dependency is down (what still works) | [`docs/DEGRADED-MODE-MAP.md`](DEGRADED-MODE-MAP.md) | Eleven dependencies, what degrades, critical-period priorities; written from the repository, never drilled |
| The region is gone | [`docs/market-readiness/DISASTER_RECOVERY.md`](market-readiness/DISASTER_RECOVERY.md) | Status **NOT_STARTED**: the plan for a plan |

## When switching something on

| Task | Read | What it is |
| --- | --- | --- |
| Deploying the backend | [`supabase/DEPLOY.md`](../supabase/DEPLOY.md) | Edge Functions, the SQL they read, the scheduler, and the checks after |
| Reading a preview branch | [`STAGING.md`](../STAGING.md) | What a preview is and is not telling you about production |
| Going live for a cohort | [`docs/market-readiness/GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md) | The technical checklist; the decision itself is the council’s |
| Activating the first tenant | [`docs/vanderbilt/production-activation-runbook.md`](vanderbilt/production-activation-runbook.md) | An activation gate, not evidence that production exists |
| Limiting a university’s course rooms to its members | [`docs/SCHOOL-MEMBERSHIP-ENFORCEMENT.md`](SCHOOL-MEMBERSHIP-ENFORCEMENT.md) | Off for every school; the readiness count, the switch, and the evidence still owed |
| A school leaves | [`docs/SCHOOL-OFFBOARDING.md`](SCHOOL-OFFBOARDING.md) | Eight steps, two sides, reversible until a purge is authorized; the purge itself is not built |
| Onboarding a school’s SSO | [`docs/SSO-TENANT-ONBOARDING.md`](SSO-TENANT-ONBOARDING.md) | The order a new institution goes through |
| SAML | [`docs/SAML-IMPLEMENTATION-RUNBOOK.md`](SAML-IMPLEMENTATION-RUNBOOK.md) | Built; the tenant-specific acceptance gate |
| OIDC | [`docs/OIDC-IMPLEMENTATION-RUNBOOK.md`](OIDC-IMPLEMENTATION-RUNBOOK.md) | **NOT BUILT**; what it would take |
| LTI 1.3 | [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](LTI-1.3-LAUNCH-RUNBOOK.md) | Built for core launch, Deep Linking and score passback |

## Not here on purpose

Alert destinations, on-call phone numbers and council acceptances live in the
private operations system, for the reason `docs/vanderbilt/incident-routing.md`
gives. A runbook in this repository says *what* to do; the private system says
*whom* to call.
