# Institutional trust scorecard

**Status:** metric catalog and state calculation built; pilot baselines and most live measurements are not yet recorded.

The scorecard does not collapse safety, privacy, recovery, accessibility, and trust into one number. Each metric keeps its state, owner, cadence, evidence date, target, limitations, and corrective action.

## State calculation

- **Green:** target met, evidence current, no material limitation.
- **Yellow:** target missed, evidence stale/incomplete, or trend worsening.
- **Red:** control failure or a required release/authorization gate is not met.
- **Gray:** not yet instrumented; show the owner and target instrumentation date.

Repository tests show that a control exists. They do not become pilot measurements or institutional approval.

## Metric catalog

| Pillar | Metric | Owner | Cadence |
| --- | --- | --- | --- |
| Source trust | Source-backed institutional/course claims | Source operations | Monthly |
| Source freshness | Critical sources inside owner-defined SLO | Source operations | Continuous |
| Student control | Shares preview scope, recipient, and expiry | Product and privacy | Quarterly |
| Consent | Revocation reaches AI, indexes, caches, downstream use | Privacy | Quarterly |
| Access safety | Confirmed cross-tenant/unauthorized access | Security | Continuous |
| Auditability | Sensitive reads, AI/tool calls, decisions, and writes have a trace | Security and platform | Monthly |
| Academic integrity | Restricted-assessment block/reroute tests | Academic affairs and AI governance | Quarterly |
| Human control | Communications and official writes previewed/confirmed | Product and integrations | Monthly |
| AI quality | Source correctness and policy compliance | AI governance | Monthly |
| Incident response | Acknowledge, contain, recover, and close times | Incident commander | Quarterly |
| Recovery | Restore tests meet approved RTO/RPO | SRE | Quarterly |
| Accessibility | Critical workflows pass assistive-technology testing | Accessibility | Quarterly |
| Integration health | LTI/SSO success and safe reconciliation | Integrations | Continuous |
| Student trust | Students understand what Semester uses and why | Student experience | Termly |
| Institutional assurance | Time to retrieve current evidence | Security and GRC | Quarterly |

The executable catalog and state calculation are in `app/src/lib/institutional-trust-scorecard.ts`; the institution Trust Dashboard renders every metric and says when a baseline is absent.

Gray rows also show the proposed instrumentation date carried by the executable catalog: continuous measures target 2026-10-15, monthly measures 2026-10-31, quarterly measures 2026-12-15, and the termly student-trust measure 2026-12-18. These are implementation targets, not evidence or institutional approval.

## Governance cadence

- Continuous: safety, service, source, and integration signals.
- Monthly: source coverage, audit coverage, human-control and AI-quality review.
- Quarterly: share-preview, consent, assessment-safety, incident, restore, accessibility, and assurance evidence review.
- Termly: student/faculty trust feedback and institution-specific target review.

No metric authorizes a high-risk capability by itself. Activation still requires current tenant-bound evidence, configuration-bound approval, integration health, operating controls, and a working kill switch/audit path.
