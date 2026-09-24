# Role and capability exposure audit

This records what the repository proves. It is not evidence that Vanderbilt
identity, provisioning, or production authorization is active.

## Surfaces

| Surface | Roles | Current authority | Verified behavior |
| --- | --- | --- | --- |
| Core Semester workspace | Student, faculty | Presentation choice on one device; not authorization | Student retains the complete product. Faculty excludes student-only degree, billing, housing, registration and similar screens. Role changes, internal navigation and typed URLs cannot leave an excluded screen open. |
| Institutional synthetic preview | Student, faculty, teaching assistant, advisor, campus staff, university administrator, moderator, employer, applicant, authorized payer, authorized family, alumni | Live synthetic scoped grants in the fixture; never production authority | Each role's visible function list is derived from unexpired capabilities for that exact role and current synthetic institution. A capability from another role or institution cannot bleed into the selected workspace. Local preparation actions create reviewable drafts and explicitly publish or send nothing. |
| Institutional gateway | Server-returned Vanderbilt roles when configured | Supabase membership plus adapter role checks | The browser role selector grants nothing. Consequential reads and writes require authenticated tenant membership, server roles and adapter authorization. |

## Privacy and scope findings

- Applicant, payer, family, alumni, employer and moderator previews do not show
  the sample student's academic task list.
- Advisor and student-success previews show a case name only when the sample
  consent flag is present. The unconsented row is labelled as a restricted
  case without exposing its sample subject name.
- Administrator presentation does not unlock the control plane. It remains a
  local inspection until a server-verified tenant-administrator capability is
  returned.
- A live-looking synthetic grant scoped to another fixture institution exposes
  no functions in the current institution's workspace.
- Preview actions append only a local synthetic draft and audit entry. Their
  receipt says that nothing was published or sent.

## Automated evidence

- `app/src/lib/role.test.ts` checks the core visibility matrix and fallback.
- `app/src/state/reducer.test.ts` checks role changes, internal navigation and
  direct routes cannot bypass that matrix.
- `app/src/components/institutional/role-workspace.view.test.ts` checks every
  representative role, fixture/grant alignment, expiry, exact-role and
  synthetic-institution isolation, and preparation-action capability
  requirements.
- `app/src/components/institutional/role-workspace.test.tsx` renders all twelve
  preview roles, verifies privacy boundaries and exercises every non-student
  local preparation action.

## External gates still required

Production role verification remains incomplete until Vanderbilt supplies and
accepts SSO/SCIM group mappings, LTI role mappings, lifecycle/deprovisioning
tests, authoritative role readback, named owners and cross-tenant isolation
evidence. Applicant, family, payer, alumni and employer production experiences
also require their approved upstream systems and data-sharing rules. A green
synthetic role audit proves the application boundary and does not substitute
for those institutional decisions.
