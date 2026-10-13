# AI boundary

Status: specified. Default for the pilot: **no AI-assisted feature is in pilot
scope** (see `docs/launch/pilot-scope.md`). Anything below is the rule an AI
feature must meet before it can be added.

## Rules

1. **AI output is a draft.** AI-generated text, summaries or classifications carry the `ai_assisted` authority and cannot become authoritative without a named human decision (AUTH-004).
2. **AI does not decide readiness.** Readiness states come from the readiness rules and source records, never from a model's output.
3. **Restricted data stays out of AI.** `restricted` data (see `data-classification.md`) is prohibited for AI processing unless it is explicitly approved and de-identified.
4. **No model-state claims to students.** Screens do not say "the assistant checked your record"; they say which source was used.
5. **Every AI call is attributable.** The request, the model version and the output reference are logged under the `ai.*` audit keys in `docs/contracts/audit-events.yaml`, classed `confidential`.
6. **Failure falls back to the rule-based path.** If an AI component is unavailable, the screen shows the deterministic result and the `POLICY_UNAVAILABLE` message where applicable.

## Open decision

Whether a future assistant may summarise a student's own readiness record is not
decided in the source material. It needs an approval record in
`docs/governance/decision-log.md` before any build work starts.
