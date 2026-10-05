# Incident Response

The consolidated lifecycle, proposed service tiers, fail-safe automation boundaries, service runbooks, verification requirements, and remaining operational gates are in [`../INCIDENT-RECOVERY-PLAYBOOK.md`](../INCIDENT-RECOVERY-PLAYBOOK.md). This page preserves the current operational-status boundary.

**Status: `IN_PROGRESS` as an operational practice.** This document defines the
process, public uptime monitoring can trigger it, and communication templates
exist. No named incident owner or university contact has been configured, and
the process has not been exercised.

## Severity

| Sev | Means | Example |
| --- | --- | --- |
| **SEV1** | Suspected cross-tenant exposure, systemic authorization or consent failure, widespread unsafe official write, or total outage | A policy change lets one school read another's rooms |
| **SEV2** | Core workflow broken for many users, including broad SSO/LTI outage or integrity failure | Calendar or courses fail to load for many users |
| **SEV3** | Degraded or partial service, stale source, accessibility defect, or limited AI-quality issue | An integration is failing; the rest works |
| **SEV4** | Isolated low-impact, cosmetic, or single-user defect | A label is wrong |

Any suspected cross-tenant data exposure is **SEV1 until disproven**, not until
confirmed. The asymmetry is deliberate.

## Flow

```
DETECT → CONTAIN → COMMUNICATE → RECOVER → VERIFY → CLOSE
```

This is the consolidated lifecycle. **Own** remains a required invariant from
detection through close rather than a separate stage. The former **Resolve**
stage is now the explicit Recover and Verify pair. The former **Postmortem** is
part of Close for SEV1 and SEV2; those written reviews are due within five
working days. SEV3 and SEV4 still require complete close-out evidence, with a
written review when impact, communication, or a missing guard warrants one.

**Detect.** The hourly production smoke now detects loss of the Pages shell,
its deployed module or stylesheet, and the production Supabase REST edge.
Gateway liveness/readiness joins it when both production URLs are configured.
Application exceptions, workflow correctness and named-person alert delivery
remain unmonitored, so a user report is still the only signal for those gaps.

**Own.** One named person. Not a channel.

**Contain.** Prefer rollback over forward-fix for SEV1/SEV2; see `ROLLBACK.md`.
For a suspected data exposure, containment precedes diagnosis — revoke first,
understand afterwards.

**Communicate.** University contacts hear from us before they hear from their
students, in every case where their students are affected.

**Recover.** Restore the approved path or fallback without weakening a control.

**Verify.** Prove the affected path, tenant boundary, data state, and fallback
before declaring recovery.

**Close.** Record the measured timeline, impact, recovery point,
communications, and every corrective action with owner, due date, and required
evidence. SEV1 and SEV2 receive a blameless written review within five working
days, naming the guard that would have caught the incident.

## University-facing templates

Use [`INCIDENT_COMMUNICATION_TEMPLATES.md`](./INCIDENT_COMMUNICATION_TEMPLATES.md).
The messages deliberately separate suspected impact from confirmed facts and
include the next-update time. They are drafts, not a mailing list: a pilot
still cannot start until the institution supplies its contacts and Semester
assigns the named incident owner and backup.

## Blocked on

- Semester incident owner and backup
- Vanderbilt security/privacy and operational contacts
- A tabletop exercise using the real contact route
