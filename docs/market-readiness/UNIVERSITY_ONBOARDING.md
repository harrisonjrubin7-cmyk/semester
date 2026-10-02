# University Onboarding

**Status: `FOUNDATION_BUILT / NO LIVE TENANT`** — the repository now carries
the controlled rollout machinery. Institution approvals, production identity,
source credentials and named operators remain unfulfilled.

## The steps, and what each needs from us

| # | Step | Needs | State |
| --- | --- | --- | --- |
| 1 | Create and govern the tenant | School record, lifecycle state and gate evidence | **Built, not activated** — `schools`, `tenant_rollout`, evidence and history are RLS-protected; service-role operation still needs a named operator and live UAT |
| 2 | Branding | Logo, accent, short name | **Built as governed configuration** — `governance_policy_nodes.brand` resolves through system/campus/school/program/course; no real tenant brand has been approved or read back |
| 3 | Academic calendar | Terms, breaks, deadlines | **Partial** — canonical academic records and integration contracts exist; the ordinary student calendar is not a complete tenant calendar service |
| 4 | Schools / departments | Org structure | **Partial** — governed system/campus/school/program/course hierarchy exists; institution-specific department ownership and source mapping still require configuration and UAT |
| 5 | Feature scope | Per-tenant flags | **Built** — `tenant_feature_policy`, feature evaluation and kill switches are tested; rollout lifecycle is intentionally not an automatic feature grant |
| 6 | Identity | SSO metadata exchange and provisioning | **Built, not connected** — SAML/SCIM binding and membership controls exist; `BLOCKED` on university metadata, authorization and certificate-rotation ownership. Institutional OIDC is not supported |
| 7 | Integrations | LMS/SIS credentials and scopes | **Built through sandbox/control-plane contracts, not connected** — `BLOCKED` on institutional API approval, credentials and source-owner sign-off |
| 8 | Roles | Who administers this tenant | **Built, not assigned** — `app_roles`, `app_capabilities`, scoped `role_grants` and audit controls replace the old global-admin-only model; the pilot still needs named grants and UAT |
| 9 | Policies | Terms, privacy, support contacts | **Partial** — governed feature/AI/retention/classification records exist; approved tenant legal text, data scope and human support/escalation contacts do not |
| 10 | Pilot cohort | Invite the first users | **Built, not launched** — private-beta programs, six capped cohort kinds, invitations, memberships, known issues, feedback and exit requests exist; activation requires a real support contact and authorized beta manager |

## What is genuinely blocked versus what is not

**Blocked on the university:** SSO metadata and authorization (step 6),
integration approval, credentials and named source ownership (step 7), plus
the pilot champion, data scope and outcome agreement. These cannot be coded
around. The adapter, sandbox and approval registers are preparation, not proof
of activation.

**Blocked on Semester production authority:** assigning operator roles,
creating the live tenant and cohort, entering approved configuration, proving
backup/restore and rollback, and staffing support/escalation. The repository
contains controls for these actions; it cannot supply the accountable people,
provider settings or production readback.

**Still repository-controlled:** keep the lifecycle, feature, role, beta and
evidence gates release-blocking; keep the product build separate from the
synthetic institutional preview; and refuse any claim of live operation that
has only local or sandbox evidence.

## The first honest onboarding

Until a university authorizes and tests its connections, the first honest
pilot is **Semester as a planning and experience layer**, with student-entered
or explicitly imported data and no writes to systems of record. Use the
account-isolated synthetic preview for demonstrations; use a separately
approved read-only pilot tenant for real participants. Do not describe SSO,
SCIM, LMS/SIS exchange, AI-provider access or institutional operations as live
until the named tenant's approval register and authoritative readback say so.
