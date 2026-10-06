# Role and capability matrix

Two matrices already exist. This page says which question each one answers so a later session does not merge them.

## Client role, `app/src/lib/role.ts`

Ten roles: student, faculty, teaching assistant, advisor, admin, staff, applicant, payer, family, alumni. `forRole` hides screens that are addressed only to a student. An applicant may open `launchpad`. A missing or unknown role gets the narrower set.

`app/src/lib/rolejourney.ts` gives each of those roles one first action and, when the app has a screen that role may open, that screen. Payer’s screen is null. `closedJourneys()` must stay empty: a journey must not point at a screen `forRole` would refuse.

Choosing a role does not create a membership.

## Server capability, `app/src/lib/rolelaunch.ts`

`OPERATIONS_ONLY` is what a platform or commercial role may hold. `STUDENT_RECORD` is what reaches one student’s records, including `registration:administer`. The test refuses a grant that puts a student-record capability on an operations role.

Database role counts and gateway role counts disagree across older docs. `docs/operations/OPERATIONS_ROADMAP.md` records that contradiction (OR-15). Do not pick a number here.

## Registration actions

| Action | Who | Where it is decided |
| --- | --- | --- |
| Type course codes | The person holding the device | `readPlanDraft` |
| Build a cart from an imported catalog | The student, on device | `RegistrationPortal` |
| Enroll, drop, withdraw | The student, only if the school gate is on | `Registration.tsx` and the database writers |
| Override or administer registration | A grant of `registration:administer` for that school | `my_capabilities`, not the client role picker |

The operations matrix at `docs/operations/ROLE_CAPABILITY_MATRIX.md` remains the long-form catalog. This file is the rule for the registration journey.
