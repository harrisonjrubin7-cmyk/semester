# Gap analysis

## Executive finding

The archive is broader than the production surface, but much of that breadth is catalog, prototype, policy, or future operating-model material. The repository has substantial foundations; the safe path is incremental reconciliation, not replacement.

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

1. **Catalog coherence:** 281, 362, and 673 screen totals are not normalized by identity, ownership, state, or reachability.
2. **Staff/institutional surfaces:** prior row evidence concentrates gaps in administration, integrations, trust/privacy/security operations, and `/ops`.
3. **Workflow proof:** approval, reconciliation, cutover, launch, and retirement need server transitions, retries, audit evidence, and owners.
4. **Token conflicts:** 335 archive token rows do not match `tokens.css` by selector, name, and normalized value; the other 49 token rows are exact matches. Conflicts need explicit mapping, not copying.
5. **Document authority:** overlaps lack consistent owner, approval, effective date, and implementation evidence.
6. **Authority classification:** archive labels do not prove memberships or grants; private student segments belong in `student_context`, family access belongs in consent-scoped `family_grants`, and actual roles still require RLS, provisioning, access review, and revocation evidence.
7. **Asset provenance:** fonts have OFL evidence; many images, icons, screenshots, and maps do not.
8. **Test evidence:** the app build/test/browser matrix was not run; the bundled runtime exposed Node but no npm executable.

## Preservation constraints

Preserve route/navigation authorities and history; `semester-store`, collection stores, `semester.v1` rollback, and unknown fields; semantic tokens and saved appearances; feature flags, server capabilities, RLS, and audit boundaries. Never convert a designed state into fabricated institutional readiness.

## Phase 0 gate

**NOT PASSED.** File inspection and the canonical 1,595-row ledger are complete, but narrative requirements and interactive states still need atomization and reconciliation. The screen-count conflict, incomplete 362-route state walkthrough, unmapped narrative requirements, and absent current test baseline block implementation.
