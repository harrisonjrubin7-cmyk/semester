# Role workflow reconciliation

Source: `Student_vs_Faculty_vs_Admin_role_permission_matrix.pdf` (23 pages), the
"Execution instruction for the coding agent" in its section 8. This note
records what was reconciled against the repository, what was built, what was
deliberately not built, and what is still blocked. It is a status record, not
a decision: no decision number is taken.

## Built in this increment

- `app/src/components/LearnerWorkspaceView.tsx` — the learner's "Your semester"
  controlled view. Loading, forbidden, error (with retry), empty, and ready
  states. The parent supplies an already-authorized projection; the component
  makes no API calls. Planned courses read "Planned", never "Enrolled"; every
  item carries its source and freshness; disabled actions cannot fire.
  Tests: `app/src/components/LearnerWorkspaceView.test.tsx` (9 tests).
- `app/src/components/CourseStudio.test.tsx` — four cases added to the existing
  suite: account switch removes the prior account's course list, a late lookup
  from the previous account is ignored, a failed access check retries without
  retaining old grants, and sign-out removes connected teaching content.

### Mutation evidence for the new Course Studio cases

Each guard was removed from `CourseStudio.tsx` in a scratch edit and the file
was restored from git afterwards:

| Mutation | Result |
|---|---|
| Both late-response guards (`alive && setCourses`) removed | "ignores a late course lookup" fails |
| Owner check (`courses?.who === who`) and loading reset removed together | "removes the prior account course list" fails |
| Owner check removed alone | all 16 pass — the loading reset still hides the list |
| Loading reset removed alone | all 16 pass — the owner check still hides the list |
| Learner context-key guard removed | "shows nothing from a previous context" fails |

The single-guard results show the guards are defence in depth: either one is
enough to hide another account's data. The retry and sign-out cases were not
mutation-tested.

## Reconciled and deliberately not built

### Role-transition storage

The draft (`private.role_transition_request` and `private.role_transition_change`)
is **not** added as a migration. The repository already has the pieces it would
duplicate:

- `public.approval_request` and `public.approval_decision`
  (`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`):
  duty-bound, require evidence and a ticket, expire after seven days, and track
  execution. A transition is an approval of a change set. The PDF's own rule is
  to reuse approval, audit and outbox systems.
- `public.role_grants` (`20260921223000_role_grants.sql`): the draft's
  `scope_kind`/`scope_id` rule `((scope_kind = 'platform') = (scope_id = ''))`
  and the one-grant-per-scope unique key already exist there. The draft's
  `role` FK to `public.app_roles` matches the canonical vocabulary.
- `private.role_grant_audit_event` and its triggers
  (`20260924213000_role_grant_audit.sql`): grant changes are already audited
  and the audit rows are immutable.
- `private.revoke_grants_on_deprovision()`
  (`20261012055000_provisioning_authority_hardening.sql`): deprovisioning
  already revokes grants, so membership-ended transitions are partly covered.

Open decision before any transition schema is written: whether a
`role.transition` duty in `console_duty` with the change set stored in
`approval_request.detail` is enough, or whether ordinal change rows are needed.
The draft's ordinal `role_transition_change` idea is the only piece with no
existing equivalent.

Known gap in the draft: `scope_kind` values are an inline `check` on
`public.role_grants`, not a shared table, so a transition table cannot foreign
key them. The command layer must check the same list.

### Role elevation

No endpoint was added. The PDF forbids it until authorization, exact scope,
approval binding, audit, idempotency and revocation tests exist.

### Mounting the learner view

`LearnerWorkspaceView` is **not mounted** anywhere. No permitted learner
projection exists in the repository that supplies "next actions" with source
and freshness. Mounting it would mean inventing that data, which the PDF rules
out. The next step is to define the projection and its server contract.

## Verification

Run from `app/` unless noted. Pre-existing failures are reported separately.

- Type check: `npx tsc -b` — clean.
- `npm run lint` — exit 0; no warnings from the new or changed files; the
  existing warnings are below the 25-warning cap.
- `npm run design-system:check` — 0 violations; no ledger growth.
- Targeted suites: `CourseStudio.test.tsx` and `LearnerWorkspaceView.test.tsx`
  — 25 of 25 passing.
- Full suite: see the result recorded below.

## Not verified and blocked

- **Course Studio SQL suite** (`supabase/coursestudio.check.sql`) was not run.
  Docker is unavailable in this environment, and the full migration chain needs
  the Supabase stack. Nothing in the SQL was changed.
- **Deployment** was not performed. The PDF requires explicit approval before
  any change to hosted resources, migrations, or the hosted database.
- **Learner projection**: needs a server contract before the view can be
  mounted.
- **Role transitions**: need the decision above before any schema is written.
