# Education OS blueprint: what it adds, and how it maps to the handoff

From your pasted blueprint (6 Oct): Student OS, Faculty OS, Institution OS and Business OS on one shared identity, workflow and data core.

## Use the existing schema, not the blueprint's SQL
The blueprint's SQL (persons, user_accounts, role_assignments with a free-form `scope_id`, single-tenant tables, `numeric` money) is illustrative. **Don't run it.** It lacks:
- tenant isolation
- composite tenant-safe foreign keys
- RLS
- integer minor-unit money
- append-only records

Every entity it lists already exists, hardened, in \`user/semester_campus_portals.sql\` and \`user/014–024\`:

| Blueprint | Already in the handoff |
|---|---|
| persons, user_accounts | \`people\`, \`identity_links\` (SSO subject), \`memberships\`; lifecycle via \`applications\` → \`student_records\` (010 / campus DDL) |
| roles, permissions, role_assignments | \`roles\`, \`permissions\`, \`role_permissions\`, \`role_assignments\` (typed scope, expiry, revoke); helpers \`has_permission\`, \`authorize()\` |
| profiles, profile_fields, visibility, portfolio | 024 (\`profiles\`, \`profile_visibility_rules\`, \`portfolio_items\`, share links) |
| terms, programs, catalog, sections, enrollments | campus DDL + 021 (calendar, rooms, change requests, term lifecycle) |
| advisor_assignments, cases, alerts, tasks, appointments | campus DDL (\`advisor_assignments\`, \`case_assignments\`) + 011 relationships; workflow tasks |
| holds, charges, aid_awards | campus DDL (\`student_holds\`, \`billing_charges\`, aid) |
| budgets, budget_lines, resource_allocations | **New. See 025 below.** |
| audit_events, api_clients | \`audit_events\` (append-only, 013/023 ledger); developer apps in the registry |

## New: Business OS finance (\`user/025_business_os.sql\`)
Department budgets with versions, budget lines and resource allocations, with:
- integer minor-unit money
- approval by someone other than the requester
- variance alerts written to the outbox
- read-only for aggregates

Views use org-scoped permissions such as \`budget.view_org\`. **No student-level data.**

## Cross-layer workflows (event → task)
| Student or staff action | Event | Task created |
|---|---|---|
| Misses a registration step | \`registration.window.missed\` | Advisor task + reminder |
| Faculty flags poor progress | \`faculty.progress_flagged\` | Advising case, assigned |
| Student reports a financial concern | \`support.hand_raise.financial\` | Aid referral + advisor visibility |
| Applicant deposits | \`admissions.deposit_confirmed\` | Onboarding checklist, advisor assignment, provisioning |
| Restricted course added | \`registration.override_requested\` | Registrar/advisor approval queue |
| Budget variance over threshold | \`finance.variance.alert\` | Business-officer review task |

**How events flow:**
1. Every event is written to \`outbox_events\` in the same transaction as the change.
2. One workflow worker evaluates the rules and creates tasks or cases.
3. It routes them by relationship, never by role alone.
4. It notifies people through 022.

## API surface
The blueprint's endpoints map onto the registry (\`handoff/registry/capabilities.json\`) and the command functions:
- \`/me\` and \`/me/permissions\`
- \`/students/:id/360\`, which uses \`authorize()\` with purpose \`advise_assigned_student\`
- \`/advising/*\`, \`/registration/*\` and \`/finance/*\`

Each write endpoint calls exactly one command function.

## Vendor framing (positioning only)
- **EAB Navigate360:** coordinated care, alerts, campaigns.
- **Ellucian:** SIS and finance backbone.
- **HEM:** an all-in-one enrollment and records cloud.

Semester integrates with whichever SIS a school runs, through \`domain_authority\` (connected read or transaction). It doesn't replace the system of record.
