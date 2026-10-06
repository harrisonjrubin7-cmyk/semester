# Domain catalog

Each row is a component the mainframe specification names. Scores are the four axes in `READINESS_REGISTER.csv`. “Owner” is the operating owner the specification expects. Where the repository has not named a person, the owner is **unassigned**.

Client navigation is not authorization. A screen in this catalog is not a grant.

## Device registration plan

- Owner: unassigned. Product surface for a student before an account.
- Canonical implementation: `app/src/lib/planpreview.ts`, `app/src/components/PlanPreview.tsx`, `FirstRun` door, `NamedPlan` in `RegistrationPortal.tsx`.
- Roles: student, on this device. Other roles keep their own first screen via `rolejourney.ts`.
- Tenant scope: none. The list is not institution-scoped.
- Authority: the student who typed the codes. Not the registrar.
- Dependencies: `blankCourse`, `addCourse`. No network.
- Policies: at most 12 codes; a code matches a department and a number; empty term is refused.
- Audit: none beyond the course’s `source` field `Added by hand`. No server audit row.
- Tests: `planpreview.test.ts`, `screens/planpreview.test.tsx`, `RegistrationPortal.namedplan.test.tsx`, `rolejourney.test.ts`.
- Observability: none. It does not leave the device.
- Support: the sentence under the button. There is no ticket because nothing was sent.
- Recovery: delete the course on the device. That does not drop a class.
- Readiness: design specified, implementation local-tested, deployment not-deployed, authority device-local.
- Blocker: a catalog, sections, and seats are a later import. Do not treat these codes as a cart.

## Term plan

- Owner: unassigned.
- Canonical implementation: `app/src/screens/Yes.tsx`, `app/src/components/RegistrationPortal.tsx`.
- Roles: student. `yes` is in `STUDENT_ONLY`.
- Tenant scope: whatever institution name was inside the imported file. Semester has not verified it.
- Authority: planning workspace. Copy says official enrollment and live seats need an institution connection.
- Dependencies: device library key `semester.registration.v1`.
- Policies: catalog file size, cart conflicts, twelve saved schedules.
- Audit: `record` journal entry `plan-saved` with provenance “Your planning workspace”.
- Tests: `RegistrationPortal.conflicts.test.tsx` and the named-plan test.
- Observability: device only.
- Support: recovery JSON download when the device library fails.
- Recovery: undo catalog removal; export cart. Not an enrollment reversal.
- Readiness: see the register.
- Blocker: live section feed.

## Registration readiness checklist

- Owner: unassigned.
- Canonical implementation: `app/src/components/RegistrationReadiness.tsx`, `app/src/lib/path-readiness.ts`.
- Roles: student path.
- Tenant scope: imported institution name when present.
- Authority: explicitly not clearance.
- Dependencies: path profile, requirements, registration cart, meetings.
- Policies: imported data is not promoted to official.
- Audit: not a server command.
- Tests: existing path-readiness tests. This batch did not extend them.
- Observability: none added.
- Support: the details list names SSO, LTI, OneRoster, and official writes.
- Recovery: not applicable. It does not submit.
- Readiness: built, unoperated, not authoritative.
- Blocker: the device-named codes are not yet one of its rows. That is the next task.

## Official registration

- Owner: registrar, when a school turns the gate on. Unassigned until then.
- Canonical implementation: `app/src/screens/Registration.tsx`, `app/src/lib/enrollment/`, migration `20260929300000_registration_transaction.sql`.
- Roles: the student for their own transaction; registrar only with `registration:administer`.
- Tenant scope: the school the capability is scoped to.
- Authority: the school’s registration system until the gate is on and a command is confirmed. Today the screen says the gate is off.
- Dependencies: module gate `writeback.registration_submit`, `my_capabilities`.
- Policies: holds, windows, and overrides live in that ledger. This batch did not execute them.
- Audit: the ledger’s design. Production rows unverified.
- Tests: `screens/registration.test.tsx` exists. Not re-run as a full file this session.
- Observability: unverified.
- Support: the off-state sentence points the student back to the school’s system and leaves the plan alone.
- Recovery: drop and withdraw are school transactions, not a local delete.
- Readiness: built and gated. Deployment unverified. Authority external.
- Blocker: a school decision to turn the gate on, plus the open approval-bypass work in the operations roadmap before anyone claims the write cannot be skipped.

## Shared authorization

- Owner: unassigned. See `docs/operations/ROLE_CAPABILITY_MATRIX.md`.
- Canonical implementation: capability grants and `has_capability` as described there, plus `lib/rolelaunch.ts`.
- Roles: database roles and the ten client roles are different vocabularies. The roadmap records that split and does not resolve it here.
- Tenant scope: grant scope. Not “every institution”.
- Authority: the grant. Employment at Semester is not a grant.
- Dependencies: Postgres RLS and the gateway.
- Policies: F-1 direct-write bypass is still an open roadmap item.
- Audit: machinery tested in repository; production chain unverified.
- Tests: `rolelaunch.test.ts` reads migrations.
- Observability: unverified.
- Support: break-glass is a separate audited path, not a silent override.
- Recovery: revoke the grant. Hiding a menu is not revocation.
- Readiness: built, unoperated.
- Blocker: OP-01 through OP-03 in the operations roadmap. Those are migrations and need approval before anyone applies them.

Other domains in the mainframe PDF (learning, assessment, campus, community, career, family, company operations) have screens or docs and are listed in the operations scorecard. This catalog does not invent consoles for them. Their readiness is the scorecard’s, restated in `READINESS_REGISTER.csv` only where this audit touched the claim.
