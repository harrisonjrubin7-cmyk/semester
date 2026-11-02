# Forty Semester Skills

Curated 2026-11-02 from the Semester repository: WHAT-IS-SEMESTER.md, UNIFIED-SEMESTER-SYSTEM.md, SEMESTER_PRODUCT_UNIVERSE.md, SEMESTER_ROLE_CATALOG.md, CLAUDE.md, and 30-60-90-DAY-EXECUTION-PLAN.md.

Grouped into six clusters. Each skill is one sentence of the operating rule that matters.

## Product and strategy

1. **Thesis discipline** — Never claim a native replacement until it is implemented, tested, accessible, secure, governed, migrated, approved, and supportable.
2. **Claim ceiling** — Separate what the repo holds from what is activated; zero of forty public claims are available today.
3. **Critical path awareness** — The launch date is set by outside parties (accessibility evaluators, counsel), not by engineering work.
4. **First buyer decides** — Build the foundation first, then the one or two domains a named design partner asks for; defer the rest.
5. **Evidence ordering** — Recovery and release hygiene first, then tenant isolation, then alerting, then claims cleanup, then one real data path.
6. **Wedge discipline** — Qualify only prospects fitting the bounded scope; use synthetic demos and conditional proposals.
7. **No backfilling** — Never convert synthetic or repository evidence into operated outcomes, and never imply customer status.
8. **Phase separation** — Keep individual validation, design-partner activation, paid pilot, and broad enterprise as distinct decisions with separate go/no-go records.

## Engineering and architecture

9. **Check main before starting** — Other sessions converge on the same fix; grep for the thing, not the commit titles.
10. **Decision log by pull request number** — Open the pull request first, then write the decision as docs/decisions/D-PRNUMBER.md.
11. **Run every command from app/** — The root package.json is the workspace manifest and defines none of the scripts.
12. **tsc -b and check:university are different gates** — One can be green while the other is red (NodeNext vs project references).
13. **test:shuffle catches ordering failures; rootunmount.test.ts catches timing ones** — A seed fixes order, not a race; consecutive green shuffles are weak evidence.
14. **A guard that never failed is not proven** — Revert the fix under the new test and watch it go red, then restore.
15. **Include a control in every measurement** — Measuring six suspects and finding six problems is also what a broken probe looks like.
16. **Spine attachment** — A feature that does not attach to Identity through Outcome does not ship.
17. **Three tenant column spellings** — tenant_id, school_id, institution_id; ADR-0002 would unify them.
18. **Policy engines have zero importers from app/** — That integration debt is the first thing to kill.

## Design and UI

19. **Semantic tokens only** — No raw colors, spacing, radii, shadows, z-indexes, font sizes, durations, or easings in feature code.
20. **The earlier file wins** — When two design docs disagree, the earlier one is right and the later one is stale.
21. **Reuse before creating** — Search components/ui.tsx, Page.tsx, unity/, gallery/stories.tsx, and the nearest screen in screens/ first.
22. **Every screen declares governance metadata** — Owner, job, source, permission, fallback, accessibility, mobile, analytics, maturity, merge-target.
23. **Color is never the only status signal** — Pair it with a word or glyph.
24. **Cover the applicable states** — Default, loading, empty, error with a way back, disabled, success, long content, permission.
25. **Figma is evidence of approved visual intent** — Never authority over tokens or components.

## Data and privacy

26. **Student data is owned by the account** — No role reads private work by default.
27. **Seven source states with precedence labels** — A label is not yet a rule.
28. **Data classification T0 through T6** — Per-table, rule-derived, unreviewed.
29. **Consent, guardian grants, time-limited access** — Built; counsel review is open.
30. **Audit events are hash-chained** — But not tamper-evident everywhere (F-10).
31. **Minimum age thirteen** — Minors off social surfaces until eighteen.
32. **Files never leave the device; mail is draft-only** — The productivity service is off by default and not mounted in any deployment.

## AI and intelligence

33. **Metered edge proxy with kill switch** — But BYOK bypasses the kill switch (F-04).
34. **AI output is never official institutional information** — No unexplained score, risk label, or recommendation.
35. **Red-team set exists; evals are thin** — Expand evals before widening AI surface area.
36. **No AI output presented as institutional record** — Guidance, recommendation, and official record stay visibly distinct.

## Operations and launch

37. **Named backup owners for every queue** — Support, security, privacy, accessibility, incident.
38. **Tabletop and notification rehearsal** — Before any activation.
39. **Export, deletion, revocation, offboarding exercised with witnesses** — Dated records with scope and measured results.
40. **Reissue GO-NO-GO-DECISION.md** — Whenever material scope, evidence, ownership, or risk changes.

## Source documents

- docs/launch/WHAT-IS-SEMESTER.md
- docs/design/UNIFIED-SEMESTER-SYSTEM.md
- docs/master/SEMESTER_PRODUCT_UNIVERSE.md
- docs/master/SEMESTER_ROLE_CATALOG.md
- CLAUDE.md
- 30-60-90-DAY-EXECUTION-PLAN.md
