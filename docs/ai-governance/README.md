# AI governance architecture

**Status: design and guard. Not an approval, not a claim about any deployed environment.**
Written against `origin/main` on 4 October 2026. Nothing here activates a feature, signs a provider, names an owner or
makes a legal conclusion. Human and counsel review of this design is still owed.

The brief: build Semester's AI platform so every assistant, tutor, advisor, writer, study tool and automation is
helpful, policy-bound, source-aware, evaluated, private and operationally governed, and **never allow AI to make an
unreviewed high-impact decision or bypass a policy boundary.**

## What this is, and what main already had

Main already carries the governance *spine* as controlled drafts dated 3 October: a four-family inventory, a
12-risk register, a human-oversight standard, a transparency standard, a data-use standard, an incident and
kill-switch runbook, change management, and the lifecycle gates `G0`–`G5` in code. They are honest baselines with
"claim ceilings", and they list what is unproven. **This change does not restate them.** It adds what they say is
missing: the **target architecture** (a gateway, retrieval, a tool broker), the **requirements** for seven
features and a tenant console, an **evaluation framework** with thresholds, a **red-team and gate-by-tier** scheme, and
the first **machine-checked** inventory below family level.

Each chapter opens by naming what it builds on, states what exists **as verified in the code**, and ends with
numbered requirements carrying one of `tested`, `built`, `partial`, `designed` or `not started`, in the repository's own
vocabulary. A `designed` row cites this document and nothing else.

## Relationship to the target-architecture pack

[`../target-architecture/`](../target-architecture/README.md) (#1144) places `services/ai-gateway` as its own
deployable (decision P-09), with a provider interface, per-tenant allow-list, zone and cost caps, a retrieval broker,
redaction, an output guard, a tool broker and an event log, and lists "AI policy + injection suite gating" in the exit gate of
its milestone M1. **These chapters are the detailed design inside that box**, and agree with it on every point it
makes: the model holds no credential and no tool a user could not call; consequential calls become proposals a human
confirms; the student's-own-key mode is a client-only path that never touches tenant data; evaluation is a release
gate; region is fixed at onboarding. Where this goes further:

- it reports that the "provider interface" is **two incompatible doors today**, so P-09 is a convergence and not an
  extraction (chapter 02);
- it says what the client-only path *cannot* be made to do, and designs the advisory containment around it (chapter 07);
- it specifies the retrieval, broker, evaluation and gate details P-09 names without defining;
- region and zones stay open on P-12; chapter 02 specifies the field and the refusal and chooses no zone.

Phases 1 and 2 below are the AI half of M1; nothing here changes the pack's milestones.

## The seven laws

1. **Policy before model.** Nothing reaches a provider that a policy decision did not clear, including on routes the
   server cannot see.
2. **Enforcement follows the data.** Institution-held data leaves only through the gateway, which can enforce. Data a
   student sends under their own key is governed by notice and a client door, and is honestly called advisory.
3. **Every source is authorised, scoped, dated and cited.** A claim without one is labelled general knowledge.
4. **Model output is untrusted input.** Validated, cited by ids Semester verifies, never executed.
5. **Models propose; typed code validates; people commit; the system verifies and can undo.** No decision about a
   person, ever, and the refusal is at intake, not in a prompt.
6. **Every route has an off switch that reaches it, and a drill on file.** A switch that reaches two of five routes is
   described as that.
7. **No release without evidence at its tier, and evidence expires.** The person can see, correct, delete, and leave
   for a path with no AI in it.

## The ten deliverables

| # | Deliverable | Chapter | Already on main | This change adds |
| --- | --- | --- | --- | --- |
| 1 | Inventory and risk tiering | [01](01-inventory-and-risk-tiering.md) | Family baseline; tiers 0–4, A–E, H0–H4, T0–T6 | A crosswalk of the four scales; the placement rule; **nine child systems and four doors, with a census test**; kill reach per route |
| 2 | Model gateway | [02](02-model-gateway.md) | Two gateways; reserve and settle budgets; the `respond()` pipeline | One contract, route table, failover rules, data zone, cost layers, observability, build order |
| 3 | Retrieval policy | [03](03-retrieval-policy.md) | Approved-source checks; scope binding; course policy; separation of material | The retrieval contract; authority, freshness, minimisation, redaction; ten-layer injection resistance |
| 4 | Tool broker | [04](04-tool-broker.md) | Consumer proposals with inverses; server prepare and confirm; the automation ladder | One typed registry; server-rendered, hash-bound previews; **approval distinct from confirmation**; rollback classes; limits |
| 5 | Feature requirements | [05](05-feature-requirements.md) | Four roles with instructions and policy modes | Seven features in one frame, including a **support assistant that does not exist** |
| 6 | Evaluation framework | [06](06-evaluation-framework.md) | A 15-case deterministic set; structural injection suite; one live run | Ten dimensions with proposed bars by tier, graders, datasets, pipeline, evidence |
| 7 | Incident response and shutdown | [07](07-incident-response-and-shutdown.md) | The runbook; the kill switch; one drill | A shutdown ladder of ten levers; severity by tier; signals; playbooks; drills |
| 8 | Tenant AI console | [08](08-tenant-ai-console.md) | `ai_policy`, the Configuration Studio, `aiOff` | One policy model; thirteen sections; ten things it cannot do; simulation |
| 9 | User-facing transparency | [09](09-user-transparency.md) | The standard and template; route label; policy-state notice | Twelve states, a report path, data controls, escalation, accessibility |
| 10 | Red-team and launch gates | [10](10-red-team-and-launch-gates.md) | Lifecycle gates; the release gate | Gates by tier **held by a test**; rings; waivers; sixteen suites |

## What was verified in the code

Found while reading, each confirmed before it was written down. Two were fixed here with a control; the rest are
specified.

| # | Finding | Where | Disposition |
| --- | --- | --- | --- |
| 1 | **`confirm` never read the kill switch.** An action reviewed before the switch was engaged could still be confirmed and run within its five minutes, and the claim consumed it before any refusal | `app/server/institution/intelligence.ts` | **Fixed**: read before the claim, so a refusal leaves the action unspent. Test fails on a revert (`expected 200 to be 503`) |
| 2 | **The institutional instruction turn never told the model its sources are data.** Structure was already tested (JSON, schema-locked output); the sentence that gives the structure meaning was missing | `app/server/institution/providers/openai.ts` | **Fixed**: `SOURCE_DATA_RULE`. Test fails when the sentence is dropped from the instruction while the constant remains |
| 3 | A server kill switch reaches **two of five routes**; the consumer door never reads it; a student's own key is called from the browser | `app/src/lib/claude.ts` | Specified (`IR-01`); **pinned by a test** so the claim cannot go stale either way |
| 4 | Two gateways, two providers (the institutional runtime refuses anything not `openai:`), no shared contract, **no failover, no region field anywhere** | `intelligence-runtime.ts`, `chooseModel`, `ai_policy` | Specified (chapter 02) |
| 5 | `verifiedAt` is the row's `updated_at`, not a verification; `authority` is read and dropped; whole source bodies go unbounded before the call; no classification column; the data-class gate is not on the server | `intelligence-repository.ts`, `approved_source` | Specified (chapter 03) |
| 6 | Server actions carry free-text `label`, `effect` and `target` from the client; no typed preview binds to what runs; no model-driven tools on this path; `execute` is stubbed | `intelligence.ts`, `intelligence-runtime.ts` | Specified (chapter 04) |
| 7 | **`ai_policy` is writable in one statement by one `ai:configure` holder.** The reviewed store (the Studio) is read by nothing; three vocabularies for the same policy | the policy migration; `lib/config/studio.ts` | Specified (chapter 08) |
| 8 | The only live red-team is 21 cases (7 surfaces × 3 goals), route `shared-key`, one day. No institutional route, tool, leakage, bias or crisis suite | `docs/evidence/ai/` | Specified (chapters 06 and 10) |
| 9 | Feedback on an answer is local and says nothing is sent; there is no report path | `app/src/ai/Turns.tsx` | Specified (chapter 09) |
| 10 | The assistant's lookups can send grades and attendance on consumer routes; the toolkit gate says T3 never goes to AI | `app/src/ai/converse.ts`, `lookup.ts` | Recorded as a required reconciliation on `AI-01.1` (`RP-08`); refused by test if unwritten |
| 11 | **The first call-site census missed a dynamic import** and the institutional client; found while building the guard | `ProductivityPreparation.tsx` | Probe widened; a control fails if it regresses |

A finding that something is *not there* is a claim about the tree on 4 October. The tests that hold the inventory, the
kill reach and the gate lists will tell the next person when it stops being true.

## What the guard holds

`app/src/lib/governance/ai-systems.ts` and its test, run in `npm test`:

- every source file that reaches a model is in the inventory, once, and no listed file is missing (30 files);
- the census probe finds a static importer, a dynamic importer and the institutional client, and passes over a
  function named `ask()` that has nothing to do with a model;
- no system is placed below the tier its own properties require; a lower effective tier carries its reason;
- T3 data reaching a model has a written reconciliation, and nothing else has one;
- the routes a server kill switch can reach are computed, and the consumer door is held to *not* reading it;
- launch requirements are cumulative, never duplicated, and **printed in chapter 10 exactly as the code has them**;
- the inventory chapter names every system and door, and the shutdown chapter names every uncontained route;
- `ai-tools.ts`: every tool a model may be offered has a registry row and every row a tool; each row's reach and undo
  match the source; a tool that sends cannot carry the approval of a tap; and the two tools that carry education
  records are named in the reconciliation and offered to no institutional role.

## Build order

| Phase | Deliver | Exit gate |
| --- | --- | --- |
| **0** (this change) | Inventory guard, two fixes, the design | Gates green; both fixes shown to fail on revert |
| **1** Foundations (**begun**: `GW-16` on the generation path, the `IR-01` decision as tested code, and `TB-01` for the 22 consumer tools; the rest below is open) | Gateway contract and route table; audit as a precondition (`GW-16`); the server data-class gate (`RP-02`); AI policy through the Studio (`TC-02`); consumer tools as registry rows (`TB-01`); a filed baseline evaluation run and ratified thresholds (`EV-01`, `EV-02`); named owners | A baseline on file; no direct `ai_policy` writes; audit failure refuses generation |
| **2** Institutional route to pilot-readiness | Retrieval with authority, freshness and bounds; server-rendered, hash-bound previews; a second provider and the failover rules; the gateway **deployed** with its drill; an independent live red-team of the institutional route | Tier 2 gate met for `AI-03.3`; kill-switch drill on the deployed gateway |
| **3** Containment and the console | Client door honouring a signed AI status (`IR-01`); policy pack; report path and owner; console sections 1–8 | Drill on every route; a report taken to closure |
| **4** Approvals and automation | Human-approval queue; adapters with readback and compensation; institutional automation; the support assistant | Tier 3 gate met, with an independent red-team and a second named release reviewer |

Do not build `TB-15` (model-driven tools on the institutional route) before `TB-05` (server-rendered previews). A
model that chooses tools, with a preview the server does not control, is the shape of the failure this design exists to
prevent.

## What this does not do

- It approves nothing and activates nothing. **No system here has met its tier's gate**, and every owner seat is
  `UNASSIGNED`; the product and contracts should claim nothing a gate has not earned.
- It describes the repository, not any deployed environment. The gateway is not deployed, no provider terms are signed,
  and the one drill covers one route.
- It makes no legal determination: FERPA, minors, cross-border transfer, retention and student rights belong to counsel.
- **Every threshold in chapter 06 is a proposal** with no baseline behind it.
- It does not add admissions and accommodation decisions to the intake refusals (`IN-09`): that edits a tested list
  and regenerates rendered pages, and is its own change.
- It does not wire the client door, build the retrieval service, the broker or the console. Those are requirements with
  states, not code.
- It was written by an AI model. The repository's own threat model says the right thing about that: an AI reviewing an
  AI's work is a real check and not the same one. **A human review of this design is a gate, and is still open.**

## Reading order

For a decision-maker: this page, then [07](07-incident-response-and-shutdown.md) and [10](10-red-team-and-launch-gates.md).
For an engineer: [01](01-inventory-and-risk-tiering.md), [02](02-model-gateway.md), [03](03-retrieval-policy.md),
[04](04-tool-broker.md). For a school's reviewer: [05](05-feature-requirements.md), [08](08-tenant-ai-console.md),
[09](09-user-transparency.md).
