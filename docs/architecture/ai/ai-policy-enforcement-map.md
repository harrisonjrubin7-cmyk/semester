# AI policy enforcement map

| | |
| --- | --- |
| Purpose | For every path by which a model is invoked or AI context is built: which policy layers are evaluated **before** retrieval, model call, tool invocation and action proposal; where; with what evidence and test; and what is missing. |
| Scope | `supabase/functions/`, `app/server/`, `app/api/`, `packages/*`, `app/src/` (AI surfaces), `supabase/migrations/` and `supabase/*.check.sql` for AI policy. No deployed environment was inspected. |
| Date | 2026-10-04, repo at `origin/main` 4adb8cc |
| Status | Phase 0 baseline — evidence-cited, not a readiness claim |

Read with, not instead of: [`docs/ai-governance/`](../../ai-governance/README.md) (design and gap list, 4 Oct), [`docs/trust/AI-SYSTEM-INVENTORY.md`](../../trust/AI-SYSTEM-INVENTORY.md) (family baseline), `app/src/lib/governance/ai-systems.ts` (census of doors and systems, guarded by `ai-systems.test.ts`), [ADR 0004](../0004-ai-through-a-metered-gateway.md), [ADR 0007](../0007-policy-decision-point.md), [`docs/legal/AI-USE-POLICY-DRAFT.md`](../../legal/AI-USE-POLICY-DRAFT.md). Those are claims; this file checks them against code and says where they are right, stale or silent.

## Method (commands run)

```
git fetch origin main; git log --oneline -30 origin/main      # nothing on main duplicates this map; last AI commits: fb555b7 (#1231 dollar meter), 046706a
grep -rliE "anthropic|openai|api\.anthropic|/v1/messages|embedding" (ts,tsx,sql,json,mjs,js; excl. node_modules,dist)
grep -rnE "api\.anthropic\.com|api\.openai\.com|functions/v1/claude|/v1/intelligence" app/src
grep -rlE "import[^;]*\bask\b[^;]*from '...claude'" app/src (non-test)   # 25 files call ask()
grep -rn "decide(" app/server packages/institution/src (non-test)       # PDP callers
grep -rniE "embedding|pgvector|vector\(" supabase/migrations app packages  # none in AI path
for each refusal code in app/server/institution/intelligence.ts: grep -rl "<code>" *.test.ts   # denial-path test coverage
```
Read in full: `supabase/functions/claude/index.ts`, `_shared/{clamp,killswitch,provideractivation}.ts`, `app/server/institution/{intelligence,intelligence-runtime,intelligence-repository}.ts`, `providers/openai.ts`, `packages/institution/src/{intelligence,agents,course-agent-policy}.ts`, migrations `20260923210000_intelligence_policy`, `20260924163000_intelligence_provider_runtime`, `20261004170000_ai_spend_meter`. Skimmed: `app/src/ai/converse.ts`, `lib/{claude,assistant,context,lookup,tools,aiflags,aistatus}.ts`, `lib/governance/ai-systems.ts`.

## 1. The audit memo's question, answered

> "Tenant AI policy may not be enforced at actual model invocation."

**Refuted for one path, confirmed for every other.**

*Refuted — institution gateway (`POST /v1/intelligence/respond`).* `respond()` in `app/server/institution/intelligence.ts` evaluates, in this order and all before `input.generate` (line 234): identity-vs-body scope (126), tenant `state === 'off'` (131), permitted role (138), tenant `allowedModes` (141), agent action class (147), source approval (150–157), source policy scope (159–176), per-course `course_ai_rules` modes (183–189), model allow-list and per-request cost (200), atomic budget reservation (222–231). Tenant values are loaded server-side with the service key from `tenant_feature_policy`, `ai_policy`, `feature_cohort_members`, `approved_source`, `course_ai_rules` (`intelligence-repository.ts:74–194`); the request's `clientState` is parsed and ignored (`intelligence.ts:129–130`). The kill switch is asked first, in `createIntelligenceService.respond` (441). Tests: `intelligence.test.ts` ("refuses missing source approval before a provider sees the question", "does not call a provider after an atomic budget refusal", "reserves tenant budget before provider work…" asserting order `reserve, generate, settle`).

*Confirmed — everything else.* The gateway is one door of five (`ai-systems.ts:34 ROUTES`, `KILL_REACH` 42–48). In `app/src/lib/claude.ts:886 ask()`, which 25 non-test files import and which carries every study, drafting, import, planning and reading feature, there is **no read of tenant policy, `ai_policy`, `tenant_feature_policy`, the kill switch, `aistatus.decideDoor`, or consent** (`grep -n "gatewayConfigured|tenant|killswitch|decideDoor" app/src/lib/claude.ts app/src/lib/openai.ts` → no matches). `decideDoor` (`app/src/lib/aistatus.ts:53`) has no caller outside its test. That holds **even in a build with `VITE_UNIVERSITY_GATEWAY_URL` set**: only `app/src/ai/converse.ts:226,484` (the Ask assistant) and `app/src/components/ProductivityPreparation.tsx:219` branch to the gateway; the other callers go straight to `ask()`. A school that sets `tenant_feature_policy.state = 'off'` stops the Ask assistant and nothing else. The shared-key function (`supabase/functions/claude/index.ts`) has no tenant concept at all: it passes `aiGenerationKilled(admin, null)` (132), so a school's own kill-switch row cannot reach it (`killswitch.ts:44–49`; stated at `index.ts:128–131`).

*Also not enforced inside the gateway, though stored:* `ai_policy.web_sources_allowed`, `.course_sources_only`, `.default_provider`, `.retention_days` (loaded as `retentionDays`, read by nothing else: `grep -rn retentionDays app/server` → only the repository and the disabled stub), and `consent_record` (`grep -rn "consent_record\|consentIds" app/server packages/institution/src` → only `integration/worker.ts`). Feature states `preview`, `sandbox` and `production` are all treated alike; only `off` blocks (`intelligence.ts:131`). The repo's own `docs/ai-governance/02-model-gateway.md` S1 row says "built, except feature state", consistent.

## 2. Invocation paths

| ID | Path | Entry code | Provider | Who holds the key | Classification |
| --- | --- | --- | --- | --- | --- |
| P1 | Shared-key function | `supabase/functions/claude/index.ts:60` | Anthropic | Semester (function secret) | `PARTIAL` |
| P2 | Institution gateway `respond` | `app/server/institution/intelligence.ts:124`; wired `intelligence-runtime.ts:35`, `start.ts:214`, `runtime.ts:54` | OpenAI only (`intelligence-runtime.ts:37`) | Institution/Semester server env `OPENAI_API_KEY` | `PARTIAL` |
| P3 | Institution gateway `policy` (no model; gates the UI) | `intelligence.ts:425` | none | n/a | `PARTIAL` |
| P4 | Institution action `confirm` | `intelligence.ts:473`, `confirmAction` 337 | none (a write) | n/a | `PARTIAL` (execute stubbed: `intelligence-runtime.ts:72`) |
| P5 | Consumer door, student's own Anthropic key, browser to provider | `app/src/lib/claude.ts:886,960` (`anthropic-dangerous-direct-browser-access`) | Anthropic | Student device | `OPERATIONAL-UNDER-GOVERNED` |
| P6 | Consumer door, student's own OpenAI key | `app/src/lib/openai.ts:182` | OpenAI | Student device | `OPERATIONAL-UNDER-GOVERNED` |
| P7 | Consumer door via a user- or build-set proxy; dev-server proxy | `claude.ts:956` (`proxy`); `app/vite.config.ts:415` (dev only) | Anthropic | Whoever runs the proxy | `OPERATIONAL-UNDER-GOVERNED` |
| P8 | Ask assistant tool loop: context build, read-only lookups, proposals | `app/src/ai/converse.ts:420–700`; `lib/context.ts:252`; `lib/lookup.ts`; `lib/tools.ts` | via P1/P5/P6/P7, or P2 when governed | n/a | `PARTIAL` |
| P9 | Productivity preparation (dual path) | `app/src/components/ProductivityPreparation.tsx:219,243` | P2 if gateway configured, else `ask()` | n/a | `PARTIAL` |
| P10 | Server-side web search tool inside `ask()` | `lib/research.ts:54,69`; clamp `clamp.ts:155` | Anthropic server tool | per route | `OPERATIONAL-UNDER-GOVERNED` |
| P11 | Authoring-time operator script | `pipeline/restyle-script.mjs:23,98` | Anthropic SDK | Operator env | `UNKNOWN-INVESTIGATE` (not read beyond its header; not a student path) |
| P12 | Retrieval (source selection) | `intelligence-repository.ts:160` loader; `packages/institution/src/retrieval.ts` | none | n/a | loader `PARTIAL`; `retrieval.ts` policy `DOCUMENTED-UNIMPLEMENTED` (pure, "not wired", header lines 25–28) |

Measured: no embedding, vector, chunk-ranking or semantic index exists in the AI path (`grep` above). "Semantic source search" in P9 is a prompt asking the model to return source ids. Retrieval in P2 is exact-id lookup of tenant-approved rows.

Deployment state (claims, not verified here): ADR 0004 says the gateway function is "written, tested, and not deployed"; `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json` says it exercised `supabase/functions/claude` as "the deployed runtime" on 2026-09-29 and records the institution gateway as "not deployed". The activation record is entirely `pending-owner` (`_shared/provideractivation.ts` `SHARED_PROVIDER`; no `docs/evidence/vendors/` directory exists), and the function returns 501 before reading the key until it is recorded (`index.ts:84–88`). The activation gate landed after the drill (file's first appearance in merge 2621c80, 2026-10-01), so the drill evidences the switch, not the current gated behaviour. Whether either is live today is **not established from the repo**.

## 3. Policy layers by path (before retrieval / model call / tool / proposal)

`E-S` enforced server-side before the call; `E-C` enforced client-side only (advisory: a modified client skips it); `—` not evaluated; `n/a` not applicable to the path.

| Layer | P1 shared-key | P2 institution respond | P4 confirm | P5/P6 device key | P7 proxy | P8/P9 client loop |
| --- | --- | --- | --- | --- | --- | --- |
| **Global** (platform) | E-S: activation gate `index.ts:84`; global kill row `:132`; fail-closed on read error `killswitch.ts:44` | E-S: global kill row `intelligence.ts:441` + `repository.ts:60–72` | E-S: kill checked before the claim, `intelligence.ts:478` | — (`KILL_REACH` = none, `ai-systems.ts:42–48`) | — | — |
| **Tenant** (`school`/`institution`; column `tenant_id`, text, FK `schools(id)`) | — (no tenant concept; individual accounts) | E-S: state off, roles, modes, cohort, providers, budget, tenant kill row (`intelligence.ts:131–141`; `repository.ts:74–143`). Not enforced: `web_sources_allowed`, `course_sources_only`, `default_provider`, `retention_days`, consent, preview vs production | scope only (`intelligence.ts:339–342`); **tenant state/role/mode not re-evaluated at confirm** | — | — | E-C only: `school.capabilities.aiOff` category list drops blocks from the preamble (`converse.ts:440`; `aiflags.ts`) |
| **Module** | — (no module dimension) | — | — | — | — | — (`module_mode.sql:46` only lists `kill.ai_generation` as a switch key) |
| **Course** | — | E-S: `course_ai_rules` modes per source scope; unknown policy = explain/hint/practice only (`intelligence.ts:177–189`; `course-agent-policy.ts:9–14`); tutor/course-guide require exactly one course (166–169) | — | — | — | E-C: `tutorPolicy` of the student-recorded course policy (`converse.ts:322`); `course-off` still permits sending (`canSend`, 978); refusal is by prompt text |
| **User** | E-S: JWT (`index.ts:119`); per-account call cap 60/month (`MONTHLY_CALLS`, `count_call`); per-account dollar allowance | E-S: verified identity, `scope-refused` on mismatch (126); release-cohort membership per person (`repository.ts:109–122`); per-identity rate limit (`gateway.ts:306`); **no per-user budget** | E-S: single-use claim by tenant+person (`action-store`), 5-minute expiry | — | — | — |
| **Model** | E-S: `ALLOWED_MODELS` and per-plan `PLAN_MODELS`; unknown plan = free (`clamp.ts:41–62`; `index.ts:149–184`) | E-S: `SEMESTER_AI_PROVIDERS` config ∩ `ai_policy.allowed_providers` by provider prefix; cheapest allowed (`repository.ts:129–132`; `chooseModel` `intelligence.ts` pkg 144–160). Version is not pinned | n/a | — (any model the student types) | — | — |
| **Source** | — (client sends arbitrary messages; no source concept) | E-S: every id must exist in `approved_source` for the tenant and not be `prohibited` (`repository.ts:163–168`); unbound or unscoped sources refused (`intelligence.ts:161`). **Not checked: that this person is enrolled in the source's course, or any data classification** (`approved_source` has no tier; any tenant member can read ids via the `"school members read approved sources"` policy) | n/a | — | — | E-C: `lib/context.ts` allowlist of fields (`PICK`) and `assembleIntelligenceRequest` drop non-visible evidence (`intelligence/assemble.ts`) |
| **Tool** | E-S: clamp keeps only client-defined tools (name + schema) and web search capped at 5; drops code execution, fetch, MCP (`clamp.ts:141–166`) | n/a (no model tool loop; JSON-schema answer, `providers/openai.ts:99–113`) | E-S: non-assistant agents may only `prepare` (`intelligence.ts:147`); `execute` returns `{verified:false}` | — | — | E-C: per-agent allow-list `agentAllows` (`packages/institution/src/agents.ts:28`), re-checked in `onToolUse` (`converse.ts:609`). **Lookups ignored `aiOff`** at the 4 Oct baseline (`runLookups(wants,{state,catalog,now})` took no school capabilities). Fixed 4 Oct in Phase 1 step 3: `Source.off` is passed from `school.capabilities.aiOff` and `find_deadlines`, `read_grades`, `read_attendance` and `search_material` refuse when their category is off (`lib/lookup.ts`, tests in `lib/lookup.test.ts`); `read_tasks` and `read_timetable` have no category. Client-side only, so still advisory |
| **Budget** | E-S: reserve worst case then settle in micro-dollars (`add_spend`, `20261004170000_ai_spend_meter.sql:53`) + call count; meter failure refuses | E-S: `reserve_ai_budget` row-locked against `ai_policy.monthly_budget_cents`; budget ≤ 0 refuses (`…provider_runtime.sql:57–94`); actual > reserved discards the answer (settle returns false) | n/a | — (student's own bill; client ledger `lib/spend.ts` is display only) | — | — |

Reading the table: the only column with every server-side layer is P2, and P2 is the path no student uses until a school deploys a gateway (`ai-systems.ts:93`, `university.ts` DOOR-4 note). The path a student uses today (P5, or P1 if activated) has none of tenant, course, source or user policy server-side.

## 4. Decision logging, denial tests, content controls

| Path | Decision log | Denial paths with a test | Prompt-injection / DLP / redaction | Risk tier (`ai-systems.ts`) |
| --- | --- | --- | --- | --- |
| P1 | No decision row. Counters only: `usage` row `calls`, `usage.cost_micros`. Refusals, clamped/dropped fields (`clamped.dropped`) and plan are not recorded; `console.warn/error` only | `claudeclamp.test.ts` (17), `aispend.test.ts` (25), `sharedkey.test.ts` (12), `aikillswitch.test.ts` (10), `killswitchdrill.test.ts` (5), `supabase/ai-spend.check.sql` (DB). No test drives the function end to end against a denied tenant (there is no tenant) | Request clamp bounds shape and cost, not content. No scan of messages, no output guard, no redaction | Systems AI-01.x/03.x tiers 1–3, all via DOOR-1 |
| P2 | `private.gateway_intelligence_audit` (`20260924184500_gateway_action_journal.sql:34`) via `PostgresActionJournal.auditIntelligence` (`postgres-journal.ts:141`): category, provider, model, tokens, cost, `policy_decision`, action id, confirmation; no bodies, **no correlation id, no reason code for most denials**. Written only for: `policy-disabled`, `kill-switch`, `provider-refused`, success (`state:agent:mode`), `confirmation-required`, `confirmed-and-read-back`. **Not written for:** `scope-refused`, `role-disabled`, `mode-disabled`, `agent-action-refused`, `source-not-approved`, `source-scope-unverified`, `course-*`, `model-unavailable`, `budget-*`, `cost-ceiling-exceeded`, `invalid-provider-response`, `usage-not-recorded` (audit calls at `intelligence.ts` 132, 239, 312, 354, 373, 415 only). Success audit is a precondition of returning the answer (321–323). Gateway telemetry logs route, status, correlation id (`gateway.ts:110`, emitted at 671) but not the decision | `intelligence.test.ts` (22), `intelligence-course-policy.test.ts` (16), `intelligence-runtime.test.ts` (3), `intelligence-repository.test.ts` (6), `providers/openai.test.ts` (4), `supabase/intelligence-policy.check.sql`, `approved-source-policy-scope.check.sql`. **No test names:** `scope-refused`, tenant `mode-disabled`, `course-scope-mismatch`, `model-unavailable`, `budget-unavailable`, `invalid-provider-response`, `cost-ceiling-exceeded`, `usage-not-recorded`, `authoritative-readback-required`, `action-not-found` (grep of each code string over `*.test.ts`; `mode-disabled` only matches inside `course-mode-disabled`) | Sources travel as JSON in the user turn; developer turn states they are data (`providers/openai.ts:38–41,52–75`); strict JSON schema; every cited id must be a requested source (146–151; `intelligence.ts:253–271`); `store:false` (`openai.ts:97`). **No redaction or PII/secret scan of `question` or source bodies** (`grep -niE "redact|dlp|pii|mask"` over the gateway files → none; doc 02 stages S4/S8 "not started"). Held by `ai/injection.test.ts` (structural) | AI-02.1 tier 3, effective 2 because execute is stubbed (`ai-systems.ts:191–198`) |
| P4 | Audit rows `confirmation-required` (refused) and `confirmed-and-read-back` | `intelligence.test.ts`: "cannot apply a consequential action without a fresh explicit confirmation", "creates a receipt only after authoritative readback", "refuses to confirm an action reviewed before kill.ai_generation was engaged, and leaves it unspent" | n/a | action tier E designed, none live |
| P5–P7 | None server-side. Client ledger in `localStorage` (`lib/spend.ts`) | `aistatus.test.ts` tests the unwired decision only | Fence + `DATA_RULE` around untrusted material (`app/src/ai/untrusted.ts`), `injection.test.ts` (11), live red-team `docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json` (21 cases, run through the shared-key proxy; the first case reads `followed: false`; I did not tally all 21). Allowlist of what leaves the device: `lib/context.ts` | AI-01.1 tier 3, others 1–2 |
| P8 | None server-side; proposals shown to the student, undo recorded on the proposal (`lib/tools.ts` header) | `lib/aiflags.test.ts` tests the switch function; no test that a lookup honours `aiOff` | Same fence; lookups bounded by `MOST_LOOKUPS` | AI-01.1 `agentLoop: true`, tier 3, `reconcile` text records that grades/attendance reach the model on consumer routes |

## 5. Human confirmation, prohibited actions, kill switches, budgets

**Human confirmation.**
- Consumer assistant (P8): a model tool call becomes a `Proposal` card; nothing executes without a press (`lib/tools.ts` header; `ai/Actions.tsx:69` `onRun`). View-type proposals on the current screen are dropped, not auto-run (`converse.ts:627`).
- Institution (P4): proposals are **supplied by the client** in the request (`parseIntelligenceGatewayRequest` `proposedActions`, `packages/institution/src/intelligence.ts:103–126`); the model does not produce them (the live client sends `proposedActions: []`, `converse.ts:497`). Server saves, issues a single-use id with a 5-minute expiry (`intelligence.ts:456–468`), and on confirm requires `confirmed:true` with an `at` timestamp **supplied by the client** within 5 minutes (`confirmAction` 344–350). Freshness therefore rests on the client's clock; the claim-once store and expiry are the server-side bounds.

**Prohibited autonomous actions (grades, enrolment, finance, permissions, external messages, purchases).** No code path found that lets a model perform any of them.
- Client tool registry (`lib/tools.ts:108` `TOOLS`): `tick_deadline, add_task, move_task, mark_attendance, start_timer, add_note, add_source, add_application, set_look, set_day_budget, move_application, set_next_step, make_document, make_sheet, save_equation, open_screen`. None touches a grade, grading scale, enrolment, payment, permission or outbound message; the file's header says nothing deletes and no grade tool exists. `mark_attendance` edits the student's own attendance log.
- Institution runtime: `execute: async () => ({ verified: false })` (`intelligence-runtime.ts:72`), so every confirm ends `authoritative-readback-required` (502). The class `consequential` is accepted by the parser and storable, but cannot run.
- Email: `components/mail/Compose.tsx:127` calls `ask()` to draft into a text box. I did not trace the send path; it was not shown to be model-triggered.
- Enforcement is by registry and by absence of code, not by a policy engine: ADR 0007's `decide()` has one caller outside tests, `app/server/productivity/service.ts:380`, and the `ai.retrieve_source` rule (`packages/institution/src/policy.ts:75,272`) is not called from the AI path (`grep -rn "ai.retrieve_source" app/server` → none).

**Kill switches** (`feature_kill_switch`, key `kill.ai_generation`; created in `20260927170000_integration_control_plane.sql:108`).

| Route | Reaches | Evidence |
| --- | --- | --- |
| P1 shared-key | global row only | code `killswitch.ts`; drill file 2026-09-29 (engaged 22:52:11, released 22:55:31, 200 → 503 → 200) |
| P2/P3/P4 institution | global and the school's own row | code `intelligence-repository.ts:60–72`; test `aikillswitch.test.ts`, `intelligence.test.ts`; drill file says "not deployed", no drill on file (`KILL_DRILLS`, `ai-systems.ts:51`) |
| P5/P6/P7 device key, OpenAI key, proxy | nothing | `KILL_REACH` = none; the app-side stopper `aistatus.decideDoor` is unwired and its own header says it is an app control, not a security boundary |
| Dev proxy (`vite.config.ts:415`) | nothing; forwards the body without the clamp | dev only |

**Cost budgets: where enforced.**

| Route | Locus | Mechanism |
| --- | --- | --- |
| P1 | Server | `count_call` (60/month, atomic) and `add_spend` dollar reservation per plan (Free $0.75, Plus $2.00, Pro $4.00: `_shared/aispend.ts:258–264`, D-1231, stated there as proposals) |
| P2 | Server | per-tenant monthly budget, per-request ceiling `SEMESTER_AI_MAX_REQUEST_CENTS`; the reservation is a **configured constant** `SEMESTER_AI_ESTIMATED_REQUEST_CENTS`, not derived from the request size (`intelligence-runtime.ts:53–59`) |
| P5–P7 | Client display only | `lib/spend.ts`; the student's own provider quota is the only limit |

## 6. Gaps (each is in `findings-ai.md` with severity)

1. Tenant AI policy (state, roles, modes, providers, budget, kill row) reaches only P2; all other consumer model calls, including every non-Ask feature in a gateway-configured build, ignore it.
2. School `aiOff` categories (client-side) are bypassed by the lookup tools in the Ask assistant.
3. Per-person source authorisation and data classification are absent in P2; `retrieval.ts` and the PDP rule `ai.retrieve_source` exist and are unwired.
4. Stored policy fields with no consumer: `web_sources_allowed`, `course_sources_only`, `default_provider`, `retention_days`, `consent_record`.
5. P2 audits only 6 of ~22 outcomes; most denials leave no record; no correlation id on the audit row.
6. P1 has no decision log and no tenant dimension; a school cannot stop or constrain it.
7. Source bodies are fetched (`loadApprovedSources`) before tenant policy is evaluated (`intelligence.ts:446–448` precede `respond()`'s checks); no model sees them, but "authorise before retrieval" is not literally true.
8. `confirm` re-checks kill switch and identity, not tenant policy or role.
9. No redaction, DLP or output scan on any path; injection control is structural plus one dated live red-team through P1.
10. Ten denial codes have no named test.

## Open questions / not verified

- Whether `supabase/functions/claude` or any institution gateway is deployed, and with which env (`SHARED_AI_PROVIDER`, `SEMESTER_AI_PROVIDERS`, `OPENAI_API_KEY`, `SEMESTER_AI_RUNTIME_STATUS`). The repo cannot say.
- Live database state of `ai_policy`, `tenant_feature_policy`, `feature_kill_switch` and whether `supabase/*.check.sql` have been run against a real project. I ran no check.
- I did not run the test suite; denial-test coverage is by grep of code strings, which can miss a test that asserts by status only.
- `pipeline/restyle-script.mjs` (P11) and the email send path were not traced.
- `docs/evidence/ai/injection-redteam-…json` per-case results beyond the first were not tallied.
- Whether the OpenAI strict-JSON schema and `store:false` satisfy any retention commitment is a question for counsel and the provider contract (`docs/trust/PROVIDER-TERMS.md`).
- Whether the draft policy statement "A school can choose which AI providers are allowed, set a budget, or switch AI off" (`docs/legal/AI-USE-POLICY-DRAFT.md` §5) is accurate for consumer routes is for counsel; the code shows it holds for P2 only.
