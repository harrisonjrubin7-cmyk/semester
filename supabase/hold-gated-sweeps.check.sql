-- The AI-runtime and Community sweeps behind a platform-wide legal hold: that
-- each runs when there is no hold, is skipped (and says so) while one is live,
-- runs again once it is released, and that a school hold does not pause them
-- (which is the stated limit, held here so it cannot drift into a claim). The
-- Community sweep writes a row to community_retention_runs every time it runs,
-- which is what makes "it ran" and "it did not run" observable without a
-- fixture for each table it deletes from. Every refusal is attempted as the
-- account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh hold-gated-sweeps

begin;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.error_as_role(r text, q text)
returns text language plpgsql as $$
begin
  execute 'set local role ' || r;
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

do $$
declare
  said jsonb; runs_before bigint; runs_after bigint; hold uuid; who uuid := gen_random_uuid();
  school_hold uuid;
begin
  insert into public.schools (id, name, email_domains) values ('gs-u', 'Gated Sweeps University', array['gs-u.example']);
  perform set_config('request.jwt.claims', '', true);

  -- ── no hold: both run ──────────────────────────────────────────────────
  select count(*) into runs_before from public.community_retention_runs;
  said := private.run_sweep('community_retention');
  select count(*) into runs_after from public.community_retention_runs;
  perform pg_temp.must('with no hold, the Community sweep runs and records that it ran',
    runs_after = runs_before + 1 and not said ? 'skipped');
  said := private.run_sweep('ai_runtime_metadata');
  perform pg_temp.must('with no hold, the AI sweep runs and reports what it removed',
    said ? 'removed' and not said ? 'skipped');

  -- ── a school hold does not pause them: the stated limit ────────────────
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('tenant', 'gs-u', 'gs-u', 'The school is under preservation.', 'MATTER-500', who) returning id into school_hold;
  select count(*) into runs_before from public.community_retention_runs;
  said := private.run_sweep('community_retention');
  select count(*) into runs_after from public.community_retention_runs;
  perform pg_temp.must('a school hold does not pause the Community sweep as a whole: it still runs and records that it ran (it skips only that school''s rows, proved in hold-aware-sweeps.check.sql)',
    runs_after = runs_before + 1 and not said ? 'skipped');

  -- ── a platform hold pauses both, visibly ───────────────────────────────
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('platform', '', null, 'Preserve everything.', 'MATTER-501', who) returning id into hold;
  select count(*) into runs_before from public.community_retention_runs;
  said := private.run_sweep('community_retention');
  select count(*) into runs_after from public.community_retention_runs;
  perform pg_temp.must('a platform hold skips the Community sweep: no run is recorded',
    runs_after = runs_before);
  perform pg_temp.must('and the result says it was skipped for a legal hold, and which sweep',
    said = jsonb_build_object('skipped', 'legal_hold', 'sweep', 'community_retention'));
  said := private.run_sweep('ai_runtime_metadata');
  perform pg_temp.must('and skips the AI sweep the same way',
    said = jsonb_build_object('skipped', 'legal_hold', 'sweep', 'ai_runtime_metadata'));

  -- ── released: they run again ───────────────────────────────────────────
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = hold;
  select count(*) into runs_before from public.community_retention_runs;
  said := private.run_sweep('community_retention');
  select count(*) into runs_after from public.community_retention_runs;
  perform pg_temp.must('once the platform hold is released the Community sweep runs again',
    runs_after = runs_before + 1 and not said ? 'skipped');
  perform pg_temp.must('and so does the AI sweep', private.run_sweep('ai_runtime_metadata') ? 'removed');

  -- ── the door ───────────────────────────────────────────────────────────
  begin
    perform private.run_sweep('sweep_stale_invites');
    raise exception 'FAILED: an unlisted sweep was run';
  exception when sqlstate '22023' then
    raise notice 'ok  a sweep that is not on the list is refused, not run';
  end;
  perform pg_temp.must('a signed-in account cannot run it',
    pg_temp.error_as_role('authenticated', $q$select private.run_sweep('community_retention')$q$) like '%permission denied%');
  perform pg_temp.must('nor can a signed-out visitor',
    pg_temp.error_as_role('anon', $q$select private.run_sweep('community_retention')$q$) like '%permission denied%');
end $$;

rollback;
