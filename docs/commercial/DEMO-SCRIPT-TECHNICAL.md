# Technical and Security Demo Script

| Control | Value |
| --- | --- |
| Status | **CONTROLLED 45–60 MINUTE WALKTHROUGH — EVIDENCE EXCHANGE; ACTIVATION PROHIBITED** |
| Owner | Harrison Rubin — technical presenter and evidence owner; backup engineer, security reviewer and customer technical authority unassigned |
| Evidence date | 2026-10-03 at repository revision `9b866db3` |
| Source | [`../market-readiness/DEMO-SCRIPT.md`](../market-readiness/DEMO-SCRIPT.md) |

## Before the walkthrough

Agree the audience, review areas and confidentiality boundary. Use an approved revision and synthetic/isolated environment; redact secrets, personal data, project identifiers and exploit detail. Distinguish repository implementation, local/CI tests, public reachability, target readback, external assessment and customer approval throughout.

## Flow

1. **Architecture and data flow (7 minutes):** browser/local-first, Supabase, gateway/provider boundaries, data classes, authority and environments. State which services are configured versus merely represented in code.
2. **Identity, tenancy and authorization (8 minutes):** roles, capability evaluation, RLS/grants, tenant scope, denied paths and support/break-glass concepts. Repository tests are not target acceptance.
3. **Lifecycle and privacy (7 minutes):** minimization, consent, retention, legal holds, export/deletion and offboarding; show open legal/customer decisions.
4. **Integrations and writes (8 minutes):** adapter/connection approval, source/freshness, read-only/manual-first posture, idempotency/readback and degraded mode. No official write or live-provider claim without proof.
5. **Security and supply chain (7 minutes):** secure-development gates, secrets/dependencies/SBOM, DAST status and independent-test gaps. Never characterize a scan as certification.
6. **Reliability and recovery (8 minutes):** proposed SLIs/SLOs, monitoring gaps, release/rollback, feature kills, logical restore and provider-backed DR plan. RTO/RPO and on-call remain unproved.
7. **Evidence and acceptance plan (8 minutes):** map requested controls to dated artifacts, limitations, owners and expiry; define sandbox/UAT/target tests and named approvals.
8. **Decision (3 minutes):** evidence follow-up, technical workshop, conditional scope or no-fit—never activation by verbal assent.

Record every unanswered question with owner, authoritative source, due date and permitted interim language. Correct an overstatement in the meeting and in any reused artifact.

## Evidence state

**Repository evidence.** Architecture, trust, engineering, legal-draft and institutional-readiness materials support structured evidence exchange with explicit gaps.

**Operational evidence.** Target configuration, named-customer control acceptance, independent assessment, production restoration, staffed operations and institutional integration remain incomplete.

**Missing test/proof.** Reconcile exact candidate and evidence dates; run requested target/sandbox tests; complete independent reviews; answer the customer control matrix; capture authorized acceptance and residual risk.

## Claim ceiling

Semester may conduct an evidence-bounded technical/security walkthrough and jointly design an acceptance plan.

## Prohibited claims

Do not claim certification, compliance, penetration-test clearance, complete tenant isolation, production recovery, achieved SLA/SLO, live institutional integration or enterprise readiness without current authoritative evidence.
