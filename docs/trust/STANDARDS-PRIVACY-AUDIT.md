# Standards and privacy audit implementation

Assessment date: 2026-10-01. Baseline: `46ee2414a2def0a87b23a3611cb771b2f94fade1`.

The five supplied PDFs are tracked by filename and SHA-256 in `standards-audit-sources.json`. They describe requirements; they are not operational evidence.

## Delivered

- Institution → Trust includes a searchable control matrix, standard/family/owner filters, workflow mode, evidence drilldown, blockers and full JSON export.
- The view covers 32 requirement groups, 16 education-data domains and all 65 RFP questions from the interactive-dashboard PDF.
- Scores come from the master register. The weakest referenced control determines maturity. A mandatory control below 3 blocks its mode regardless of weighted score. Filters cannot alter release scoring or export scope.
- The RFP CSV carries response, evidence ID/date, owner, limitation, remediation target and production applicability; answers remain blank pending review.
- Every new integration reference receives server-generated source owner, permitted purpose, freshness expiry, retention policy/expiry, consent-purpose binding and default AI denial. The worker persists this envelope as a reserved JSON string in the existing flat display object; tenant/subject isolation is unchanged. The provider display retains its 4 KB allowance, with a separate allowance for server governance metadata.
- Adapter declarations reject missing/invalid retention clocks and source ownership. Provider data cannot set the envelope or map to its reserved field. Existing metadata is not retroactively invented; these clocks describe policy and do not replace live consent checks or retention sweeps.
- Rev. 4 Appendix J privacy family labels in the PDFs are corrected to real Rev. 5 control IDs. Edu-API domain alignment is distinguished from implemented endpoint support and certification.

## Requirement groups and registered maturity

| Requirement | Owner | Mode | Register rows | Maturity / 4 |
|---|---|---|---|---|
| Identity and account lifecycle | Identity | Observe | IAM-003, IAM-004, IAM-005 | 1 |
| Tenant and object isolation | Security | Observe | IAM-007, IAM-008, IAM-009 | 2 |
| Signed LMS contextual launch | Integrations | Observe | INT-002 | 2 |
| Course membership and roster expiry | Integrations | Observe | INT-003 | 0 |
| Faculty content placement | Faculty and integrations | Assist | INT-004 | 2 |
| Confirmed and reconciled grade passback | Faculty and integrations | Operate | INT-005, AI-009 | 1 |
| Roster exchange compatibility | Integrations | Observe | INT-006 | 0 |
| Canonical enterprise data and source mappings | Data governance | Observe | INT-001, INT-009 | 1 |
| Assessment portability | Learning systems | Assist | INT-007 | 1 |
| Course migration and portability | Implementation | Assist | INT-008, MIG-002 | 1 |
| Source lineage and freshness | Data governance | Observe | TRUST-001, TRUST-002, AI-004, AI-005 | 1 |
| Authority, purpose and minimization | Privacy | Observe | SEC-008, TRUST-003, AI-006 | 1 |
| Student-controlled sharing and revocation | Privacy | Assist | UOS-007, TRUST-003 | 1 |
| Retention, legal hold, deletion and exit | Privacy and operations | Observe | SEC-008, SEC-009 | 1 |
| Read, write, consent and AI audit trail | Security | Observe | SEC-006 | 1 |
| Privileged and support access review | Security | Observe | IAM-010, IAM-011 | 1 |
| Agent, model and tool governance | AI governance | Assist | AI-001, AI-002, AI-003, AI-013 | 1 |
| Course and assessment policy enforcement | Faculty and AI governance | Assist | AI-006, AI-007 | 1 |
| Prompt injection and exfiltration protection | Security and AI governance | Assist | AI-010, AI-011 | 1 |
| AI safe mode and incident escalation | AI governance and operations | Assist | AI-012, AI-014 | 1 |
| Official workflow authority and confirmation | Institution workflow owner | Operate | AI-009, INT-001 | 1 |
| Integration outage safety and recovery | Integrations | Observe | INT-001, INT-013, INT-014 | 1 |
| Backup restoration and disaster recovery | Operations | Observe | SRE-004, SRE-005, SRE-006 | 1 |
| Service health and academic peak capacity | Operations | Observe | SRE-001, SRE-002, SRE-003, SRE-007, SRE-009, SRE-010 | 1 |
| Secure releases and vulnerability remediation | Engineering and security | Observe | SEC-002, SEC-003, SEC-004, SEC-005, SRE-008 | 1 |
| Vendor, residency and subprocessor controls | Privacy and procurement | Observe | SEC-010, AI-002 | 1 |
| Security and privacy incident operations | Security and operations | Observe | SEC-007 | 1 |
| Accessible product, content and workflow delivery | Accessibility | Observe | A11Y-001, A11Y-002, A11Y-003, A11Y-004, A11Y-005, A11Y-006, A11Y-007 | 1 |
| Phased institution configuration and migration | Implementation | Operate | IMP-001, MIG-001, MIG-005, MIG-006, UOS-009 | 1 |
| Campus knowledge and support routing | Student services | Assist | UOS-001, UOS-002 | 1 |
| Student-selected career evidence and opportunities | Career services | Assist | UOS-004, UOS-005, UOS-007 | 1 |
| Aggregate outcomes and experimentation | Institutional research | Assist | UOS-008 | 2 |

## Broader enterprise capabilities in the expansion PDF

| Pillar | Existing implementation / assessed controls | Remaining operational proof |
|---|---|---|
| Trust Center | Policy simulator, consent, source registry, model controls, incident paths, audit; AI-001–014 / SEC / TRUST | Approved terms, reviewed control evidence, incident drills and accountable owners |
| Integration Fabric | Tenant control plane, worker, mappings, identity, LTI launch/deep links, sandbox adapters | Approved real LMS/SIS adapters, source reconciliation, NRPS/OneRoster support where advertised and platform UAT |
| Institution Studio | Configuration Studio, WorkflowBuilder, module modes, MigrationCenter | Named tenant approval, live configuration review, parallel run and rollback |
| Accessibility Center | Preferences, keyboard/focus/semantics checks, content tools | Human assistive-technology QA, current VPAT/ACR and remediation evidence |
| Evidence Graph | Career, portfolio, source provenance, selected shares | Verified portable credential and CASE support where advertised; employer consent/UAT |
| Value Analytics | Cohort-suppressed aggregate operations and demand views | Approved outcomes definitions, opt-in experiments and real measurements |

## Release and activation boundaries

This release adds audit and ingestion metadata capabilities. It does not authorize official-record writes or certify institutional readiness. A named institution must still provide identity/LMS/SIS configuration and UAT, signed processing/vendor terms, required accessibility and security assessments, operational restore and incident evidence, and accountable launch signoffs. Optional standards without an implemented client remain blocked rather than painted green.

The audit is product-wide, not a per-tenant attestation. Evidence exported from it is the cited register content, not authenticated access to restricted procurement artifacts. Backend deployment, tenant policy and database authorization remain independent.

## Validation commands

```bash
cd app
npm test
npm run test:shuffle
npm run build
npm run lint
npm run check:university
```

Publication verification requires the original generated files outside this checkout:

```bash
SEMESTER_PUBLICATION_DIR=/absolute/path/to/semester-institutional-rollout npm run test:publication
```

That separate suite retains all artifact/hash/content checks and still fails when deliverables are absent. The application suite no longer depends on a path in another session’s scratch directory.

Local browser navigation was blocked by the browser environment. Rendered React interaction tests cover views, filters, no-hidden-blocker behavior and accessible table structure; live browser review remains part of release verification.

## Authoritative references

- https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
- https://csrc.nist.gov/pubs/sp/800/53/a/r5/final
- https://standards.1edtech.org/edu-api/
- https://www.1edtech.org/standards/lti

Local validation: 1,220 application test files passed; 19,308 tests passed and 48 existing opt-in/live tests skipped. Production build, lint (existing warning budget), application types and institutional gateway types passed. The separate publication suite was not run: original external artifacts are unavailable.

Final verification: the shuffled application suite also passed all 1,220 files and 19,308 tests (48 existing skipped). Performance budgets passed after lazy-loading the audit; first load is 428.3 KB against 435.0 KB. Removing the mandatory-blocker calculation made its negative-control test fail; the implementation was restored and retested.

Release follow-up (2026-10-01): the user explicitly approved public source publication and deployment after CI. PR #1068 is published; merge and deployment remain gated on CI and review findings.

Review corrections:
- Reconfirmed source revisions refresh only their retrieval and freshness clocks, using the connection freshness override when configured, otherwise the stored freshness duration; provider values, provenance, purpose and retention deadlines stay unchanged even when an adapter declaration changes. Concurrently replaced/deleted revisions cannot be refreshed, and a reappearing source record receives a full import.
- Reconciliation tombstones all missing references in one database call while retaining each row's own governance envelope.
- A migration preserves the provider's 4 KB display allowance with a bounded server-metadata allowance. Flat values and never-ingest rules remain enforced.
- Direct LTI context writes now persist source, purpose, expiry and default AI denial. Tenant-wide LTI context uses the existing tenant-lifetime retention policy, with a null time-based expiry; no new retention sweep is claimed.
- The explicit publication command selects strict mode even without a supplied directory, so missing artifacts fail instead of being skipped.

Focused regression validation: 178 tests passed, along with application/gateway type checks and lint. The publication command correctly exits nonzero when external artifacts are absent. SQL regression cases cover near-limit displays, direct LTI metadata, tenant isolation, source revision races and tombstone retention; PostgreSQL 17 validation is pending in CI.

## Approved release retry

HawkScan run `36893630069` and CI run `36893630341` passed for published head `f6f2d0ea81229fc82d0a7a1217604352ba120393`. The user subsequently approved publishing the final review fixes, merging and deploying after fresh CI passes.

After workspace maintenance removed the earlier local checkout, the final fixes were reconstructed from the recorded changes on PR #1068 and merged with main `d51963dfe6d9701de4efe216cbe2a4ee3f00a16d`. Metadata-only refreshes now preserve stored provenance, purposes, retention deadlines and freshness duration; only retrieval/freshness clocks change. Worker and SQL regressions cover changed adapter source, purpose, version and duration. Role validation uses a small ID module so startup does not load conversation prompts and tool policies.

Restored local validation: 98 focused tests passed; production build, performance budgets (431.3 KB startup), lint and institutional gateway type checks passed. The updated SQL regression awaits PostgreSQL 17 validation in fresh CI. Publication, merge and deployment will be verified on the final commit; institutional activation still requires the evidence described above.

Final review corrections bind new envelopes to the effective connection freshness target and apply changed connection targets on metadata refresh without relabeling provenance or extending retention. Failed persistence withholds the cursor and releases the event claim for redelivery. The existing daily, service-only retention sweep removes expired live governance references while respecting connection legal holds; malformed/legacy or null deadlines keep the existing lifecycle policy. Worker regressions cover RPC errors and source races; PostgreSQL regressions cover freshness overrides, live expiry, legacy metadata and hold release.

Additional edge-case validation covers zero/negative/sub-minute freshness targets, full provider remapping of missing or malformed legacy governance while retaining timestamp-regression checks, and central account/tenant/platform holds. The retention sweep visits tenants owning surviving references or snapshots even after their last connection is removed. No refresh attaches a current envelope to legacy values.

Connection deletion is refused while its legal hold remains active, preserving the hold during orphan cleanup. Effective freshness intervals share a one-minute floor and 365-day ceiling across worker/scheduler parsing, metadata refresh and direct LTI writes; raw pipeline overrides above that ceiling are refused before claiming an event. Regression cases include a 300,000-year interval and held connection deletion followed by hold release.
