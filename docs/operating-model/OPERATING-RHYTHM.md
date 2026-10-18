# Founding-team operating rhythm

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

A platform this broad needs decision discipline. Every meeting below produces something written down. If a meeting
has no output, it can be cancelled.

## Weekly (60–90 minutes)

| Item | Input | Output |
| --- | --- | --- |
| User feedback and support triage | Tagged support themes | Top 3 issues with owners |
| Product and release review | Release gate status (`quality-gates.ts`) | Go/no-go per release |
| Security and reliability review | Monitoring, incidents, open vulnerabilities | Actions with owners |
| Customer and pipeline review | Pipeline, deal desk queue | Deals needing escalation |
| Top risks and blockers | Risk register | Named owner per risk |

## Monthly

| Item | Output |
| --- | --- |
| Financial runway, budget vs actual | Runway in months; variance explanations |
| Unit economics and AI cost/quality | AI unit-economics dashboard ([COMMERCIAL-GOVERNANCE.md](COMMERCIAL-GOVERNANCE.md#ai-cost-controls)) |
| Data and source freshness | Per-contract SLA attainment ([DATA-STEWARDSHIP.md](DATA-STEWARDSHIP.md)) |
| Compliance and accessibility remediation | Backlog aging by severity |
| Customer health and feature adoption | Adoption against charter hypotheses |
| Quality metrics | [QUALITY-MANAGEMENT.md](QUALITY-MANAGEMENT.md#quality-metrics-reviewed-monthly) |
| Hiring and capacity | Open roles; whether the support load is covered |
| Partner pipeline | Partners in certification |

## Quarterly

| Item | Output |
| --- | --- |
| Strategy refresh | One-page strategy memo |
| Portfolio review | Build/partner/integrate/defer/decline/sunset decisions; flags past review renewed or removed |
| Pricing and package review | Changes to `DEAL_POLICY`, signed off by finance |
| Roadmap reprioritization | Next-quarter roadmap |
| AI governance board | Decisions and the published summary ([AI-GOVERNANCE-BOARD.md](AI-GOVERNANCE-BOARD.md)) |
| Data governance council | Contract changes; stewardship gaps per tenant |
| Legal and regulatory horizon scan | Written summary ([TRUST-BRAND-AND-LEGAL.md](TRUST-BRAND-AND-LEGAL.md#horizon-scanning)) |
| Customer advisory input | Themes |
| Security, privacy and accessibility review | Findings |
| Access review | Every privileged grant re-justified or revoked, read from the role-grant audit; filed under `docs/evidence/` |
| Vendor and subprocessor review | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) re-read against what runs; each vendor's assurance current |
| Disaster-recovery exercise | A restore into another project or region, timed against the recovery objective; filed under `docs/evidence/` |
| Incident and postmortem themes | Recurring causes and the structural fix for each |
| Board/advisor review | Board deck |

The quarterly rows that produce an artifact are the quarterly half of
[`../PROOF-CALENDAR.md`](../PROOF-CALENDAR.md), which names the seat and the file for each.

## Annually

Customer advisory board · independent accessibility audit · security/privacy review and HECVAT refresh · product
strategy refresh · review of this operating model itself.
