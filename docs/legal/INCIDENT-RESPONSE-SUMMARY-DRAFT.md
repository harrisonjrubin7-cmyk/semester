# Semester Incident Response Summary — DRAFT

> **Not in force. Not reviewed by a lawyer.** The public summary of
> [`SECURITY.md`](../../SECURITY.md) and
> [`INCIDENT_RESPONSE.md`](../market-readiness/INCIDENT_RESPONSE.md), which
> hold the full procedure. The process is written but has not been exercised:
> no tabletop has been run, and the incident owner is one person with no named
> backup. Do not publish it as a description of a practised capability until
> those are done. Every `[DECIDE: …]` is a question only the owner or counsel
> can answer.

**Effective date:** [DECIDE]

## 1. What counts as an incident

Anything that makes Semester unavailable, loses or corrupts data, or lets
someone see data they should not. A suspected exposure of one school's data to
another is treated as the most severe kind until it is disproved.

## 2. What we do

1. **Detect** — from monitoring, the status check, a report from you, or a
   researcher.
2. **Own** — one named person takes charge and keeps the record.
3. **Contain** — stop it spreading: switch a feature off, revoke access,
   switch AI generation off, or put the app into read-only mode.
4. **Communicate** — tell the people affected (section 3).
5. **Resolve** — fix the cause and restore service.
6. **Review** — a written, blameless review within five working days, and the
   fixes it calls for.

## 3. When we tell you

- **If your data may have been seen by someone who should not have seen it:**
  we aim to email every affected account and, for a school deployment, the
  school's named contact, saying what happened, what data, and what we are
  doing. **[COUNSEL REQUIRED]** The internal target is 72 hours from
  confirming it, but no notice deadline has been approved (P-02) and this
  draft does not promise one. Where the law or a school's contract sets a
  time, that applies.
- **Outages:** on the status page. It checks the service live from your
  browser; it does not yet send notifications or keep an uptime history.

## 4. Reporting a security problem

See [`SECURITY.md`](../../SECURITY.md) and
`/.well-known/security.txt`: email harrisonjrubin7@gmail.com. We aim to
respond to a critical report the same day and fix it within two days; high
within 14 days; medium within 60; low within 180.

## 5. Schools

A school's agreement sets its notification terms, contacts and cooperation in
an investigation. [DECIDE with counsel: the standard clause.]
