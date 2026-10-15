# Decisions — 14 Oct 2026

## DEC-ENV-001 · Production database is the Supabase project `semester`  (decided by the founder)
| Project | Role from today |
|---|---|
| **semester** | **Production.** Real tenant data only after the activation gate. Migrations reach it only through the release pipeline. |
| semester-restore-drill-2026-10-01 | Recovery drills only. Synthetic data. Never reconnected to connectors. |
| Semester2 | Review contents, then either staging or retire — not production. |
| Semester-Platform | Review contents, then either staging or retire — not production. |

Recommendation: keep whichever of Semester2 / Semester-Platform has the newest migration history as **staging**, export anything worth keeping from the other, then pause it. One staging, one production, one drill.

Set in CI: `SEMESTER_PROD_PROJECT_REF=<ref of semester>` so `verify/environment-boundaries` fails any non-production build pointed at it.

## DEC-OWNER-001 · Registration readiness owners  (recommended by Claude, accepted by the founder)
| Role | Who | Why |
|---|---|---|
| Accountable / product owner | **Harrison (founder)** | Owns scope, copy and the renewal decision |
| Technical owner | **Harrison (founder)** until the first platform-engineering hire | Hiring trigger: reliability work becomes continuous |
| Operational owner (hypercare, reconciliation) | **Harrison (founder)**, primary | Daily health review during launch |
| Backup operator | **Contractor** (to be engaged — founder agreed 2026-10-14) | One operator can't cover nights, illness or an S1 |
| Independent security/operations approver | **Security advisor** (to be engaged — founder agreed 2026-10-14) | The activation gate needs three *different* approvers |
| Institution operational owner | **Vanderbilt registrar designee** (Vanderbilt names them) | Authority for holds, prerequisites, enrollment; approves the gate |
| Institution technical contact | **Vanderbilt IT designee** | SSO and SIS access |

### Support and escalation
- **Tier 1 (Semester):** in-product Help → Harrison during published pilot hours. Acknowledge within 1 business day; S1/S2 immediately.
- **Policy or record questions** (a hold, a prerequisite, an enrollment) → the registrar designee. Semester never answers them.
- **SSO / SIS access problems** → the Vanderbilt IT designee.
- **S1 (security or cross-tenant exposure):** Harrison contains immediately (kill switch / safe-off), notifies the Vanderbilt security contact; the independent approver reviews.
- **S2 (wrong authority result or critical path down):** safe-off the affected path, tell the registrar designee, fix, re-verify before re-enabling.

### What this unblocks
- REG-001 (accountable owner) passes for registration readiness.
- SLICE-REG-001 meets the definition of ready — **build can start**.
- Activation stays blocked until the backup operator, the independent approver and the Vanderbilt designees are named, and the P0 tests have run.

## DEC-OWNER-002 · Backup operator and independent approver  (founder, 2026-10-14)
- **Backup operator: a contractor.** Engagement needs: written scope (hypercare cover, S1/S2 first response, safe-off authority), confidentiality + IP assignment, least-privilege access (staging + read-only production dashboards; kill-switch rights; no production data export), named hours and handoff with Harrison, and access removal on contract end.
- **Independent approver: a security advisor.** Engagement needs: advisor agreement with confidentiality, no reporting line to product delivery, authority to block activation, review of the P0 test evidence and the AUTHZ decision before signing the gate.
- Activation stays blocked until both are engaged and named, and Vanderbilt names its registrar and IT designees.

## DEC-ENV-002 · Keep both Semester2 and Semester-Platform  (founder, 2026-10-14)
Neither is paused. Assign each one job so data and migrations can't drift between them:
| Project | Role |
|---|---|
| **Semester-Platform** | **Staging** — release candidates, P0 tests, drills, pilot rehearsal. Production-like policy and RLS; synthetic or approved non-production data only. |
| **Semester2** | **Development / preview** — feature branches and local-style experiments. Synthetic data only; may be reset any time. |
| semester | Production (DEC-ENV-001) |
| semester-restore-drill-2026-10-01 | Recovery drills only |

Rules: migrations flow Semester2 → Semester-Platform → semester, never the other way; no production credentials or exports in either; each project has its own secrets. If you'd rather swap the two roles, say so — the rule is one role per project.

## DEC-OWNER-003 · Contractor and security advisor engaged  (founder, 2026-10-14)
- **Backup operator:** contractor — engaged. Name: _to record_.
- **Independent security/operations approver:** security advisor — engaged. Name: _to record_.
- Before access: signed scope + confidentiality/IP (contractor) and advisor agreement (advisor); least-privilege grants on Semester-Platform first; kill-switch rights for the contractor; no production export for either.
- REL-READINESS-001 approvers now: Harrison (product) · security advisor (engineering/security) · contractor (operations) · Vanderbilt pilot owner (still to name).

## DEC-OWNER-004 · Names recorded  (founder, 2026-10-14)
| Role | Name | Status |
|---|---|---|
| Contractor — backup operator | **Teo Katz** | recorded |
| Security advisor — independent approver | **Bramm Rubin** | recorded — **confirm independence**: shares a surname with the founder; the independent approver must have no family, financial or reporting tie to Semester's owner |
| Vanderbilt pilot owner | Harrison Rubin (as given) | **not accepted** — the founder can't also be the institution's approver; REL-READINESS-001 needs four different people and the institution owner must be a Vanderbilt employee |
| Vanderbilt registrar contact | Wyatt (as given) | recorded — need full name and office |
| Vanderbilt IT contact | Wyatt (as given) | recorded — same person as registrar contact; acceptable for the pilot if Vanderbilt confirms, but full name and role needed |
| Test results | "tests pass" (founder-reported) | **reported, not evidence** — paste the `supabase test db` output (or a CI run link) to record it |

## DEC-OWNER-005 · Institution owner and attestations  (founder, 2026-10-14)
| Role | Name | Status |
|---|---|---|
| Vanderbilt pilot owner | **Wyatt Rose, Registrar's Office** | accepted — four distinct approvers now: Harrison Rubin · Bramm Rubin · Teo Katz · Wyatt Rose |
| Vanderbilt registrar contact | **Wyatt Rose, Registrar's Office** | accepted |
| Vanderbilt IT contact | Wyatt Rose (as given) | recorded — ask Vanderbilt IT to name its SSO/SIS technical contact; a registrar can't approve IT access changes |
| Security advisor independence | Bramm Rubin | **founder-attested independent** (no family, financial or reporting tie) |
| Test results | founder-attested "pass" | recorded as attestation; **not** release evidence — REL-READINESS-001 needs the run output or CI link per item |
