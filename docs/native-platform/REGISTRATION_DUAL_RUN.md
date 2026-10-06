# One section, dual-run, sandbox only

**As of** 2026-10-06. **Not a pilot. Not a cutover.** `writeback.registration_submit` stays off. `supabase db push` was not run.

The SIS enrols. Semester keeps a shadow receipt for one synthetic section and does not take a seat.

## What already refuses an enrol

`registration_enroll` and the TypeScript engine in `app/src/lib/enrollment/service.ts` `blocker` refuse, in the registrar's order:

| Cause | Engine reason | SQL check |
| --- | --- | --- |
| Add/drop has closed | `window_closed` | `supabase/registration_transaction.check.sql` (hist after the window) |
| An active hold | `hold` | the same file, office named, reason not returned |
| A course not passed and not waived | `prerequisite_missing` | the same file, `ana` into calc |

`app/src/lib/enrollment/enrollment.test.ts` fails if those three returns are removed. Shown on 2026-10-06: with the three returns replaced by `null`, 9 tests failed, including "refuses after add/drop closes", the hold submit, and "refuses a missing prerequisite". The order ladder that landed on main as `706feed4` failed its hold rung, its prerequisite rung, and the late-window case in the same run. `service.ts` was restored; it is unchanged by this plan.

Drop and withdraw use the same blocker for a hold. A hold does not block leaving. That is the existing rule, not a new one.

## The shadow receipt

`shadowReceipt` in `app/src/lib/enrollment/shadowreceipt.ts` takes an SIS notice (`externalRef`, `sectionCode`, `term`, `outcome`) and returns:

- `authority: 'sis'`
- `source: 'imported'` (the existing source list, not `institution_verified`)
- `wroteSeat: false`

It does not call `registration_enroll`, open a database, or read a student record. The sandbox command, from `app/`, is:

```bash
node scripts/registration-shadow-receipt.mjs
```

The fixture is section `MATH 101`, term `2026FA`, SIS reference `sis-ref-1001`. The script exits 1 if the receipt's authority is not the SIS or if `wroteSeat` is not false.

## What this does not do

- It does not enrol anyone.
- It does not start a dual-run against a live section.
- It does not compare a real SIS extract. The migration factory's M5 station in `docs/master/SEMESTER_MIGRATION_FACTORY.md` still requires a live unit, a signed scope, and a clean comparison. None of those exist here.
- It does not change `RegistrationReadiness` on main (`e0082d91`, `c45114c1`), which already says preparation is not registration clearance.
