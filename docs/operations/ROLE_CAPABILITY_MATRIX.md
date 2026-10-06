# Role and capability matrix (operations)

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** proposal; records no decision.

> **Authority.** The database wins. Roles, capabilities and grants are defined in migrations and rendered into [`docs/ROLE-PERMISSION-MATRIX.md`](../ROLE-PERMISSION-MATRIX.md) (69 roles, 84 capabilities, 157 grants per that render; live counts elsewhere differ — see the contradictions note in [`OPERATIONS_ROADMAP.md`](OPERATIONS_ROADMAP.md#contradictions-to-resolve)). The screen-to-capability map for the company console is [`OPERATIONS_CONSOLE_PERMISSION_MATRIX.md`](../ops/OPERATIONS_CONSOLE_PERMISSION_MATRIX.md). **This page adds the institution-side and cross-cutting view and invents no capability that lacks a stated reason.** Capabilities marked **⊕** are *proposed*, not verified against `app_capabilities`; creating one is a migration with a threat model and an approval.

## 1. The decision formula

```
Role (grant) + Tenant scope + Organisational scope + Resource relationship
 + Capability grant + Policy conditions + Consent conditions = Permission decision
```

Evaluated by `private.has_capability(cap, scope_kind, scope_id)` for the first, second, third and fifth terms (**exact** scope match: a platform grant does not satisfy a school scope; no inheritance down an org tree yet — OD-3), by in-body RPC logic for *resource relationship* (assigned caseload, assigned section, assigned tenant) and by `consent_record` / `support_access_grant` for consent. A route, a tab or a hidden button decides nothing; `lib/capabilities.ts` says so itself.

Three rules apply to every row below:
1. **No single broad admin.** `app_admins` / `is_app_admin()` are legacy and gate school offboarding and `schools_write` (F-5); they are retired, not extended.
2. **`console:operate` is a platform-wide read key, never sufficient.** Domain amounts and content need the domain capability as well.
3. **No company role reads a student's rows** (held by `company-roles-student-data.check.sql`, D-1294).

## 2. Operators from the brief → roles and capabilities

| Operator (brief) | Existing role(s) | Capabilities (verified) | Proposed (⊕) | Scope | Relationship / consent condition |
| --- | --- | --- | --- | --- | --- |
| Institution super-admin | `university_admin` | `tenant:configure`, `audit:read`, `outcomes:read`, `integration:view` | `steward:designate` | school | none |
| Registrar | `registrar` | registrar RPCs incl. `registrar_grant_override` (in-body check) | `registrar:operate` | school | none; sharing out of the institution needs consent |
| Academic affairs operator | `department_admin` | `tenant:configure` (academic domain) | `academic:manage` | org unit | the unit's programs only |
| Faculty | `faculty` | course and gradebook capabilities | `grade-release` | school | **assigned sections only** |
| Advisor | `academic_advisor` | caseload capabilities | — | school | **assigned caseload only**; notes per permitted-notes policy |
| Student accounts operator | — (role to be located) | — | `accounts:operate` | school | case-bound access; refund above threshold needs approval |
| Campus services operator | — | — | `services:operate` | operating unit | unit's catalog only |
| Security/privacy officer | `trust_officer`, `compliance_owner`, `data_steward` | `data_request:handle`, `hold:read`, `compliance:manage`, `trust:publish`, `audit:read` | `access:review` | school or platform | DSR content stays in the DSR flow |
| Semester implementation operator | `implementation_manager` | `console:operate`, `tenant:implement` | — | platform, **bound to assigned tenants** | configure approved settings; migrate only permitted data |
| Semester support operator | `support_agent` | `console:operate`, `support:ticket` | — | platform | minimum necessary context; **student content only by `support_access_grant`** |
| Semester finance operator | `finance_operator` | `billing:read`, `account:manage` | — | platform | amounts only with the domain capability |
| Semester release operator | `platform_admin` (today) | `console:operate`, `killswitch:engage` | `release:operate` | platform | flags/cohorts via the `release` duty |
| Break-glass responder | `incident_responder` | `breakglass:request`; a grant is an approved, time-boxed (≤ 4 h) `break_glass_grant` | `incident:command` | school (grant scope) | two-person approval, ticket, fresh MFA, post-use review by someone else |
| Moderator / safety reviewer | `moderator`, `trust_safety_reviewer` | `moderation:action` | — | community or school | appeals by a different reviewer |
| Customer success | `customer_success` | `success:manage`, `account:manage` | — | platform | accounts, not student rows |

`console:operate` holders today: `platform_admin`, `support_agent`, `implementation_manager`, `data_steward`, `incident_responder`, `trust_officer` (six roles). The company-roles check refers to "fourteen global roles"; twelve were identifiable by name; the other two are an open reconciliation item.

## 3. Capability × console matrix

R = read, A = start an action (request), D = decide, — = none. A cell lists the capability that grants it; ⊕ proposed. Every cell also requires `console:operate` (company) or the school-scope equivalent (institution).

### Institution consoles

| Console | Read | Act | Decide |
| --- | --- | --- | --- |
| Executive | `outcomes:read` | export pack: `report:read` | one approver |
| Academic operations | ⊕`academic:manage` | rule change: `tenant:configure` | registrar + academic affairs |
| Registrar | `registrar` | override: registrar role | term dates: two-person |
| Faculty/teaching | section relationship | ⊕`grade-release` | department rule |
| Student success | caseload relationship | outreach: ⊕`outreach:send` | lead approval |
| Student accounts | ⊕`accounts:operate` | charge/credit | refund ≥ threshold: two-person |
| Campus services | ⊕`services:operate` | capacity, eligibility | one approver |
| Community/safety | `moderation:action` | restrict | second reviewer |
| Career/alumni/employer | ⊕`career:operate` | verify employer | one approver |
| IT/identity | ⊕`identity:manage` | SSO/SCIM change | `tenant-policy` duty |
| Governance/trust | `data_request:handle`, `hold:read`, `compliance:manage` | DSR, hold | retention: two-person + counsel |
| Implementation | `tenant:configure`, `tenant:implement` | mapping, activation | go/no-go two-person |
| Institution command center | per item kind | acknowledge, assign | per item kind |

### Company consoles

| Console | Read | Act | Decide |
| --- | --- | --- | --- |
| Corporate governance | ⊕`governance:manage` | draft resolution | board + founder |
| Product/engineering | `console:operate` | `killswitch:engage`, ⊕`release:operate` | `release` duty |
| Trust/security/privacy/accessibility | `compliance:manage`, `trust:publish` | evidence release, access review ⊕`access:review` | `evidence-release` duty |
| Revenue operations | `account:manage`, `success:manage` | quote, record contract | discount > floor |
| Customer implementation/success | `tenant:implement`, `success:manage` | activate, map | launch gate two-person |
| Finance operations | `billing:read` | entitlement, invoice | `refund` duty |
| Legal/vendor operations | `compliance:manage`, ⊕`vendor:manage` | add vendor | review before data access |
| People operations | ⊕`people:manage` | grant on hire, revoke on exit | platform-scope grants: two-person |
| Operations Command Center | `console:operate` | `request_approval` | `approval:decide` |

## 4. Delegation rules (to be asserted by checks)

1. A delegator may grant only a capability they hold, at a scope no wider than their own.
2. A delegated grant expires; the default is the term or ninety days, whichever is shorter (proposed).
3. A grant whose holder leaves (SCIM deprovision, offboarding) is revoked by the same event; a check proves it.
4. Break-glass is time-boxed (≤ 4 h), ticketed, MFA-fresh, two-person, reviewed by someone who is not its subject. An overdue review blocks the next request (built).
5. Service accounts hold named capabilities, never a role; their keys rotate; their reads are audited like a person's.

## 5. Known defects to fix before this matrix is relied on

1. ~~`my_capabilities()` ignores break-glass grants, so the UI under-offers.~~ **Fixed** by `20261006100000` (merged in #1341): one school-scope row per capability in an open grant, held row-for-row to `has_capability` by `my-capabilities.check.sql` (15 checks).
2. Three INVOKER readers return all tenants to any `console:operate` holder. **Partly fixed** by `20261006110000` (#1348): `console_approvals` and `console_break_glass` now need `console:operate` AND `approval:decide`, `breakglass:request` or `trust:publish` (so `support_agent`, `implementation_manager` and `data_steward` lose the all-tenant queue; requesters, approvers, actors and subjects keep their own rows). **Still open:** `console_customers` and the `customer*` tables, pending an owner decision, because `account_executive` and `customer_success` hold no `console:operate` and granting it would also open the audit-chain read, command center, release evidence, council seats and duty matrix to them.
3. ~~`private.is_app_admin()` still gates school offboarding and `schools_write` (F-5).~~ **Fixed** by `20261006170000`: the function now answers `platform:configure` at platform scope, so all thirteen sites follow the capability model and an `app_admins` row alone is no longer an operator (held by `admins.check.sql`, red against the old function). `public.app_admins` stays until it has been unused for a release. Prerequisite checked read-only on production 2026-10-06: 2 rows, both also `platform_admin`.
4. Two role vocabularies: 69 database roles versus the gateway's 10 `UNIVERSITY_ROLES` (ADR-0002 open). New institution consoles use the database roles.
5. Tenant-bound assignment for implementation and support staff is by convention, not by a table (OD-7).
