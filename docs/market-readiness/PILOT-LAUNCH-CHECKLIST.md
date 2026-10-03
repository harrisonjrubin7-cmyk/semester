# Pilot launch checklist

Every item requires a dated artifact, accountable owner, reviewer, and link. A checkbox in this file is not evidence.

## Commercial and governance

- [ ] Executed pilot agreement and DPA/no-personal-data determination.
- [ ] Cohort, workflow, exclusions, price, support and decision date fixed.
- [ ] Executive sponsor, champion, technical, privacy, security, accessibility, support and backup contacts named.
- [ ] Launch council has no open P0/P1 and every required seat signed `GO`.

## Data and access

- [ ] Data-flow/minimization map approved; forbidden data excluded.
- [ ] Tenant/cohort IDs and environment recorded; demo/sandbox separated.
- [ ] Role/capability matrix tested, including cross-tenant, IDOR, stale/revoked role cases.
- [ ] Retention, export, deletion, legal hold and offboarding rules approved.
- [ ] Integrations are manual/read-only unless a separate write approval exists.

## Experience and inclusion

- [ ] Student/admin golden paths pass beginning, success, error, empty, recovery and support states.
- [ ] Mobile, 200% zoom, keyboard-only and target assistive-technology tests pass.
- [ ] Permission and AI explanations are understandable to representative users.
- [ ] Known limits and safe workarounds are published.

## Operations

- [ ] Monitoring, privacy-safe events, health checks and alert destinations work.
- [ ] Support queue, response windows, escalation, backup owner and status channel work.
- [ ] Kill switches, read-only/degraded mode and rollback are rehearsed.
- [ ] Backup restore and incident tabletop meet approved RTO/RPO.
- [ ] Export/deletion and offboarding are rehearsed end to end.

## Measurement

- [ ] Baseline, 3–5 measures, guardrails and minimum cell size are signed.
- [ ] Weekly review and midpoint/final meetings are scheduled.
- [ ] Conversion/expand/pause/stop criteria are explicit.
- [ ] Testimonial/case-study consent is separate and optional.

**Launch rule:** any missing item is `NO-GO`; P0/P1 findings cannot be accepted as launch conditions.
