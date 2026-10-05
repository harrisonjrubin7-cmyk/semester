# Business continuity and disaster recovery

## Pilot objectives

RTO/RPO are not promised until measured in the contracted environment. Before launch, identify critical services, dependencies, data owners, manual/read-only fallback, backup scope/encryption/retention, restoration order, communications and decision authority.

## Exercise

Restore into a disposable isolated environment; verify record counts, tenant isolation, audit continuity, recent deletions/legal holds, file integrity, authentication, critical golden paths and reporting. Record start/end, achieved RTO/RPO, data gap, deviations and remediation. Provider “backup enabled” is not restore evidence.

## Continuity modes

- provider/source unavailable: keep student-owned planning usable; show freshness and safe retry;
- writes unsafe: enter read-only mode and preserve pending work without duplicate execution;
- identity unavailable: refuse protected data; provide public/help information only;
- total service outage: status/support communication and approved manual institutional process;
- key-person loss: backup owners have current runbooks, access and contact tree.
