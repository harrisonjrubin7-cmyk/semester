# 01 · AI system inventory and risk tiering

**Code:** `app/src/lib/governance/ai-systems.ts`, held by `ai-systems.test.ts`.
**Builds on:** [`../trust/AI-SYSTEM-INVENTORY.md`](../trust/AI-SYSTEM-INVENTORY.md) (the four-family baseline),
`app/src/lib/governance/ai-assurance.ts` (risk tiers 0–4), `ai-playbook.ts` (action tiers A–E),
[`../trust/AI-HUMAN-OVERSIGHT-STANDARD.md`](../trust/AI-HUMAN-OVERSIGHT-STANDARD.md) (H0–H4),
`app/src/lib/toolkit/classification.ts` (data tiers T0–T6).

## What was missing

The baseline inventory names four families and says, correctly, that each separately configured route, prompt or
tool set "requires a child entry". None existed, and nothing would have said so when a thirty-first AI call site
was added. This chapter is the child level for what is in the tree, the rule that places each system in a tier, and
a test that fails when an AI call site has no entry.

## Four tier vocabularies, one crosswalk

The repository already has four scales. They answer different questions, and the confusion is in treating them as one.

| Scale | Question it answers | Values | Where |
| --- | --- | --- | --- |
| **Risk tier** | How much evidence and what authority before this *system* ships? | 0–3, and 4 = do not deploy | `ai-assurance.ts` `RISK_TIERS` |
| **Action tier** | How far can one *output* reach? | A read · B draft · C internal proposal · D external or reversible · E high-impact | `ai-playbook.ts` `ACTION_TIER_ROWS` |
| **Oversight tier** | What human review does that action need? | H0–H4 | `AI-HUMAN-OVERSIGHT-STANDARD.md` |
| **Data tier** | What may be *sent* to a model? | T0–T6 | `toolkit/classification.ts` |

```
action A, B  → H0   drafting; user can edit, discard, or go non-AI
action C     → H1   a proposal; no silent write
action D     → H2   exact target and effect reviewed immediately before execution
action E     → H2/H3  fresh authentication, or a human decision-maker reviewing the authority
prohibited   → H4   no amount of review cures it; intake refuses
```

### The placement rule

A system's **risk tier is the highest of its own properties** (`tierFloor` in code), and it may be placed above that
floor, never below:

| Property | Floor |
| --- | --- |
| Highest action tier A or B | 1 |
| Highest action tier C (a proposal the user commits) | 2 |
| Highest action tier D or E | 3 |
| **The model chooses among tools** (an agent loop), at any action tier | 3 |
| Sources bound to a named institution (data T1) | 2 |
| Anything that would decide, rank, score or certify a person | **4: refused at intake** |

Two consequences the test holds. A confirmation button **enables** a tier; it never lowers one, so an assistant
that proposes writes the student presses is still tier 3 because the model picks the tools. And a model that fills a
fixed schema which the student then ticks (an announcement turned into date-change proposals) is tier 2, not 3,
because nothing chose a tool.

Tier 4 is not an inventory value. A system that would do any of the ten intake refusals in `ai-lifecycle.ts` does not
get a row; it does not enter the lifecycle. `ai-assurance.ts` already records two tier-4 domains the intake does not
yet name, **admissions** and **accommodation decisions** (`TIER4_NOT_YET_REFUSED`). They should be added to
`PROHIBITED_STARTING_SCOPE`; that regenerates the rendered operating-model pages, so it is a change of its own and
is listed under [what is not done](README.md#what-this-does-not-do).

## The doors

A **door** is a place a model call leaves Semester. Every feature reaches one. Five **routes** run through four doors.

| Door | Name | Routes | Reads the kill switch? |
| --- | --- | --- | --- |
| `DOOR-1` | The consumer door: `ask()` and its second provider (`app/src/lib/claude.ts`, `openai.ts`) | `shared-key`, `device-key`, `device-key-openai`, `proxy` | **No.** It chooses a route from settings and never asks a server |
| `DOOR-2` | The shared-key function (`supabase/functions/claude`) | `shared-key` | Yes. Drilled 2026-09-29 |
| `DOOR-3` | The institutional intelligence gateway (`app/server/institution/intelligence*.ts`, `providers/openai.ts`, `packages/institution/src/{intelligence,agents,course-agent-policy}.ts`) | `institution-gateway` | Yes. Repository tests only; not deployed |
| `DOOR-4` | The institutional client (`app/src/lib/university.ts`) | `institution-gateway` | Inherits `DOOR-3` |

`ask()` is the single door out of the consumer app, which is the most useful fact in the inventory: one place to put a
policy hook, and one place to be wrong. It also means a student's own key, called from the browser, is a route that a
server-side switch cannot stop. [Chapter 07](07-incident-response-and-shutdown.md) is built around that.

## The systems

Tier is the designed ceiling. *Data* is the highest data tier that can reach a model. *Uncontained* lists the routes
no server switch can stop.

| ID | System | Doors | Tier | Action | Agent loop | Data | Integrity | Uncontained routes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AI-01.1` | Ask Semester assistant | `DOOR-1` | **3** | C | yes | **T3**, reconciled | yes | `device-key`, `device-key-openai`, `proxy` |
| `AI-01.2` | Study support: explanations, practice, teach-back, concept links, worked problems, diagrams, decks, chart commentary, guide rebuilds | `DOOR-1` | 1 | B | no | T2 | no | same three |
| `AI-01.3` | Writing and drafting: assignment breakdown that refuses to write the assignment, project file, non-coursework drafting behind `gate()`, email drafting and proofreading | `DOOR-1` | 1 | B | no | T2 | yes | same three |
| `AI-01.4` | Planning narratives: day, week, runway, update. Figures counted in code; model writes the sentences | `DOOR-1` | 1 | A | no | T2 | no | same three |
| `AI-01.5` | Outside-source finding. The one surface not grounded in the student's own material | `DOOR-1` | 1 | A | no | T2 | yes | same three |
| `AI-03.1` | Syllabus to course: classify, build, map | `DOOR-1` | 1 | B | no | T2 | no | same three |
| `AI-03.2` | Photo and page reading | `DOOR-1` | 1 | B | no | T2 | no | same three |
| `AI-03.3` | Announcement to change proposals, each ticked | `DOOR-1` | **2** | C | no | T2 | no | same three |
| `AI-02.1` | Institutional intelligence: four scoped roles, tenant sources, course policy, prepare and confirm | `DOOR-3`, `DOOR-4` | **3** (effective 2) | E | no | T1 | yes | none |

Notes the table cannot carry:

- **`AI-01.1` is the only system with an agent loop and a T3 reconciliation.** `read_grades` and `read_attendance`
  reach the model on consumer routes. The toolkit gate says T3 (education records) never goes to AI. The assistant
  predates that gate and is bounded instead by the per-school `aiOff` category switches (`app/src/lib/aiflags.ts`),
  which default to *on*. The institutional roles force `grades` and `attendance` off (`app/src/ai/converse.ts`), so
  the question is confined to consumer routes. The test refuses any system with T3 data and no written reconciliation,
  and any reconciliation on a system without it. The resolution is `RP-08` in
  [chapter 03](03-retrieval-policy.md).
- **`AI-02.1` is tier 3 by design and tier 2 today.** `createInstitutionIntelligenceRuntime` wires `execute` to
  `() => ({ verified: false })`, so no AI-proposed action can run. The consequential class exists in the contract and
  is not live. The registry records the ceiling and the effective tier and the test requires the effective one to be
  lower, so turning execution on without re-running the tier 3 gate is visible as an edit to this row.
- **Three systems carry `integrity: true` for a reason that is not the same.** `AI-01.1` can be asked to do graded
  work; `AI-01.3` writes prose; `AI-01.5` can fabricate a citation a student then submits.

## The census, and why it is a test

`ai-systems.test.ts` finds every non-test source file in `app/src` that reaches a model by any of three doors: a
static import of `ask`, `readMaterial`, `readShots`, `readPages` or `askOpenAI` from `lib/claude` or `lib/openai`; a
**dynamic** `import('…/claude')`; or any use of `institutionIntelligence`. Thirty files today. A file that is found and
not listed fails the suite.

The first version of the probe matched static imports only and reported twenty-eight. Two files were invisible to
it: a component that loads the model with `await import('../lib/claude')` inside a click handler (it also reaches the
institutional gateway), and the institutional client itself. The test runs a control for the first: the static
pattern alone must fail on that file, so a regression to the narrower probe is red. It must also pass over a
file with a function named `ask()` that has nothing to do with a model (`lib/canvas.ts`) and over a file about AI that
calls none (`lib/aiflags.ts`). A census that finds everything is also what a probe that matches everything looks like.

**What it does not find.** A model reached by `fetch` from a file that imports none of the above; a route added in a
server function other than the two listed; a system configured in a deployed environment and not in the tree. It is a
repository census, not a deployed-asset one, which is the same ceiling the baseline inventory states.

## Entry schema for a new system

The registry holds what the tree can prove. A **deployed** entry needs the rest, and *unknown is a blocking value*.

| Field | Held in code today | Source of truth for the rest |
| --- | --- | --- |
| Name, purpose, owner seat | name, purpose | owner is a person, `UNASSIGNED` for every system |
| Doors, routes, files | yes | |
| Risk tier, action tier, agent loop, data tier | yes | |
| Provider, **pinned** model version, region, account owner | no | deployment export; see `GW-03` |
| Retention, training and secondary-use terms | no | executed provider terms, none signed |
| Prompt and tool-set version (hash) | no | `GW-14`: stamped on every audit record |
| Retrieval sources and their authority | no | `approved_source` for the institutional path |
| Evaluation suite, last run, result, expiry | no | [chapter 06](06-evaluation-framework.md) |
| Kill switch and last drill | `KILL_REACH`, `KILL_DRILLS` | |
| Incident route and owner | no | [chapter 07](07-incident-response-and-shutdown.md) |
| Retirement state | no | |

## Requirements

| ID | Requirement | State |
| --- | --- | --- |
| `IN-01` | Every source file that reaches a model is in the inventory, once | **tested** (`ai-systems.test.ts`) |
| `IN-02` | A system is placed at or above its `tierFloor`, and a lower effective tier is recorded with its reason | **tested** |
| `IN-03` | T3 and above reaching a model carries a written reconciliation | **tested** |
| `IN-04` | The routes no server switch can stop are computed from the routes, not remembered | **tested** |
| `IN-05` | A deployed-asset export reconciles provider, pinned model, region, account owner, retention and prompt hash per route and per tenant | not started |
| `IN-06` | Every system has a named owner and a backup; an unassigned seat blocks G3 | not started: all seats `UNASSIGNED` |
| `IN-07` | Changing a system's tier, door, tool set, data tier or purpose re-runs its gates | designed (`AI-LIFECYCLE-GATES.md`); not mechanised |
| `IN-08` | Retirement removes the entry's routes, indexes, embeddings and stored outputs, and records that it did | not started |
| `IN-09` | Add admissions and accommodation decisions to the intake refusals | not started; see above |
