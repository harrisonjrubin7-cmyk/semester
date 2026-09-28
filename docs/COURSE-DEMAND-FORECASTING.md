# Course Demand Forecasting: Phase K

**Flag:** `demand_forecasting` (`VITE_DEMAND_FORECASTING`). Off by default
(D-012). With it off, the registration cart and University are unchanged; a
test holds both.

**Destinations:**

- **Plan › registration › Cart.** A student may contribute their plan.
- **University › Demand.** Registrar, department, dean and institutional
  research accounts read counts.

**Migration:** `supabase/migrations/20260928305000_course_demand_forecasting.sql`
(D-051). It needs the owner's approval before any merge to `main`.

**Builds on** `20260926150000_expansion_roles_and_features.sql`:

- `term_plan_courses` and its opt-in flag;
- `course_demand_snapshots`, whose check constraints refuse a count below
  ten;
- `private.refresh_course_demand`;
- the `demand:read` capability;
- `catalog_sections` capacity and waitlist.

## What each side sees

**A student**, under their cart:

> **Help your school plan sections**
> If you choose, the courses in your cart are counted with other students' — anonymously, and only when ten or more plan the same course…
> [Contribute my plan for 2027SP…]
> *Based on anonymized planning data from students who chose to contribute.*

The confirmation lists every course code as "planning to take" or "backup
N". It then says: "Not sent: your name, sections, times, instructors, or
anything else in Semester."

**A registrar or department chair**, on University › Demand:

> **ECON**
> **ECON 1010** — 70 planning to take · Fewer than 10 hold it as a backup · `Estimated` Updated today
> 55 seats in 2 sections · 4 waitlisted · 15 more planned than seats · `Imported` Updated today

| Command asks for | How |
|---|---|
| Explicit student opt-in | Off until the student confirms, per term. Consent is a record (`demand_consents`), not just a flag, and the refresh counts only live consent |
| Contribute primary/backup planning data | `contributionFrom` takes the cart (planned) and the registration-day backups (ranked). It sends each course code once, and nothing else |
| Anonymous aggregation only | The refresh counts distinct students per course. No function staff can call returns a person; a catalogue check holds that, with a control |
| Minimum threshold n ≥ 10 | A check constraint on the table; the refresh's `having`; backups null below ten; and the app reader again |
| No individual plan visibility | No staff policy on `term_plan_courses` or `demand_consents`. `demand.check.sql` reads both as the registrar and the chair and gets nothing |
| No admissions or automated enrollment use | Said on both screens. There is no export, and no function hands the counts to anything else |
| Source explanation | "Based on anonymized planning data from students who chose to contribute." on both screens |
| Registrar/department scope only | `course_demand` is security invoker, so the table's policy decides: `demand:read` over the school, or over `<school>/<DEPT>` |
| Capacity/waitlist source labels if connected | Summed from synced `catalog_sections`, labelled Imported with the sync time. Otherwise "Capacity not connected" |
| Revoke opt-in prospectively | **Stop contributing…** removes the rows and stamps the consent. Published counts keep the student until the next refresh; none after that. The dialog says so |
| Consent UI | `components/DemandContribution.tsx` |
| Aggregate demand model | `lib/course-demand.ts` |
| Threshold suppression | Above. Complementary suppression is not needed because no total is published (D-053) |
| Department/term/course scoped views | `components/DemandDesk.tsx`: by term, grouped by department, course by course |
| Refresh job/adaptor scaffold | `refresh_course_demand_snapshots(tenant, term)`, callable by the service role only; nothing schedules it |
| Tests proving no individual data is exposed | `demand.check.sql` and the two app test files, below |

## What it never does

- **Send more than course codes.** A test checks every key of the payload,
  and checks that the instructor, room, title, section and time are absent.
- **Re-send quietly.** A changed cart is pointed out; sending again is
  another confirmation.
- **Show a count below ten.** The database won't store one, and the reader
  drops one anyway.
- **Let one school's students count at another.** The owner policy and
  `contribute_course_plan` both use the school on the student's profile.
- **Predict who gets a seat.** "15 more planned than seats" is arithmetic
  on two labelled figures.

## Turning on the refresh

Nothing is scheduled. A school that turns the feature on runs this as the
service role, per term, from a scheduled job:

```sql
select public.refresh_course_demand_snapshots('<tenant>', '<term>');
```

Each run replaces that term's snapshot. Counts change only when it runs,
which is what makes stopping prospective.

## Data

| Table | Who reads | Who writes |
|---|---|---|
| `demand_consents` | The student only | `contribute_course_plan` and `stop_contributing` |
| `term_plan_courses` (contributed rows) | The student only | `contribute_course_plan`; a direct contributing row must be at the student's own school |
| `course_demand_snapshots` | `demand:read` over the school or the course's department | The refresh only |

**Retention:** `demand_consents` is in `RETENTION.md`. It goes with the
account, and the snapshot entry now names it.

## Files

| New | Purpose |
|---|---|
| `supabase/migrations/20260928305000_course_demand_forecasting.sql` | Above |
| `supabase/demand.check.sql` | 49 checks, each refusal tried as the account refused |
| `lib/course-demand.ts` | `contributionFrom`, `normalizeCode`, `readContribution`, `contributionChanged`, `readDemandRow`, `byDepartment`, `backupLine`, `capacityLine`, `pressureLine` |
| `lib/course-demand-remote.ts` | The calls |
| `components/DemandContribution.tsx` | The student's consent, under the cart |
| `components/DemandDesk.tsx` | The staff view |

| Changed | Change |
|---|---|
| `components/RegistrationPortal.tsx` | `demandForecasting` prop (default: the flag); the panel on the Cart tab, lazy-loaded |
| `screens/University.tsx` | A **Demand** tab behind the flag |
| `supabase/expansion.check.sql` | Its opted-in students now consent too |
| `supabase/grants.check.sql` | The five new functions |
| `RETENTION.md`, `styles/app.css` | The entry; `.demand-*` |

## Tests

| File | Covers |
|---|---|
| `supabase/demand.check.sql` | **Contributing:** no school, no contribution; codes, roles and size checked; replaces; a course counted once; normalized; own school only; no direct consent. **Counting:** nine consenting plus one flag without consent publish nothing, ten publish ten; a course nine plan has no row; one backup is withheld; the table refuses nine. **Access:** refresh closed to students and staff; registrar, chair, instructor, student and another school; nothing staff call returns a person, with a control. **Capacity** and its absence. **Stopping:** rows go, consent is stamped, the published count stands until the refresh; a revoked flag set directly does not count. **Anonymous callers.** |
| `lib/course-demand.test.ts` | What is sent: codes, roles and ranks only; backups ranked; one term; codes skipped and named; at most thirty. Normalizing. Change detection. Read-back. Staff: nothing below ten however it arrives; backups in words; capacity not guessed; the gap as fact; departments |
| `components/DemandContribution.test.tsx` | Flag off: no panel (with a flag-on control) and no Demand tab. Signed out, nothing is sent. Contribute after a full preview with focus on Cancel, sending exactly the payload. A changed cart pointed out, not re-sent. Stop after the prospective warning. Staff: no scope told so; counts, backups, capacity and the source line, and a count of three dropped |

**Revert checks.** Each guard was shown red against a revert and green on
restore.

- **SQL:**
  - no consent join;
  - no own-school check;
  - the threshold;
  - a definer view;
  - stopping that keeps rows;
  - an open refresh;
  - backups below ten.
- **App:**
  - contributing or stopping without a confirmation;
  - sending the section;
  - a backup duplicating a primary;
  - accepting a count below ten;
  - a backup number below ten;
  - the flag ignored;
  - guessed capacity;
  - an automatic re-send.

Two tests needed fixing before they could fail. The backup check first
passed against its revert, because no course had one to nine backups; it now
has one. The "returns a person" probe first matched `planned_students`; it
now reads whole identifiers and has a control.

## Responsive manual-test checklist

- [x] 390 and 1280px, in Chromium, with a fake signed-in session: the Cart
  panel, the contribute confirmation, and University › Demand with rows. No
  overflow and no `pageerror`.
- [ ] A real Supabase preview with seeded grants and a scheduled refresh.
- [ ] Parchment (light) ground; VoiceOver / NVDA.

## Analytics: definitions only (D-005)

Nothing below is collected.

| Event | When |
|---|---|
| `demand_contributed` | After the confirmation (the count of courses, never which) |
| `demand_stopped` | After the confirmation |
| `demand_viewed` | A staff account shows a term (scope kind only) |

## Rollback

- **The feature.** Leave the flag unset (the default). The panel and the tab
  go.
- **Before the migration is applied.** Drop the file.
- **After it is applied.** Leave it. With no refresh scheduled, nothing new
  is ever published. A student who stops has no rows left.
