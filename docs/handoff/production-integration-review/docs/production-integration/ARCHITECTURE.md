# Architecture workflow guide

## Shared request flow — target contract
Identity → workspace context → capability/policy → authorized source → domain command → durable transaction/outbox → worker → evidence/audit → reconciliation → receipt → permission-aware projection/search → UI.
This is an architectural contract, not verification that every stage is implemented.

## Student syllabus journey — existing test anchor
Fresh profile → onboarding/account offer → syllabus paste → model request → source quote/date validation → human review → saved course → deadlines → personal action → Today/calendar → support → completion → local resume → file export/restore. golden-path.mjs stubs the model response and proves application behavior around it, not provider quality. account-sync.mjs separately uses local real auth/database for cross-device and privacy checks.

## Course Studio — target workflow
Course/section membership → scoped authoring → versioned draft → student preview → required validation/approval → publication snapshot → Action Center/calendar → submission version → durable receipt → authorized review → feedback release → official passback only under approved authority → archive. Do not map the local reference SQLite implementation into production without inspecting existing course services, memberships and schemas.

## Registration — target workflow
Read source and freshness → explain eligibility/holds → prepare request → evaluate policy and current inputs → consequential preview → approval/confirmation → idempotent command → reconcile unknown outcomes → authoritative receipt. Readiness is not enrollment. A timeout is not a definitive failure.

## Privacy — target workflow
Purpose explanation → preference/consent decision → OS permission where needed → authoritative grant → per-request enforcement → expiry/revocation → invalidate applicable sessions/cache/retrieval → verify → receipt. Browser preference, OS permission, consent and institutional processing authority remain distinct. Official retention/holds constrain deletion.

## Board reporting — target workflow
Reconciled business sources → versioned KPI observations and assumptions → approved aggregates → disclosure review → immutable monthly publication → audience-specific read model/data room. No raw student records. Actuals, targets and forecasts remain distinct.

## Reliability
Each durable command needs operation identity, idempotency rules, bounded retry, unknown-result state, compensation policy and reconciliation. Audit binds actor/context/resource/version. Projections expose freshness and never become authority merely by displaying data. Permission checks cover APIs, database/storage, exports, search and AI, not only navigation.
