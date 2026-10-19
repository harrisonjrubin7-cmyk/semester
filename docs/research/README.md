# Semester product research — the evidence system

| Control | Value |
| --- | --- |
| Status | **PROPOSAL — no participant has been recruited, no session run, no insight recorded** |
| Owner seat | `product` (held by the founder, acting); `privacy` seat (outside counsel) reviews [`08`](08-ETHICS-CONSENT-DATA-HANDLING.md) before any participant is contacted |
| Written | 2026-10-04 at `dac31c9` |
| Decision | `D-<this pull request>` in [`../decisions/`](../decisions/README.md) |

## The rule

**An opinion or a feature request is not validated product truth.** It is an
input to a hypothesis. Evidence is what people were seen doing, did at a cost,
or were measured achieving, weighed by how it was gathered and how far it
generalises. Building a capability is not evidence that anyone needs it.

## What is in here

| Page | Answers |
| --- | --- |
| [`01-EVIDENCE-MODEL.md`](01-EVIDENCE-MODEL.md) | What counts as evidence; the confidence levels C0–C4; the insight taxonomy; what each level may justify |
| [`02-STAKEHOLDER-RESEARCH-PLAN.md`](02-STAKEHOLDER-RESEARCH-PLAN.md) | The twelve groups: what to learn, in what order, from how many, by what route |
| [`03-INTERVIEW-GUIDES.md`](03-INTERVIEW-GUIDES.md) | How a session runs; a guide per group |
| [`04-TESTING-AND-OBSERVATION.md`](04-TESTING-AND-OBSERVATION.md) | Usability tests, diary studies, surveys, concept tests, institutional workflow observation |
| [`05-AUDIT-VALIDATION.md`](05-AUDIT-VALIDATION.md) | The repository audit checked against the tree; capability-by-capability evidence state; the thesis decomposed into testable claims |
| [`06-RESEARCH-REPOSITORY.md`](06-RESEARCH-REPOSITORY.md) | Where evidence lives, how it becomes an insight, how an insight reaches a decision |
| [`07-PILOT-AND-LONGITUDINAL.md`](07-PILOT-AND-LONGITUDINAL.md) | Pilot feedback, the measures that exist and those that do not, longitudinal design, closing the loop |
| [`08-ETHICS-CONSENT-DATA-HANDLING.md`](08-ETHICS-CONSENT-DATA-HANDLING.md) | Consent tiers, power imbalances, sensitive information, data handling, open items for counsel |
| [`repository/register.json`](repository/register.json) | 50 assumptions, 8 open decisions, 0 insights |
| `app/src/lib/ops/researchregister.ts` and its test | The rules as code; the register fails the build if it claims more than its evidence |

## Where things stand

- **Zero insights.** All 50 assumptions are C0. That is the true state, and the
  register shows it.
- **Eight open decisions** are linked to the assumptions they depend on, so the
  evidence needed for each is visible before anyone decides.
- **The single most valuable study** is the one [`VALIDATED.md`](../../VALIDATED.md)
  already named: ten real students and thirty days. It needs no engineering.
  This pack adds the baseline, midpoint and exit interviews around it so that
  the number comes with its reasons.

## How this relates to what already exists

| Existing | Relationship |
| --- | --- |
| [`RESEARCH-AND-SERVICE-DESIGN.md`](../operating-model/RESEARCH-AND-SERVICE-DESIGN.md) | Its cadence and recruitment matrix stand; this pack supplies the plan, methods and evidence model |
| [`EXPERIMENTATION-PROTOCOL.md`](../market-readiness/EXPERIMENTATION-PROTOCOL.md) | Governs experiments; this pack's pilot design obeys it |
| [`ANALYTICS.md`](../../ANALYTICS.md), [`PILOT.md`](../../PILOT.md), [`PILOT-SCORECARD.md`](../market-readiness/PILOT-SCORECARD.md) | The measures and definitions are theirs; this pack adds the qualitative layer and refuses to invent the open baselines |
| [`EVIDENCE-REGISTER.md`](../../EVIDENCE-REGISTER.md) | Release and claim evidence. Research levels feed its "measured outcome record" class; they do not replace it |
| [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | Decides what may be said publicly; research levels give the minimum evidence |
| [`CAPABILITY-STATUS-REGISTRY.json`](../market-readiness/CAPABILITY-STATUS-REGISTRY.json) | Says what is built; this pack says what is *needed* |

## What it will not do

- Convert any stakeholder's enthusiasm into a finding.
- Produce a percentage from a handful of people, or an outcome claim from
  interviews.
- Waive a security, privacy, accessibility or legal gate on the strength of
  demand.
- Reach a legal conclusion. Consent text, human-subjects status, minors,
  staff-participant protections and retention need counsel; the open list is
  at the end of [`08`](08-ETHICS-CONSENT-DATA-HANDLING.md).

## Not decided, not done

No participants recruited; no consent text approved; no restricted store
created; no `RETENTION.md` row; no changes to the product, its telemetry or
its consent mechanism; the stale statements in `VALIDATED.md` (payments,
counts) are noted in [`05`](05-AUDIT-VALIDATION.md) and not edited here.
Budget for incentives and tools is not set. The company-level seats a larger
program would need (a research lead other than the founder) are not filled.
