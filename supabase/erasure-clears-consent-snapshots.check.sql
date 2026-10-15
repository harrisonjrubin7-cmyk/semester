-- Erasing an account must not leave its consent history behind in a copy.
--
-- `audit_consent_record` (20260923210000_intelligence_policy.sql) fires on
-- every insert, update and delete of `public.consent_record` and writes the
-- whole row, as `to_jsonb(old)` and `to_jsonb(new)`, into
-- `public.tenant_policy_audit_event.old_data` / `.new_data`. That row carries
-- `subject_user_id` and `recorded_by`: who consented to what, and when.
--
-- `erase_account` finds what to remove from `private.account_data_map()`,
-- which is read off the catalog and sees **foreign-key columns only**. A UUID
-- inside a JSON document is not a foreign key. So the question this file asks
-- is whether the copy survives the erasure it was copied from. The table is
-- kept until the school is removed (RETENTION.md), so if it does, a person who
-- was erased still has a dated record of their consent in a school's audit.
--
-- This was found by reading the SQL, not by running it. Two things hold it to
-- account.
--
--   * It looks for the account's id as text anywhere in either JSON column,
--     not for a particular key. A copy that moved to another key, or into a
--     nested object, is still found.
--   * It has two controls. Before the erasure the copies must exist (a probe
--     that finds nothing in an empty table proves nothing), and after it the
--     *other* person's copies must still be there (an erasure that wipes the
--     table passes the property and breaks the audit it is meant to keep).
--
-- It failed ("expected 0, got 4") until `public.erase_account` was made to scrub
-- the id after the erasure (20261004190000, D-1198). Whether a school's audit
-- may lawfully keep such a copy is not this file's question, and is queued for
-- counsel (docs/privacy-operations/07-COUNSEL-REVIEW-QUEUE.md, P-08). What this
-- file establishes is only what the code does.
--
-- LOCAL/DISPOSABLE DATABASES ONLY. Inserts synthetic users, then rolls
-- everything back. Run through `supabase/check.sh
-- erasure-clears-consent-snapshots`.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- How many audit rows still carry this account's id, in either snapshot.
create or replace function pg_temp.copies(who uuid)
returns bigint language sql as $$
  select count(*) from public.tenant_policy_audit_event e
   where coalesce(e.old_data::text, '') like '%' || who::text || '%'
      or coalesce(e.new_data::text, '') like '%' || who::text || '%';
$$;

do $$
declare
  leaver uuid := 'eeeeeeee-0000-0000-0000-00000000c501';
  keeper uuid := 'ffffffff-0000-0000-0000-00000000c502';
  said   jsonb;
begin
  insert into public.schools (id, name, email_domains, edition) values
    ('consent-snap-check', 'Consent Snapshot Check College', array['consent-snap-check.example'], 'higher_ed');

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (leaver, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'leaver@consent-snap-check.example', now(), now(), now()),
    (keeper, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'keeper@consent-snap-check.example', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values
    (leaver, 'snapshot leaver', 'consent-snap-check'),
    (keeper, 'snapshot keeper', 'consent-snap-check');

  -- Each gives a consent and then withdraws it: an insert and an update, so
  -- there are copies in `new_data` and in `old_data`.
  perform pg_temp.become(leaver);
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by)
  values ('consent-snap-check', leaver, 'lecture_capture', 'consented', '1', leaver);
  update public.consent_record
     set status = 'revoked', revoked_at = now()
   where subject_user_id = leaver and capability = 'lecture_capture';
  reset role;

  perform pg_temp.become(keeper);
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by)
  values ('consent-snap-check', keeper, 'lecture_capture', 'consented', '1', keeper);
  update public.consent_record
     set status = 'revoked', revoked_at = now()
   where subject_user_id = keeper and capability = 'lecture_capture';
  reset role;

  -- Control, before: the copies exist, for both people.
  perform pg_temp.counted('control: the leaver''s consent was copied into the audit before erasure',
    (pg_temp.copies(leaver) >= 2)::int, 1);
  perform pg_temp.counted('control: the keeper''s consent was copied into the audit before erasure',
    (pg_temp.copies(keeper) >= 2)::int, 1);

  -- Erase the leaver, as the Edge Function does: service role, one transaction.
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  -- Supabase grants the service role this; the stub does not.
  grant usage on schema public to service_role;
  execute 'set local role service_role';
  said := public.erase_account(leaver);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.counted('the erasure ran and gave a receipt', (said ->> 'receipt' is not null)::int, 1);
  perform pg_temp.counted('the leaver''s consent rows are gone',
    (select count(*) from public.consent_record where subject_user_id = leaver), 0);

  -- The property.
  perform pg_temp.counted('no audit snapshot still carries the erased account''s id',
    pg_temp.copies(leaver), 0);

  -- Control, after: erasing one person did not scrub the other's audit.
  perform pg_temp.counted('control: the keeper''s audit copies are untouched',
    (pg_temp.copies(keeper) >= 2)::int, 1);
end $$;

rollback;
