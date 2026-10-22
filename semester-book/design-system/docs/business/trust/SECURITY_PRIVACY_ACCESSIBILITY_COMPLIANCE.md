# Security, privacy, accessibility and compliance

_Semester business operations · 2026-10-05 · Source: uploads/Show the finance and accounting operations section.pdf. **Accounting, tax, legal, insurance, privacy, security, accessibility and compliance content needs qualified professional review before use.**_

> Every customer promise connects to a financial owner, delivery owner, support process, security/privacy control, product capability and evidence trail.

Continuous operational systems, not a launch checklist.

## Security program

Governance, asset and data inventory, classification, threat modeling, identity and access, MFA, secrets, secure SDLC, dependency and vulnerability management, logging and monitoring, incident response, backup/restore, DR, BCP, vendor risk, access reviews, pen testing, awareness, evidence register, Trust Center, HECVAT, questionnaires, reporting.

## Controls by domain

| Domain | Required controls |
| --- | --- |
| Identity | MFA, least privilege, joiner/mover/leaver, service-account ownership |
| Authorization | RLS, tenant isolation, capability checks, server-side scope |
| Secrets | Server-only credentials, rotation, secret scanning, no browser exposure |
| Application | Code review, testing, SAST, dependency scanning, release gates |
| Infrastructure | Environment separation, logging, monitoring, backups, recovery |
| Data | Classification, minimization, encryption, retention, deletion, export |
| AI | Provider controls, policy, classification, audit, evaluation, spend limits |
| Vendors | Security review, contract terms, subprocessors, monitoring, offboarding |
| Incident | Severity, command roles, communications, postmortem, corrective actions |
| Compliance | HECVAT, evidence, control mapping, review calendar, claims governance |

## Privacy operations

Data inventory and map, classification, purpose limitation, consent, retention, deletion, legal holds, subject/export/erasure/correction requests, subprocessors, privacy impact assessments, privacy incidents, policy review, reporting.

## Control record

Control → owner → policy → implementation → evidence → test → reviewer → last review → next review → customer claim → procurement response → exception/remediation.

**Have:** docs/secure/, docs/operate/, docs/legal/ (DPA, privacy, subprocessors), docs/build/ (test plans). **Gaps (P0):** insurance, HECVAT, ACR, vendor reviews, evidence register entries.
