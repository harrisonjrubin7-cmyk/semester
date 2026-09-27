# Strategic defensibility

The moat is not a feature list. Competitors can copy features. What they can't copy quickly is accumulated trust,
integration quality and evidence.

```text
Trusted institution integrations
+ action graph and source lineage
+ student-owned journey data
+ course-aware AI/policy layer
+ cross-module workflow context
+ implementation playbooks
+ accessibility quality
+ institutional trust evidence
+ partner ecosystem
+ outcome benchmarks
```

## How each part is measured

| Moat component | Measure | Reviewed |
| --- | --- | --- |
| Integration quality | Freshness SLA attainment per contract; connector recovery time | Monthly |
| Source lineage | Share of shown facts carrying source and freshness | Monthly |
| Course-aware policy layer | Courses with an explicit AI policy configured | Termly |
| Implementation expertise | Time from signature to first live workflow | Per deal |
| Accessibility quality | Open serious/critical defects; audit result | Monthly / annually |
| Trust evidence | HECVAT, ACR, DPA, pen-test and audit artefacts current | Quarterly |
| Reference customers | Referenceable institutions | Quarterly |
| Outcome benchmarks | Institutions contributing to aggregated, privacy-preserving benchmarks | Annually |

## How it is protected

| Protection | Rule |
| --- | --- |
| Canonical data model | One contract (`packages/contract`, see [data-contract.md](../data-contract.md)); adapters map to it, never the reverse |
| IP assignment | Every employee and contractor signs an invention assignment before first commit; see [IP.md](../../IP.md) |
| Trade secrets | Evaluation sets and action-ranking rules held in access-controlled storage, not in public artefacts |
| Trademark | Register the mark in core classes; hold the primary domains and common misspellings |
| API versioning | Public APIs versioned; a breaking change needs a deprecation period of at least one term |
| Data portability, not lock-in | Students and institutions can export their data in documented formats at any time. Lock-in via data is a trust liability, not a moat |
| Continuous integration quality | The gates in [REGRESSION-CHECKLIST.md](../../REGRESSION-CHECKLIST.md) |
| Benchmarks | Built only from aggregated, consented, privacy-preserving outcomes, with a minimum cell size |
