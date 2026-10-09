# Reference catalog-screen reconciliation

**Automation pass** 5 · **Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086` · **Source** `ui_kits/master-catalog/catalog-data.js` · **Rows** 673 · **CSV SHA-256** `989d65402940915083ceea8d33237dc8cfe7e0b5d68ca02fe2e0c9d4f0cbf8e1`

[`REFERENCE-CATALOG-SCREEN-RECONCILIATION.csv`](REFERENCE-CATALOG-SCREEN-RECONCILIATION.csv) gives every archive screen-catalog row exactly one disposition. It preserves three separate populations: 673 archive catalog rows, 281 prototype routes and 589 current repository catalog rows. It does not create routes or treat a matching label as end-to-end verification.

The apparent 84-row catalog increase is not 84 independently specified screens. The archive's own `addedScreens` field declares those rows to be selected workflow-step projections. The first 589 rows, group by group and in order, exactly equal the repository catalog labels in `docs/master/REPO_AUDIT.md`; the remaining 84 exactly equal `addedScreens`. Those aliases are therefore duplicate or superseded here and stay owned by the canonical 319-row workflow reconciliation.

## Reproducible method

From the repository root:

```bash
node scripts/reconcile-reference-catalog-screens.mjs .semester-reference/12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086
```

The generator parses the JSON assignment as data and never evaluates archive JavaScript. It fails unless it finds exactly 673 archive screen rows, 84 declared workflow aliases, 589 repository catalog rows, exact group-and-position equality for the 589 base labels, exact appended-order equality for all aliases and 673 unique output keys.

Classification is bounded as follows:

1. A repository `exists` or `partial` row is **existing but incomplete**. `REPO_AUDIT.md` explicitly does not prove the full release definition.
2. Advisor Caseload and Student profile remain **existing but incomplete** despite their older `missing` audit labels: current shared-plan behavior supplies only the student-consented analogue, not an institution-wide roster or general profile.
3. An absent current-catalog row is **missing and in scope** only when the user-authorized integration program permits a bounded implementation and the row has a current owner profile, dependencies and acceptance contract.
4. Broad faculty student-progress surveillance, automated academic-integrity accusation, hidden advisor risk ranking, local directory/marketplace listings, reaction mechanics outside the current community contract and employer talent discovery without a student-created grant are **intentionally excluded** under current repository boundaries.
5. Calendar booking, OneRoster REST, Edu-API configuration and penetration-test evidence are **blocked externally** because the missing vendor/endpoint/credentials/operational owner or actual assessment cannot be invented in the repository.
6. Alumni donations/advancement handoff remains **documentation or roadmap only**.
7. Every `addedScreens` workflow projection is **duplicate or superseded** as a screen row. Its workflow item will receive the authoritative disposition in the next workflow pass.

## Evidence-profile inheritance

The CSV reuses P1–P11 from [`REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md); it does not create a second authorization model. Each CSV row also records its exact current evidence or planned owner and a group-specific dependency/acceptance contract.

| Groups | Profile | Boundary inherited by each row |
| --- | --- | --- |
| A | P1 | Public claims, intake validation and deployment remain separately controlled. |
| B | P5 | Student-owned workspace data stays separate from official records; provenance, reversibility and explicit confirmation apply. |
| C, E, F, K, L | P6 | Exact course/institution/finance/integration capability, tenant scope, official-source authority and consequential-action controls apply. |
| D, G, H, I, J | P7 | Relationship, consent, delegated grant, privacy, moderation and employer-isolation boundaries apply. |
| M, N | P3 | Console shell access never grants an action; every operation still requires its exact capability, audit and recovery contract. |

For any missing-and-in-scope row, completion still requires the full vertical slice: discoverable route where applicable, repository-native UI, persisted server behavior, deny-by-default authorization, tenant isolation, validation/rate control, audit/idempotency/recovery, provenance/freshness, complete UI states, accessibility, 320px behavior, focused regression tests and release evidence. The CSV's owner and dependency fields identify where that proof must attach; they are not proof that it already exists.

## Structural result

| Disposition | Rows |
| --- | ---: |
| Existing and verified | 0 |
| Existing but incomplete | 534 |
| Missing and in scope | 44 |
| Prototype only | 0 |
| Duplicate or superseded | 84 |
| Documentation or roadmap only | 1 |
| Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision | 4 |
| Intentionally excluded with a repository-backed rationale | 6 |
| **Total** | **673** |

| Group | Rows | Existing incomplete | Missing in scope | Duplicate | Roadmap | Blocked | Excluded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · Public company, sales & marketing | 80 | 79 | 0 | 0 | 0 | 1 | 0 |
| B · Student OS | 82 | 70 | 0 | 12 | 0 | 0 | 0 |
| C · Faculty & Course Studio | 39 | 26 | 8 | 3 | 0 | 0 | 2 |
| D · Advisor & student success | 29 | 18 | 6 | 4 | 0 | 0 | 1 |
| E · Registrar & academic operations | 36 | 32 | 3 | 1 | 0 | 0 | 0 |
| F · Student accounts, aid & commerce | 29 | 28 | 1 | 0 | 0 | 0 | 0 |
| G · Campus life | 38 | 30 | 4 | 3 | 0 | 0 | 1 |
| H · Community & moderation | 35 | 26 | 2 | 6 | 0 | 0 | 1 |
| I · Family & guardian | 13 | 10 | 2 | 1 | 0 | 0 | 0 |
| J · Career, employer, alumni | 40 | 30 | 8 | 0 | 1 | 0 | 1 |
| K · Institutional administration | 49 | 40 | 1 | 8 | 0 | 0 | 0 |
| L · Integrations | 53 | 25 | 1 | 25 | 0 | 2 | 0 |
| M · Trust, privacy, security | 48 | 42 | 5 | 0 | 0 | 1 | 0 |
| N · Operations Command Center | 102 | 78 | 3 | 21 | 0 | 0 | 0 |

## Buildable candidates, not yet selected

The 44 missing-and-in-scope rows are candidates rather than a flat implementation queue. The dependency order begins with Course Studio foundations (course setup, syllabus, objectives, schedule and announcements), then exact role/relationship and official-record contracts, before dependent advisor, registrar, finance, campus, career, institution, integration, trust and operations surfaces. The workflow and remaining stream reconciliations may reveal that several catalog labels belong in one vertical slice or depend on an earlier shared contract.

No candidate is selected for production in this pass because the 319 workflow rows and the still-unreconciled execution streams can change dependency order and acceptance evidence. The next Phase 0 slice is the canonical 319-row workflow population, including the 84 aliases identified here.

## Release boundary

This pass changes reconciliation tooling and documentation only. It adds no product route, navigation item, permission, schema, server operation, token, dependency, deployment or external configuration. HawkScan DAST is not applicable to this non-production slice; its runtime and API key also remain unavailable. Full application gates are deferred because no production build input changed. Deployment, vendor configuration, institutional approval, UAT, accessibility conformance and external assurance remain open.
