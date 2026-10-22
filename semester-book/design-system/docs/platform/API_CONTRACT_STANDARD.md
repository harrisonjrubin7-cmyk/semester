# API domains and contract standard

_Semester platform maturity program · 2026-10-05 · Source: uploads/Apple vs Google vs Microsoft in EdTech_ build a st.pdf._

APIs are organized by authority and risk, not by frontend page. High-impact writes never mutate raw tables from the browser; they go through capability-checked server commands.

## Domains

| API | Primary resources | Write-control model |
| --- | --- | --- |
| Identity | Accounts, sessions, memberships, SSO, SCIM, roles | Server-authorized; auditable |
| Tenant | Institutions, campuses, policies, configurations, feature state | Tenant admin + approval path |
| Academic | Terms, catalog, sections, enrollment, holds, records, grades | Deterministic policy + registrar authority |
| Learning | Courses, objectives, resources, assignments, assessments, study packs | Faculty/course-scoped capabilities |
| Workspace | Tasks, notes, files, calendar, plans, projects | Student ownership + sharing grants |
| AI | Requests, policy, providers, sources, usage, evaluations | Gateway-enforced, tenant/course policy |
| Student success | Caseload, check-ins, referrals, success plans, support | Purpose-limited, consent/role-scoped |
| Campus | Dining, housing, events, organizations, spaces | Service-owner policy + tenant scope |
| Career | Skills, evidence, credentials, opportunities, mentors | Student consent + verified claim rules |
| Family | Grants, invitations, scoped shares, revocation | Student-controlled, time-limited |
| Integrations | Connections, scopes, mappings, syncs, webhooks | Approval-gated, server-only credentials |
| Commercial | Quotes, contracts, subscriptions, invoices, entitlements | Finance capability + approvals |
| Trust | Controls, evidence, claims, artifacts, trust-room grants | Security/legal scoped |
| Operations | Approvals, incidents, SLOs, audits, rollouts, risks | Internal capabilities, two-person controls |
| Platform | Apps, API keys, OAuth clients, webhooks, marketplace | Tenant install approval + developer governance |

## Every API answers

| Check | Question |
| --- | --- |
| Identity | Who is calling? |
| Scope | Which tenant, customer, course or person may be accessed? |
| Purpose | Why is this data or action needed? |
| Authority | Official, derived, AI-generated, user-owned or external? |
| Policy | Which rules constrain it? |
| Validation | Are inputs structurally and semantically valid? |
| Idempotency | Can a retry create duplicate harm? |
| Audit | What event must be recorded? |
| Freshness | Live, delayed, stale or unavailable? |
| Error | What safe recovery or human hand-off is available? |

## Example resources

```
GET /v1/identity/me
GET /v1/tenants/{tenantId}
GET /v1/tenants/{tenantId}/policy
GET /v1/academic/terms
GET /v1/academic/sections
POST /v1/academic/registration-requests
POST /v1/academic/registration-requests/{id}/decision
GET /v1/learning/courses/{courseId}
GET /v1/learning/gradebook
GET /v1/workspace/tasks
POST /v1/ai/requests
GET /v1/ai/sources
POST /v1/support/requests
GET /v1/advising/caseload
GET /v1/career/opportunities
POST /v1/family/grants
GET /v1/integrations/sync-runs
POST /v1/integrations/{id}/scope-approval
POST /v1/commercial/quotes/{id}/send
POST /v1/ops/approval-requests/{id}/decision
POST /v1/privacy/data-subject-requests/{id}/complete
GET /v1/platform/apps
```
