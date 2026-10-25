# Registration Readiness: institutional operating tranche

Source: the "continue" tranche brief (11 pages, uploaded 2026-10-13). This index tracks the artifacts it
specifies and their status. Statuses follow the project scale: proposed, specified, in progress, blocked,
implemented, verified, deployed.

## Status of this tranche

- **Specified:** all artifacts listed below are written. They are specifications and drafts, not running code.
- **Implemented:** none of the operating controls (identity provisioning, revocation, data lifecycle
  enforcement, request workflow, source adapters) are implemented by this change.
- **Verified:** the YAML artifacts parse (PyYAML `safe_load`, 9 of 9). No behavioral verification exists.
- **Deployed:** no. There is no tenant, staging target, or production change in this tranche.

## Coverage matrix

| ID | Artifact | Status | Blocker |
| --- | --- | --- | --- |
| TR-01 | Tenant activation record: `docs/implementation/tenant-activation.yaml` | specified | Institution, signatories, and owners not named |
| TR-02 | Source-authority register: `docs/data/source-authority-register.yaml` | specified | Institutional owners and freshness thresholds not approved |
| TR-03 | Role provisioning and deprovisioning: `docs/security/role-provisioning.yaml` | specified | SSO configuration not verified; role mapping not reviewed |
| TR-04 | Data lifecycle schedule: `docs/privacy/data-lifecycle.yaml` | specified | Each tenant's retention schedule not recorded |
| TR-05 | Data-subject request workflow: `docs/privacy/data-request-workflow.yaml` | specified | Not implemented; no owner per tenant |
| TR-06 | Integration onboarding checklist and adapter contract: `docs/integrations/source-onboarding.yaml` | specified | No source named or approved |
| TR-07 | SIS prerequisite source mapping: `docs/integrations/source-mapping-sis-prerequisites.yaml` | specified | Data owner and integration owner approvals pending |
| TR-08 | Communications kit: `docs/pilot/communications-kit.md` | specified | Pilot owner, support path, and cohort placeholders |
| TR-09 | Pilot support operating model: `docs/pilot/support-operating-model.md` | specified | Named owners not assigned; not staffed |
| TR-10 | Renewal decision pack: `docs/pilot/renewal-decision.yaml` | specified | No pilot has run, so no evidence inputs exist |
| TR-11 | Capability maturity record: `registry/capabilities/registration-readiness.yaml` | specified | Maturity values are the brief's baseline and are **not verified** against code |

## Build sequence status

| Step | Brief item | Status |
| --- | --- | --- |
| 1 | Create the tenant activation record and name accountable owners | blocked: owners and institution not named |
| 2 | Approve the source-authority register and source mapping before any live connection | blocked: approvals pending |
| 3 | Implement and test identity provisioning, revocation, role mapping, scoped access | not started (code) |
| 4 | Deliver lifecycle schedule, request workflow, approval process per tenant | specified only |
| 5 | Integration onboarding package: schema mapping, freshness, failure mode, reconciliation | specified only |
| 6 | Finalize communications and training | drafted, not approved |
| 7 | Scoped activation and hypercare workflow | blocked on steps 1–6 |
| 8 | Renewal decision pack before expansion | specified only |

## Launch and deployment blockers

These need a human decision or external party. None can be resolved from this repository.

1. Executed pilot agreement and data-privacy terms, and recorded institutional signatories.
2. Named owners: executive sponsor, registrar business owner, technical owner, support escalation owner, security contact.
3. Verified SSO configuration, or an approved fallback.
4. Approved source-authority table and source mapping, with the institution data owner's sign-off.
5. Approved retention schedule for each tenant.
6. Operational support queue, rollback drill, and monitoring confirmation.

## Deployment target and approvals

- **Target:** none identified. The brief names no staging or production environment.
- **Production:** not deployed, and not authorized in this session. Production activation requires the
  institution's go/no-go and approval under the tenant activation record.
- **Costs and service changes:** none introduced by this tranche.

## Source-fidelity notes

- Several rule sentences in the brief are cut off at the page edge in the source PDF (for example "does not
  author official enrollmen…"). They were completed to their evident meaning. Check them against the
  source runbook (`paste.txt` / `Semester-Ship-Program-and-Launch-Runbook-1.html`, cited by the brief) before
  approval. Affected: `source-authority-register.yaml` authority rules, `role-provisioning.yaml`
  role constraints, `data-lifecycle.yaml` lifecycle requirements, `data-request-workflow.yaml` rules.
- The brief's integration checklist wrote `expose provider_secrets_in_client_code` with a space. It is
  normalized to an underscore key in `source-onboarding.yaml`.
- The capability maturity baseline (`registry/capabilities/registration-readiness.yaml`) is taken from the
  brief. A catalog entry `edu.registration` exists in `app/src/data/ecosystem/capabilities.json`, but its
  maturity was not checked against the brief's claims.

## Scope not covered by this tranche

The brief covers only the registration-readiness pilot operating model. The wider Semester ecosystem
(other workspaces, modules, and roles) is not inventoried here. That inventory is a separate task.
