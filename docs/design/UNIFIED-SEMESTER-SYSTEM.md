# Unified Semester system

This is the implementation contract distilled from the five product-analysis
documents. It treats Semester as one student operating system, while preserving
specialist workspaces as contextual modes inside that system.

## Persistent product grammar

- **Five destinations:** Today, My Path, Search, Plan and Me are the canonical
  student navigation in a normal build. The old tab collection is an explicit
  rollback, not a competing information architecture.
- **One context strip:** every standard surface carries the current term,
  canonical destination, specialist surface, active workflow, a safe Continue
  route and system health. Full-canvas communication and search surfaces stay
  intentionally quiet.
- **One Action Center:** Today is the default decision workspace. Other modules
  propose actions into it instead of creating parallel task lists.
- **One details model:** a shared drawer can show an object's kind, context,
  source status, relationships, history and safe actions.
- **One trust language:** source, freshness, connection health, limitations and
  rollback state use shared labels instead of bespoke module wording.

## Shared foundations

| Foundation | Implementation | Status |
| --- | --- | --- |
| Context graph | `app/src/lib/context-graph.ts` | Canonical factual nodes and relationships for student, institution, term, course, source and action; deliberately no inferred motivation, ability or risk. |
| Universal object drawer | `app/src/lib/unity.ts`, `app/src/components/unity/UnityLayer.tsx`, `ObjectCard.tsx` | Shared relationship, history, context, status and action sections. |
| Cross-module workflows | `app/src/lib/student-workflows.ts` | Six named journeys: Registration Readiness, Course Success, Advising Preparation, Career Evidence, Support Routing and Term Transition. |
| Term + Continue | `app/src/components/unity/SystemContextBar.tsx` | Global semester switcher when multiple terms exist, plus a route back to recent unfinished work. |
| System health + why | `SystemContextBar.tsx`, `ExplanationSheet.tsx`, `SourceBadge` | Visible connection state and shared source/explanation patterns. |
| Screen governance | `app/src/lib/screen-governance.ts` | Required owner, job, source, permission, fallback, accessibility, mobile, analytics, maturity and merge-target metadata for every routed screen. |

## Governance rule

New student-facing screens must declare their canonical destination and
governance metadata before release. A screen that duplicates a canonical job
must be merged, made contextual, marked transitional with a replacement target,
or kept internal. The generated `SCREEN-AUDIT.md` is the inventory; the typed
governance registry is the enforceable contract.

## Honest boundary

This change unifies the local application shell and typed product model. It does
not deploy a new build, change Supabase data, connect new institutional systems,
or prove production behavior. Those remain release operations with their own
verification.
