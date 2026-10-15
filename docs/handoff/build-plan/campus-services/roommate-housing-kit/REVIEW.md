# Review — Roommate & Housing Integration Kit (uploaded package)

Filed unchanged. Your 21 Python tests passed when you ran them; nothing re-run here (no Python, no Postgres). `housing_allocation.sql` is marked NOT EXECUTED and stays a reference.

## Adopted into the campus-services SQL

| Kit rule | Was | Now |
|---|---|---|
| One claim table for reservations, assignments **and bed closures** | Closures not modelled | `cs_occupancy_assignments` gains status `blocked` with no student; shares the bed exclusion. Checks: closure overlapping an assignment refused, adjacent closure accepted, closure can't name a student |
| Acceptance tied to the **current group version** (`accepted_group_version`) | Acceptance was `accepted_at` only — a member could accept, the group could change, and the old acceptance still counted | `accepted_group_version` required with every acceptance; any membership insert/delete bumps the group version; group selection needs every member to have accepted *this* version. Checks: version bumps, acceptance must name a version, old acceptances stop counting |

Check file is now 34 checks. The staging AT003 test sets acceptances at the current version before changing the group.

## Not adopted — decisions for you

1. **"Server roles must not BYPASSRLS."** The kit puts capability policies on every table and runs services as a non-bypassing role. The campus SQL (and the registrar hardening patch) instead use security-definer functions owned by a role that bypasses RLS, with the authority checks inside each function, and no client write policies at all. Both are defensible; mixing them isn't. Pick one for the repo before applying either. If you choose the kit's model, every `cs_*` writer needs explicit policies and the FORCE-RLS precondition in the hardening patch flips.
2. **Separate `housing` schema with identity bridge tables** (`institution_ref`, `student_ref`). The campus SQL keys straight to `auth.users` / institution ids. A bridge is worth it only if housing must run before Semester identity is canonical for that school.
3. **Dates vs timestamps.** The kit uses `daterange` (whole days in the institution's time zone); the campus SQL uses `tstzrange`. Day ranges avoid midnight-in-which-zone errors for move-in/out — consider switching before data exists.
4. **Idempotency scope.** Kit: unique per institution + actor + operation + key. Campus SQL: per institution + key, with a payload digest. Theirs lets two actors reuse a key safely; adopt if keys are client-generated per device.

## Roommate matching

The kit's `match()` agrees with the prototype's rules and goes further: both students must opt in; blocked or ineligible pairs are `excluded` (no score); only fields **both** shared are compared; overnight sleep windows wrap past midnight; output always carries `coverage` and is labelled `recommendation_only`. Use it as the reference when the prototype's suggestion logic moves to the server.

## Kit acceptance tests (13) vs checks

Covered by `campus_services.check.sql`: 1, 2, 3, 5 (reversed period is a `tstzrange` error; reserved without expiry), 9 (version + all accepted), 12. Need two sessions / the edge function: 6 (`campus-acceptance.spec`), 7. Need the service layer, audit and restore drills: 4, 8, 10, 11, 13.
