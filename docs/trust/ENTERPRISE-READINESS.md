# Enterprise Readiness: Four Levels and What "Done" Means

The goal is for Semester to become, in turn:

1. a real student SaaS;
2. a sellable institutional pilot;
3. an enterprise LMS;
4. a university-wide operating layer.

This page fixes what each level means, so that "ready to sell" has a
definition and cannot drift toward whatever the demo looks like.

**The honest promise at each stage:**

| Stage | What Semester can truthfully say |
| --- | --- |
| Today | A student workspace with an institutional pilot layer under construction |
| After Level 2 | A real student and institutional SaaS platform |
| After Level 3 | A full enterprise learning-management system |
| After Level 4 | A university-wide operating platform |

Do not market Semester as a replacement for Canvas, Brightspace or Blackboard
until Level 3 is met **and independently validated**.

## Level 1: real student SaaS

Sellable to students, and usable today.

**Definition of done:**

- A new student creates a real account and selects and verifies their
  university.
- Their data persists across devices, and they can export or delete it.
- They can reach real support.
- Nobody else, in any tenant, can read their private data.
- The app survives a restart, a deployment, a failed integration and a
  recovery test.

| Requirement | State | Where |
| --- | --- | --- |
| Real auth, verified email, password recovery | Built | Supabase Auth |
| Social sign-in and account connections | Built | `app/src/lib/cloud.ts`, `app/src/lib/connect.ts` |
| RLS on every table, enforced schema-wide | Built, tested | `supabase/rls-coverage.check.sql` |
| Export and deletion | Built, tested | `supabase/deletion.check.sql` |
| No secrets in the browser bundle | Enforced | `app/src/lib/security.test.ts`, `.gitleaks.toml` |
| Demo clearly separated from production | Built | The demo build labels itself (commit `12c40fa`) |
| Monitoring | Partial | `MONITORING.md`; [`APM-RUNBOOK.md`](APM-RUNBOOK.md) |
| Restore drill | **Not done** | `docs/market-readiness/DISASTER_RECOVERY.md` |
| Production and staging separated | **No staging tier** | `docs/market-readiness/INFRASTRUCTURE_READINESS.md` |
| Terms of Service, Privacy Policy, AI Use Policy, Acceptable Use | **Absent** | [`README.md`](README.md) |
| Status page and support route | **Absent** | — |

## Level 2: institutional pilot SaaS

Sellable to departments and universities.

**Definition of done:** a university security, privacy and procurement team can
evaluate Semester without having to ask:

- what data it stores;
- who can access it;
- what the AI does;
- where the data goes;
- how it is deleted;
- what happens during an incident.

An institutional user signs in with SSO and lands in the right tenant and
role. Every external fact shows its source and when it was last updated. An
integration outage cannot corrupt data, or make stale data look current.

| Requirement | State | Where |
| --- | --- | --- |
| Tenant provisioning, SAML, SCIM | Built, tested; no live IdP exchange yet | `supabase/identity-provisioning.check.sql` |
| OIDC | Designed | `docs/OIDC-IMPLEMENTATION-RUNBOOK.md` |
| LTI 1.3 launch, deep linking, AGS | Built, tested | `docs/LTI-1.3-LAUNCH-RUNBOOK.md`, `supabase/lti.check.sql` |
| Source and freshness labels | Designed | `docs/FIELD-LINEAGE-AND-SOURCE-FRESHNESS.md` |
| Consented staff access | Built, tested | `supabase/support-access.check.sql` |
| AI under tenant policy | Built; not production-approved | `docs/market-readiness/AI_GOVERNANCE.md` |
| Security whitepaper | Draft | [`SECURITY-WHITEPAPER.md`](SECURITY-WHITEPAPER.md) |
| HECVAT | Register kept; questionnaire not completed | `docs/market-readiness/HECVAT_READINESS.md` |
| VPAT/ACR | **Absent** | [`HECVAT-VPAT-PLAN.md`](HECVAT-VPAT-PLAN.md) |
| DPA and security addendum | Checklist; not drafted by counsel | [`DPA-CHECKLIST.md`](DPA-CHECKLIST.md) |
| Pilot agreement and SOW | Outline | [`PILOT-AGREEMENT-OUTLINE.md`](PILOT-AGREEMENT-OUTLINE.md) |
| Subprocessor list | Written; diligence not done | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) |
| Support, onboarding, escalation | Playbooks | `docs/market-readiness/SUPPORT_PLAYBOOK.md`, `docs/market-readiness/UNIVERSITY_ONBOARDING.md` |
| Pilot scorecard | Template | [`PILOT-AGREEMENT-OUTLINE.md`](PILOT-AGREEMENT-OUTLINE.md) |
| Penetration test, insurance, legal entity | **Absent** | [`README.md`](README.md) |

## Level 3: enterprise LMS SaaS

Sellable as a learning-management replacement for selected programs.

**Definition of done:**

- A faculty member can build, publish, teach, assess, grade and conclude a
  real course without a legacy LMS.
- A student can submit work, take an assessment, recover from lost
  connectivity, receive feedback and understand their grades, without losing
  work.
- A registrar can reconcile official grades and audit every critical change.
- A representative set of real Canvas, Brightspace and Blackboard courses
  imports, reconciles, and can be rolled back without data loss.

This needs:

- **Course Studio:** modules, accessible authoring, version history,
  conditional release.
- **Assignments and assessment:** submissions with autosave and receipts;
  an assessment engine with question banks, accommodations and
  resume-after-disconnect.
- **Gradebook:** weighted categories, audit history, SIS passback with
  reconciliation.
- **Standards:** LTI Advantage conformance certification (NRPS, Deep Linking,
  AGS), OneRoster, QTI, Common Cartridge.
- **Migration:** a toolkit with parallel-run support.
- **Operations:** exam-window load testing and 24/7 P0/P1 coverage.

`docs/LMS-LEARNING-ROADMAP.md` holds the layer-by-layer plan. The 24/7
coverage requirement alone means Level 3 cannot be reached by one person.

## Level 4: University OS

Registration and degree planning; advising, tutoring and library handoffs;
housing, dining, clubs and career; partner-backed payments; multi-campus
governance; institution-wide analytics with privacy thresholds. Each arrives
as a tenant-enabled module. Transactions go through partners.

## The build team this implies

A full LMS, and then a University OS, cannot be delivered and operated safely
by a single founder or a single coding agent. The functions needed:

- product and engineering leadership;
- frontend and backend engineers;
- a security engineer or consultant;
- SRE and on-call;
- a product designer;
- an accessibility specialist;
- QA automation;
- a learning scientist;
- an LMS integration engineer;
- privacy and legal counsel;
- an implementation lead;
- customer success;
- sales;
- finance and operations.

## Program order

1. Freeze these definitions as the platform standard.
2. Close Level 1's gaps: restore drill, staging, public policies, status
   page, support route.
3. Close Level 2's non-code gaps: legal entity, insurance, counsel-drafted
   DPA, penetration test, ACR. **None of these is code, and each blocks a
   signature.**
4. Run one real pilot as operational proof. It is not a substitute for
   engineering maturity.
5. Build Level 3 in parallel, but sell it only once it is validated.
