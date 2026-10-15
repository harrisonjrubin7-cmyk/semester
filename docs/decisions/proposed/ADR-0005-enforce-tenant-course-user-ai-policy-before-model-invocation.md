# ADR-0005 · Tenant, course and user AI policy is evaluated server-side before any model call, retrieval or tool lookup

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | AI governance owner |
| Deciders / reviewers | Founder; security owner; counsel (student data to model providers; school AI-off rules) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 gate for any school-managed account; Phase 2 for retrieval classification |
| Related | `docs/architecture/ai/ai-policy-enforcement-map.md`; `findings-ai.md` #1-#5, #7, #8; `docs/architecture/0004-ai-through-a-metered-gateway.md`; `docs/architecture/0007-policy-decision-point.md`; `docs/legal/AI-USE-POLICY-DRAFT.md`; `FITNESS_FUNCTIONS.md` #7; ADR-0003 |
| Supersedes / superseded by | — (amends `0004` for school-managed accounts only; if ratified, `0004` gets a dated addendum) |

## Context
- Enforced where the gateway is the path. `respond()` in `app/server/institution/intelligence.ts` evaluates scope (126), tenant state off (131), role (138), allowed modes (141), agent action (147), source approval (150-157), per-course modes (183-189), model allow-list and cost (200), atomic budget reservation (222-231), all before `input.generate` (234); kill switch at 441. The audit memo's "tenant policy not enforced at invocation" is **refuted for this path** (`findings-ai.md` "Refuted").
- Not enforced anywhere else. `app/src/lib/claude.ts:886 ask()` (25 non-test importers) reads no tenant policy, `ai_policy`, kill switch, `aistatus.decideDoor` or consent; `decideDoor` (`app/src/lib/aistatus.ts:53`) has no caller outside its test. `KILL_REACH` for device-key, OpenAI-key and proxy routes is none (`app/src/lib/governance/ai-systems.ts:42-48`).
- Shared-key function `supabase/functions/claude/index.ts` has no tenant dimension and no decision log; global kill row at `:132`, fail-closed on read error `_shared/killswitch.ts:44`; activation record is entirely `pending-owner` and the function returns 501 until recorded (`index.ts:84-88`).
- School `aiOff` categories are bypassed by the lookup tools: `converse.ts:440` vs `:668`, `runLookups(wants,{state,catalog,now})` takes no school capabilities; `read_grades`, `read_attendance`, `find_deadlines` run regardless (`findings-ai.md` #3).
- Retrieval has no per-person source authorization or classification: `app/server/institution/intelligence-repository.ts:160-194`; `approved_source` has no tier; `packages/institution/src/retrieval.ts` is pure and not wired; `ai.retrieve_source` (`policy.ts:75,272`) has no caller.
- The gateway audits 6 of about 22 outcomes with no correlation id (`intelligence.ts` audit calls at 132, 239, 312, 354, 373, 415). Stored `ai_policy` fields `web_sources_allowed`, `course_sources_only`, `default_provider`, `retention_days`, `consent_record` are read by nothing (`migrations/20260923210000_intelligence_policy.sql:49-67`).
- Today's student path has no server-side tenant, course, source or user policy (`ai-policy-enforcement-map.md` §3 closing paragraph).

## Problem
For an account that belongs to a school with an AI policy, how is it guaranteed that no model sees data, and no tool reads data, that the tenant, course or person policy forbids?

## Decision drivers
1. Server-side evaluation before retrieval, tool and model call, with a decision record.
2. Policy applies equally on every door a managed account can reach.
3. Preserve student-owned device-key use for unmanaged accounts (`docs/architecture/0004`, `0001`).
4. Disclosure of student data to providers is a counsel question, not settled here.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Client-side advisory flags only (today for P5-P8) | No server change | A modified client skips them (`ai-policy-enforcement-map.md` §3 `E-C`) | Rejected for managed accounts |
| B. Route every AI call, consumer and managed, through the gateway; retire device keys | One enforcement point | Breaks the local-first "your own key" promise (`0004`); gateway not deployed (`EXT-018`) | Rejected |
| C. Managed accounts: server door only; device-key/proxy doors disabled when `profiles.school_id` has an AI policy other than allow; unmanaged unchanged | Targets the gap without removing individual use | Disabling is itself client-enforced for the device-key door | Chosen, with the limit stated |
| D. Provider-side data controls only | Simple | Not evidence of Semester policy | Rejected |

## Decision
**Recommended, unratified; no agent can accept it. Legal/counsel items are flagged below.**
1. A managed account's AI traffic uses the gateway or the shared-key function with a server tenant lookup; the shared-key function reads the account's school and the tenant kill row before activation and writes a decision row per request.
2. Lookup tools receive `aiAllows` and refuse categories the school turned off (grades, attendance, deadlines).
3. The gateway runs retrieval as the caller or calls `decide('ai.retrieve_source')` per person and course enrollment; add a classification tier to `approved_source`.
4. Audit every terminal outcome with the request correlation id (ADR-0003, `docs/architecture/0010`).
5. `confirm` re-checks tenant state, role and mode and uses server time.
6. Enforce or delete each stored `ai_policy` field.
7. Counsel (flagged): what the client-side door limit can claim; retention and provider disclosure for `retention_days`/`consent_record`.

## Consequences
Positive: policy holds on the shared-key route. Negative: managed students lose device-key AI unless the school allows it; a client-enforced limit remains for that door. Harder: adding a model path.

## Impact
- **Data / tenancy:** adds tenant lookup to the shared-key path (ADR-0002).
- **Security:** closes lookup bypass; keeps retrieval authorization per person.
- **Privacy:** reduces what reaches providers; classification enables DLP stages S4/S8 (`findings-ai.md` #8).
- **Accessibility:** refusal messages must be perceivable (ADR-0013).
- **Operations (SLO, alert, runbook, support):** re-run the kill-switch drill; the 2026-09-29 drill predates the 2026-10-01 activation gate (`findings-ai.md` #11).
- **Cost / commercial:** per-user budget absent (`findings-ai.md` #12).

## Implementation
1. `aiAllows` into `runLookups` (`converse.ts:668`, `lookup.ts`). 2. Tenant lookup and decision log in `supabase/functions/claude/index.ts` with kill-row read before activation. 3. Wire retrieval policy in `intelligence-repository.ts:160`. 4. Audit all outcomes in `intelligence.ts`. 5. Name tests for the 10 untested refusal codes.

## Tests and verification
- Managed account, school `aiOff: ['grades']`: `read_grades` lookup must be refused (fails today).
- Source id for a course the person is not enrolled in: `respond` must refuse and write an audit row (fails today).
- Shared-key request for a school with tenant kill row engaged: 503 (fails today; no tenant concept).
- `confirm` after tenant state set to off: refuse.
- Control: an unmanaged account's request passes unchanged.

## Fitness functions
- `ai-policy` (`scripts/architecture/ai-policy.mjs`): a provider-host fetch outside `supabase/functions/claude`, `app/server/institution/intelligence-*.ts`, `app/src/ai/providers/*`; a model-calling module without the kill-switch guard; newest `killswitch-drill-*.json` older than the activation gate; runs in `build`.
- `policy-gateway adoption`: ADR-0003.

## Rollback / reversal
Feature-flag the managed-account restriction; remove lookup refusal. Not cheap after schools rely on a policy being enforced.

## Open questions
- Whether `school.capabilities.aiOff` becomes server data (today client capability).
- Counsel: provider data-processing terms for managed accounts (not evidenced in repo).

## Addenda
(none)
