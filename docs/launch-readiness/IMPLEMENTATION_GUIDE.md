# Institutional implementation guide

**Status:** controlled implementation sequence; not authorization to deploy

## 1. Define scope

Name the executive sponsor, product owner, data steward, security/privacy/accessibility owners, support contacts and implementation lead. Select only the required capabilities and authoritative data sources. Record prohibited uses and success/stop criteria.

## 2. Contract and privacy review

Execute the order/pilot agreement, DPA, security schedule and support terms. Approve notices, consent, retention, deletion, subprocessors, incident contacts and offboarding. Do not load production student data before this gate closes.

## 3. Tenant configuration

Create a named tenant and immutable configuration version. Configure domains, identity, roles, capability flags, data sources, AI/provider choices, retention and accessibility/support contacts. Keep high-risk and writeback capabilities disabled by default.

## 4. Integration validation

Use sandbox/test identities and synthetic records to validate SSO, roster/LMS/SIS sources, calendar, notifications and any provider. Prove least privilege, tenant separation, replay/idempotency, revocation, source freshness, error handling and auditability. A connector existing in code is not a live integration.

## 5. Acceptance

Run the student golden path, staff/admin workflows, accessibility matrix, security tests, support escalation, export/deletion, rollback and restore. Record defects and explicit acceptance against the exact configuration.

## 6. Approval and launch

Collect every capability-class approval in the named-tenant register. Confirm no open P0/P1, council sign-off, trained support, launch communications, monitoring and rollback criteria. Deploy in a bounded cohort before expansion.

## 7. Operate and offboard

Review access, providers, incidents, SLOs, data quality and capability scope on a fixed cadence. On exit, export/return authorized data, disable integrations and access, execute contractual deletion, retain only authorized evidence and obtain closure confirmation.

## Current Vanderbilt boundary

The Vanderbilt candidate register reports 0 approved and 60 pending. It explicitly states that it is not endorsement, contract, authorization, deployment or approval. Vanderbilt deployment is therefore blocked regardless of repository capability.
