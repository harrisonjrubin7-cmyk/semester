# Supporter and family privacy model

Part 11 of the expansion command. Phase 5. **Needs a policy decision on minors
before building** (see below).

## What exists on main

- **Family** (`app/src/screens/Family.tsx`, nav id `family`) and
  `app/src/lib/family.ts`: family members and items (information, request,
  checklist, budget), a preview of what a family member would see, and a local
  history that says of itself it is not an audit log.
- `public.family_grants` (`supabase/migrations/20260921161500_roles.sql`):
  category, access (`none · selected · view · payment`), resource ids, expiry.
  This is the supporter sharing permission, already.
- `public.student_context.is_minor` and a guardian-consent field.

**Not the same thing:** consented *support access*
(`supabase/migrations/20260925103000_support_access.sql`,
`app/src/lib/support-access.ts`) is for university support staff with
`support:read`. Its `read_support_signals` returns an aggregate learning
summary including an **average score**. A family member must never see that, so
supporter features are built on `family_grants` and **never** on support
access.

## In flight

Nothing.

## Entity plan

| Command entity | Decision | Why |
|---|---|---|
| `supporter_profiles`, `supporter_relationships` | **Reuse** `family_grants` + a supporter account | |
| `supporter_sharing_permissions` | **Reuse** `family_grants.category` / `access` / `resource_ids` | Categories: selected deadlines, general milestones, financial-action reminders, emergency resources |
| `supporter_shared_items` | **View** over the granted items | Computed from the grant, so revoking the grant removes the items |
| `supporter_revocations` | **Audit rows** on `family_grants` changes | Same pattern as `role_grant_audit_event` |
| `supporter_resource_hub_entries` | **School pack section** | General, needs no student data |

## Capabilities and flags

- A supporter holds no capability. Access is exactly the student's grant.
- Flag `me.supporter_sharing`, `off` — the command lists supporter sharing among
  things never enabled by default.

## Hard boundaries

- **Default is share nothing.** There is no parent dashboard and no implied
  access.
- Never shared, whatever the grant says: grades, scores or averages, counselling,
  health, disability, private notes, course activity, messages, location,
  private study data, community membership, AI conversations.
- A supporter cannot act as the student, change the plan or see anything hidden.
- Every grant expires and can be revoked at once; revocation takes effect on
  the next read.
- **Minors and FERPA:** what a supporter of a minor, or of a dependent student,
  may see is each school's policy. Until a school records it, the feature stays
  off for that school.

## Tests

- `.check.sql`: a supporter with a `selected` deadline grant reads that deadline
  and nothing else; after revocation, nothing.
- The supporter view's data source has no path to `read_support_signals`, grade
  tables or notes (import graph + RLS).
- An expired grant reads nothing.
