# AI and recommendation evaluation harness

Part 15 of the expansion command. Phase 6. Nothing here is built yet.

## What exists on main

- Prompts: `app/src/ai/prompt.ts` (`ACTING`, `READING`, `BOUNDS`, `VOICE`,
  `systemPrompt`) and about 28 `*_SYSTEM` constants across `app/src/lib`.
- Unit-level prompt and grounding assertions: `app/src/ai/prompt.test.ts`,
  `app/src/lib/claude.test.ts`, `app/src/intelligence/assemble.test.ts`.
- Model list: `app/src/lib/assistant.ts`. Request assembly and provider routes:
  `app/src/intelligence/assemble.ts`.
- Per-school AI settings: `public.ai_policy` (`policy_version`,
  `allowed_providers`).

There is no evaluation set, no scored run and no release gate.

## In flight

- #781–#788 (AI Toolkit) add many AI surfaces, each a candidate evaluation set.
- #764 clamps what the shared key pays for — evaluation runs need their own
  budget, not the students'.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `evaluation_suites`, `evaluation_cases`, `evaluation_datasets` | **Files** in the repository, versioned with prompts | A case changes in the same commit as the prompt it tests |
| `evaluation_runs`, `evaluation_results`, `evaluation_metrics` | **CI artifacts**; a summary row per run in a table only once schools need to see evidence | |
| `evaluation_thresholds` | **File** beside the suite | The gate is code |
| `evaluation_regressions` | **CI failure** | |
| `model_provider_versions` | **Reuse** `assistant.ts` + `ai_policy` | |
| `recommendation_evaluations` | **Suite** over the action scorer | Deterministic, runs on every commit |
| `human_review_samples` | **New** once human review starts | Sampled outputs, reviewer, verdict |

## Suites

Each case: an input, the sources it may use, and assertions — must cite, must
refuse, must refer, must not contain. Ten suites, matching the command:
requirement explanation, course policy, citation verification, statistics,
accessibility output, multilingual explanation, integrity boundary,
sensitive-data refusal, human handoff, action explanation.

Two layers:

1. **Deterministic** (every commit, no model call): prompt assembly includes the
   right bounds; the action scorer's ranking and explanation over fixture
   actions; refusal routing for sensitive categories.
2. **Model-graded** (before any model, provider or prompt change reaches a
   school): groundedness, citation accuracy, fabrication rate, refusal
   correctness, bias pairs (same question, names and pronouns varied), cost per
   passing case, escalation rate. Thresholds per suite; a drop below the last
   release's score blocks the change.

## Capabilities and flags

- `ai:configure` (exists) to accept a run as evidence for a school's rollout.
- No flag: it gates flags.

## Hard boundaries

- **Evaluation data is synthetic or approved.** No real student data in any
  suite. A lint over case files refuses anything shaped like a real address or
  student id.
- Results are linked to the rollout decision that used them.

## Tests

- The deterministic layer runs in `npm test`.
- The lint is shown to fail on a planted real-looking address.
- A deliberately degraded prompt (the `BOUNDS` block removed) fails the
  sensitive-data and integrity suites — the control that proves the gate can
  close.
