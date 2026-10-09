# Reference prototype-route reconciliation

**Automation pass** 4 · **Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086` · **Source** `handoff/prototype/screens.json` · **Rows** 281 · **CSV SHA-256** `5b57fdb108ef876f5cc75d004c2ef3bd3e595bc7ef42d40cdedd8fd47e30bee4`

[`REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.csv`](REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.csv) gives every unique archive prototype route exactly one disposition. It maps the route to a current owner/evidence path, the P1–P11 permission and data-boundary profile from [`REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md), an exact current app-screen key where one exists, discoverability, exact normalized repository-catalog rows, reconciled capability rows and the release boundary.

The archive routes are identification evidence, not routes to add. A matching screen id, catalog label or capability row is classed **existing but incomplete** because it does not prove the archive URL, combined prototype behavior, authorization, persistence, recovery, responsive states and tests end to end. No row is called **existing and verified**. An unmatched design is **prototype only**, not automatically **missing and in scope**; current authority must first permit the capability and name its owner, data contract and acceptance path.

## Reproducible method

From the repository root:

```bash
node scripts/reconcile-reference-prototype-routes.mjs .semester-reference/12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086
```

The generator fails unless it reads exactly 281 archive routes, 589 current `REPO_AUDIT.md` screen rows and 122 already-reconciled capability rows. It also requires 281 unique archive route strings. Matching is deliberately bounded:

1. Marketplace routes are excluded by `D-1287`, including the two student prototype aliases that explicitly describe marketplace/buy-and-sell behavior.
2. Architecture/demo-flow views and archive mock/test harnesses are roadmap-only.
3. Exact reconciled capability routes or same-domain capability-area names inherit the capability row's disposition and P1–P11 boundary.
4. A student route key may map to the current `Screen` union; navigation is separately checked against `nav.ts` so nested/shell-only screens are not called registered destinations.
5. Exact normalized catalog labels and eight explicit public-site analogues may establish existing-but-incomplete evidence. Fuzzy label similarity never does.
6. Everything else remains prototype-only. The CSV still names the nearest current authority, but that is not an implementation claim.

## Evidence-profile inheritance

The CSV does not create a second permission system. P1–P11 retain the full capability, tenant/data authority, server-operation, audit/recovery/state, test, dependency and release-ceiling definitions in the capability register:

| Profiles | Route families |
| --- | --- |
| P1 | Public/company-site routes; public claims and intake constraints apply. |
| P2 | Applicant, identity and membership routes; server-derived identity, grants and revocation apply. |
| P3 | Trust and operations routes; `console:operate` is only shell access and exact action capability remains required. |
| P4 | Search and notification routes; self-service data, reversible edits and offline/error states apply. |
| P5 | Student and Studio routes; self-owned workspace data stays distinct from official institutional records. |
| P6 | Faculty, TA, institution, finance, insights and executive routes; course/exact-school authorization and official-source authority apply. |
| P7 | Advisor, support, career, campus, family, alumni, employer, success, club and social routes; consented or relationship-specific access applies. |
| P9 | Company/account routes; company metadata boundaries and the no-student-row isolation contract apply. |
| P10 | Prototype/roadmap routes; no production capability or acceptance evidence is inferred. |
| P11 | Marketplace routes; `D-1287` exclusion applies. |

P8 remains a valid capability-register profile but no route row required it as its primary profile after exact route reconciliation. Its governed-AI constraints still apply whenever a later vertical slice invokes those capabilities.

## Structural result

| Disposition | Rows |
| --- | ---: |
| Existing and verified | 0 |
| Existing but incomplete | 62 |
| Missing and in scope | 0 |
| Prototype only | 201 |
| Duplicate or superseded | 0 |
| Documentation or roadmap only | 13 |
| Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision | 0 |
| Intentionally excluded with a repository-backed rationale | 5 |
| **Total** | **281** |

| Workspace | Routes | Existing incomplete | Prototype only | Roadmap only | Excluded |
| --- | ---: | ---: | ---: | ---: | ---: |
| public | 8 | 8 | 0 | 0 | 0 |
| applicant | 4 | 0 | 4 | 0 | 0 |
| student | 62 | 32 | 28 | 0 | 2 |
| faculty | 17 | 3 | 14 | 0 | 0 |
| institution | 19 | 6 | 13 | 0 | 0 |
| advisor | 7 | 0 | 7 | 0 | 0 |
| ta | 4 | 1 | 3 | 0 | 0 |
| finops | 4 | 0 | 4 | 0 | 0 |
| support | 3 | 0 | 3 | 0 | 0 |
| admissions | 6 | 0 | 6 | 0 | 0 |
| career | 4 | 0 | 4 | 0 | 0 |
| campus | 5 | 1 | 4 | 0 | 0 |
| marketplace | 3 | 0 | 0 | 0 | 3 |
| insights | 3 | 0 | 3 | 0 | 0 |
| trust | 21 | 1 | 20 | 0 | 0 |
| family | 3 | 0 | 3 | 0 | 0 |
| alumni | 7 | 0 | 7 | 0 | 0 |
| employer | 3 | 1 | 2 | 0 | 0 |
| company | 17 | 3 | 11 | 3 | 0 |
| operations | 17 | 3 | 14 | 0 | 0 |
| os | 8 | 0 | 0 | 8 | 0 |
| success | 4 | 0 | 4 | 0 | 0 |
| executive | 4 | 1 | 3 | 0 | 0 |
| clubs | 4 | 0 | 4 | 0 | 0 |
| social | 13 | 1 | 10 | 2 | 0 |
| studio | 31 | 1 | 30 | 0 | 0 |

The high prototype-only count is intentional. The archive frequently splits one broad concept into many demonstration routes, internal labs, named examples and control views. Current Semester commonly provides one bounded native surface instead. This register does not create 201 production obligations from that difference. The 673-row archive catalog and remaining stream reconciliation must determine which absent concept has current authority and is dependency-ready.

## Release boundary

This pass changes reconciliation tooling and documentation only. It adds no app route, navigation row, permission, schema, server operation, token, dependency, deployment or external configuration. Current catalog labels marked `exists` or `partial` remain existing-but-incomplete against the vertical-slice completion contract. Live providers, institutional approval, UAT, accessibility conformance, deployment and HawkScan remain separate gates.
