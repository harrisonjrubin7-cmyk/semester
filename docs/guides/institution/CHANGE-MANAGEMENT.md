# Change management

> **Type:** how-to · **Audience:** institution-admins, implementers · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page lists the communications a pilot needs, which materials already exist for them and what to tell students about limits and changes; stop reading if you expect change-management tooling in the app, because none is built.

**Status:** `PLANNED` for institutional change-management tooling: the repository's change-management plan says "Nothing here is built yet". The communications below are done by people, using documents and templates that exist. The release-note page is written by the project lead and linked below by path.

<!-- status: Institutional change management = PLANNED @ docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md :: Nothing here is built yet -->
<!-- labels: app/src/screens/University.tsx :: Campaigns -->
<!-- labels: app/src/components/institutional/CampaignManager.tsx :: Release checklist -->
<!-- capabilities: campaign:manage, campaign:review, campaign:report -->
<!-- roles: marketing_admin, campaign_reviewer, marketing_analyst -->
<!-- paths: docs/market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md, docs/pilot/KNOWN-LIMITATIONS.md, docs/pilot/QUICK-START.md, docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md, docs/market-readiness/CAMPUS-LAUNCH-KIT.md, docs/market-readiness/STUDENT-ONBOARDING-GUIDE.md, docs/LAUNCH-CONTENT-AND-TRAINING.md, docs/FACULTY-ENABLEMENT.md -->
<!-- pending-links: docs/releases/README.md -->

## What the pilot docs require you to send

The pilot playbook lists six communications ([`PILOT-IMPLEMENTATION-PLAYBOOK.md`](../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md)). Each needs an owner on your side and one on Semester's.

| Communication | Contents | Material that exists |
| --- | --- | --- |
| Kickoff | Scope, owners, permitted use, channels, dates | The signed scope |
| Prelaunch | What changes, known limits, support, privacy, opt-out or withdrawal | [Campus launch kit](../../market-readiness/CAMPUS-LAUNCH-KIT.md); [student onboarding guide](../../market-readiness/STUDENT-ONBOARDING-GUIDE.md); [quick start](../../pilot/QUICK-START.md) |
| Incident | Impact, safe workaround, next update, resolution | [Incident communication templates](../../market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md): the messages are prepared; the sender, approver, recipients and delivery channel are not |
| Weekly | Aggregate measures, guardrails, issues, decisions | A decision log kept by the champion |
| Midpoint and final | Evidence against the signed scorecard | The pilot scorecard |
| Offboarding | Export, access revocation, deletion and retention, completion | The [exit plan](EXIT-PLAN.md) |

Approved templates are a precondition of the launch phase. Final copy needs counsel, privacy, accessibility, customer and representative student review; the repository does not record that any copy has had it.

## Tell students the truth about limits

Give students the known-limitations list, which the app also shows on its Help screen and the public site, from the same data ([`KNOWN-LIMITATIONS.md`](../../pilot/KNOWN-LIMITATIONS.md)). Among its entries for an institution:

- Semester is not connected to your school's systems. Students register, drop, pay and submit in your own systems.
- Files attached in the app stay on the device where they were added.
- Two devices can disagree after offline use.
- Every date Semester shows came from what the student gave it or from a file they loaded, and the app labels the source.

Say that Semester works beside your systems. See [parallel-run evidence](PARALLEL-RUN-EVIDENCE.md) for why other wording is not allowed. Do not promise outcomes, uptime, response times or 24/7 support: the claims register prohibits those today, and the go / no-go checklist records that no staffed support channel exists yet.

## Prepare staff and faculty

- Faculty enablement is a plan, and the repository says nothing in it is built beyond the roles. Training is yours to schedule: [`FACULTY-ENABLEMENT.md`](../../FACULTY-ENABLEMENT.md), [`LAUNCH-CONTENT-AND-TRAINING.md`](../../LAUNCH-CONTENT-AND-TRAINING.md).
- Administrators complete the operator acceptance record before any production access ([`ADMIN-ONBOARDING-GUIDE.md`](../../market-readiness/ADMIN-ONBOARDING-GUIDE.md)): review the signed scope and prohibited uses, practise invitations, aggregate review, audit lookup, help escalation, rollback request, export, deletion and offboarding on synthetic data.
- Administrators may not use Semester for undisclosed surveillance, individual risk labelling or high-impact automated decisions.

## Campaigns

The `Campaigns` tab (needs a campaign capability) manages recruitment and adoption campaigns and links for one school. `marketing_admin` (`campaign:manage`) creates and changes them but cannot review or approve its own, and never reads a contact; `campaign_reviewer` (`campaign:review`) records a privacy, accessibility or brand review; `marketing_analyst` (`campaign:report`) reads results as suppressed counts. A campaign has a `Release checklist`. Use it before you send anything to students.

## Telling people when Semester changes

Release notes and the change-communication matrix are written by the project lead and live at [`docs/releases/README.md`](../../releases/README.md). Until that page exists in your copy, the changelog in [`CHANGELOG.md`](../../../CHANGELOG.md) is the record of what changed.

Change control for scope is separate: any new data class, integration, user group, metric, AI use or write capability returns to trust review and go / no-go before it reaches students.

## What is not built

The change-management plan's entities (stakeholder maps, policy approval workflows, impact assessments, training assignments, communication templates and campaigns, adoption metrics, staff feature requests, a roadmap, release-note targeting) are a plan. The flag `university.change_management` is `off`. Keep these in your own project tools.
