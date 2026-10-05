# Reliability and operations runbook

**Activation status: RED until named owners and target-environment rehearsals exist.**

## Operating loop

1. Confirm environment, revision, configuration export, enabled features, providers, cohort, and deployment approver.
2. Run health, authentication, core journey, audit, export/deletion, and rollback smoke checks.
3. Monitor client/runtime errors, authentication failures, database health, latency, critical jobs, provider failures, rate limits, and privileged events without logging sensitive content or tokens.
4. Triage against the documented severity model; assign incident commander, engineering, security/privacy, customer communication, and note-taking roles.
5. Prefer feature disablement, read-only mode, provider isolation, or rollback over unsafe continued operation.
6. Record timeline, affected scope, decisions, recovery, customer notice, evidence preservation, and follow-up owners.

## Before any pilot launch

- publish realistic support hours and escalation contacts with backups;
- test alerts and ownership handoffs;
- restore a backup into an isolated environment and record measured recovery results;
- rehearse rollback, kill switch, read-only/degraded mode, export, deletion, and offboarding;
- verify audit retention/access and privacy-safe log fields;
- confirm status/incident communication channels and templates;
- approve release, emergency patch, migration, and change-log procedures.

No RTO, RPO, uptime, on-call, or response commitment becomes a public/contractual promise until the responsible owners approve it and measured evidence exists. Detailed sources: [business continuity and disaster recovery](BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY.md), [incident runbook](INCIDENT-RESPONSE-RUNBOOK.md), [rollback](../../ROLLBACK.md), [restore](../../RESTORE.md), and [monitoring](../../MONITORING.md).
