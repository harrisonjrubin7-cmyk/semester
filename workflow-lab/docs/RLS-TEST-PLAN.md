# RLS and auth test plan

Authorization lives in Row Level Security. The UI hides controls for convenience
only. Every case below is **executed** by `tests/rls.test.ts` against real
Postgres (PGlite) with the committed migrations and `seed.sql`, as the
`authenticated` or `anon` role with `auth.uid()` set — so a policy regression
fails the suite. `tests/actions.test.ts` covers the server-action layer on top.

Cast: **alice** (owner of Org A), **bob** (member of Org A), **carol** (viewer of
Org A), **dave** (outsider), **erin** (owner of Org B).

## Private data
| # | Case | Expected |
| - | ---- | -------- |
| P1 | Alice clones the template | 12 tasks in a suite only she can see |
| P2 | Bob reads Alice's personal suite, tasks, runs, grades | 0 rows each |
| P3 | Bob inserts a run/grade into it; updates or deletes its rows | RLS error / 0 rows affected; data unchanged |
| P4 | Alice inserts a run with `recorded_by` = Bob, or a grade with `grader_id` = Bob | RLS error (no forging) |
| P5 | `anon` selects from benchmark, recommendation, organization tables | permission denied |
| P6 | `anon` calls a `private.*` helper | permission denied |

## Template
| # | Case | Expected |
| - | ---- | -------- |
| T1 | Any signed-in user reads the template | 12 tasks |
| T2 | Anyone updates/deletes it, adds a run, or inserts a second template | 0 rows / RLS error |

## Organization sharing
| # | Case | Expected |
| - | ---- | -------- |
| O1 | Creator of an org | becomes `owner` automatically |
| O2 | Members and viewers read the shared suite; outsiders and other orgs | members yes; dave and erin 0 rows; Org A members never see Org B's suite |
| O3 | Member records a run and grades; a viewer and the owner read both graders | allowed; all graders visible |
| O4 | Viewer inserts a run, a grade, or a shared recommendation | RLS error |
| O5 | Bob edits Alice's grade | 0 rows affected; value unchanged |
| O6 | Outsider (dave, erin) inserts into the org suite | RLS error |
| O7 | Dave or carol clones the template into Org A | RLS error |
| O8 | Recommendations: private vs shared | private only to author; shared to members; never to outsiders; cannot be created as another user |

## Roles
| # | Case | Expected |
| - | ---- | -------- |
| R1 | Admin adds a member/viewer | allowed |
| R2 | Admin adds an owner or admin; promotes anyone to owner | RLS error |
| R3 | Admin changes or removes the owner | 0 rows affected |
| R4 | Member adds/changes members | RLS error / 0 rows |
| R5 | Non-member lists an org's members | 0 rows |
| R6 | Demote/remove/leave as the last owner | rejected (`at least one owner`) |
| R7 | Add a second owner, then the first leaves; owner deletes the org | allowed; cascade is not blocked by the guard |
| R8 | Admin deletes the organization | 0 rows affected |

## Persistence ceiling (integrity, enforced in the database)
| # | Case | Expected |
| - | ---- | -------- |
| C1 | Persistence-required task, no test recorded, persistence grade 3 | rejected (ceiling 0) |
| C2 | Tested, did not survive reload, `local-preview`, grade 2 | rejected (ceiling 1) |
| C3 | `browser-local` survived, grade 4 | rejected (ceiling 3) |
| C4 | `database` survived, no evidence, grade 5 | rejected (ceiling 3); with evidence → allowed |
| C5 | Run later edited to "did not survive" | existing grade pulled down to 1 |
| C6 | Task that does not require persistence | uncapped |
| C7 | TypeScript and SQL ceilings over all 144 input combinations | identical (`tests/persistence.test.ts`) |

## Constraints
Unique `(task, platform, attempt)`; run and task must share a suite (composite FK);
scores 0–5; a grade needs ≥ 1 score; survival requires a test; weights total 100
across 8 criteria; `output_url` must be `http(s)`.

## Manual checks after deploying (needs a real Supabase project)
These need Supabase Auth, which the automated suite does not run.
1. Sign in with a magic link in browser A; open the link in browser B → still works with the `token_hash` template.
2. Create two users; user 1's suite returns 404 for user 2 at `/benchmark/<id>` and 404 at `/api/exports/benchmark?suite=<id>`.
3. Sign out, reload a protected page → signed-out state; saving shows the sign-in prompt.
4. Inspect network traffic and the page source: only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key appear.
5. Run Supabase's Security Advisor: no table without RLS, no `anon` grants.
