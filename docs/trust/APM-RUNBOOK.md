# Monitoring and Incident Runbook

**Status: `IN_PROGRESS`.** This is the target telemetry and alert set for an
institutional pilot, marked with what exists today. `MONITORING.md` describes
the monitoring actually running, and it is honest that most signals live in
provider dashboards and not in this repository. This file does not replace
it. It is the list of what has to be wired before an SLA
([`SLA.md`](SLA.md)) can be offered.

The **Today** column uses three values:

- **Yes** means it exists, and the file named shows it.
- **Manual** means somebody can look it up, but nothing tells them to.
- **No** means it does not exist.

## Telemetry

| Signal | Today | Where |
| --- | --- | --- |
| Public app reachable, assets load | Yes | `.github/workflows/production-smoke.yml`, hourly |
| Production API (PostgREST) reachable | Yes | Same workflow |
| Gateway liveness and readiness | No | Joins the smoke run once both production URLs are configured |
| Edge function errors | Manual | Supabase dashboard → Logs |
| Auth failures | Manual | Supabase dashboard → Logs → Auth |
| Database health, slow queries, connections | Manual | `supabase/health.sql` |
| RLS policy denials | No | — |
| Browser JavaScript and route errors | No | No client error reporting |
| Core Web Vitals | No | — |
| API p50, p95 and p99 latency | No | — |
| Queue depth, job age, retries, dead letters | No | — |
| Source freshness per connector | No | Designed in `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md` |
| OAuth refresh failures | No | — |
| AI spend | Yes | `MONITORING.md`: the one alert allowed to wake somebody |
| AI latency and quality | No | — |
| Backup success | No | Platform backups are not monitored |
| Schema deploy (migration apply) | Manual | Supabase dashboard → Branches; see `MONITORING.md` |

### Critical workflows to probe synthetically

Once the probes above are wired:

1. Sign in
2. Student onboarding
3. Today loads
4. Course launch, including the LTI launch
5. Assignment save
6. Assignment submit
7. Grade posting
8. Tutoring booking
9. AI policy decision

## Alert thresholds

Starting values. Tune them after a term of baselines. Nothing here is wired
yet except AI spend.

| Signal | Warning | Critical | Owner |
| --- | --- | --- | --- |
| API 5xx rate | Over 1% for 10 min | Over 5% for 5 min | On-call engineer |
| Authentication failure | Over 3× baseline | Broad SSO or login outage | On-call and identity owner |
| Submission failure | Over 0.5% | Any systematic failure: open a P0 | Incident commander |
| p95 API latency | Over 1.5 s | Over 4 s | Platform engineer |
| Queue age | Over 10 min | Over 30 min for a critical sync | Integration owner |
| Source freshness | 80% of SLA | SLA breached | Integration owner |
| RLS denial anomaly | Above baseline | Suspected cross-tenant attempt | Security owner |
| OAuth refresh failure | Over 2% | Broad provider failure | Integration owner |
| Backup failure | Any | Two consecutive | Platform |
| Database saturation | Over 70% | Over 85% | Platform |
| AI cost | 80% of monthly budget | 100% of budget | AI owner |
| Accessibility regression | New P0 or P1 | Launch-blocking | Accessibility owner |

Today every owner in this table is the same person. The table names roles
so that a second person can take one without the table changing.

## Severity

| Severity | Example | Response |
| --- | --- | --- |
| P0 | Cross-tenant exposure, auth outage, broad outage, risk of lost submissions | Page now; incident commander; customer communication |
| P1 | Institution-wide course or integration failure, assessment impaired | On-call response with a documented update cadence |
| P2 | Degraded feature with a workaround | Business hours |
| P3 | A question, a non-critical bug, an enhancement | Standard queue |

There is no 24/7 coverage. During a pilot, P0 response depends on one person
being reachable. `SECURITY.md` and `ROLLBACK.md` state this, and a contract
must not imply otherwise.

## Incident runbook

1. **Detect.** An alert fires or a customer report arrives.
2. **Classify severity.** For data exposure, decide first whether a key is
   out, a policy is open, or the app is wrong: `SECURITY.md`, *What counts*.
3. **Assign an incident commander.** Open a timeline, one line per action,
   with times.
4. **Mitigate before understanding:**
   - roll back (`ROLLBACK.md`);
   - disable a flag (`docs/FEATURE-FLAG-REGISTRY.md`);
   - close sign-ups (`select public.set_invite_only(true);`);
   - pause an integration;
   - rotate a key (`SECURITY.md`).
5. **Update the status page.** Add the incident, and each update, to
   `app/public/status-incidents.json` (`date`, `status`, `title`, `detail`)
   and merge it; `/status.html` shows it once Pages redeploys. Change its
   `status` when it is over.
6. **Notify affected institution contacts,** using
   `docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`.
7. **Preserve evidence:** logs are kept for a month, and `access_log` for
   ninety days.
8. **Restore and validate.** Run the relevant `supabase/*.check.sql` suites
   against production state.
9. **Close the incident.**
10. **Postmortem within five business days.** Record the cause, customer
    impact, and what detection missed.
11. **Corrective actions,** each with an owner and a due date, tracked to
    closure. For a P0 or P1, closure requires the postmortem.
