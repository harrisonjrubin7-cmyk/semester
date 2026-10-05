# AI Incident and Kill-Switch Runbook

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — LIMITED DRILL EVIDENCE; TARGET EXERCISE REQUIRED** |
| Owner | Harrison Rubin, incident commander and AI/Security/Privacy/Product primary; backup and customer contact `UNASSIGNED` |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Primary containment control | `kill.ai_generation`, global or tenant-scoped |

## When to open an AI incident

Open an incident for suspected data or cross-tenant leakage; harmful, discriminatory or prohibited output; fabricated authoritative advice at material scale; prompt/tool compromise; unapproved provider/model/data use; unauthorized or incorrect external action; loss of required audit/oversight; provider abuse or terms change; unexplained quality drift; or inability to read/enforce the kill switch. A credible safety concern may justify containment before impact is confirmed.

## Response sequence

1. **Detect and record.** Create incident ID, UTC time, reporter, environment, tenant/feature, provider/model/prompt/config versions, source/data classes, suspected severity, affected users and immediate safety concern. Do not put unnecessary prompt or student content in the incident record.
2. **Contain.** Stop the narrowest reliable scope: feature/cohort/tenant/provider first when safe, or engage global `kill.ai_generation` when scope or control integrity is uncertain. Revoke exposed credentials, stop tools/writes, isolate unsafe sources and preserve evidence. Failure to read the switch is treated as stopped by the implemented decision logic.
3. **Verify containment.** Test both a blocked request and unaffected non-AI workflow. Record actor, switch scope/reason, timestamps, response/status, audit event and screenshot/log reference. Never infer containment only from a dashboard toggle.
4. **Assess.** Determine confidentiality, integrity, availability, safety, accessibility, academic and contractual impact; affected data/people/tenants; continuing risk; legal/contract notice clocks; and which outputs/actions must be distrusted or corrected.
5. **Communicate.** Use verified facts, safe workaround, affected scope, action requested, next update and help route. The `ai_quality` communication policy requires AI platform lead and AI governance chair approval, identifies outputs to distrust and whether the feature is paused, and sets a four-hour maximum update interval; security/privacy obligations may require a shorter path.
6. **Eradicate and recover.** Fix the control failure; rotate/revoke; remove unsafe sources/configuration; regression-test the exact incident and adjacent risks; reconcile actions/data; obtain scoped recovery approval; restore in stages with monitoring and a ready re-disable path.
7. **Close and learn.** Record timeline, root cause, contributing conditions, affected records, communications, recovery validation, residual risk, corrective owners/dates, risk/inventory/evaluation updates and an evidence-expiry date. P0/P1 or prohibited-scope events block launch/continued pilot until accountable owners approve recovery.

## Kill-switch authority and safeguards

The incident commander or on-call Security/Operations owner may engage the switch without waiting for commercial approval when delay could increase harm. Only the named recovery authority may release it, after two-person review for a production/customer scope. Harrison Rubin is the current primary, but the second reviewer is unassigned; therefore a production/customer release remains blocked. Engagement must freeze capability, not delete evidence. Release must use a documented change, re-test, observation window and rollback decision.

If tenant scope cannot be established, audit data is unreliable, or the switch read fails, use the broader safe state. Do not bypass the switch to diagnose with real user data. Preserve a manual/non-AI route and tell affected users what remains available.

## Evidence and control mapping

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| global/tenant disablement | `supabase/functions/_shared/killswitch.ts`; `app/src/lib/aikillswitch.test.ts` | [The recorded kill-switch drill](../evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json) shows before/refuse/after for the deployed shared-key function | Operations | target tenant exercise and deployed institutional gateway exercise |
| fail-closed read | switch tests treat errors/exceptions as engaged and check both AI runtimes structurally | no target outage/game-day observation | Engineering | induce dependency/read failure in staging and preserve results |
| communications | `app/src/lib/governance/incident-comms.ts` and tests constrain AI-quality notice fields | no staffed delivery/receipt trail or customer contact proof | Incident commander | tabletop with approved contacts and timing |
| investigation/recovery | general incident and recovery runbooks | no full AI incident case, provider escalation or corrective-action closure record | Security + AI Governance | end-to-end tabletop and post-incident review |

The 2026-09-29 drill is narrow: it observed the deployed shared-key Edge Function. Its own record says the institutional gateway was not deployed and was supported only by repository tests. It is not proof that every AI route, tenant, provider or current deployment can be disabled.

## Claim ceiling

Semester may say it has a global/tenant AI kill-switch design, fail-closed repository tests and one dated successful drill for the deployed shared-key function. It may report the drill's exact before/during/after result.

## Prohibited claims

Do not claim universal instantaneous containment, tested institutional-gateway shutdown, complete incident readiness, staffed 24/7 response, customer notification compliance, zero data loss, full recovery or current production validation from this limited drill and repository evidence.
