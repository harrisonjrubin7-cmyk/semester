# Institutional Role and Permission Matrix

| Control | Value |
| --- | --- |
| Status | **REPOSITORY-DERIVED CONTROL SUMMARY — CUSTOMER ROLE DESIGN AND TARGET ACCEPTANCE ABSENT** |
| Owner | Harrison Rubin — company-side IAM owner; customer system/data owners and access-review approver unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../ROLE-PERMISSION-MATRIX.md`](../ROLE-PERMISSION-MATRIX.md), [`../INTEGRATION-PERMISSION-MATRIX.md`](../INTEGRATION-PERMISSION-MATRIX.md), and [`../trust/ACCESS-CONTROL-POLICY.md`](../trust/ACCESS-CONTROL-POLICY.md) |

## Authorization model

The database authorizes capabilities at a scope; role names are bundles, not the enforcement boundary. Row-level policies and controlled functions further narrow access by tenant/resource, ownership, consent, feature state, membership status, time, approval separation and other attributes. The UI role model is not an authorization boundary. Student private work is account-owned and is not broadly readable by an institutional role.

## Institutional baseline

| Function | Candidate role(s) | Representative capability | Boundary / separation |
| --- | --- | --- | --- |
| tenant policy/configuration | `university_admin` | `tenant:configure`, `ai:configure`, `source:approve` | one school; target/customer approval required |
| integration configuration | `integration_admin` | `integration:configure`, `sync`, `reconcile`, `replay`, `view` | cannot self-approve connection/scope/write direction |
| integration approval | `university_admin` | `integration:approve` | approver must be distinct from owner/proposer where enforced |
| implementation/migration | `implementation_manager`, `integration_admin` | `tenant:implement`, `migration:manage/view` | sandbox/bounded records; cutover approval separate |
| migration/cutover approval | `registrar`, `dean`, `university_admin` | `migration:approve` | cannot approve own migration |
| academic record | `faculty`, `registrar`, `dean` | propose/read/approve/override | proposal, approval, override and release remain distinct |
| grade workflow | `faculty`, `teaching_assistant`, `registrar`, learner roles | enter/moderate/release/export/receive | course/school scope; official write separately gated |
| audit review | `university_admin` | `audit:read` | tenant configuration/access events only; not blanket log access |
| kill switch | `university_admin`, `incident_responder` | `killswitch:engage` | tenant versus platform scope; release/exercise evidence required |
| support | `support_agent`, `university_staff` | `support:ticket`, `support:read` | no default student-record access; separate scoped/expiring grant |
| data rights | `data_steward` | `data_request:handle` | verified request/authority, logged decisions and dual review as required |
| privileged console | limited global/implementation roles | `console:operate` | opening console is not authority for every action; step-up/approval gates apply |

This summary does not replace the generated complete matrix. A target customer must choose only the roles/capabilities required for the accepted workflow and map them to named job functions and identity-provider groups.

## Target approval worksheet

| Job function / group | Person type | Role + exact scope | Capabilities needed | Data classes | Requester | Approver(s) | SoD conflicts | Start / expiry | JML source | MFA / step-up | Test evidence | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[FUNCTION/GROUP]` | `[WORKFORCE/LEARNER/SERVICE]` | `[ROLE, SCOPE]` | `[MINIMUM SET]` | `[T0–T4]` | `[NAME/ROLE]` | `[INDEPENDENT OWNER]` | `[NONE OR EXCEPTION]` | `[DATES]` | `[SCIM/MANUAL]` | `[RULE]` | `[POSITIVE/NEGATIVE]` | `draft` |

## Required negative tests

For every approved role test: no-role/default deny; wrong tenant; wrong resource/scope; another person's private object; expired/revoked/suspended/deprovisioned membership; unapproved self-action; proposer-as-approver; missing consent; unsupported UI/API/direct-database path; attempted privilege/grant escalation; service credential misuse; break-glass expiry; and audit-event failure. Verify permitted tasks separately with representative least-privilege accounts.

## Evidence state

**Repository evidence.** A generated role/capability inventory, scoped grant model, RLS/control-function tests and selected separation, support-access, audit and lifecycle controls exist.

**Operational evidence.** No customer-approved role design, named group mapping, complete account/service inventory, target negative matrix, recurring access review, joiner/mover/leaver sample or accepted residual risk is evidenced.

**Missing test/proof.** Populate the target worksheet; reconcile IdP/SCIM groups and effective grants; run representative positive/negative tests; exercise joiner/mover/leaver, privileged access and emergency paths; obtain system/data/customer approval.

## Claim ceiling

Semester may describe the repository-derived scoped capability model and exact tested paths. It may not generalize them into universal least privilege or customer-approved access.

## Prohibited claims

Do not claim complete RBAC, universal least privilege, production MFA coverage, fully enforced separation of duties, complete privileged-access management, continuously reviewed access, customer-approved roles or institution-ready IAM without target and operated evidence.
