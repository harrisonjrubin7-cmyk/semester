# Gap analysis

## Executive finding

The archive is broader than the production surface, but much of that breadth is catalog, prototype, policy, or future operating-model material. The repository has substantial foundations; the safe path is incremental reconciliation, not replacement. This is a legacy audit view; current dispositions and gate status live in [`../../design-system/HANDOFF-INTEGRATION-STATUS.md`](../../design-system/HANDOFF-INTEGRATION-STATUS.md) and its linked generated reconciliation registers.

| Status | Count |
| --- | ---: |
| existing/verified | 465 |
| existing/defective | 0 |
| partial | 610 |
| absent | 166 |
| ambiguous | 0 |
| conflict | 336 |
| externally blocked | 18 |
| not applicable | 0 |
| **Total** | **1,595** |

“Existing/verified” means matching repository evidence was found. It does not mean live institutional operation, GA approval, provider activation, UAT, or completion of release gates.

## Material gaps

1. **Catalog coherence:** the 379-row union of 281 handoff routes and 362 rendered routes is now reconciled against 673 catalog labels in [`ROUTE-IDENTITY-CROSSWALK.md`](./ROUTE-IDENTITY-CROSSWALK.md). Exact and normalized-only label matches are reported separately. The remaining gap is disposition: 17 handoff-only Operations routes, 98 rendered-only routes, and ambiguous labels still need authoritative owners and decisions.
2. **Staff/institutional surfaces:** prior row evidence concentrates gaps in administration, integrations, trust/privacy/security operations, and `/ops`.
3. **Workflow proof:** approval, reconciliation, cutover, launch, and retirement need server transitions, retries, audit evidence, and owners.
4. **Token conflicts:** 335 archive token rows do not match `tokens.css` by selector, name, and normalized value; the other 49 token rows are exact matches. Conflicts need explicit mapping, not copying.
5. **Document authority:** overlaps lack consistent owner, approval, effective date, and implementation evidence.
6. **Authority classification:** archive labels do not prove memberships or grants; private student segments belong in `student_context`, family access belongs in consent-scoped `family_grants`, and actual roles still require RLS, provisioning, access review, and revocation evidence.
7. **Asset provenance:** fonts have OFL evidence; many images, icons, screenshots, and maps do not.
8. **Test evidence:** the app build/test/browser matrix was not run; the bundled runtime exposed Node but no npm executable.

## Preservation constraints

Preserve route/navigation authorities and history; `semester-store`, collection stores, `semester.v1` rollback, and unknown fields; semantic tokens and saved appearances; feature flags, server capabilities, RLS, and audit boundaries. Never convert a designed state into fabricated institutional readiness.

## Gate relationship

**SUPERSEDED AS THE CURRENT GATE.** File inspection, the 1,595-row legacy ledger, and the supplemental route-identity crosswalk are complete. The current design-system status records Phase 0 archive-population reconciliation as complete and owns the active implementation boundary. The 17/98 route-source deltas, incomplete rendered-state walkthrough, narrative requirements, provenance gaps, and test evidence listed here remain follow-up evidence needs; they are not a competing Phase 0 verdict or proof of production readiness.
