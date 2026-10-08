# RLS / auth test plan (run against `supabase start`)

Use two users A, B and an organization O where A=owner, C=viewer, B is not a member.

| # | As | Action | Expected |
| --- | --- | --- | --- |
| 1 | anon | select any table | 0 rows / permission denied |
| 2 | A | insert private recommendation | ok; B selects → 0 rows |
| 3 | A | insert recommendation visibility=organization, org O | C selects → 1 row; B → 0 |
| 4 | C (viewer) | insert into O | denied (rec_insert requires owner/admin/member) |
| 5 | B | insert member row into O | denied (mem_write) |
| 6 | A | create private suite + seed tasks | B selects tasks/runs/grades → 0 |
| 7 | B | insert run for A's task | denied (can_write_suite) |
| 8 | C | grade a run in an org suite | denied (viewer) |
| 9 | A | update another grader's grade | denied (grader_id) |
| 10 | any | insert run status=unsupported without reason | check constraint violation |
| 11 | any | insert run persistence_tested=true without evidence | check constraint violation |
| 12 | build | grep .next/static for SERVICE_ROLE | no match |

Automate with `supabase test db` (pgTAP) using `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>"}'`.
