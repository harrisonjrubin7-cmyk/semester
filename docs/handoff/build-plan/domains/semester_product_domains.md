# Semester product domains — architecture and acceptance register

## Status
Proposed domain contracts derived from the supplied inventory. Not a claim of 673 implemented screens, verified production permissions, or FERPA certification. Repeated platform and phased-app entries are normalized. Domain count is an editorial grouping, not a new claim about the source catalog. Truncated source requirements remain unresolved.

## Shared contract
Every domain identifies an authoritative owner, commands, records, role grants, sources, connection state, readiness outcome, projections, receipts, and acceptance tests. Grant evaluation is server-side and tenant-bound. The student identity may persist across institutions, but each institution's records and role grants remain isolated. Native/integrated/embedded/handoff modes must be recorded.

## Command envelope
actor, activeGrant, tenant, term, capability, objectId, expectedVersion, idempotencyKey, purpose, evidenceRefs, policyVersion, correlationId. A committed command creates a receipt and outbox event atomically. Projection status is separate from command success. Never repeat a confirmed action merely because a derived view is updating.

## Domain register

### Gradebook
- Roles: Faculty, TA, Student
- Authority: Faculty assessment authority
- Flow: Draft → reviewed → released → correction requested
- Proposed records: assessments, grade_drafts, grade_releases, grading_overrides
- Proposed capability keys: grades.draft, grades.release
- Required tests: Student cannot read draft; TA cannot release; projection cannot overwrite actual

### Degree audit
- Roles: Student, Advisor, Registrar
- Authority: Configured academic-record and exception authorities
- Flow: Evidence loaded → evaluated → exception review → accepted snapshot
- Proposed records: requirement_versions, audit_runs, audit_nodes, exceptions
- Proposed capability keys: audit.read, audit.exception.approve
- Required tests: Unknown evidence is not satisfied; what-if cannot update official audit

### Transcripts
- Roles: Student, Registrar
- Authority: Registrar academic-record authority
- Flow: Requested → validated → generated → released → delivered
- Proposed records: transcript_requests, record_snapshots, deliveries
- Proposed capability keys: transcript.request, transcript.release
- Required tests: Draft excluded; delivery retry not duplicate request

### Admissions · PROP-WF-016
- Roles: Prospect, Applicant, Admissions
- Authority: Admissions decision authority
- Flow: Prospect → application draft → submitted → review → decision released → matriculation handoff
- Proposed records: program_requirement_versions, applications, documents, decisions, matriculation_tasks
- Proposed capability keys: application.self.edit, decision.release
- Required tests: Applicant cannot read internal review; submit does not imply admit

### Campus services
- Roles: Student, Housing, Dining, Finance, Campus Services
- Authority: Separate housing, dining, maintenance, and finance owners
- Flow: Request → allocation → contract → charge → entitlement → move-in → service
- Proposed records: allocations, contracts, charge_requests, entitlements, redemptions, service_requests
- Proposed capability keys: bed.allocate, contract.accept, dining.redeem
- Required tests: Last bed has one winner; replay redemption debits once

### Community and clubs
- Roles: Student, Moderator, Club Lead
- Authority: Content owner and moderation authority
- Flow: Draft → published → reported → review → action → appeal
- Proposed records: posts, groups, memberships, events, reports, moderation_actions
- Proposed capability keys: community.publish, moderation.review
- Required tests: Private group not indexed publicly; report does not publish identity

### Campus marketplace
- Roles: Student, Marketplace Partner, Moderator
- Authority: Listing owner; governed reservation and moderation services
- Flow: Draft → verified → live → reserved → pickup confirmed → completed
- Proposed records: listings, reservations, pickup_confirmations, disputes
- Proposed capability keys: listing.publish, reservation.create
- Required tests: One active reservation; institutional affiliation not safety guarantee

### Company site and marketing
- Roles: Visitor, Company Marketing
- Authority: Company content and legal reviewers
- Flow: Draft → review → published → identity handoff
- Proposed records: site_pages, campaigns, leads, approved_claims
- Proposed capability keys: site.publish
- Required tests: No private education records in acquisition analytics

### Institution console
- Roles: Institution Admin, IT, Privacy, Support
- Authority: Tenant-scoped administrative authorities
- Flow: Configure → validate → approve → activate → monitor
- Proposed records: tenant_settings, approvals, integrations, security_events
- Proposed capability keys: tenant.configure, integration.manage
- Required tests: Institution admin is not unrestricted student-record reader

### Course Studio
- Roles: Faculty, TA
- Authority: Course author and delegated teaching team
- Flow: Draft → accessibility review → approved → published → archived
- Proposed records: course_versions, syllabi, assignments, question_bank, ai_rules
- Proposed capability keys: course.author, course.publish
- Required tests: TA scope bounded; question bank not leaked to student

### Course workspace · ECON 1020 / BUS 1400
- Roles: Student, Faculty, TA
- Authority: Course publication authority; learner personal artifacts
- Flow: Published item → saved working set → study → reflection
- Proposed records: course_items, working_sets, reflections, takeaways
- Proposed capability keys: course.item.read, working_set.self.edit
- Required tests: Today and course share canonical item ID; course content remains fixtures unless sourced

### Device capabilities
- Roles: Student, Account Owner
- Authority: Device OS plus account owner
- Flow: Not asked → pre-prompt → OS decision → available or declined → revoked
- Proposed records: permission_preferences, device_sessions
- Proposed capability keys: device.preference.edit
- Required tests: Decline offers fallback; server preference cannot claim OS grant

### External audiences
- Roles: Applicant, Guardian, Alumni, Employer, Marketplace Partner
- Authority: Audience-specific relationship authority
- Flow: Invite → verify → grant scope → use → expire or revoke
- Proposed records: relationships, audience_grants, consents
- Proposed capability keys: external.scope.read
- Required tests: Verified identity does not imply educational-record access

### Faculty grading workspace
- Roles: Faculty, TA
- Authority: Assessment owner and configured approver
- Flow: Rubric draft → suggestions reviewed → submitted → approved → released
- Proposed records: rubric_scores, feedback_drafts, review_submissions
- Proposed capability keys: grading.submit, grading.approve
- Required tests: AI suggestions stay draft; accommodation instructions omit unrelated sensitive detail

### Student mobile
- Roles: Student
- Authority: Same domain authorities as desktop
- Flow: Today → My Path → Search → Plan → Me
- Proposed records: navigation_manifests, device_preferences
- Proposed capability keys: workspace.enter
- Required tests: Phone layout does not expand permissions

### Careers and employers
- Roles: Student, Career, Employer
- Authority: Student sharing choice and career/employer scope
- Flow: Profile choice → opportunity → application → employer review → outcome
- Proposed records: career_profiles, opportunities, career_applications
- Proposed capability keys: opportunity.publish, application.review
- Required tests: Employer sees submitted scope, not grades by default

### Alumni mentoring
- Roles: Student, Alumni, Career
- Authority: Consent-bound relationship authority
- Flow: Opt in → match → accept → interact → close or revoke
- Proposed records: mentor_profiles, matches, mentor_consents
- Proposed capability keys: mentoring.opt_in, mentoring.accept
- Required tests: Matching does not reveal academic records

### Family and guardian access
- Roles: Student, Guardian
- Authority: Verified delegation and applicable institutional rules
- Flow: Invite → accept → scoped grant → view → expire or revoke
- Proposed records: delegations, delegation_items, revocations
- Proposed capability keys: delegation.create, delegated.read
- Required tests: Revoke blocks subsequent access; guardian role alone grants nothing

### Registrar readiness pilot
- Roles: Student, Registrar, Advisor
- Authority: Owning offices confirm facts; registrar coordinates readiness
- Flow: Unknown → evidence checked → ready as of or blocked/review/stale/handoff
- Proposed records: readiness_runs, readiness_checks, holds, time_tickets, outreach_approvals
- Proposed capability keys: readiness.read, outreach.approve
- Required tests: One released hold does not imply ready; missing prerequisite unknown

### Registrar replacement blueprint
- Roles: Registrar, Academic Affairs, Institution Admin
- Authority: One configured writer per authoritative domain
- Flow: Propose → validate → approve → commit → project → reconcile
- Proposed records: authority_register, enrollment_commands, record_versions, reconciliations
- Proposed capability keys: enrollment.commit, record.publish
- Required tests: Last seat one winner; authority switch requires approved cutover

### Semester Account and Mail
- Roles: Account Owner, IT
- Authority: Identity authority; separate mailbox and institution owners
- Flow: Sign up → verify → recoverable account → link institution → optional mailbox
- Proposed records: accounts, identifiers, mailboxes, institution_links, authorized_apps
- Proposed capability keys: account.self.manage, mailbox.use
- Required tests: Username is not mailbox entitlement; account link not role grant

### Student Affairs / Advisor slice
- Roles: Student Affairs, Advisor, Student
- Authority: Assigned case and caseload authorities
- Flow: Intake → triage → assigned → referral accepted → support → resolved
- Proposed records: cases, student_updates, internal_notes, restricted_notes, referrals
- Proposed capability keys: case.read, case.update, referral.send
- Required tests: Note classes separated; referral discloses only approved fields

### Study Studio
- Roles: Student, Faculty
- Authority: Source owner and authorized artifact creator
- Flow: Choose sources → choose format → generate draft → review → save/share
- Proposed records: sources, source_versions, study_artifacts, artifact_citations
- Proposed capability keys: source.read, artifact.generate
- Required tests: No unauthorized source retrieval; regeneration preserves edits

### Semester platform and staff shell
- Roles: Student, Faculty, TA, Advisor, Registrar, Finance, Student Affairs
- Authority: Identity plus active tenant/term/grant
- Flow: Enter → validate grant → select workspace → first action
- Proposed records: memberships, role_grants, role_capabilities, session_contexts
- Proposed capability keys: workspace.enter
- Required tests: Role switch clears forbidden cache and late responses

### Student lifecycle
- Roles: Applicant, Student, Alumni, Institution Staff
- Authority: Separate domain state-machine owners
- Flow: Admission → affiliation → enrollment → progression → completion → alumni
- Proposed records: lifecycle_transitions, authority_receipts, consent_decisions
- Proposed capability keys: lifecycle.transition
- Required tests: Student lifecycle does not collapse into one status field

### Master catalog and screen atlas
- Roles: Builder, Product, Design, QA
- Authority: Catalog owner and evidence reviewers
- Flow: Specified → rendered → behavioral → integrated → permission tested → verified
- Proposed records: roles, screens, workflow_steps, systems, documents, evidence
- Proposed capability keys: catalog.read, catalog.edit
- Required tests: Rendered thumbnail is not implementation evidence

### Design system and trust components
- Roles: Builder, Design, QA
- Authority: Component contract owners
- Flow: Specify → implement → test → adopt → version
- Proposed records: component_contracts, variants, component_tests
- Proposed capability keys: component.inspect
- Required tests: Every state named; missing numbers not zero; source and authority visible

## State axes
Connection: confirmed, pending, updating, stale, blocked, degraded, reconcile, resolved.
Readiness: ready_as_of, blocked, review_required, unknown, stale, handoff_pending, action_completed.
Screen: default, loading, empty, error, forbidden, offline.
Workflow: domain-specific; never inferred from an error-free screen or completed notification.

## Design contract adoption
- ConnectionState + ConnectionLine: preserve confirmed actions while projections catch up.
- ReadinessState: ready_as_of requires identified sources and asOf; unknown is not eligible.
- DecisionTrail: every approval names actor and authority; reversal remains visible.
- MetricTile: kind, period, denominator, source and age; missing is not zero.
- VisibilityPicker: audience selector is presentation, never authorization.
- ActionPreview: scope, effective time, effects, non-effects, recovery; unknown non-effects must not be promised.
- DelegationRow: exact scope and expiry; current authority checked on every subsequent request.
- PermissionPrompt: why, when, fallback, kept; OS decisions remain authoritative.
- DataTable: caption, row header, explicit sorting values, error/retry and announced counts.
- SideRail/TabBar: role-scoped destinations; mobile never inherits student tabs blindly for staff.
- SourceBadge/ScreenGuide: source, freshness, purpose and decision owner.
- DateField: derive weekday from the date, do not copy inconsistent sample labels.
- AIResponse: AI label, scope, citations and draft/review boundary.

## Critical concurrent operations
Last bed and last seat: lock or atomic conditional mutation, verify current eligibility, prevent duplicate active allocation with constraints, commit receipt. Lock all writers on the same authority path. Retry serialization failures safely.
Dining redemption: unique scanner/tenant redemption request, lock entitlement, validate validity and remaining units, debit once, replay prior result.
Marketplace drop: one active reservation per item, expiry handled on server, duplicate request returns prior reservation.
Cross-domain ledger: reference the owning finance ledger; housing contracts, meal entitlements and enrollment remain separate authoritative state machines.

## Evidence and compliance
Separate operational audits from FERPA-required disclosure records. Determine applicable consent/exception before referral/export. No broad guardian, employer, alumni, marketing, or institution-admin access. Role grants do not establish the legal basis by themselves. Masking labels or pseudonymous identifiers do not prove de-identification. Direct RLS-protected SELECT does not automatically create an audit entry; use an audited gateway if required.

## Catalog normalization
Reconcile overlaps among 64 destinations, 673 screens, and 84 gap screens. Reconcile 14/20/26/51 role views and 21 team roles before totals. Keep app prototype phases distinct from domain ownership. Split specification, rendering, behavior, integration, authorization, and evidence statuses. Do not synthesize missing 93 capabilities, nine registrar domains, six facts, 24 touchpoints or ten checkpoints.

## Build order
1. Canonical authority/capability/screen registry and reusable trust components.
2. Student Affairs/Advisor slice and grade-release cross-role slice.
3. Readiness pilot with reconciliation, office ownership and approved outreach.
4. Admissions and Study Studio slices.
5. Campus-service and marketplace concurrency slices.
6. Career/alumni/family and external audience grants.
7. Native Registrar domains only after validated authority cutover.

## Verification
Files are generated reference artifacts; no React build, API integration, live database migration, institutional legal review, or exhaustive screen rendering was performed. Explorer transitions are local simulation, not server authorization.
