# Route identity crosswalk

## Purpose and boundary

This artifact reconciles three route and screen identity sources in the 2026-10-08 design archive (`SHA-256 12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`). It is Phase 0 evidence only. It does not activate routes, adopt archive assets, establish authorization, or prove production behavior.

The sources are:

- `handoff/prototype/screens.json`: the handoff route inventory (281 routes across 26 workspaces).
- The rendered `ui_kits/semester-app/All Screens.html` navigation captured from the archive bundle: 362 routes across 27 workspaces.
- `ui_kits/master-catalog/catalog-data.js`: 673 screen labels across 14 catalog groups.

The row-level union reconciliation is in [`route-identity-crosswalk.csv`](./route-identity-crosswalk.csv). Its 379 data rows cover every route identity present in either route source: 281 handoff routes plus 98 rendered-only routes.

## Matching method

Route equality is byte-for-byte string equality. Label matching is deliberately two-stage:

1. `exact_*` means the full source label equals the candidate label with case preserved and no transformation.
2. Only when there is no exact candidate, `normalized_*` compares `label.trim().toLowerCase()`.
3. Candidate indexes are collision-checked after normalization. More than one candidate remains ambiguous; the crosswalk never selects one automatically.

The CSV records the matching mode, candidate labels, candidate routes, and catalog groups so every aggregate below can be reproduced. A normalized match is a discovery aid, not exact identity evidence.

## Reconciliation result

| Comparison | Exact unique | Normalized-only unique | Exact ambiguous | Missing | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| Handoff route → rendered route | 264 exact routes | — | — | 17 | Most handoff route identities survive, but the entire handoff-only set is under `#/operations/*`. |
| Handoff label → rendered label | 249 | 0 | 15 | 17 | Labels alone are unsafe identifiers because common labels occur in multiple workspaces. |
| Rendered label → master catalog | 34 | 2 | 3 | 323 | The master catalog is primarily a conceptual screen taxonomy, not a route registry. |
| Handoff label → master catalog | 32 | 2 | 3 | 244 | The two normalized-only matches are not exact-label evidence. |

The rendered inventory adds 98 routes that do not exist in the handoff route list. Each appears as a `rendered_only` row with catalog candidates where available. These additions are evidence of archive drift, not automatic requirements or production implementation.

## Workspace route counts

| Workspace | Handoff | Rendered | Delta |
| --- | ---: | ---: | ---: |
| admissions | 6 | 8 | +2 |
| advisor | 7 | 8 | +1 |
| alumni | 7 | 8 | +1 |
| applicant | 4 | 6 | +2 |
| business | 0 | 17 | +17 |
| campus | 5 | 8 | +3 |
| career | 4 | 4 | 0 |
| clubs | 4 | 4 | 0 |
| company | 17 | 24 | +7 |
| employer | 3 | 3 | 0 |
| executive | 4 | 6 | +2 |
| faculty | 17 | 19 | +2 |
| family | 3 | 4 | +1 |
| finops | 4 | 9 | +5 |
| insights | 3 | 4 | +1 |
| institution | 19 | 27 | +8 |
| marketplace | 3 | 3 | 0 |
| operations | 17 | 2 | -15 |
| os | 8 | 30 | +22 |
| public | 8 | 8 | 0 |
| social | 13 | 13 | 0 |
| student | 62 | 75 | +13 |
| studio | 31 | 34 | +3 |
| success | 4 | 8 | +4 |
| support | 3 | 3 | 0 |
| ta | 4 | 4 | 0 |
| trust | 21 | 23 | +2 |
| **Total** | **281** | **362** | **+81** |

`business` is rendered-only. The totals differ by 81 because the rendered set adds 98 routes and omits 17 handoff routes.

## Handoff-only route identities

All 17 exact-route misses are in the Operations workspace:

| Route | Handoff label |
| --- | --- |
| `#/operations/home` | Command center |
| `#/operations/incidents` | Incidents |
| `#/operations/releases` | Releases |
| `#/operations/access` | Access |
| `#/operations/privacy` | Privacy requests |
| `#/operations/deadletters` | Dead letters |
| `#/operations/architecture` | Architecture |
| `#/operations/lti` | LTI launch checks |
| `#/operations/ltiseq` | LTI sequence |
| `#/operations/lticompliance` | LTI audit |
| `#/operations/ltitrace` | Launch trace |
| `#/operations/jwt` | JWT inspector |
| `#/operations/notify` | Notification hub |
| `#/operations/feeddelivery` | Feed delivery |
| `#/operations/presence` | Presence reliability |
| `#/operations/migrations` | Migration runner |
| `#/operations/guards` | Route guards |

This is a namespace and navigation conflict, not evidence that those capabilities are absent from the production repository. Each item still requires an explicit disposition: preserve the route, redirect it, map it to an authoritative production surface, or retire it with recorded rationale.

## Ambiguity controls

Exact label matching produces 15 ambiguous handoff rows. Repeated labels include Home, Calendar, Family sharing, Gradebook, Transcript, Announcements, Applicants, Decisions, My Work, and Executive Assistant. The CSV records every candidate route; no candidate is selected automatically.

Two handoff-to-catalog matches exist only after normalization: `Action center` → `Action Center` and `Course studio` → `Course Studio`. They are recorded as `normalized_unique`, not exact matches.

Three rendered labels map to more than one master-catalog group:

| Rendered route | Label | Catalog groups |
| --- | --- | --- |
| `#/student/privacy` | Privacy | Public company site; Operations Command Center |
| `#/institution/entitlements` | Entitlements | Institutional administration; Operations Command Center |
| `#/trust/audit` | Audit explorer | Institutional administration; Operations Command Center |

These collisions require domain-qualified stable IDs. Display labels must not become authorization keys, analytics identities, or redirect targets.

## Decision rules for continuation

1. Treat an exact route match as identity continuity only; verify repository ownership, authorization, data boundaries, and tests separately.
2. For a missing exact route with one label candidate, record a proposed redirect or rename and require owner approval before implementation.
3. For ambiguous labels, use workspace, actor, data sensitivity, and workflow context to choose—or reject—a mapping.
4. For handoff-only Operations routes, reconcile against the authoritative production Operations Console before adopting any archive route.
5. For rendered-only routes, classify each as a new requirement, a prototype-only variant, a duplicate, or an explicit rejection.
6. Do not copy icons, media, fonts, or other archive assets until provenance and license evidence is complete.

## Phase gate

Route identity reconciliation is **not passed**. Inventory coverage is complete across the 379-route union, but Phase 0 remains blocked on explicit resolution of the 17 Operations route misses, the 98 rendered-only routes, ambiguous label collisions, and the broader provenance and production-evidence gates recorded in the archive requirements matrix.
