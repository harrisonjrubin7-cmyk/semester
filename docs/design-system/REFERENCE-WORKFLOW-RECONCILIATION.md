# Reference workflow reconciliation

**Automation pass** 6 · **Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086` · **Source** `ui_kits/master-catalog/catalog-data.js` · **Rows** 319 · **CSV SHA-256** `bea99779e050238555b02a358bc13fae98e30b49df2795209af6a30efffc0c8e`

[`REFERENCE-WORKFLOW-RECONCILIATION.csv`](REFERENCE-WORKFLOW-RECONCILIATION.csv) gives every canonical archive workflow step exactly one disposition. It maps the archive's 17 named flows to the 319 unique workflow keys in `docs/master/REPO_AUDIT.md`, records current evidence or a planned owner, inherits an authorization/data-boundary profile, and names a dependency and acceptance contract. It does not turn a catalog label into proof of a complete workflow.

The archive and repository populations match exactly after the archive names are mapped to the repository's fuller headings: 319 rows, the same ordered labels within all 17 workflows, and no missing or duplicate key. The 84 rows projected into the archive screen catalog also resolve to exact zero-based workflow indices and labels. They remain aliases of these canonical rows; they do not add routes or screens.

## Reproducible method

From the repository root:

```bash
node scripts/reconcile-reference-workflows.mjs .semester-reference/12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086
```

The generator parses the JSON assignment as data and never evaluates archive JavaScript. It fails unless it finds exactly 319 archive steps, 319 unique repository workflow rows, exact group length/order/label equality, 84 valid screen aliases and 319 unique emitted archive keys.

Classification is bounded as follows:

1. Repository `exists` and `partial` rows are **existing but incomplete**. The source audit explicitly does not prove the vertical-slice completion contract, so none is elevated to existing and verified.
2. An absent row is **missing and in scope** only where current product authority permits the behavior and the CSV names the role/data boundary, owner and acceptance contract. Fifty-four rows meet that planning threshold; they are candidates, not completed features.
3. All sixteen developer-platform/marketplace rows are **documentation or roadmap only** under `D-1287`, including three rows whose technical primitives are partial. Per-field directory visibility and continuing-education enrollment are also roadmap-only because current product authority and a data owner are absent.
4. Accommodation approval and a signed sponsor measures sheet are **blocked externally**. Semester may route or record authorized evidence but cannot issue an accessibility-office decision or manufacture an institutional signature.
5. The four marketplace-commerce steps are **intentionally excluded** under `D-1287`; the proposed listing scanner also conflicts with `D-1298`.
6. Human-created advising escalation stays buildable only as a visible, appealable, relationship-scoped support process. Its acceptance contract expressly forbids hidden surveillance, scores and broad rosters.

## Evidence-profile inheritance

The CSV reuses P3, P5, P6, P7, P8 and P9 from [`REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md). These are crosswalk profiles, not new permissions.

| Workflows | Profile | Governing boundary |
| --- | --- | --- |
| Student | P5 | Student control, source authority, explicit confirmation, reversibility and provenance. |
| Faculty, registrar, implementation, integration, migration, finance | P6 | Exact institutional/course capability, tenant scope, official-source authority, audit and rollback. |
| Advising, support, campus, community, career, family | P7 | Relationship or delegated grant, minimization, revocation, moderation and employer isolation. |
| Governed AI | P8 | Policy ceiling, data minimization, exact tool permission, provenance, evaluation and human handoff. |
| Incident and analytics | P3 | Console access does not grant an operation; staffing, exact capability, evidence and recovery still apply. |
| Developer platform | P9 | Roadmap only pending a newer product decision, owner, tenant/data model and security contract. |

For every buildable row, completion still requires the applicable discoverable route, repository-native UI, persisted server behavior, deny-by-default authorization, tenant isolation, validation/rate control, audit/idempotency/recovery, provenance/freshness, complete states, accessibility, 320px behavior, focused regression tests and release evidence. The current-owner and dependency fields locate that proof; they do not provide it.

## Structural result

| Disposition | Rows |
| --- | ---: |
| Existing and verified | 0 |
| Existing but incomplete | 241 |
| Missing and in scope | 54 |
| Prototype only | 0 |
| Duplicate or superseded | 0 |
| Documentation or roadmap only | 18 |
| Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision | 2 |
| Intentionally excluded with a repository-backed rationale | 4 |
| **Total** | **319** |

| Archive workflow | Rows | Screen aliases | Final disposition summary |
| --- | ---: | ---: | --- |
| Student | 40 | 5 | 40 existing incomplete |
| Faculty | 24 | 3 | 15 existing incomplete; 9 missing in scope |
| Advisor / student success | 17 | 4 | 7 existing incomplete; 10 missing in scope |
| Registrar | 21 | 1 | 20 existing incomplete; 1 missing in scope |
| Institutional implementation | 22 | 8 | 19 existing incomplete; 3 missing in scope |
| Controlled integration | 20 | 6 | 20 existing incomplete |
| AI | 17 | 7 | 17 existing incomplete |
| Support | 12 | 8 | 11 existing incomplete; 1 missing in scope |
| Incident | 17 | 8 | 8 existing incomplete; 9 missing in scope |
| Domain migration | 17 | 9 | 16 existing incomplete; 1 missing in scope |
| Student finance | 16 | 0 | 15 existing incomplete; 1 missing in scope |
| Campus services | 15 | 3 | 11 existing incomplete; 3 missing in scope; 1 blocked |
| Community & moderation | 20 | 6 | 14 existing incomplete; 1 missing in scope; 1 roadmap; 4 excluded |
| Career & employer | 18 | 0 | 9 existing incomplete; 8 missing in scope; 1 roadmap |
| Family consent | 13 | 1 | 12 existing incomplete; 1 missing in scope |
| Developer platform | 16 | 10 | 16 roadmap only |
| Analytics & outcomes | 14 | 5 | 7 existing incomplete; 6 missing in scope; 1 blocked |

## Dependency result

This pass narrows the buildable workflow population from the audit's 75 missing labels to 54 authorized candidates. It still does not select production work. Several early-looking candidates depend on decisions that the remaining execution streams, role catalog, system catalog and document catalog own: Course Studio needs a course-shell/assignment authority sequence; advising needs verified relationship and consent semantics; incident work needs staffed role ownership; analytics needs an approved metric and privacy contract.

The next Phase 0 slice is the remaining Stream 00–30 reconciliation at meaningful-item level, beginning with the unreconciled role, system and document catalog populations and their stream-owned dependencies. Only after those controls agree can the earliest vertical slice be selected without guessing.

## Release boundary

This pass changes reconciliation tooling and documentation only. It adds no product route, navigation item, permission, schema, server operation, token, dependency, deployment or external configuration. HawkScan DAST is not applicable to this non-production slice; its runtime and API key also remain unavailable. Full application gates are deferred because no production build input changed. Deployment, vendor configuration, institutional approval, UAT, accessibility conformance, staffing, restore evidence and external assurance remain open.
