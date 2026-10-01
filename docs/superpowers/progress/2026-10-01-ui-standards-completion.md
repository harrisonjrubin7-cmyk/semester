# SDD ledger — plan: docs/superpowers/plans/2026-10-01-ui-standards-completion.md

Base: 4825d1275d5db2446cda33f07d3aa1c3e351ee92. Isolated worktree and branch verified. The baseline release remains in required CI; local media/layout/deadline tests (21), build and lint passed before this plan.

## Preflight task/interface scan

| Tasks | Producer and consumer / shared area | Finding |
|---|---|---|
| 1, 2 | Planning tables and calculator forms; view preferences versus assumption inputs | Separate namespaces; preserve form controls while adapting views. |
| 1, 3 | DecisionTable/CourseCompare; human row adapters consumed by comparison actions | Reuse table IDs and original controls; do not execute transactions. |
| 1, 4 | Record tables and object links; shared row identity consumed by relationships | Canonical IDs only; preserve object routing. |
| 1, 5 | Preference shape and accessible labels | Independent preference fields; never replace the whole preference object. |
| 2, 3 | Scenario/course/career adapters and snapshots | Comparisons consume canonical assumption context, not a duplicate calculator. |
| 2, 4 | Assumption provenance and dependent object identities | Edges require recorded identifiers, not matching text. |
| 2, 5 | Assumption labels and language preferences | Supported language controls only; source/data content stays intact. |
| 3, 4 | Saved comparison snapshots and relationship navigation | Register actual snapshot IDs; preserve return context. |
| 3, 5 | Privacy previews and accessible menu routing | Shortcuts cannot send advisor drafts or bypass preview. |
| 4, 5 | Accessible relationship list, motion and focus | List is baseline; existing persisted accessibility modes remain authoritative. |

| Task | Internal requirement consistency | Finding |
|---|---|---|
| 1 | Typed real rows, all eligible table inventory, private saved criteria, visible-row working exports | Tests cover persistence, authorization and export semantics; no contradiction. |
| 2 | Shared editor, canonical calculators, preview/cancel and locked school inputs | Tests require real downstream outcomes and no fabricated values; no contradiction. |
| 3 | Personal choose/save and reviewed advisor draft, not official transactions | Tests preserve official next steps and no outbound action; no contradiction. |
| 4 | Actual cross-domain IDs, explicit personal links, accessible object navigation | Tests forbid inferred/cross-user edges; no contradiction. |
| 5 | Actual agenda/language destinations and honest supported-language state | Shortcut scope is distinct from independent acceptance; no contradiction. |

Task 1: pending
Task 2: pending
Task 3: pending
Task 4: pending
Task 5: pending
