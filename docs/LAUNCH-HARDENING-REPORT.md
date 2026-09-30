# Launch hardening report

Launch-readiness Phase 7. Each area the command names gets three answers:

- what guards it in this repository;
- what was run on 27 September 2026 and what it said;
- what cannot be done from here, and who has to do it.

A green row is a claim about a check that ran. A gap is stated as a gap, because the go/no-go decision is only as good as the rows it reads.

Everything below ran locally, not in production and not against the live project. The database runs used Postgres 16 with `SEMESTER_CHECK_PG_ANY=1`; CI runs the same scripts on 17, the major the live project uses.

## What this phase changed

**Migrations now run twice.** `supabase/README.md` has said since the start that every migration is idempotent, so running the set twice is a no-op. That matters because a restore, or a deploy that failed halfway, leaves a half-built database, and only an idempotent set can repair it. Nothing had ever tested the claim, and it was false.

The first run applied every migration a second time. Nine files stopped:

| Cause | Fix |
| --- | --- |
| `create policy` with no `drop policy if exists` | Added the drop |
| `create trigger` | Changed to `create or replace trigger`, available since Postgres 14 |
| `create table` / `create index` without `if not exists` | Added `if not exists` |
| A unique constraint dropped and re-added after foreign keys came to depend on it (`20260923211000_evidence_graphs.sql`) | Now added only when missing |
| `open_help_request` re-created over the wider version two later files had installed (`20260927230000_help_requests.sql`) | A `drop function if exists` first, as those later files already do |

The last one did not just fail. It stopped part way through and left an older `lti_account_untouched` behind, and `help-requests.check.sql` caught it. A migration that cannot run twice does not merely refuse. It can leave the database wrong.

All nine are fixed. Two more reached main while this was in review, from #803, and the check found them on the first rebase: `20260927120000_identity_claim_minimization.sql` added a check constraint without dropping it first, and `20260928011845_tenant_sso_policy.sql` re-created `lti_launch_entitlement_facts` at the three-argument signature a later file installs. Both are fixed here the same way. Production never re-runs an applied file: the migration ledger records it once. So these edits change nothing live. They change what a rebuild or repair produces, which is now identical.

**The check that keeps it true:** `SEMESTER_CHECK_REAPPLY=1 supabase/check.sh`. It:

1. applies every migration a second time;
2. requires the `pg_dump --schema-only` output to be identical to the first pass;
3. runs every policy suite on the result.

CI now runs it that way. `supabase/reapply.known` would list a file that genuinely cannot run twice, with its reason; it is empty.

It was proved rather than trusted:

- **Removing the `help_requests` fix** makes the second pass fail by name.
- **A migration that succeeds twice but creates a new table each time** passes the per-file check, and the schema diff catches it.
- **A passing file added to `reapply.known`** fails as a stale entry.

**Links in the runbooks.** `app/src/lib/runbooklinks.test.ts` holds every relative link in the operational documents to a file that exists. Those are the root runbooks, `supabase/*.md`, `docs/vanderbilt/` and `docs/market-readiness/`, 43 files. There were none broken and it keeps it that way.

Across all 226 tracked Markdown files there are 261 dead relative links, nearly all in generated reports and archived plans. Widening the check is follow-up work, one directory at a time.

## The areas

| Area | Guarded by | Ran on 27 September | Result | Not done here |
| --- | --- | --- | --- | --- |
| Row-level security and authorization | `supabase/check.sh` (every `.check.sql` suite), `tablerls.test.ts`, `grants.check.sql` | `SEMESTER_CHECK_REAPPLY=1 supabase/check.sh` | Every policy check passed on a schema built twice | Nothing; CI runs it on Postgres 17 |
| Migration idempotency | `SEMESTER_CHECK_REAPPLY=1 supabase/check.sh` (new) | Same run | All migrations apply twice; schema identical (18,941 lines, only pg_dump's random restrict token differs) | — |
| Deploy rehearsal | `supabase/rehearse.sh` | Ran | 36 pending migrations apply to production's recorded shape; the invite gate and one account's courses unmoved | **The 36 is from `supabase/ledger.snapshot`, a dated reading.** Re-read the live ledger before a launch; a newer reading that disagrees is a finding (the snapshot's own header) |
| Backup and restore | `supabase/restore.sh` (logical dump and restore, with fingerprints and controls) | Ran | Passed: 118 tables compared, fingerprints matched, `ensure_rls` survived, RLS on for every table; dump 0.2 s / 924 KB, restore 1.9 s, one account in the database | **The live project's own backups have never been restored.** `RESTORE.md` "After the drill" is still unanswered: recovery point, recovery time, and whether the dashboard restore keeps RLS. That is a drill on real infrastructure, by the owner |
| Rollback | `ROLLBACK.md`, `rollback.test.ts`, `migrationorder.test.ts` | Suite ran | Passed | The schema does not roll back (`ROLLBACK.md`); a code rollback is a Pages redeploy, not rehearsed this phase |
| Accessibility | `npm run smoke:a11y` in CI, the label and style audits in `npm run lint`, `lib/contrast.test.ts` | `smoke:a11y` against a built, base-pathed preview | Passed: 6 critical journeys at desktop and 400% reflow | **Not a WCAG audit.** No assistive-technology testing with real users, no VPAT/ACR. The smoke says so in its own comment |
| Cold load of every address | `npm run smoke:cold` in CI | Ran | "Every address opened cold drew what it names" | — |
| Dependencies | `npm audit --audit-level=high` in CI | Ran | 0 vulnerabilities | — |
| Security review | `SECURITY.md`, the secret scans in CI | CI | — | **No external penetration test.** A named second operator is a Stage 3 item in `SECURITY.md` |
| Performance | `lib/timing.ts`, the Data screen's "How fast" | Not re-run | Figures in `COMPLETION-PLAN.md` §7.1 | No SLO; no aggregate of real devices, by design |
| Load and peak capacity | `supabase/load.sh` (D-154) | Ran, in CI | Eight scenarios within budget; no lost update with two devices; capacity 2–4× the first morning of term at 10× the largest pilot ([readings](PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md#load-and-capacity)) | The database only. Still no load test of PostgREST, the `claude` function or the gateway. Before a registration-week cohort: a scripted load against a Supabase preview branch at 10× the cohort's expected peak, owner engineering |
| Documentation review | `runbooklinks.test.ts` (new), the launch docs' own tests (phases 0–6) | Ran | 43 operational documents, no dead links | 261 dead links elsewhere, listed above |
| Operational rehearsals | `docs/vanderbilt/incident-routing.md`, `MONITORING.md` | — | — | **No incident tabletop has been run.** One tabletop against the incident-routing document, with the pilot's champion, before the cohort launches |

## The launch PRs, against this phase's new check

The three open launch-readiness PRs that carry migrations were applied on top of this branch and run through the second pass. All three apply twice with the schema unchanged:

- SCIM gateway, `20260928200000`;
- support tickets, `20260928210000`;
- private beta, `20260928220000`.

Other open PRs with migrations will meet the same check in CI once this lands. That is the point of it.

## What this report does not claim

- No production deploy was rehearsed against production itself.
- No live backup was restored.
- No load was applied.
- No accessibility conformance or security certification is claimed.

Each of these is a row above with its owner. The go/no-go decision should read those rows, not this paragraph.
