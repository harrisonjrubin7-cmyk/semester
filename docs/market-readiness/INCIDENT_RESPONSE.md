# Incident Response

**Status: `NOT_STARTED` as an operational practice.** This document defines the
process; nothing has exercised it, and no monitoring exists to trigger it.

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

**Detect.** Today: only a user report. This is the largest gap — see
`INFRASTRUCTURE_READINESS.md`. Until monitoring exists, mean time to detection
is unbounded.

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

Not yet written. A pilot cannot start without them: an institution needs to
know what it will be told, how fast, and by whom.

## Blocked on

Nothing external. This is unblocked work that has simply not been done.
