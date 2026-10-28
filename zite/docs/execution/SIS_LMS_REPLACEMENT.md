# SIS/LMS replacement — status and first executable increment

Source: owner's "detail outline … SIS and LMS" specification (27 Oct 2026, 24 pp). This file tracks what is built against
it. The machine-checked register is `apps/semester/src/lib/replacementRegister.ts` (test: `tests/replacementRegister.test.ts`),
with six separate statuses per capability: designed, implemented, tested, deployed, institution_authorized,
production_enabled. Nothing is institution-authorized or production-enabled; those need an owner approval reference.

## §16 first executable increment (27 Oct)
| Link | Built by | Status | Evidence |
|---|---|---|---|
| Approved section | Institution section requests → Sections | implemented | no database check yet |
| Concurrency-safe enrollment | reg_decide / reg_seats / locks, sub, ser, wl modules | tested | dbchecks/registrationRace.ts: 20 concurrent last-seat claims → 1 seat; control without lock → 6 |
| Course roster | Enrollments → section pages | implemented | — |
| Assignment submission | Tasks + Submissions | implemented | gaps: no immutable artifact or receipt |
| Released course grade | ogr_propose / ogr_release (new) | tested | dbchecks/officialGrades.ts 32/32 |
| Certified official entry | ogr_certify / ogr_post / ogr_correct, aum_modes (new) | tested | dbchecks/officialGrades.ts 32/32 + 3 mutants |

Behaviour change: Faculty "set final grade" (api/staff.ts setFinal) now creates a course-grade proposal. It no longer writes
the enrollment's official Final Grade directly. Official grades are written only by registrar posting, and only projected
into the institution's records in pilot/authoritative mode (two administrators + evidence) or for sample institutions.
Records mode for every tenant is `design` today.

## Open items
- SECURITY (not verified): `zite.permissions.json` has no `defaultPolicy` and no roles. The spec notes Zite rules are
  inert unless `defaultPolicy` is "deny". No app page imports `zitejs/db` (all access goes through endpoints), but whether a
  signed-in user can read or write tables directly has not been tested. Needs Zite documentation or a second account.
- Live two-person run of the §16 path: needs a second (teacher) sign-in account in the sample institution.
- Gaps per link are listed in the register (`gaps`).
