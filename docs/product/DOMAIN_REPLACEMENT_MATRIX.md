# Domain replacement matrix

Status: Phase 0 baseline, assessed 2026-10-05 at `790ebbf`. Read-only audit; no test was run. This document defines the fifteen replacement gates and applies them to every domain. **No domain may be marked "native authoritative" without passing every applicable gate**, with dated evidence and institutional approval. Today none does: the repository's own register says 0 of 14 (`docs/DOMAIN-REPLACEMENT-REGISTER.md`, rendered from `app/src/lib/replaceregister.ts`; five requirements stop every domain: `r-lifecycle`, `r-migration`, `r-change`, `r-contract`, `r-exit`).

That register is the executable source and stays authoritative for its 14 domains. This matrix adds the gate definitions the brief asks for, widens the domain list, and corrects rows that understate the code (see the correction table in [the thesis](SEMESTER_UNIFIED_EDUCATION_OS_THESIS.md)). Mapping the fifteen gates below onto the register's fifteen `r-*` requirements is backlog item EOS-201; until it lands, treat the register as the gate of record and this matrix as the plan.

## The fifteen gates

A gate is passed only when its **evidence artifact** exists, is dated, names the exact version it covers, and was produced by someone other than the author of the change. Evidence from a synthetic fixture proves a mechanism, not readiness.

| # | Gate | Passed when (evidence artifact) | Applies to |
| --- | --- | --- | --- |
| 1 | Functional parity | A parity checklist for the domain, built from the incumbent system's real workflows with the institution, with every line either met by a named test or accepted as a documented exclusion by the institution | All |
| 2 | Data model completeness | Every field the institution uses in the incumbent has a native column, a mapping and a classification, or a documented exclusion; no free-text overflow | Record domains |
| 3 | Accessibility | A qualified accessibility review against the target standard on the exact build, plus assistive-technology walk-throughs of each core task; findings closed or accepted in writing | All user-facing |
| 4 | Security and privacy controls | Independent assessment and DAST on the target environment; data-flow map; privacy review; subprocessor list current | All |
| 5 | RLS and tenant isolation | Cross-tenant negative tests for every table and function the domain touches, run against the production-major database, including non-database layers (cache, queue, object store, search, analytics, AI retrieval) | All |
| 6 | Auditability | Every write and every sensitive read produces an audit event that names actor, tenant, purpose, correlation id and policy version; chain verification passes | Record, workflow |
| 7 | Migration integrity | Import of the institution's real data reconciles: counts, semantic checks (e.g. grades attributed to the right students), duplicate handling, lineage, with sign-off by two people | Record |
| 8 | Reconciliation | A scheduled reconciliation against the incumbent runs, discrepancies queue and age, and a named owner clears them | Record, mirror |
| 9 | Dual-run reliability | Two consecutive full-scale passes against the live incumbent within the staleness limit, with agreement above the threshold the institution set | Record |
| 10 | User acceptance | Representative users complete the core tasks unassisted; results written up; an institutional acceptance signature | All |
| 11 | Institutional policy approval | Written approval by the people with authority (registrar, bursar, counsel, CIO as relevant), recorded in the approval system | Record, workflow |
| 12 | Support readiness | Named staff, a rota, a runbook exercised once, an SLA the institution accepted | All |
| 13 | Incident and rollback readiness | A rollback to the incumbent performed on rehearsal data inside the agreed window; an incident exercise held; a restore drill on the target | Record, workflow |
| 14 | Export and portability | The institution can export every record in an open format that the incumbent or a successor can load; exercised once | Record, workflow |
| 15 | Commercial and implementation readiness | Order form, price, implementation plan, owner on both sides, and a tenant contract recorded (`contracts/` is empty today) | All sold domains |

Rollback evidence in the repository today is **tooling**: `app/src/lib/migration/rehearsal.ts` requires two consecutive full-scale passes, a rollback actually performed, and a staleness limit; `parallel-run.ts` assesses agreement; the Migration Center needs a date, a rollback plan and a decision per area. None has run on real data (`docs/migration/README.md`: "never yet run against a real institution").

## Marks

`●` the mechanism exists and a test or check suite asserts it. `◐` part of the mechanism exists. `○` nothing exists. `n/a` the gate does not apply to this domain class. **A mark never means the gate is passed.** Gates 3, 9, 10, 11, 12, 13 and 15 are `○` for every domain because nothing has been run with an institution, accessibility has had no qualified review (`GO-NO-GO-DECISION.md` blocker), and no support service is staffed.

Gate 3 shows `◐` only where automated accessibility checks exist (`app/scripts/accessibility-smoke.mjs`, `docs/WCAG-UI-AUDIT-SCORECARD.md`); that is not a review.

## Matrix

Domains are the register's 14 first, then the domains the brief adds.

| Domain | Native today | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Identity | NI | ◐ | ◐ | ◐ | ◐ | ● | ● | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Student portal | NV (device) | ◐ | ◐ | ◐ | ◐ | ● | ◐ | n/a | n/a | n/a | ○ | ○ | ○ | ○ | ● | ○ |
| Course catalog | NS (authoring) | ○ | ◐ | ○ | ◐ | ● | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Degree planning | NS (audit) | ○ | ○ | ◐ | ◐ | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Registration | NV in DB | ◐ | ● | ○ | ◐ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| LMS (Course Studio, gradebook) | NI / NV in DB | ◐ | ◐ | ◐ | ◐ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Advising | PL (cases) | ○ | ○ | ◐ | ◐ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Student accounts | NV in DB, **UA** | ◐ | ● | ○ | ◐ | ● | ● | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Financial aid | NS | ○ | ○ | ○ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Housing | PL | ○ | ○ | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Dining | NV in DB, **UA** | ◐ | ● | ○ | ◐ | ● | ● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Career | NI | ◐ | ◐ | ◐ | ◐ | ● | ◐ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Campus community | NV, off | ◐ | ● | ◐ | ● | ● | ● | n/a | n/a | n/a | ○ | ○ | ◐ | ◐ | ◐ | ○ |
| Institution operations | NI | ◐ | ◐ | ◐ | ◐ | ● | ● | ◐ | ◐ | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Productivity workspace | NV / NI | ◐ | ◐ | ◐ | ◐ | ● | ◐ | n/a | n/a | n/a | ○ | ○ | ○ | ○ | ● | ○ |
| AI (governed gateway) | NI | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | n/a | n/a | n/a | ○ | ○ | ○ | ◐ | n/a | ○ |
| Search | NI | ◐ | ◐ | ◐ | ◐ | ◐ | ○ | n/a | n/a | n/a | ○ | ○ | ○ | ○ | n/a | ○ |
| Family and guardian | NV (suites) / **UA** (K-12) | ◐ | ◐ | ◐ | ◐ | ● | ● | n/a | n/a | n/a | ○ | ○ | ○ | ○ | ◐ | ○ |
| Company operations | NI | ◐ | ◐ | ◐ | ◐ | ● | ● | n/a | n/a | n/a | ○ | ○ | ○ | ○ | ○ | ○ |

Basis for the notable cells:
- **Registration gate 6 `●`:** `registration_audit_event` and the transaction suite. **Gate 7 `○`:** no importer; no real data.
- **Student accounts gate 8 `◐`:** payment-plan and ledger reconciliation exist in the check suites; no provider to reconcile against. Gate 6 `●` from the HMAC-sealed `ledger_chain`.
- **Campus community gate 4 `●`:** `scoped_pseudonymity`, volunteer moderation, institution escalation and the crisis path are DB- and test-held. Gate 12 `◐`: moderators are the only "supportable" roles (runbook plus training), which is the repository's own judgement, not an exercised rota.
- **Platform-wide gate 5:** `●` is for database tables. Non-database layers (cache, queue, object store, search, analytics, AI retrieval) are proven only on in-memory adapters (`packages/platform/src/isolation`), so any domain whose data touches them is `◐`, which is why AI and Search show `◐`.
- **Identity gate 14 `◐`:** deprovisioning exists; no export to a successor directory.

## Per-domain gap to the next role step

The step from *mirror* to *ledger* to *record* (see [authority rules](DOMAIN_AUTHORITY_MATRIX.md)) and what blocks it.

| Domain | Next step | Blocking, in order |
| --- | --- | --- |
| Registration | Live mirror of SIS sections and holds, then supervised native handoff | SIS adapter (EOS-401); reconciliation schedule; reject-and-explain parity test against SIS rules; registrar sign-off. Native submission stays off until gates 7 to 13 |
| Academic record | Importer then read-only student view | Importer (EOS-402); student read screen; legal review of transcript wording `+REV`; then `+APP +MIG` |
| Gradebook | `LmsAdapter` for passback with idempotency and read-back | AGS idempotency ledger and result read-back (EOS-302); policy mapping; faculty acceptance; institution approval |
| Degree planning | Requirement import from the institution's audit | A requirement source; registrar certification; no native audit before gate 9 |
| Student accounts | Provider and finance owner, then read-only mirror of balance | Nine preconditions (`docs/MONEY-MODULES-SWITCH-ON.md`); counsel; bursar |
| Dining | Card-office connection | Vendor connection; staff screen |
| Advising | Case model | Privacy review; caseload design; no risk scores (the `FORBIDDEN` list) |
| Identity | One live IdP acceptance run | A design-partner IdP; OIDC; offboarding notice |
| Catalog | Live feed, then authoring | Feed; catalog-year versioning |
| LMS (submissions) | LTI launch from a real LMS | A real platform registration; NRPS decision |
| Housing, financial aid | Define scope with the institution | `+REV`; vendor decision |

## Domains that must never reach "native authoritative" automatically

Even with all gates passed, these require an explicit institution decision per tenant and a counsel review each time: financial records and payments, grades and transcripts, identity and provisioning, legal holds and conduct, health, counseling and emergency data (purpose-limited handoff only), and anything about a minor. The gate evaluator treats "approved" as per-tenant, per-domain, per-version, with an expiry.

## Executable form (proposal)

`replaceregister.ts` computes the verdict from rows and requirement states and its test refuses an unevidenced `tested`. Extending it is the cheapest way to keep this matrix honest: add the seven operational gates as requirements that can be `tested` only by a cited evidence artifact under `docs/evidence/` (the directory does not exist today, which is itself the finding), and have a CI check fail when this matrix shows a mark the register contradicts. Tracked as EOS-201 and EOS-202.
