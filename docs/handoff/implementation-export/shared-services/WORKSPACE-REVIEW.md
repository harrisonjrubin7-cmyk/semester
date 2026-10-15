# Shared services workspace review

13 services form the common foundation. Source names are design contracts, not verified production endpoints.

## shared.identity.signin
Authenticate through verified provider and recover access
Boundary: Identity service only; browser cannot assign actor or tenant
Routes: /auth/signin, /auth/mfa, /auth/recover
Permissions: session.create
Records: auth.users, onboard.devices
Commands: sign_in, verify_mfa
Acceptance negatives: Bad token/provider, recovery abuse, revoked session

## shared.identity.sessions
List, expire and revoke sessions
Boundary: Revocation enforced server-side and propagated to sensitive caches
Routes: /app/settings/sessions
Permissions: session.revoke
Records: onboard.devices, onboard.push_tokens
Commands: api.revoke_device
Acceptance negatives: Revoked token denied, other-account session denied

## shared.org.memberships
Connect institution relationships
Boundary: Membership is distinct from capabilities and roles
Routes: /institution/members, /invite/*
Permissions: membership.invite, membership.revoke
Records: core.profiles, iam.invitations, iam.memberships
Commands: api.issue_invitation, api.accept_invitation, api.revoke_invitation
Acceptance negatives: Cross-institution membership read, expired affiliation

## shared.authz.grants
Request/review least-privilege grants
Boundary: Privileged requester and approver must differ; expiry enforced
Routes: /ops/access, /institution/access
Permissions: grant.create, grant.revoke
Records: ctl.capabilities, ctl.grants
Commands: api.grant_capability, api.revoke_grant
Acceptance negatives: Self-approval, expired/revoked grant, object bypass

## shared.authz.approvals
Bind consequential approvals
Boundary: Exact payload/target/version/tenant/expiry and current authority
Routes: /app/approvals, /ops/approvals
Permissions: action.request, action.approve
Records: ctl.action_requests, ctl.action_approvals
Commands: api.request_action, api.decide_action, api.execute_action
Acceptance negatives: Changed payload, concurrent version, already decided

## shared.delegation
Grant scoped expiring access
Boundary: Relationship alone grants nothing; revoke promptly enforced
Routes: /app/settings/sharing
Permissions: delegation.grant
Records: core.delegations
Commands: api.grant_delegation, api.revoke_delegation
Acceptance negatives: Expired delegation, scope escalation, cache leakage

## shared.notifications
Deliver permitted action-aware notices
Boundary: Recipient/channel permissions; no sensitive bodies in unapproved channels
Routes: /app/notifications, /app/settings/notifications
Permissions: notification.read, preference.edit
Records: comms.notifications, comms.preferences
Commands: mark_read, set_preferences
Acceptance negatives: Duplicate delivery, recipient changed, privacy redaction

## shared.search
Search permitted current objects
Boundary: Authorize retrieval, snippets, ranking and indexed visibility
Routes: /app/search
Permissions: search.query
Records: search.documents
Commands: search
Acceptance negatives: Cross-tenant query, revoked object, stale index

## shared.files
Store/retrieve permitted artifacts
Boundary: Quarantine uploads, content checks, signed access, retention
Routes: /app/files
Permissions: file.upload, file.read
Records: comms.files
Commands: upload_file, delete_file
Acceptance negatives: Unsafe upload, unauthorized download, expired URL

## shared.audit
Retain accountable decisions
Boundary: Restricted append-only evidence; minimize sensitive payloads
Routes: /ops/audit, /institution/audit
Permissions: audit.read
Records: audit.events
Commands: None declared
Acceptance negatives: Audit tamper, sensitive logging, investigator scope

## shared.documents
Version and review controlled documents
Boundary: Draft/review/approved/published/executed are different states
Routes: /company/documents, /institution/documents
Permissions: document.submit, document.execute, document.archive
Records: docs.documents, docs.document_versions, docs.version_states, docs.review_tasks, docs.transition_events, docs.contract_documents, docs.signature_requests, docs.acknowledgments
Commands: api.transition_document, acknowledge
Acceptance negatives: Unapproved publication, wrong reviewer, stale version

## shared.ai.gateway
Use approved sources and bounded AI
Boundary: Default-deny unapproved record egress; course/institution policy
Routes: /app/assistant
Permissions: ai.use
Records: core.ai_policy, core.course_ai_rules, core.sources, audit.ai_usage
Commands: api.ai_policy, api.ai_context, api.ai_log
Acceptance negatives: Prompt injection, forbidden tool, unapproved provider

## shared.events.outbox
Deliver durable events
Boundary: Atomic write/outbox, leases, dedupe, gap/replay reconciliation
Routes: (worker)
Permissions: event.publish
Records: ctl.outbox
Commands: outbox.publish
Acceptance negatives: Lost publish, duplicate event, out-of-order event, lease expiry

## Review order
Identity → memberships → grants/audit → sessions/delegation/approvals → files/documents/notifications → outbox/search → AI gateway. Resolve bootstrap dependencies from canonical repository code; not all runtime collaborations form a DAG.

## Release boundary
Each service must have tenant/object isolation, negative access tests, privacy/retention, failure-state behavior and exact-target operated evidence. A reachable page is not a functioning service.