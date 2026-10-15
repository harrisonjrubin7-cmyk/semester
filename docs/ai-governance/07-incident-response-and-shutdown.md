# 07 · AI incident response and feature shutdown

**Builds on:** [`../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md)
(the response sequence, authority and communications; not repeated here), `supabase/functions/_shared/killswitch.ts`,
`app/src/lib/aikillswitch.test.ts`, `app/scripts/killswitch-drill.mjs`,
[`../engineering-operations/FEATURE-FLAG-AND-KILL-SWITCH-STANDARD.md`](../engineering-operations/FEATURE-FLAG-AND-KILL-SWITCH-STANDARD.md),
[`../CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md).

The runbook says what to do once an incident is open. This chapter is what it assumes and does not specify: **how much
of the product a switch can actually stop**, the ladder of shutdown levers, what makes an AI incident severe, and the
drills that would show it.

## What a server switch reaches today

`kill.ai_generation` is read by exactly two things: `supabase/functions/claude` (before the key is read) and the
institutional intelligence service (before policy is loaded and before anything is generated). Both fail closed: a
switch that cannot be read counts as engaged. Both are good designs.

The consumer app does not read it. `ask()` in `app/src/lib/claude.ts` is the single door out of the app, and nothing
in `claude.ts` or `openai.ts` mentions the switch; the client reads `feature_kill_switch` for dining, integration and
module gating and never for AI. So of five routes:

| Route | What it is | Stopped by `kill.ai_generation`? | Drill on file |
| --- | --- | --- | --- |
| `shared-key` | Browser → Semester function → Anthropic | **Yes** | 2026-09-29: answered 200, refused 503 with the runtime's own sentence, answered 200 after release; engaged 22:52:11, released 22:55:31 UTC |
| `institution-gateway` | Browser → school's gateway → OpenAI | **Yes** | None. The drill record says the gateway was not deployed and is held to the switch by tests |
| `device-key` | Browser → Anthropic with the student's own key | **No** | n/a |
| `device-key-openai` | Browser → OpenAI with the student's own key | **No** | n/a |
| `proxy` | Browser → a proxy the student configured | **No** | n/a |

`ai-systems.ts` records this as `KILL_REACH`, and a test fails if the consumer door starts mentioning the switch, so
the table cannot silently go stale in either direction. Every consumer feature (`AI-01.*`, `AI-03.*`) has these
three uncontained routes in addition to `shared-key`.

This is not a defect to be embarrassed by: a student calling their own provider with their own key is the student's
act, and the design preferred it on purpose ([`../architecture/0004-ai-through-a-metered-gateway.md`](../architecture/0004-ai-through-a-metered-gateway.md)).
It is a gap in what the runbook may claim. "Engage the global switch" stops two routes, and the runbook's
claim ceiling already says it does not claim universal containment; this chapter says which part is missing.

### The principle: enforcement follows the data

- **Institution-held data** (approved sources, course policy, tenant records) only ever leaves through the gateway, so
  the gateway can enforce completely, and the switch, budget and policy there are real controls.
- **Student-held data on the student's own device, sent under the student's own key**, cannot be enforced by
  Semester's servers. What Semester can do is stop *its own app* from sending, which is an app control and not a
  security boundary against a modified client.

So the design has two kinds of containment and says which a route has: **enforced** (`shared-key`,
`institution-gateway`) and **advisory** (the other three, through the client door).

### Making the client door honour the switch

**Decided 2026-10-04**, and held by `app/src/lib/aistatus.ts` and its test. `IR-01`. `ask()` consults a small signed **AI status** document before it sends: `{ killed, tenantStates, routesDisabled,
issuedAt, ttl }`. Fetched at launch and refreshed on a TTL, cached in memory.

| Account | Status unreachable or stale past TTL | Rationale |
| --- | --- | --- |
| Managed by a school with a policy | **Fail closed**: AI off, with the existing sentence | The school's policy is the contract; stale authority is not authority |
| Individual, no school | **Fail open with a visible banner** | The student's own key and own device; blocking on a Semester outage would punish the choice that avoided Semester |

A **last-known kill is never failed open from**, for either kind of account, until a fresh status releases it. An engaged status turns off all four consumer routes, `device-key` included, with
`KILLED_MESSAGE`. Tenant policy `allow_device_keys: false` ([chapter 08](08-tenant-ai-console.md)) makes a managed
account use `institution-gateway` only. The test that today forbids the consumer door from mentioning the switch is
the one to invert when this lands.

## The shutdown ladder

Engage the narrowest lever that reliably contains the problem; engage a broader one when scope or control integrity
is uncertain. Failure to read a lever is treated as engaged.

| Lever | Scope | Latency | Who can engage | Reaches | Exists |
| --- | --- | --- | --- | --- | --- |
| `S0` Tenant policy `state: off` | One tenant, all AI | Next request | Tenant AI admin, Semester | `institution-gateway` | Yes (`ai_policy`, `respond`) |
| `S1` Category switch (`aiOff`) | One tenant, one context block | Next request, via the school pack | Tenant AI admin | consumer context assembly | Yes (`aiflags.ts`) |
| `S2` Per-feature state | One feature, any scope | Next request | AI platform on-call | Gateway features | Designed (`GW-11`) |
| `S3` Per-tool disable | One tool, any scope | Next request | AI platform on-call, tenant admin | The tool broker | Designed (`TB-04`) |
| `S4` Route or provider breaker | One route, all tenants or one | Seconds, automatic or manual | On-call | Gateway routes | Designed (`GW-09`) |
| `S5` Tenant kill | One tenant | Next request | On-call, incident commander | `shared-key` (global only), `institution-gateway` | Yes for the gateway; `claude` passes `null` tenant, so only the global row stops it |
| `S6` Global kill | Everyone | Next request | On-call, incident commander | Two routes | Yes |
| `S7` Client door, AI status | Everyone or a tenant | TTL, minutes | On-call | The three uncontained routes | **No.** `IR-01` |
| `S8` Credential revocation | Every call on that credential | Seconds to minutes | Security | The shared key or a tenant key | Yes (process); drill not on file |
| `S9` Build flag (`VITE_AI_TOOLKIT=off`) | The toolkit | **Minutes to hours**: new build, and a cached service worker serves the old bundle | Release owner | Toolkit entry | Yes (`AI-TOOLKIT-FEATURE-FLAGS.md`) |

Two details of that table matter. **`S5` on the shared key is global-only today** because the function asks for a
tenant of `null`: the shared key serves individuals, and a school's row reaches only its own school
(`engagedFrom`). That is correct for the design and means a tenant-scoped incident on a managed account that uses the
shared key needs `S6`, or `S0`, not `S5`. **`S8` is the only lever that stops a compromised credential**, and it is not
a kill switch: it stops everything on the credential, including the legitimate use, and needs a rotation plan ready.

### Confirming must not outrun the switch

Containment means no AI-originated write runs. Until this change, `confirm` on the institutional gateway never
consulted the switch: an action prepared and reviewed before the switch was engaged could still be confirmed and
executed in the five minutes it lived, and `claim` consumed it before any refusal. The fix is in this change
(`intelligence.ts`, `confirm`): the switch is read **before** the claim, so a refusal leaves the action unspent and
a release inside its lifetime lets the reviewed confirmation run once. The test fails when the fix is reverted
(`expected 200 to be 503`: the write ran under an engaged switch). It is currently latent, because the runtime's
`execute` returns `{ verified: false }` and no action ships; it would have become live the day an adapter was wired.

## Severity, tied to tier

The runbook opens an incident on defined triggers and does not grade them. Grade them by the tier of the system
([chapter 01](01-inventory-and-risk-tiering.md)) and the nature of the harm. A tier 3 system's incident is never
below P1.

| Severity | Definition | Examples | Containment | First update |
| --- | --- | --- | --- | --- |
| **P0** | Confirmed harm to people or confirmed exposure of education records, across tenants or at scale; a prohibited decision made; an AI-originated write that cannot be reversed | Another tenant's source in an answer; a model output used as an eligibility or discipline determination; an executed consequential action the user did not review | Global or tenant kill within the hour of confirmation; `S8` if a credential is exposed | Per the `ai_quality` policy: four-hour maximum interval; privacy and security clocks may be shorter |
| **P1** | Probable exposure or a control failure with plausible harm; any tier 3 incident; a kill switch that cannot be read or does not hold | Canary token leaked; injection that changed a tool proposal; a provider silently changing retention; audit writes failing | Narrowest reliable lever now; broaden if scope unclear | Within the day |
| **P2** | Material quality or safety regression, contained to a feature | Citation-verified rate below threshold after a model change; refusal quality failing on a sensitive class; cost runaway | Feature state or route breaker; roll back | Within two days |
| **P3** | Individual wrong or poor output reported through feedback; no pattern | A fabricated source caught by the student | Fix, add the regression case | Weekly review |

**A credible safety concern justifies containment before impact is confirmed.** The runbook says so; the ladder is
what makes that cheap enough to do.

## Detection: signals and who owns them

None of these has an alert today. Each is a metric in [chapter 02](02-model-gateway.md) §Observability.

| Signal | Threshold, to be set from a baseline | Triggers |
| --- | --- | --- |
| Canary token from a system prompt or planted source appears in any output | Any | P1, `S4` for that route |
| A source id in an answer that is not in the request's retrieval set | Any | P0 candidate: cross-tenant until shown otherwise |
| Citation-verified rate | Drop beyond the confidence interval of the last release | P2 |
| Refusal rate by reason, by role | Step change in either direction | P2 |
| Schema-failure or invalid-response rate | Sustained rise | P2; provider or prompt drift |
| Tool proposals per user, rejected-to-confirmed ratio | Anomaly against that user's and tenant's baseline | P1 if injection suspected |
| Spend velocity | Above the tenant's projected rate | P2; at 100% the budget already stops generation |
| Injection-detector hits on ingested sources | Spike | P1; quarantine sources |
| Provider status, terms or retention page changes | Any | P1 review |
| **Audit write failure** | Any | **Refuse to generate on tier 2 and above** (`GW-16`): an AI action with no record is the worse failure |
| Kill-switch read failure | Any | Already fail-closed; page the on-call |

## Playbooks: first lever and exit criterion

| Class | First lever | Preserve | Exit criterion before release |
| --- | --- | --- | --- |
| Cross-tenant or education-record exposure | `S6` while scope is unknown, then `S5` | Audit records, retrieval-set hashes, provider request ids; no prompt bodies copied into the ticket | Root cause fixed; isolation test through the AI path passes; affected tenants notified through counsel's path |
| Prohibited or harmful output | `S2` for the feature, `S0` for affected tenants | The case as a regression input | The case is in the evaluation set and passes; refusal quality re-measured |
| Prompt or tool compromise | `S3` for the tool, `S4` if a route is implicated | Tool-proposal log, proposal hashes | Red-team retest of the exact vector and its neighbours; broker rejects it |
| Wrong action executed | `S3`, then roll back through the broker's inverse | The proposal, the preview shown, the receipt | Rollback verified by readback; why the preview did not prevent it understood |
| Provider outage | `S4` opens; failover only to a pre-approved route in the same data zone | Failover audit | Provider recovered and re-checked |
| Provider terms, retention or region change | `S4` for that route | The old and new text | Counsel and privacy decision; tenant notice if their data was affected |
| Cost runaway | Budget stop (exists), `S2` | Spend curve | Cause fixed; ceiling reset by a named owner |
| Quality drift after a model or prompt change | Roll back the route version | Eval artifacts of both versions | Regression passes at or above the last release |
| Abuse of the assistant | Per-user rate limit, then account action through Support | Rate-limit log | Policy applied; no collateral lockout |

**Freeze, do not delete.** Engagement freezes a capability and keeps evidence. Retention and legal-hold rules decide
what is kept; the incident record carries identifiers and hashes, not student content.

## Recovery

Release is by ring, never all at once: the incident tenant's sandbox, then a canary cohort, then the tenant. A
production or customer release needs **two-person review** (the runbook's rule). The second reviewer is `UNASSIGNED`
for every system, so **no release of a production or customer kill is possible today**. That is a staffing fact, not
a design gap, and it blocks recovery more reliably than any technical control: until a second person exists, an
engaged switch is a one-way door.

## Drills

A switch with no drill is a note in a register. The standard, per route:

| Drill | Cadence | Pass |
| --- | --- | --- |
| Kill-switch: before answered, during refused with the runtime's sentence, after answered, each step timed | Per route per quarter, and after any change to a route's door | All three steps as expected; engage-to-refusal timed against a target the owner sets from the first run |
| **Institutional gateway**, deployed | Before the first tenant | Same, against the deployed service. Not done: it is not deployed |
| **Client door** (after `IR-01`) | Per quarter | An engaged status makes `device-key` refuse; a stale status for a managed account fails closed |
| Switch-read failure | Twice a year, in staging | Induced read failure engages the switch; the page fires |
| Audit-write failure | Twice a year, in staging | Generation refuses on tier 2+; the page fires |
| Credential rotation (`S8`) | Twice a year | Rotation completes inside the target with no dropped managed tenant |
| Tabletop, one P0 and one P1 | Twice a year | Roles filled by named people; comms drafted from the approved template; second reviewer present |

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `IR-01` | The client door honours a signed AI status, fail-closed for managed accounts | **decision tested** (`aistatus.ts`, three mutations caught); the signed status endpoint and the wiring into `ask()` are not started |
| `IR-02` | `confirm` reads the switch before the claim | **tested** (this change) |
| `IR-03` | Severity is graded by tier; tier 3 is never below P1 | designed |
| `IR-04` | Every signal above has an alert with an owner and a threshold set from a baseline | not started |
| `IR-05` | Audit-write failure refuses generation at tier 2 and above | **tested on the generation path** (`audit-unavailable`); the confirm path needs a write-ahead audit, not started |
| `IR-06` | Kill-switch drill on the deployed institutional gateway before the first tenant | not started: not deployed |
| `IR-07` | Kill-switch drill on every route per quarter, results filed under `docs/evidence/ai/` | one drill, one route |
| `IR-08` | A second named release reviewer for every system | **blocked**: seats unassigned |
| `IR-09` | Per-feature and per-tool levers (`S2`, `S3`) | designed (`GW-11`, `TB-04`) |
| `IR-10` | Every incident adds a regression case and an inventory and risk-register update before release | designed (runbook step 7); not mechanised |
