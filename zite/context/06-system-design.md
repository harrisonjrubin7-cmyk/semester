# Semester SaaS System Design Document

> Source: "Semester SaaS System Design Document" (founder upload, 22 Oct 2026). Tenancy, authorization decision, schema, billing (payer vs beneficiary, entitlements, metering, collections), API routing and middleware order, data flows, security, scaling, deployment gates and release evidence. An implementation specification, not a verified deployment.

```text
Semester SaaS System Design Document
This design turns Semester into a deployable multi-tenant SaaS architecture: one education
product, one institutional operating layer, and one restricted company operating system,
supported by shared identity, workflows, billing, APIs, and security controls.
It includes the database design, authentication and authorization model, API routing, billing
architecture, data-flow diagrams, security policies, deployment gates, and a copy-ready Zite
workflow implementation prompt.
Status: implementation specification—not a verified production deployment. The remaining
deployment decisions are identified explicitly so a builder does not substitute assumptions for
working infrastructure.

1. Architecture decisions and system boundaries

1.1 Recommended architecture
Start with:
    A shared, modular application backend.
    Separately deployed background workers.
    PostgreSQL as the transactional system of record.
    Explicit database schemas and service ownership.
    Separate education, institution, and company interfaces.
    Provider-independent billing orchestration.
    A server-side AI gateway.
    A durable outbox and retry-safe workflow engine.
Do not begin with dozens of independently deployed microservices. Define service boundaries
now and extract deployment units when workload, security, or organizational requirements
justify the added operational complexity.

1.2 Three operating layers
   Operating layer                      Users                                    Responsibilities

  Education          Students, faculty, advisors, invited   Learning, planning, productivity, support, campus, career,
  Experience         supporters, employers                  community

   Operating layer                          Users                                    Responsibilities

                                                                Academic administration, services, policies, integrations,
  Institution OS         Authorized institution staff
                                                                approvals, reporting

  Semester                                                      Sales, implementation, support, finance, trust, releases,
                         Authorized Semester employees
  Company OS                                                    platform operations

Shared infrastructure does not mean unrestricted data access.
A Semester support employee should be able to diagnose a failing synchronization without
automatically reading a student’s notes, grades, or service-case content.

1.3 Production topology

                                                    PEOPLE
                                                        │
                                        DNS / TLS / Edge controls
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             │                          │                          │
   Public website                       Education application             Company application
   Marketing                            Student / faculty                Business operations
   Help / trust                          Institution console              Platform operations
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
                                API / Backend-for-Frontend
                                Authentication verification
                                Workspace resolution
                                Request validation
                                Rate limiting
                                Correlation identifiers
                                                        │
                                  Authorization / Policy layer
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               │                         │                         │
   Education modules                    Institution modules                Company modules
   Planning                              Academic operations               CRM / contracts
   Learning                              Student services                  Customer success
   Career                                Registrar workflows               Support / trust
   Community                             Communications                    Commercial finance
               │                         │                         │
               └─────────────────────────┼─────────────────────────┘
                                         │
                                 Shared platform services
                     Workflows • Billing • Files • Search • AI gateway
                       Notifications • Integrations • Audit • Config
                                                        │
                                   PostgreSQL + transactional outbox
                                            │
                           ┌────────────────┼─────────────────┐
                           │                │                 │
                     Job workers               Object storage    Read projections

               Integration               Scoped files            Search indexes
               Billing                   Retention               Analytics
               Notifications
                     │
         Approved external infrastructure
         IdP / SIS / LMS / calendars / email / payment rails


1.4 Deployment units
                                Unit                     Initial deployment responsibility

                   semester-site                  Public content, approved claims, lead intake

                   semester-web                   Education product and institution console

                   semester-company               Restricted company and operational interfaces

                   semester-api                   Domain queries, commands, authorization

                   semester-worker                Durable asynchronous processing

                   semester-ai-gateway            Approved model requests and egress controls

                   PostgreSQL                     Authoritative transactional records

                   Object storage                 Permissioned files and exports

                   Observability infrastructure   Logs, metrics, traces, alerts

These can share a repository without sharing credentials or access privileges.

2. Tenant, workspace, identity, and authorization model

2.1 Define tenant and workspace precisely
Recommended definitions:

  User:
  A global human identity.

  Tenant:
  A top-level isolation and contractual boundary.
  Examples: an institution, a personal account, Semester's company account.

  Workspace:
  A working context inside a tenant.
  Examples: institution-wide administration, a department,
  a personal workspace.

  Membership:
  A user's active relationship with a tenant.

  Role assignment:
  A verified capability bundle scoped to a workspace,
  department, course section, caseload, or specific resource.

  Resource grant:
  An explicit permission for a particular object.

  Delegation:
  A time-limited assignment of specific authority to another person.

  Consent:
  A purpose-specific sharing authorization.


A person can belong to several tenants. Their personal notes should not become institution-
owned merely because they join an institution.

2.2 Authorization decision
For protected operations:

  ALLOW only when:

  verified session
  AND active tenant
  AND active membership
  AND requested workspace belongs to that tenant
  AND actor has the required capability
  AND actor has the required resource scope
  AND applicable consent/delegation remains valid
  AND institutional policy permits the action
  AND required commercial entitlement exists
  AND any required approval/MFA condition is satisfied


Authorization and billing are separate:
    Authorization: “May this person perform this action?”
    Entitlement: “Has this tenant purchased or otherwise received this capability?”
Passing one does not imply passing the other.

2.3 Authentication flow

  Browser
    │
    ├─ Sign in through approved identity provider
    │
    ▼
  Backend verifies token:
  signature / issuer / audience / expiry
    │
    ▼
  Resolve global user
    │
    ▼
  Load current tenant memberships

    │
    ▼
  User selects workspace
    │
    ▼
  Validate tenant + workspace + membership
    │
    ▼
  Resolve current capabilities and scoped assignments
    │
    ▼
  Execute authorized request


Do not authorize staff access from:
    A user-selected role.
    An email-domain match alone.
    User-editable profile metadata.
    An arbitrary tenantId in a request.
    A role displayed in the frontend.
Supabase specifically warns that user-editable metadata is unsuitable for authorization and
that JWT-held membership information can remain stale until the token refreshes. Use current
server-side membership checks for revocation-sensitive operations. [1]

2.4 Multi-tenant enforcement
Enforce tenant scope at all relevant boundaries:

                        Boundary                         Required control

                       API            Validate tenant membership and resource scope

                       Database       RLS or equivalent least-privilege enforcement

                       Foreign keys   Prevent cross-tenant relationships

                       Storage        Scope file access and signed URLs

                       Search         Filter before returning titles, snippets, or counts

                       Jobs           Persist and verify tenant context

                       Cache          Include tenant, user/scope, and authorization version

                       Exports        Reauthorize before creation and download

                       Webhooks       Resolve tenant through trusted provider mappings

                       Analytics      Restrict raw records and approved aggregate access

RLS must be paired with appropriate database grants. Supabase documents these as separate
checks; it also warns that views and privileged credentials can bypass the protections expected
from ordinary table policies. [1]

3. Database schema

3.1 Schema organization

  iam           identities, tenants, memberships, authorization
  education     planning, learning, academic records and projections
  institution   institutional services, policy, administration
  company       Semester's business operations
  billing       commercial accounts, subscriptions, invoices, entitlements
  workflow      definitions, instances, approvals, execution
  integration   adapters, mappings, synchronization, reconciliation
  platform      audit, outbox, jobs, files, configuration


Schema names organize ownership. They are not sufficient security boundaries by themselves.

3.2 Core entity relationships

  users
    └── memberships ── tenants
            └── role_assignments ── roles ── capabilities
                           │
                           └── workspace / department / resource scope

  tenants
    └── workspaces
            ├── education records
            ├── institution records
            └── resource grants

  billing_accounts
    ├── account_members
    ├── contracts
    └── subscriptions
            ├── subscription_items
            ├── subscription_targets ── tenants
            ├── invoices
            └── entitlement_grants ── tenants

  workflow_definitions
    └── workflow_instances
            ├── step_runs
            ├── approval_requests
            └── transition_events

  domain changes
    ├── audit_events
    └── outbox_events
            └── consumer_receipts

3.3 Identity and tenant schema
                       Table                                           Essential fields and constraints

  iam.users                                   id, display_name, status, timestamps

  iam.identity_links                          user_id, issuer, subject; unique issuer/subject

  iam.tenants                                 id, kind, name, status, region

  iam.workspaces                              id, tenant_id, kind, name, status

                                              id, tenant_id, user_id, status, valid_until; unique
  iam.memberships
                                              tenant/user

  iam.roles                                   id, key, description

  iam.capabilities                            id, key, description

  iam.role_capabilities                       role_id, capability_id

  iam.role_assignments                        tenant, membership, role, scope, validity, assigner

  iam.resource_grants                         tenant, resource, recipient, action, validity

  iam.consents                                grantor, recipient, purpose, payload scope, expiry, state

  iam.delegations                             delegator, delegate, capabilities, scope, expiry, state

  iam.privileged_access_requests              actor, tenant, purpose, approver, expiry, state


3.4 Education schema
       Domain                                                       Tables

  Personal planning       goals, plans, plan_items, tasks

  Calendar                calendars, calendar_events, calendar_connections

  Productivity            documents, document_versions, notes, document_shares

  Learning                study_sets, study_items, study_sessions, learning_sources

  Academic structure      academic_terms, programs, program_requirements, courses, course_sections

  Teaching                section_staff, assignments, submissions

  Academic records        enrollments, grade_records, student_holds

  Readiness               readiness_rules, readiness_evaluations, registration_requests

  Career                  career_profiles, portfolio_items, opportunities, applications

  Community               groups, group_memberships, posts, content_reports, moderation_actions

Each institution-controlled record should carry:

  tenant_id
  workspace_id where relevant

  source_connection_id where relevant
  external_id where relevant
  authority_mode
  source_updated_at
  synced_at
  policy_version_id where relevant
  classification
  version


Suggested authority_mode values:

  external_authoritative
  semester_authoritative
  semester_derived
  personal
  sample


A semester_derived readiness result must not be presented as an official enrollment decision.

3.5 Institution schema

  institution.departments
  institution.campuses
  institution.service_catalog
  institution.service_requests
  institution.cases
  institution.case_assignments
  institution.appointments
  institution.advisor_assignments
  institution.advising_plans
  institution.policy_versions
  institution.communication_campaigns
  institution.communication_approvals
  institution.housing_units
  institution.housing_assignments
  institution.student_account_references
  institution.student_obligations
  institution.approved_accommodation_notices


Sensitive service records require more restrictive handling than ordinary service-directory
records. Do not expose accommodation reasons through instructor-facing notices or general
support interfaces.

3.6 Company schema

  company.accounts
  company.contacts
  company.opportunities
  company.quotes
  company.quote_lines
  company.contracts

  company.contract_obligations
  company.implementation_projects
  company.implementation_milestones
  company.success_plans
  company.outcome_measures
  company.support_tickets
  company.support_events
  company.controls
  company.control_evidence
  company.security_findings
  company.vendors
  company.vendor_reviews
  company.staff_records
  company.onboarding_tasks
  company.access_reviews
  company.marketing_content
  company.public_claims
  company.decisions
  company.risks
  company.incidents
  company.releases
  company.release_gates
  company.restore_drills


Company operational records should reference institution identifiers where necessary without
duplicating protected student content.

3.7 Representative SQL foundation
The following shows the intended structural constraints. It is not a complete migration or
authorization implementation.

  create schema if not exists iam;
  create schema if not exists education;

  create table iam.tenants (
    id uuid primary key default gen_random_uuid(),
    kind text not null
      check (kind in ('personal', 'institution', 'company')),
    name text not null,
    status text not null default 'active'
      check (status in ('active', 'suspended', 'closed')),
    region text not null,
    created_at timestamptz not null default now()
  );

  create table iam.workspaces (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references iam.tenants(id),
    name text not null,
    kind text not null,
    status text not null default 'active'
      check (status in ('active', 'archived')),
    unique (tenant_id, id)

);

create table iam.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references iam.tenants(id),
  user_id uuid not null references auth.users(id),
  status text not null
     check (status in ('invited', 'active', 'suspended', 'revoked')),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
   unique (tenant_id, user_id),
   unique (tenant_id, id)
);

create index memberships_user_status
  on iam.memberships(user_id, status, tenant_id);

create table education.plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid not null,
  owner_user_id uuid not null references auth.users(id),
  title text not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
   unique (tenant_id, id),
   foreign key (tenant_id, workspace_id)
     references iam.workspaces(tenant_id, id)
);

create table education.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid not null,
  plan_id uuid,
  owner_user_id uuid not null references auth.users(id),
  title text not null,
  state text not null default 'open'
     check (state in (
       'open', 'in_progress', 'completed', 'cancelled'
     )),
  due_at timestamptz,
  completed_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
   foreign key (tenant_id, workspace_id)
     references iam.workspaces(tenant_id, id),
   foreign key (tenant_id, plan_id)
     references education.plans(tenant_id, id)
);

create index tasks_tenant_owner_due
  on education.tasks(tenant_id, owner_user_id, due_at);

  alter table iam.memberships enable row level security;
  alter table education.plans enable row level security;
  alter table education.tasks enable row level security;

  revoke all on iam.memberships from anon, authenticated;
  revoke all on education.plans from anon, authenticated;
  revoke all on education.tasks from anon, authenticated;


This deliberately leaves client access closed. Add reviewed read policies and command
execution paths in subsequent migrations.
For a Supabase implementation, policy tests should assert both allowed and denied operations.
Supabase cautions that a write matching zero rows is not proof of success; tests should check
returned values and verify that denied writes left the target intact. [1]

3.8 Database implementation rules
    Use composite foreign keys to prevent cross-tenant references.
    Use integer minor units and currency codes for money.
    Use timestamptz for instants and explicit time zones for scheduling.
    Keep natural uniqueness rules scoped to the tenant.
    Add indexes for authorization predicates and common access paths.
    Avoid exposing unrestricted views over protected tables.
    Keep secrets outside ordinary application tables.
    Implement retention and erasure workflows, not just deleted_at.
    Revalidate authorization when generating and downloading exports.
    Make migrations compatible with the previous application release during rollout.

4. Multi-tenant billing architecture

4.1 Ownership model
Semester should own the commercial domain:

  Catalog
    → Pricing
    → Quote
    → Contract
    → Subscription
    → Invoice
    → Payment attempt
    → Reconciliation
    → Entitlement
    → Renewal

A payment provider supplies payment infrastructure through an adapter. It should not define
Semester’s entire product, contract, or entitlement model.
Stripe can be one adapter, but the design below does not require Stripe.

4.2 Separate payer from beneficiary
Do not assume “tenant equals customer equals payer.”
Examples:
    One institution pays for several campuses.
    A department pays for a limited institutional deployment.
    A student pays personally while also using an institutional license.
    A sponsor pays for approved beneficiaries.
    Semester grants a temporary evaluation entitlement.
Recommended relationships:

  Billing account
    ├── verified billing administrators
    ├── contracts
    ├── payment-provider mappings
    └── subscriptions
          ├── items and prices
          └── beneficiary tenant targets
                └── entitlement grants



4.3 Billing schema
                             Table                                    Purpose

             billing.accounts                       Legal payer and billing identity

             billing.account_members                Verified billing administrators

             billing.provider_accounts              Provider/customer references

             billing.products                       Product catalog

             billing.price_versions                 Immutable effective-dated prices

             billing.contracts                      Commercial agreement reference and terms

             billing.subscriptions                  Commercial lifecycle

             billing.subscription_items             Products, prices, quantities

             billing.subscription_targets           Approved beneficiary tenants/scopes

             billing.meters                         Usage definitions and aggregation rules

             billing.usage_events                   Deduplicated billable usage

                            Table                                     Purpose

             billing.usage_adjustments              Audited corrections

             billing.invoices                       Finalized receivables

             billing.invoice_lines                  Immutable billed-item snapshots

             billing.payment_attempts               Payment execution state

             billing.payment_allocations            Payments applied to invoices

             billing.credit_notes                   Approved receivable reductions

             billing.refunds                        Approved returned funds

             billing.webhook_receipts               Verified event intake and processing

             billing.entitlement_grants             Effective product access

             billing.dunning_cases                  Collections workflow

             billing.reconciliation_runs            Internal/provider comparison

             billing.reconciliation_findings        Unresolved discrepancies


4.4 Billing invariants
Implement these as database constraints, transaction rules, and tests:

  - Money always has a currency.
  - Payment allocations cannot exceed the permitted payment amount.
  - Refunds cannot exceed the refundable amount.
  - Finalized invoice lines are not silently edited.
  - Provider events cannot resolve tenant ownership from untrusted input alone.
  - A checkout redirect does not prove payment.
  - A payment event does not automatically override contract terms.
  - Failed payment does not erase academic records.
  - Usage has a stable deduplication key.
  - Corrections create an auditable adjustment.
  - Every manual entitlement override has an owner, reason, and expiry.


4.5 Entitlement resolution
Compute effective access from:

  contract grants
  + active subscription grants
  + approved evaluation grants
  + approved manual grants
  - explicit revocations
  subject to:
  validity dates
  tenant scope
  product limits

  contract policy
  suspension rules


Then evaluate the user’s authorization separately.
For overlapping personal and institutional plans, define precedence explicitly. Do not double-
charge the same billable event or remove personally owned access merely because an
institutional membership ends.

4.6 Payment-event data flow

  Payment provider
        │ signed webhook
         ▼
  Webhook ingress
    verify signature and expected account
    validate supported event type
    persist deduplicated receipt
         │
         ├─ durable persistence failed → non-success response
         │
         └─ durable receipt committed → acknowledge
                                         │
                                         ▼
                                      Billing worker
                                   resolve trusted mapping
                                   retrieve current state if needed
                                   lock affected commercial record
                                   apply valid transition
                                   write audit + outbox
                                             │
                                             ▼
                                    Reconciliation checks
                                             │
                                             ▼
                                  Entitlement projection
                                             │
                                             ▼
                               Product access evaluation


Stripe’s documentation confirms that webhook delivery can be duplicated and out of order,
recommends asynchronous processing, and requires the unmodified raw body for signature
verification. Those facts are why this architecture separates receipt, processing, reconciliation,
and entitlement updates. [2]

4.7 Metering
Example meters:

  governed_ai_requests
  ai_input_tokens
  ai_output_tokens

  licensed_seats
  storage_bytes
  approved_premium_workflow_runs


For every meter define:
    Unit.
    Billable event.
    Deduplication key.
    Aggregation window.
    Late-arrival policy.
    Correction policy.
    Included allowance.
    Overage rule.
    Price version.
    Customer-visible explanation.
Do not meter sensitive educational content itself. Store only the minimum operational
metadata needed to justify usage.

4.8 Collections and suspension
Recommended policy:

  invoice overdue
     → reminder
     → billing-owner notification
     → contractual grace period
     → reviewed restriction
     → suspension if permitted


Separate:
    Optional premium functionality.
    Institutionally contracted essential workflows.
    Access to existing records.
    Data export and contractual exit rights.
Define suspension behavior with the institution rather than treating “payment failed” as a
universal instruction to lock every student out.

5. API routing and request processing

5.1 Route families

  /api/v1/me
  /api/v1/me/tenants

  /api/v1/tenants/{tenantId}/workspaces
  /api/v1/tenants/{tenantId}/memberships
  /api/v1/tenants/{tenantId}/tasks
  /api/v1/tenants/{tenantId}/plans
  /api/v1/tenants/{tenantId}/calendar-events

  /api/v1/tenants/{tenantId}/courses
  /api/v1/tenants/{tenantId}/readiness
  /api/v1/tenants/{tenantId}/registration-requests
  /api/v1/tenants/{tenantId}/service-requests

  /api/v1/tenants/{tenantId}/workflows
  /api/v1/tenants/{tenantId}/approvals
  /api/v1/tenants/{tenantId}/search
  /api/v1/tenants/{tenantId}/ai/requests

  /api/v1/billing/accounts/{billingAccountId}/subscriptions
  /api/v1/billing/accounts/{billingAccountId}/invoices
  /api/v1/billing/accounts/{billingAccountId}/usage

  /api/v1/company/accounts
  /api/v1/company/implementation-projects
  /api/v1/company/incidents
  /api/v1/company/controls

  /api/v1/webhooks/payments/{provider}
  /api/v1/webhooks/integrations/{adapter}

  /api/v1/operations/{operationId}


Company routes require company authentication and capability checks; they are not implicitly
institution-admin routes.

5.2 Middleware order

  1. Transport and request-size checks
  2. Request/correlation ID
  3. Route-specific rate limit
  4. Session or webhook-signature verification
  5. Input validation
  6. Tenant/workspace/billing-account resolution
  7. Active membership and capability check
  8. Resource authorization
  9. Entitlement and policy checks
  10. Command/query execution

  11. Safe response serialization
  12. Audit/metrics completion


Cookie-authenticated mutation routes need the applicable CSRF protections. Provider webhook
routes use provider-specific verification rather than a browser CSRF token.

5.3 Command contract

  POST /api/v1/tenants/{tenantId}/tasks/{taskId}/complete
  Idempotency-Key: <unique-key>
  Content-Type: application/json


  {
      "expectedVersion": 4
  }


Transactional behavior:

  BEGIN
    claim scoped idempotency key
    verify request hash matches any previous use
    load authorized target
    check expected version
    apply domain transition
    append audit event
    append outbox event
    save command result
  COMMIT


A reused key with a different request body should return a conflict rather than execute a
different operation.

5.4 Query response

  {
      "data": {
        "id": "task-id",
        "state": "completed",
        "version": 5
      },
      "meta": {
        "requestId": "request-id",
        "correlationId": "correlation-id"
      }
  }

5.5 Error contract

  {
      "error": {
        "code": "RESOURCE_VERSION_CONFLICT",
        "message": "This item changed in another session. Refresh before retrying.",
        "retryable": false,
        "requestId": "request-id"
      }
  }


Use 202 Accepted only after an asynchronous operation is durably accepted. Return an
operation identifier and a status endpoint.

5.6 API acceptance requirements
Generate and maintain:

  OpenAPI contract
  request/response validation
  authorization matrix
  idempotency requirements
  pagination contract
  error-code catalog
  rate-limit policy
  contract tests
  deprecation policy


6. Data-flow diagrams

6.1 Academic integration and readiness

  Approved institution source
         │ minimum approved fields
          ▼
  Connector worker
         │ validate schema + identity mapping
          ▼
  Quarantine / staging
         │ compare source and mappings
          ▼
  Reconciliation
         ├─ unresolved mismatch → operator review
         └─ accepted record
                     ▼
          Authoritative-source projection
                     ▼
          Versioned readiness rules
                     ▼
          Student-scoped Today read model
                     ▼

         Explanation + source + freshness
                     ▼
         Approved institutional handoff


Do not silently “fix” unexplained source mismatches in the student-facing projection.

6.2 Consent-based sharing

  Student selects exact information
         ▼
  Payload preview
  recipient / purpose / expiry
         ▼
  Authorized consent command
         ▼
  Grant recorded + audit
         ▼
  Recipient requests access
         ▼
  Current grant and policy revalidated
         ▼
  Only permitted payload returned

  Revocation / expiry
         ▼
  Subsequent access denied
         ▼
  Caches, links, and projections invalidated as applicable


Previously downloaded information cannot necessarily be recalled. The interface must not
promise that revocation deletes copies outside Semester’s control.

6.3 AI request

  Question + declared source scope
         ▼
  Authenticate and authorize
         ▼
  Classify request and permitted use case
         ▼
  Retrieve only approved accessible sources
         ▼
  Enforce student-record egress prohibition
         ├─ prohibited → safe refusal
         └─ allowed
                 ▼
         Model-provider adapter
                 ▼
         Output validation and citations
                 ▼
         AI-assisted response

                     ▼
         Separate approved command for any consequential action


Do not store raw sensitive prompts in ordinary logs.

6.4 Company sale to customer activation

  Opportunity
     → approved quote
     → signed contract
     → obligation register
     → implementation project
     → tenant configuration
     → identity/integration tests
     → security and accessibility evidence
     → customer acceptance
     → billing/entitlement activation
     → controlled cohort rollout
     → adoption and outcome review
     → renewal decision


7. Security policies
These are proposed baseline policies requiring implementation evidence and appropriate
institutional and professional review.

                    Policy                                        Required behavior

          Access control          Deny by default; verified assignments; current membership checks

          Tenant isolation        Enforce across APIs, database, storage, search, jobs, caches, exports

          Privileged operations   Purpose-bound, time-limited access; approval where required; audit

          Staff authentication    MFA for company and privileged institutional access

          Secrets                 Server-only secret storage; rotation; no secrets in client bundles or logs

          Data classification     Classify before collection; minimize fields and permitted uses

          Encryption              Approved transport encryption and provider-backed at-rest protection

          AI governance           Central gateway; approved source classes; no student-record egress by default

          Logging                 Internal references and safe metadata; no routine sensitive record content

          Files                   Scoped access, upload validation, malware-control decision, retention

          Payments                Provider references instead of raw card details; verified webhooks; reconciliation

          Retention               Contract-specific schedules, legal holds, erasure and backup-expiry handling

          Incident response       Named ownership, containment controls, evidence preservation, notice workflow

          Change management       Reviewed migrations, tests, release gates, rollback readiness

          Recovery                Tested backups and timed restoration exercises

                Policy                                        Required behavior

          Vendor management    Purpose, access, assessment, obligations, owner, exit plan

Supabase administrative secret access can bypass RLS. Keep it out of browsers and limit it to
reviewed administrative paths; do not make it the default credential for every authenticated
request. [1]

Required negative security tests

  Student A cannot read Student B's private task.
  Tenant A cannot reference Tenant B's plan.
  A revoked member cannot continue using a cached role.
  A user cannot assign themselves a staff role.
  A company support user cannot read student notes.
  A guardian cannot access unshared data.
  An expired signed link fails according to policy.
  A search result does not reveal inaccessible titles or counts.
  A workflow cannot approve its own two-person request.
  A forged payment webhook cannot grant access.
  A replayed webhook does not duplicate a payment allocation.
  An AI request cannot exfiltrate prohibited records.
  An export cannot bypass current authorization.


8. Production scaling and reliability

8.1 Scale by measured workload
Before infrastructure sizing, define:

  number of tenants
  largest tenant size
  concurrent active sessions
  peak API requests
  integration event volume
  registration-period bursts
  job volume and acceptable lag
  file volume
  AI request volume and budget
  support capacity
  contractual recovery requirements


Without these inputs, “production scale” is a design target, not a validated capacity claim.

8.2 Scaling controls
    Stateless API instances.
    Bounded database connection pools.
    Tenant-aware rate limits.

    Fair job scheduling to prevent one institution monopolizing workers.
    Backpressure and queue-depth alerts.
    Cursor pagination and bounded exports.
    Indexed tenant and permission predicates.
    Read projections for expensive dashboards.
    Separate heavy analytics from transactional queries.
    Partition high-volume audit, usage, or event tables only when measurements justify it.
    Avoid replicas for security-sensitive reads unless revocation and replication-lag behavior
    are explicitly handled.
    Use circuit breakers or equivalent failure controls around unstable external providers.

8.3 Proposed starting operational targets
These are planning targets, not contractual commitments:

                        Signal                                Initial target to validate
             Interactive API reads      p95 below 800 ms for agreed representative queries

             Ordinary background work   Alert on sustained queue lag above the workflow’s limit

             Academic freshness         Display actual age; enforce institution-approved limits

             Payment processing         Durable receipt before acknowledgement; monitored processing lag

             Tenant isolation           Zero accepted cross-tenant access in test suite

             AI data boundary           Zero prohibited-record egress in test suite

             Recovery                   Institution-approved RPO/RTO demonstrated by a restore exercise

Do not turn these into an SLA until workload tests and operating evidence support them.

9. Zite workflow implementation prompt
Zite documents database-triggered automations and integrations with external automation
tools, and its product documentation includes app-user roles and data permissions. These
capabilities are useful building blocks, but they do not establish durable transaction, isolation,
or approval semantics for Semester automatically. [3] [4] [5]
Paste the following after the Semester master context:

  Build Semester's workflow orchestration system.

  GOAL
  Implement connected, persistent, permission-enforced workflows across:
  1. Education Experience.
  2. Institution OS.
  3. Semester Company OS.

Do not build only forms and status dropdowns.
Implement authorized state transitions with durable history,
idempotency, failure handling, and operational visibility.

FIRST: CAPABILITY ASSESSMENT
Verify whether this environment supports:
- server-side authorization
- tenant-scoped data permissions
- atomic multi-record transactions
- unique constraints
- durable background execution
- retries and dead letters
- scheduled timers
- signed webhook verification
- secret storage
- immutable or restricted audit history
- concurrent-update protection
- automated tests
- environment separation
- exportable data and workflow definitions

Classify each:
supported directly
supported through verified integration
requires external backend
unsupported
not verified

Do not invent platform capabilities.

If an essential guarantee cannot be enforced in Zite,
implement Zite as the interface over an external workflow API.
Do not duplicate authoritative state in both systems.

DATA MODEL
Create or map:

workflow_definitions:
id, tenant_id, key, version, status,
trigger_schema, definition, published_by, published_at

workflow_instances:
id, tenant_id, definition_id, definition_version,
subject_type, subject_id, state,
initiator_id, correlation_id,
created_at, completed_at, version

workflow_step_runs:
id, tenant_id, instance_id, step_key,
attempt, state, input_ref, output_ref,
started_at, finished_at, next_retry_at, error_code

workflow_approval_requests:
id, tenant_id, instance_id, step_key,
required_capability, required_scope,
requester_id, due_at, state

workflow_approval_decisions:
id, tenant_id, approval_request_id,
approver_id, decision, reason_ref, decided_at

workflow_transition_events:
id, tenant_id, instance_id,
from_state, to_state, actor_id,
policy_version, occurred_at, correlation_id

workflow_timers:
id, tenant_id, instance_id, step_key,
fire_at, state

workflow_dead_letters:
id, tenant_id, instance_id, step_key,
attempts, safe_error_metadata, review_state

workflow_idempotency:
scope, key, request_hash, result_ref, expires_at

Use restricted references for sensitive payloads.
Do not put student records in general workflow logs.

ENGINE RULES
- Published definitions are versioned.
- Running instances retain their definition version.
- Only authorized commands change state.
- Reject invalid transitions.
- Reject stale expectedVersion values.
- Deduplicate retried commands.
- Reauthorize at execution time.
- Approval becomes invalid if its approved payload changes.
- Requester cannot satisfy a two-person approval.
- Timers and workers carry explicit tenant context.
- Side effects use retry-safe adapters.
- Use compensation where a side effect cannot be rolled back.
- Do not claim exactly-once external execution.
- Record attempts and reconciliation status.

IMPLEMENT THESE WORKFLOWS

A. Student task completion
open → in progress → completed
Support safe retry and personal undo where appropriate.

B. Registration readiness
approved source import → mapping validation →
reconciliation → deterministic evaluation →
student explanation → official handoff.

Do not claim enrollment is complete without authoritative confirmation.

C. Student consent
payload selection → exact preview →
recipient/purpose/expiry confirmation →

grant → access history → expiry/revocation.

D. Institutional service request
intake → classification → authorized routing →
assignment → response → resolution → closure.

Protected service categories require approved separate handling.

E. Customer onboarding
signed contract → implementation project →
tenant setup → SSO → integration validation →
reconciliation → training → acceptance →
go/no-go → controlled activation.

F. SaaS billing
approved commercial terms → invoice →
provider payment attempt → verified event receipt →
reconciliation → entitlement update.

Never grant access from a browser success redirect alone.

G. Credit/refund
request → invoice/payment validation →
finance approval → impact preview →
provider execution → reconciliation → receipt.

No live money movement during development.

H. Incident response
report → severity assessment →
containment → owner assignment →
approved communications → recovery verification →
post-incident review.

Do not send incident notices automatically without approval.

INTERFACE
Build:
workflow inbox
my approvals
instance detail
decision trail
blocked work
retry queue
dead-letter review
definition versions
safe diagnostic view
evidence attachments

Every view must be tenant-scoped.
Show loading, empty, error, stale, and permission states.
Use Semester's existing design system.

TESTS
Include:
cross-tenant denial

 unauthorized transition
 self-approval denial
 changed-payload approval invalidation
 duplicate command
 duplicate webhook
 out-of-order event
 worker crash after side effect
 expired consent
 revoked membership during execution
 timer retry
 dead-letter recovery
 concurrent updates

 DELIVERABLES
 1. Capability assessment.
 2. Schema and ownership map.
 3. State diagrams.
 4. API contracts.
 5. Working synthetic-data workflows.
 6. Permission matrix.
 7. Tests actually executed.
 8. Operational runbook.
 9. Remaining deployment blockers.

 Do not use real student records.
 Do not publish, deploy production, send communications,
 move money, or modify live external systems without approval.


10. Deployment plan and go/no-go gates

10.1 Deployment sequence

 1. Inspect repository and current infrastructure.
 2. Resolve tenant, authority, and billing ownership decisions.
 3. Provision isolated development, staging, and production environments.
 4. Configure identity and secrets.
 5. Apply reviewed schema, grants, and policies.
 6. Deploy API and workers.
 7. Deploy interfaces.
 8. Configure sandbox integrations.
 9. Execute isolation and contract tests.
 10. Execute billing and workflow failure tests.
 11. Run representative load tests.
 12. Perform restore and rollback exercises.
 13. Complete institutional acceptance.
 14. Approve a limited cohort.
 15. Activate and monitor.
 16. Expand only after evidence review.

10.2 Deployment blockers to resolve
                        Decision                                  Required input
                 Authoritative database    Zite database, external PostgreSQL, or domain-specific split

                 Identity                  Approved authentication and institutional SSO configuration

                 Hosting                   Runtime, region, environment isolation

                 Payment adapter           Provider and contractual payment methods

                 Institutional authority   Which records are external, native, or derived

                 Data scope                Approved fields, purposes, retention

                 Capacity                  Representative tenant and peak-load assumptions

                 Recovery                  Approved RPO/RTO

                 Suspension                Contractual billing and access behavior

                 Security review           Reviewer, findings process, acceptance criteria


10.3 Release evidence
A production release should have:
    Schema migration review.
    Grants and RLS test results.
    API contract tests.
    Role and tenant-isolation tests.
    Workflow recovery tests.
    Billing reconciliation tests.
    Accessibility checks and disclosed limitations.
    AI-boundary tests.
    Secret scanning.
    Representative capacity results.
    Restore evidence.
    Rollback instructions.
    Named operational owner.
    Explicit launch approval.

10.4 Repository deliverable structure
Have the implementation agent produce:

  docs/system-design/
    architecture.md
    deployment-topology.md
    tenant-and-auth-model.md
    database-dictionary.md
    data-flow-diagrams.md
    billing-architecture.md
    security-policies.md
    capacity-and-reliability.md
    deployment-runbook.md
    launch-gates.md
    unresolved-decisions.md

  contracts/
    openapi.yaml
    events/

  database/
    migrations/
    tests/

  workflows/
    definitions/
    fixtures/
    tests/

  runbooks/
    incident-response.md
    billing-reconciliation.md
    integration-recovery.md
    restore-and-rollback.md


The most important implementation boundary is this: Zite may provide the connected
interface and automation entry points, but any security, transaction, billing, or durability
guarantee that cannot be verified there must live in a backend designed and tested to enforce it.
                                                           ⁂


  1. https://supabase.com/docs/guides/database/postgres/row-level-security
  2. https://docs.stripe.com/webhooks
  3. https://zite.com/help/database/automations/overview
  4. https://zite.com/help/whats-new
  5. https://zite.com/help/database/automations/n8n
  6. https://deepwiki.com/supabase/dbdev/4.3-security-and-row-level-security
  7. https://www.agilesoftlabs.com/blog/2026/06/supabase-row-level-security-guide-2026
  8. https://www.precursorsecurity.com/blog/row-level-recklessness-testing-supabase-security

 9. https://github.com/orgs/supabase/discussions/13068
10. https://www.zite.com/integrations
11. https://www.linkedin.com/posts/dominicwhyte_one-of-our-most-requested-zite-features-is-activity-747085384308638
    9248-hrYd
12. https://www.zite.com/help/platform/getting-started/glossary
13. https://supabase.com/docs/guides/auth/oauth-server/token-security
14. https://zite.com/help/database/automations/relay
15. https://automationace.com/blog/how-zite-combines-databases-apps-forms-workflows
16. https://dev.to/ethan__par_ker/supabase-row-level-security-the-policies-that-actually-ship-saas-1ell


```
