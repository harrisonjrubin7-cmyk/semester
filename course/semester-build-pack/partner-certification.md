# Partner certification workflow - proposed operating procedure

Certification is release-specific and does not grant institutional authority. No SLA or legal timeline is adopted by this document.

## 1. Register publisher
Owner: Partner operations

Action: Create publisher identity, educational purpose and ownership record.

Evidence: Legal entity or accountable institutional unit; organization administrator.

Exit gate: Publisher record exists without institutional data access.

Failure handling: Unclear ownership: remain draft.

## 2. Verify ownership and contacts
Owner: Partnerships

Action: Verify organization control and technical, support and incident contacts.

Evidence: Verification record, contact acknowledgment and escalation route.

Exit gate: Named accountable contacts confirmed.

Failure handling: Failed verification: reject or request clarification.

## 3. Declare use case and domain boundaries
Owner: Partner product lead

Action: Identify users, benefits, domain authority, prohibited uses and private/official record boundaries.

Evidence: Use-case diagram and intended-purpose statement.

Exit gate: No unapproved authority transfer.

Failure handling: Consequential decision claims require redesign.

## 4. Register application and environments
Owner: Partner engineer

Action: Create immutable app identity and separate sandbox/staging configuration.

Evidence: Application record and environment inventory.

Exit gate: Credentials and fixtures isolated by environment.

Failure handling: Cross-environment access blocks progression.

## 5. Inventory data and subprocessors
Owner: Privacy reviewer

Action: Record collection, destinations, retention, deletion, hosting and subprocessors.

Evidence: Data-flow diagram and reviewed retention/deletion schedule.

Exit gate: Purpose-limited minimization established.

Failure handling: Unresolved legal placeholders remain blockers.

## 6. Request least-privilege permissions
Owner: Partner engineer and reviewer

Action: Map each operation and data category to a purpose; remove unnecessary requests.

Evidence: Permission-purpose matrix and user-consent requirements.

Exit gate: All permissions justified; no blanket tenant access.

Failure handling: Excess permissions return for revision.

## 7. Provision synthetic sandbox
Owner: Platform engineer

Action: Provision deterministic tenant fixtures and versioned reset capability.

Evidence: Fixture version, setup log and reset test.

Exit gate: No production records; two-tenant test available.

Failure handling: Provisioning failure creates owned support task.

## 8. Run contract conformance
Owner: Partner engineer

Action: Test request/response schemas, errors, pagination, idempotency and event compatibility.

Evidence: Release-linked test results and executable examples.

Exit gate: Required cases pass for the submitted contract.

Failure handling: Failure creates specific remediation findings.

## 9. Prove tenant and resource isolation
Owner: Security reviewer

Action: Test cross-user/app/tenant/environment access and property restrictions.

Evidence: Negative tests across API, storage, database, cache and search.

Exit gate: No unauthorized disclosure or mutation.

Failure handling: Any leak blocks certification.

## 10. Review identity, credentials and egress
Owner: Security reviewer

Action: Review token validation, rotation, revocation, secret handling and destination protections.

Evidence: Threat model and credential/SSRF test evidence.

Exit gate: Critical risks resolved; residual risk documented.

Failure handling: No self-approval; security exceptions need named authority.

## 11. Review accessible user workflows
Owner: Accessibility reviewer

Action: Test keyboard, focus, labels, errors and assistive-technology workflows.

Evidence: Automated results plus manual review and remediation.

Exit gate: Required workflows meet approved accessibility criteria.

Failure handling: Untested workflows cannot receive a pass badge.

## 12. Exercise operations and offboarding
Owner: Operations reviewer

Action: Inject outage and duplicate events; rehearse support, export, revocation, downstream deletion and reconciliation.

Evidence: Recovery report and offboarding acknowledgment evidence.

Exit gate: Bounded recovery works; owners and limitations explicit.

Failure handling: Unknown downstream deletion prevents completion claims.

## 13. Freeze release and submit evidence
Owner: Partner release owner

Action: Bind artifact digest, contract, dependencies, hosting, permissions and evidence.

Evidence: Immutable manifest and declared limitations.

Exit gate: Evidence matches exact release candidate.

Failure handling: Material changes invalidate relevant evidence.

## 14. Make independent certification decision
Owner: Authorized review panel

Action: Review findings and issue approved, conditional, changes-required or rejected decision.

Evidence: Reviewer identities, reasoning, conditions and expiration.

Exit gate: Decision authorized and auditable; no self-certification.

Failure handling: Open critical findings block approval.

## 15. Approve institution-specific pilot
Owner: Institutional approver

Action: Approve installation, minimum grants, users, pilot boundaries, success criteria and rollback.

Evidence: Institution decision and pilot plan; user consent where needed.

Exit gate: Publisher certification does not substitute for institution approval.

Failure handling: Absent authority leaves installation unenabled.

## 16. Reconcile pilot and activate or reject
Owner: Institution and platform operations

Action: Compare expected/observed outcomes, resolve drift, verify rollback/support and decide bounded activation.

Evidence: Reconciliation report, activation decision and support readiness.

Exit gate: Production-enabled status only after verified activation.

Failure handling: Failed pilot returns to remediation or offboarding.

## Renewal and change control
Review again when scopes, hosting, subprocessors, material dependencies, data practices or reviewed workflows change. Record certification status separately from application, release and tenant-installation states. Revocation immediately blocks access; downstream deletion acknowledgment is separately tracked. Security incidents may trigger suspension with preserved evidence and a documented restoration decision.
