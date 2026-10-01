# Complete the remaining document-defined UI standards

Spec: `docs/UI-ENHANCEMENTS-2026-10-01.md`, the twenty-item audit of the user's entire uploaded UI document. This plan closes the software scope still recorded in rows 8, 10, 11, 12 and the compact-menu portion of 15. It does not manufacture institutional acceptance.

## Global Constraints

- Use actual records, existing source provenance and canonical application calculations. Never invent relationships, source facts, receipt status, completed actions or approval evidence.
- Preserve role checks, ownership, privacy previews and official provider confirmation. Personal choices and snapshots cannot execute registration, send messages, make payments or publish institutional decisions.
- Do not send external messages, change production data, deploy gateways, change credentials or approve launch gates. Publication to the isolated GitHub feature branch is already authorized; main merges and releases remain the controller's responsibility after review and required checks.
- Keep existing navigation and controls functional in every view. Use semantic controls, accessible labels, keyboard navigation and honest empty/unknown states. No DOM interception or HTML-string reconstruction of React controls.
- Persist only user-owned preferences/work through existing owner-scoped stores. School-owned assumptions stay read-only. Public and student views must not gain access to institutional or other-user records.
- Keep existing test, lint and bundle limits unchanged. Use lazy boundaries for substantial new UI; add no dependency unless unavoidable. Regression tests must exercise real integration behavior, cancellation and privacy boundaries, not mirror implementation.
- Scope completion is evidence-based: inventory relevant surfaces and report any exception precisely. Do not claim a universal standard because one demo component implements it.
- Work only in this isolated worktree and sequentially. Do not spawn helpers or reviewers. Commit and checkpoint task changes to `codex/ui-standards-20261001`; never force-update a shared branch. No secrets or private records belong in reports.

## Task 1: Human table contract throughout the app

1. Inventory all actual record/decision tables under `app/src` with `rg`. Record the path and purpose of every eligible data table and any excluded static explanatory/layout table. Start with `DecisionTable`, registration comparisons and institutional record/work queues; do not stop after these examples.
2. Implement a shared typed contract for table, readable card and concise summary views, search, meaningful filters, visible-row download and named saved views. Use row identities and explicit text/value accessors, preserving original interactive controls and source/unknown labels. Reuse existing safe export functions and avoid spreadsheet formula injection. Saved views retain view/filter/search choices for that table, without copying sensitive row contents into preferences.
3. Integrate all eligible inventory surfaces, reusing adapters rather than hiding native tables with CSS. Keep consequential workflow controls and their authorization/confirmation behavior intact. A downloaded working view must not be presented as an official signed record.
4. Add meaningful tests for filter/view persistence, accessible card/summary semantics, safe visible-row export and at least one real student workflow plus one permission-limited institutional workflow. Verify that view switching cannot expose hidden/private columns or bypass controls.
5. Run covering tests, production build and lint. Self-review the full task diff; commit, checkpoint and report the final coverage inventory and any genuine exception.

## Task 2: Connect assumption editing to real calculators

1. Inventory assumption inputs used by graduation/degree planning, course workload/time planning, cost and career decisions. Reuse `ProductivityWorkspace` provenance fields where appropriate, but recorded impact text alone does not count as a calculator connection.
2. Provide one shared assumption editor and typed domain adapters. Display value, owner, source and actual dependent outcomes. Editing personal assumptions must preview the affected existing calculations before confirmation; cancel preserves original values. Apply updates through the canonical domain stores and formulas, avoiding a second divergent calculator.
3. Connect the shared editor in every relevant planning domain. Institution-owned values remain visibly locked; missing or unsupported calculations remain unknown, with no fabricated numeric impact.
4. Test actual changes flowing into graduation and course/time outcomes and a career decision/preference, preview/cancel behavior, provenance retention and locked institutional assumptions.
5. Run covering tests, build and lint, self-review, commit/checkpoint and report which domains consume each adapter.

## Task 3: Consistent comparison decisions and advisor review

1. Inventory comparison experiences, including course shortlists, degree scenarios, time/cost plans, career options and productivity decisions. Register all applicable experiences with a shared action contract.
2. Add explicit choose-option actions, save-all-options/snapshot behavior and advisor-review preparation consistently. Choosing a candidate saves a personal choice or plan through existing stores; it must not perform an official transaction. Save both/all retains distinct options and their source/unknown/assumption context. Advisor actions open an editable privacy preview or draft through the actual advising workflow, without sending anything automatically.
3. Preserve existing comparison facts, uncertainty, warnings and official next-step controls. Meaningful labels can use option names, while the common contract supplies consistent behavior for Choose A/B, Save both and Ask advisor.
4. Test real course and degree/career integrations, snapshot reload, exclusion of private/unselected data from advisor previews and that no external action fires before the product user confirms through an existing authorized workflow.
5. Run covering tests, build and lint, self-review, commit/checkpoint and report complete comparison coverage.

## Task 4: Navigable cross-domain relationships

1. Inventory actual identifiers and recorded links among courses, deadlines/materials, degree requirements/scenarios, career artifacts and advising objects. Reuse the canonical course requirement matcher. Do not infer an edge merely because two records share text.
2. Implement a shared optional relationship view with an accessible list as its baseline and navigable object-level destinations. Show recorded/verified edges with source and ownership; expose disconnected objects honestly. Personal links may be created only by an explicit reviewed user action and must remain labeled as personal.
3. Connect the relationship view across the relevant domain workspaces and shared source/context surfaces. It must reach degree scenarios, career artifacts and advisor objects, in addition to the existing course/deadline relationships. Preserve context when following and returning from an object link.
4. Test canonical subject/free-elective matching, object navigation/return, no invented or cross-user edges and keyboard/list access to every represented relationship.
5. Run covering tests, build and lint, self-review, commit/checkpoint and report the registered node/edge types and integrations.

## Task 5: Finish compact accessibility menu shortcuts and acceptance record

1. Add agenda-view and language-preference shortcuts to the existing lazy compact accessibility menu, alongside its implemented contrast, reading, motion, plain-language and speech controls. Route to actual controls/screens and preserve menu/audio behavior.
2. Reuse supported language preferences. If only English is supported, say so clearly; do not claim a translated interface or offer nonfunctional languages. This task completes the shortcut and honest supported-language control, not an unrequested translation catalog.
3. Test keyboard activation, real agenda routing, actual language-preference destination, object-context speech cancellation and reduced-motion/contrast persistence. Keep substantial UI behind the existing lazy boundary.
4. Update the twenty-item audit with exact completed integrations, test/deploy evidence and remaining external acceptance requirements. Independent assistive-technology review, named institutional approvals, approved gateway hosting, production recovery/rollback exercises and real pilot baselines remain pending until supplied and verified.
5. Run covering tests, build, lint and required browser/budget checks. Commit/checkpoint and report without declaring institutional GO.

## Completion and release

Each task requires spec and quality review before the next implementation task. The final whole-branch review checks every inventory and parked concern. Run all repository-required CI, security, SQL, sync, accessibility, golden-path, load and recovery checks; merge only the exact reviewed passing revision. Verify the live HTML/assets and public API after release, and report institutional readiness separately from software deployment.
