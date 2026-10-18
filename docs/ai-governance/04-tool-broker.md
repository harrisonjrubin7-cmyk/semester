# 04 · Tool broker

**Builds on:** `app/src/lib/tools.ts` (typed proposals, `reach`, `undo`), `app/src/lib/toolscope.ts` (least privilege
per mode), `app/src/lib/lookup.ts` (read tools and their caps), `app/src/lib/reach.ts`,
`packages/institution/src/automation.ts` (the `inform → verify` ladder and `missing()`),
`packages/institution/src/agents.ts` (`agentAllows`, deny by default), `app/server/institution/intelligence.ts`
(`prepare`/`confirm`), `app/server/institution/journal.ts` (the two-phase action machine),
[`../trust/AI-HUMAN-OVERSIGHT-STANDARD.md`](../trust/AI-HUMAN-OVERSIGHT-STANDARD.md).

A model never changes anything. It **proposes**; typed code **validates**; a person **commits**; the system
**verifies** and **can undo**. The broker is the one place that sentence is made true, for every tool, on every route.

## What exists, as verified

Three separate mechanisms already carry parts of this, which is both the good news and the problem.

| Mechanism | Where | What it gets right | What it leaves |
| --- | --- | --- | --- |
| **Consumer proposals** | `lib/tools.ts`, `toolscope.ts`, `lookup.ts` | Sixteen tools (fifteen writes and `open_screen`, a navigation), each turned by `readProposal` into a card the student presses; **an inverse is computed when the card is drawn** (`Undo`: exact inverse, or "what appeared"), because "a promise of undo that is computed later is only true if nobody changed the thing first"; `reach` says how far a write goes and nothing today leaves the device; per-mode tool lists so "where is this setting" is not answered by a model holding `make_document`; read tools capped at six per turn and three rounds | Runs in the browser. A server cannot see, rate-limit or disable a tool. No `reach` value above the device is exercised |
| **Institutional actions** | `intelligence.ts` | Server-issued id; five-minute expiry; stored **encrypted** and **single-use** (`claim` deletes it); fresh confirmation by the same person within five minutes; **authoritative readback** or no receipt; audit on refusal and success; non-assistant roles may prepare only | `label`, `effect` and `target` are **free text**, supplied by the client. The preview a person reads is not derived from typed arguments, and nothing binds it to what `execute` does. `proposedActions` come from the client request, **not from a model tool call**. `execute` is `() => ({ verified: false })`: nothing ships. The switch was not read on `confirm` (fixed, [chapter 07](07-incident-response-and-shutdown.md)) |
| **The automation ladder** | `automation.ts`, `gateway.ts` | `inform, recommend, draft, prepare, confirm, execute, verify`; `missing()` says what is absent before a rung; **jumping over `confirm` is refused whatever else is offered**; execution needs confirmation, authority, policy and audit | A function, not a gate every path passes through |
| **Role tool lists** | `agents.ts` | `agentAllows`: a role's tools are listed; a new tool is denied until someone adds it | Not consulted by the institutional path, which has no model-driven tools |

So: the consumer side has the best rollback in the repository, the institutional side has the best server-side
control, and **no path has both**. The broker is those two designs made one, with the ladder as its spine.

## The tool registry

A tool is a **typed record**, not a function name in a list. Nothing is callable that is not in the registry; a model
that emits an unknown name gets a refusal, and the proposal is recorded as an anomaly.

| Field | Purpose |
| --- | --- |
| `name`, `version`, `owner` | A tool change is a governed change (change management). A schema change is a version |
| `args` | JSON Schema, **strict**: no additional properties, bounded strings, enumerations over free text |
| `level` | Highest rung of the ladder it reaches; and the **action tier** A–E and oversight tier H0–H4 it maps to |
| `reach` | `device`, `tenant`, `external` (and the system named) |
| `roles`, `agents`, `modes` | Who and where may be offered it. Deny by default |
| `capability` | The permission the **user** must hold to do this directly; the tool runs as them |
| `data` | Highest data tier it may accept or return; the classification gate runs on args and result |
| `preview(args, state)` | A **pure function** from typed arguments to the exact text a person reads |
| `precondition(args, state)` | What must still be true at commit, re-evaluated then |
| `execute`, `readback` | The write and an independent read of its outcome. No `readback`, no `execute` |
| `inverse(args, before)` | Built when the proposal is made, **or** `irreversible: true`, which forces the E-tier path |
| `approval` | `self`, `fresh-auth`, `second-person`, `official-handoff` |
| `limits` | Rate class, per-conversation round cap, pending-proposal cap |
| `kill` | Its own disable key (`S3`, [chapter 07](07-incident-response-and-shutdown.md)) |
| `eval` | The evaluation suite that covers it ([chapter 06](06-evaluation-framework.md)) |

The sixteen consumer tools and six lookups are the first rows (counted from `TOOLS` and `LOOKUPS`), in `ai-tools.ts`. The columns held in code today are name, kind, action tier, reach, undo, data tier and approval; the strict argument schema, `preview`, `precondition`, rate class and kill key are the server half, still to do. Their `Undo` and `reach` already are the
`inverse` and `reach` fields; this is migration, not invention.

## Pipeline for one model-proposed call

```
model emits a call
 1  resolve   name ∈ registry ∩ agent ∩ mode ∩ role ∩ tenant-enabled ∩ not killed
 2  validate  args against the strict schema; identity, tenant, course and role are
              INJECTED from the verified session — a value the model supplied for them is discarded
 3  authorise as the user, through the policy decision point; the tool never runs with more than they hold
 4  classify  the gate over args and over what the tool would return
 5  limit     rate, loop depth, pending proposals; over the limit is a refusal, not a queue
 6  dispatch  by ladder rung:
              inform, recommend, draft   → return the result (as data, fenced)
              prepare                    → store a proposal; change nothing
              confirm, execute           → the approval path below
 7  record    audit the call and its outcome, including every refusal
```

**Results returned to the model are data.** They are fenced, truncated, minimised and classified like any retrieved
source ([chapter 03](03-retrieval-policy.md), layer 9). A tool result is a common route for injection, because it
arrives with the authority of "something I asked for".

## Proposals, previews and the commit

| Rule | Why |
| --- | --- |
| **The server renders the preview** from the typed arguments with the tool's `preview()`. The client displays that string and never composes one | Today the preview is client-supplied text beside an action the server holds; the person reads one thing and the system may do another |
| The confirm call carries **only the proposal id and its arguments hash**. The broker recomputes the hash and refuses a mismatch | What you see is what runs; replay of an old proposal with new arguments is impossible |
| The preview shows: the exact target, the effect, **before → after**, whether and how it can be undone, who else is notified, what it costs, and the sources it rests on | The Oversight Standard's "exact fields reviewed" |
| It is **accessible**: no truncation of the consequential field; announced to assistive technology; operable by keyboard; legible without colour | A preview someone cannot read is not a review |
| At commit the broker **re-runs `precondition`** against current state and refuses if it changed since the preview (version or ETag) | Time-of-check to time-of-use: the deadline moved, the course was dropped, the grade was released |
| **Idempotency key per proposal.** A retry reconciles by receipt and never executes twice | Already the design: "claim before execution" |
| Proposals **expire** (five minutes today) and a pending-proposal cap bounds a flood | A model that proposes a hundred things is an attack on the person's attention |
| Commit then **verify** by `readback`. Success is reported only from the readback | "Never claim an action succeeded when it did not" is the platform's own rule |

## User confirmation and human approval are different things

The documents use both words for two different controls. Name them, because the second is the one that decides
whether an institution can trust the first.

| | **User confirmation** | **Human approval** |
| --- | --- | --- |
| Who | The person whose data it is | A **different accountable person**: advisor, registrar, instructor, staff |
| For | An effect on the user's own data or calendar | An effect on another person's record, an institutional state, a message in the institution's name, anything D or E on someone else |
| Mechanism | A tap on the server-rendered preview; fresh within five minutes | An approval queue; the approver sees the authoritative source and the **diff**, may edit or reject, and is recorded |
| AI may | Prepare it | Prepare it. **Never** approve, and never be the approver's only information |
| Self-approval | n/a | **Refused**: the requester cannot approve their own |
| Four-eyes | No | Required for tier 3 actions that touch records |
| Expiry | Five minutes | Defined per tool; an expired approval is a new proposal |
| Monitored | Reject rate | **Rubber-stamping**: time-to-approve, approve-without-open, override rate, per reviewer; thresholds in the oversight plan |

An approval that a reviewer gives without the authority, time, source or freedom to reject is not oversight, and the
broker's job is to make the meaningful version the easy one and measure the other.

## Ladder, tiers and rungs

| Ladder rung | Action tier | Oversight | Approval | Example |
| --- | --- | --- | --- | --- |
| inform, recommend | A | H0 | none | Explain a policy from a source |
| draft | B | H0 | none; the user edits or discards | Advisor agenda; study plan |
| prepare | C | H1 | none to prepare; user confirmation to keep | A task proposal; a handoff package |
| confirm → execute → verify | D | H2 | user confirmation, fresh; second person if it touches others | Create a calendar event; export a document |
| confirm → execute → verify | E | H2/H3 | **fresh authentication, exact confirmation, audit; often an official handoff only** | Send a message in the institution's name; share records; a payment handoff; an enrolment action |
| decide, rank, score, certify a person | prohibited | H4 | none exists | Refused at intake |

`automation.ts` already refuses `execute` without a confirmation, an authority, a policy and an audit trail, and
refuses to jump over `confirm`. The broker calls it on every commit; it is the only code that decides.

## Rollback

Every executable tool declares one of three, and a tool with none is not registered.

| Class | Meaning | Rule |
| --- | --- | --- |
| **Inverse** | An exact inverse, knowable at proposal time because the prior state is readable then | Stored with the proposal; undo is itself a brokered action, audited, and verified by readback |
| **Compensate** | A new action that reverses the effect without restoring the exact prior state (a retraction message, a cancellation) | Declared with its limits; shown in the preview as "can be undone by…", not "can be undone" |
| **Irreversible** | A sent message, a payment, a submitted record | Forced to the E path: fresh authentication, second person where it touches others, official handoff where the institution owns the act |

An undo window is stated, not implied. For external systems rollback is only as good as the **adapter**, so an adapter
contract requires `readback` and either `compensate` or an `irreversible` declaration; an adapter with neither is not
accepted. "Every write is undoable" is true only of what is in this table.

## Audit

Append-only, one record per call and per outcome, **including every refusal**. Fields: actor, tenant, session,
route, model version, prompt and tool-set hash, tool and version, arguments **hash** (not the arguments), preview
hash, rung, policy decision and version, approver, receipt, rollback id, timestamps. Not recorded: content bodies.
Retention and legal hold follow the data it concerns. An audit that cannot be written **refuses the call** at tier 2
and above ([chapter 02](02-model-gateway.md) `GW-16`).

## Rate limits

| Limit | Scope | Purpose |
| --- | --- | --- |
| Proposals per minute, per hour | per user, per tool class | A model in a loop |
| Pending proposals | per user | Attention flood |
| Confirms per minute | per user | A compromised session confirming in bulk |
| Rounds per conversation | per conversation | Already three, and six read tools per turn |
| Writes per day | per tenant, per tool | Blast radius of one bad tool |
| Concurrency | per tenant | Noisy neighbour |

Today the gateway rate-limits **requests per identity per minute** (`PostgresRateLimiter`), not tools.

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `TB-01` | A typed tool registry; nothing callable that is not in it | **tested for the consumer tools**: 22 rows in `app/src/lib/governance/ai-tools.ts`, held to `TOOLS`, `LOOKUPS`, the role lists and app mode, and each row's `reach` and `undo` read back out of its branch of `readProposal`. Metadata only: nothing at runtime reads it. The server has no registry |
| `TB-02` | Strict argument schemas; identity values injected, never read from model output | partial: consumer tools validated in `readProposal`; no server schema |
| `TB-03` | The tool runs as the user through the policy decision point | not started |
| `TB-04` | Per-tool disable key | not started |
| `TB-05` | **Server-rendered preview** from typed arguments; confirm carries id and arguments hash | not started: preview is client text |
| `TB-06` | Preconditions re-checked at commit | not started |
| `TB-07` | Every executable tool declares inverse, compensate or irreversible; irreversible forces the E path | partial: consumer inverses built; no external tool |
| `TB-08` | Human approval path distinct from user confirmation; no self-approval; four-eyes for tier 3 record changes | not started |
| `TB-09` | Rubber-stamping metrics per reviewer | not started |
| `TB-10` | Tool results fenced, minimised and classified as data | partial: consumer fence; not for tool results generally |
| `TB-11` | Rate limits per tool, per user, per tenant | not started: request-level only |
| `TB-12` | The ladder (`automation.ts`) consulted on every commit | partial: the gateway commit path asks `mayStep`; the intelligence path does not |
| `TB-13` | Adapter contract: readback plus compensate or irreversible | not started: no adapter exists |
| `TB-14` | Audit of every call and refusal, append-only, arguments hash only | partial: confirm and refuse audited; call-level not |
| `TB-15` | Model-driven tool calls on the institutional route; today the client builds the proposals | not started; do not build before `TB-05` |
| `TB-16` | Permission simulation for every tool as every role (tier 3 gate item) | not started |
