# Reference role, system and document reconciliation

**Archive** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086` · **Population** 49 roles + 88 systems + 82 documents = 219 rows · **Status** Phase 0 evidence, not release evidence

[`REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.csv`](REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.csv) gives every role, system and document row in the archive master catalog exactly one disposition. The register maps each row to a current repository owner or evidence path and records the dependency and acceptance boundary that must be satisfied before a buildable item can be called complete.

The generator reads `ui_kits/master-catalog/catalog-data.js` as JSON data. It does not import or execute archive source, create archive roles, adopt archive system ownership, or install archive documents as a second authority.

## Structural proof

- The archive master catalog contains exactly 49 role rows, 88 system rows and 82 document rows.
- The generated CSV contains exactly 219 unique keys and 220 lines including its header.
- Every role mapping that names a grantable role resolves to the migration-rendered [`ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md).
- Every document row resolves to an existing current repository document or code authority. Directory owners are recorded only where the authority is intentionally a family, such as AI providers or runbooks.
- Every row has one allowed disposition, one evidence profile, current evidence or owner, a dependency/acceptance contract and a release-boundary rationale.

Reproduce from the repository root:

```bash
node scripts/reconcile-reference-catalog-roles-systems-documents.mjs \
  .semester-reference/12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086
```

## Results

| Population | Rows | Existing but incomplete | Missing and in scope | Duplicate or superseded | Documentation or roadmap only | Intentionally excluded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Roles | 49 | 36 | 0 | 9 | 4 | 0 |
| Systems | 88 | 84 | 1 | 0 | 2 | 1 |
| Documents | 82 | 0 | 0 | 82 | 0 | 0 |
| **Total** | **219** | **120** | **1** | **91** | **6** | **1** |

No row is classified existing and verified. Current role, schema, UI, test or document evidence does not prove the archive row's complete operational breadth.

## Role boundary

The archive's 49 labels are personas, not an authorization migration. Thirty-six map to current roles or to the student-created family grant and remain existing but incomplete. Nine are contextual variants or organizational synonyms that current scoped relationships supersede; examples include online student, adult learner, student worker and program director. Creating new text roles for those labels would fragment the current capability model without evidence of a distinct permission boundary.

Applicant, admissions staff and campus safety staff remain roadmap-only until a current product owner and institutional authority/data contract establish a grantable workflow. Developer/partner also remains roadmap-only under `D-1287`; integration primitives do not authorize a developer marketplace. No role in the current launch register is launch-approved, and this reconciliation does not change that state.

The graduate-student role exists, but that does not close the separately identified P11 graduate/research lifecycle gap. Milestones, committees, candidacy, funding and defense still need a domain owner, authority/data contract and accepted workflow.

## System boundary

Eighty-four system labels map to current code, schema, checks or operational documents and remain incomplete. The labels describe domains at different levels of abstraction; they are not evidence that one deployable service per archive row exists or should exist.

Four system rows carry narrower outcomes:

| Archive system | Disposition | Current boundary |
| --- | --- | --- |
| Marketplace | Intentionally excluded | `D-1287` declines the marketplace and its data model. |
| Developer Platform | Documentation or roadmap only | Requires newer product/security authority independent of marketplace scope. |
| Board/Investor Reporting | Documentation or roadmap only | Current board materials are documents and templates, not an operated portal or reporting system. |
| Projection/Read Models | Missing and in scope | Current-state evidence records no projection worker, watermarks, registry or rebuild path. |

Projection/read models are a buildable gap, not yet an automatically selected production slice. Current `origin/main` now includes the domain-event writer, while the remaining execution-stream reconciliation still owns the worker/read-model dependency sequence and acceptance evidence. A future slice must use the current outbox and idempotency contracts rather than the archive's proposed parallel schema.

## Document boundary

All 82 archive document requirements map to current repository authorities and are duplicate or superseded. This classification means the repository already has the subject's controlling document, draft, register, code authority or evidence family; it does not claim that the underlying capability, approval or external review is complete.

In particular:

- a legal draft is not legal approval;
- a HECVAT roadmap or questionnaire library is not independent assurance;
- a backup/restore runbook or test plan is not live restore evidence;
- a financial model specification is not validated revenue or runway;
- a release policy is not deployment evidence; and
- a role, system or architecture document is not proof of production behavior.

The current repository document remains the owner. Archive copies and generated drafts are not imported or maintained in parallel.

## Dependency result

This pass closes the role, system and document catalog populations, but Phase 0 remains open. The next slice must reconcile the remaining execution streams 00–30 and use those stream-owned dependencies to choose between the overlapping buildable candidates. The projection/read-model gap is now explicit, but Course Studio foundations, domain-event/outbox sequencing, storage boundaries and other cross-stream prerequisites still need one dependency order before production work begins.

## Verification and release boundary

The generator completed twice with identical population counts and validates source totals, unique keys, current role mappings, evidence-path existence and required fields. This slice changes reconciliation tooling and documentation only. It adds no production route, schema, role, permission, server operation, token, dependency, deployment or external configuration. Full application gates and HawkScan DAST are therefore not applicable to this slice; the HawkScan runtime and API key also remain unavailable. Deployment, provider configuration, institutional approval, UAT, legal review, accessibility conformance, staffing and live restore evidence remain open.
