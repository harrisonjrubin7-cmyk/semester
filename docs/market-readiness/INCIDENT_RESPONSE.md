# Incident Response

**Status: `IN_PROGRESS` as an operational practice.** This document defines the
process, public uptime monitoring can trigger it, and communication templates
exist. No named incident owner or university contact has been configured, and
the process has not been exercised.

## Severity

| Sev | Means | Example |
| --- | --- | --- |
| **SEV1** | Data exposure, cross-tenant leak, or total outage | A policy change lets one school read another's rooms |
| **SEV2** | Core workflow broken for many users | Calendar or courses fail to load |
| **SEV3** | Degraded or partial | An integration is failing; the rest works |
| **SEV4** | Minor, cosmetic, or single-user | A label is wrong |

Any suspected cross-tenant data exposure is **SEV1 until disproven**, not until
confirmed. The asymmetry is deliberate.

## Flow

```
DETECT → OWN → CONTAIN → COMMUNICATE → RESOLVE → POSTMORTEM
```

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

**Resolve.** Fix, verify, and state what verification was run.

**Postmortem.** Blameless, written within five working days, and it must name
the guard that would have caught it. This repository's culture is that a fix
without a guard is half a fix.

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
