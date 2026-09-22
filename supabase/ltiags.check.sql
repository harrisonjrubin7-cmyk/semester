-- The table a grade finds its way back through, and the ways it refuses.
--
-- `public.lti_line_item` remembers, per launch, which Brightspace gradebook
-- column a course's link owns. It is written by the launch endpoint and read
-- by the score endpoint, both holding the service key, and by nothing else —
-- so as with `lti.check.sql` the assertions are blunt: no rows and no write,
-- for either API role.
--
-- What this covers:
--
--   * A signed-out visitor and a signed-in account reach nothing, for select,
--     insert, update or delete. A client that could read this would learn
--     which of its courses are graded in Brightspace; one that could write it
--     could point a score at any column it liked.
--   * `https` on both addresses is a check constraint, not a convention. These
--     are URLs this tool posts a signed token and then a grade to.
--   * A row cannot exist without the identity it belongs to, and goes when
--     that identity goes. The foreign key is to `lti_identity`, not to
--     `auth.users`, and the second half of that sentence is the reason: a
--     provisioned account retired in favour of the student's own takes the
--     memory of where its grade went with it.
--   * The most recent launch for a context wins. That is the documented
--     simplification in the migration, and it has to be watched doing it:
--     a suite that only ever inserted once would pass against a table with
--     no upsert path at all.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', who::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.make_user(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.refused(sql text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  execute sql into n;
  return coalesce(n, 0) = 0;
exception when insufficient_privilege or undefined_table or undefined_function then
  return true;
end $$;

-- A constraint refusing is a different exception from a privilege refusing,
-- and this file needs to tell them apart: the https rule must fail on the
-- *constraint*, as the owner, or it is the grant being tested twice.
create or replace function pg_temp.violates(sql text)
returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when check_violation or foreign_key_violation then
  return true;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- ── A row to refuse against ───────────────────────────────────────────────

do $$
declare who uuid;
begin
  who := pg_temp.make_user('graded.lti.test@example.edu');
  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-g', who, 'provisioned');
  insert into public.lti_line_item
    (issuer, subject, context_id, client_id, context_title, lineitem_url, scopes)
  values
    ('https://brightspace.test.edu', 'subject-g', 'ctx-1', 'client-1',
     'PSCI 2100 International Security',
     'https://brightspace.test.edu/d2l/api/lti/ags/lineitems/7', '{"https://purl.imsglobal.org/spec/lti-ags/scope/score"}');
end $$;

-- ── Nobody reaches it through the API ─────────────────────────────────────

do $$
declare who uuid;
begin
  perform pg_temp.become_anon();
  perform pg_temp.must('a signed-out visitor cannot read a line item',
    pg_temp.refused('select count(*) from public.lti_line_item'));
  perform pg_temp.must('a signed-out visitor cannot add one',
    pg_temp.refused($q$with w as (insert into public.lti_line_item
      (issuer, subject, context_id, client_id, lineitem_url)
      values ('https://brightspace.test.edu', 'subject-g', 'ctx-x', 'c', 'https://x.test/li')
      returning 1) select count(*) from w$q$));
  perform pg_temp.must('a signed-out visitor cannot move one',
    pg_temp.refused($q$with w as (update public.lti_line_item
      set lineitem_url = 'https://evil.test/li' returning 1) select count(*) from w$q$));
  perform pg_temp.must('a signed-out visitor cannot delete one',
    pg_temp.refused($q$with w as (delete from public.lti_line_item returning 1)
      select count(*) from w$q$));
  reset role;

  who := pg_temp.make_user('other.lti.test@example.edu');
  perform pg_temp.become(who);
  perform pg_temp.must('a signed-in account cannot read a line item',
    pg_temp.refused('select count(*) from public.lti_line_item'));
  perform pg_temp.must('a signed-in account cannot add one',
    pg_temp.refused($q$with w as (insert into public.lti_line_item
      (issuer, subject, context_id, client_id, lineitem_url)
      values ('https://brightspace.test.edu', 'subject-g', 'ctx-y', 'c', 'https://x.test/li')
      returning 1) select count(*) from w$q$));
  perform pg_temp.must('a signed-in account cannot move one',
    pg_temp.refused($q$with w as (update public.lti_line_item
      set lineitem_url = 'https://evil.test/li' returning 1) select count(*) from w$q$));
  perform pg_temp.must('a signed-in account cannot delete one',
    pg_temp.refused($q$with w as (delete from public.lti_line_item returning 1)
      select count(*) from w$q$));
  reset role;

  -- The control for every refusal above: the row is there for the owner.
  perform pg_temp.must('control: the row exists for the service role',
    (select count(*) from public.lti_line_item where context_id = 'ctx-1') = 1);
end $$;

-- ── The two addresses are https, by constraint ────────────────────────────

do $$
begin
  perform pg_temp.must('an http line item is refused by the table itself',
    pg_temp.violates($q$insert into public.lti_line_item
      (issuer, subject, context_id, client_id, lineitem_url)
      values ('https://brightspace.test.edu', 'subject-g', 'ctx-http', 'c', 'http://brightspace.test.edu/li')$q$));
  perform pg_temp.must('an http line items container is refused too',
    pg_temp.violates($q$insert into public.lti_line_item
      (issuer, subject, context_id, client_id, lineitem_url, lineitems_url)
      values ('https://brightspace.test.edu', 'subject-g', 'ctx-http2', 'c',
              'https://brightspace.test.edu/li', 'http://brightspace.test.edu/lis')$q$));
  perform pg_temp.must('and a null container is allowed, because a platform may send none',
    not pg_temp.violates($q$insert into public.lti_line_item
      (issuer, subject, context_id, client_id, lineitem_url, lineitems_url)
      values ('https://brightspace.test.edu', 'subject-g', 'ctx-null', 'c',
              'https://brightspace.test.edu/li', null)$q$));
end $$;

-- ── A row belongs to an identity, and goes with it ────────────────────────

do $$
declare who uuid;
begin
  perform pg_temp.must('a line item for an identity that does not exist is refused',
    pg_temp.violates($q$insert into public.lti_line_item
      (issuer, subject, context_id, client_id, lineitem_url)
      values ('https://brightspace.test.edu', 'nobody', 'ctx-z', 'c', 'https://x.test/li')$q$));

  who := pg_temp.make_user('leaving.lti.test@example.edu');
  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-leaving', who, 'linked');
  insert into public.lti_line_item (issuer, subject, context_id, client_id, lineitem_url)
  values ('https://brightspace.test.edu', 'subject-leaving', 'ctx-l', 'c', 'https://x.test/li');

  delete from public.lti_identity
   where issuer = 'https://brightspace.test.edu' and subject = 'subject-leaving';

  perform pg_temp.must('deleting the identity takes its line items with it',
    not exists (select 1 from public.lti_line_item where subject = 'subject-leaving'));

  /*
   * And the same through the account, which is the path a real deletion
   * takes: the account goes, the identity cascades, the line item cascades
   * off the identity. Two hops, and a test of one hop would pass with the
   * second missing.
   */
  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-leaving', who, 'linked');
  insert into public.lti_line_item (issuer, subject, context_id, client_id, lineitem_url)
  values ('https://brightspace.test.edu', 'subject-leaving', 'ctx-l', 'c', 'https://x.test/li');
  delete from auth.users where id = who;
  perform pg_temp.must('and deleting the account reaches it through the identity',
    not exists (select 1 from public.lti_line_item where subject = 'subject-leaving'));
end $$;

-- ── The most recent launch for a context wins ─────────────────────────────

do $$
begin
  insert into public.lti_line_item
    (issuer, subject, context_id, client_id, context_title, lineitem_url, resource_link_id)
  values
    ('https://brightspace.test.edu', 'subject-g', 'ctx-1', 'client-1',
     'PSCI 2100 International Security (renamed)',
     'https://brightspace.test.edu/d2l/api/lti/ags/lineitems/9', 'rl-9')
  on conflict (issuer, subject, context_id) do update
    set client_id        = excluded.client_id,
        context_title    = excluded.context_title,
        resource_link_id = excluded.resource_link_id,
        lineitem_url     = excluded.lineitem_url,
        lineitems_url    = excluded.lineitems_url,
        scopes           = excluded.scopes,
        seen_at          = now();

  perform pg_temp.must('a second launch into the same context replaces the column',
    (select lineitem_url from public.lti_line_item
      where subject = 'subject-g' and context_id = 'ctx-1')
      = 'https://brightspace.test.edu/d2l/api/lti/ags/lineitems/9');
  perform pg_temp.must('and there is still exactly one row for that context',
    (select count(*) from public.lti_line_item
      where subject = 'subject-g' and context_id = 'ctx-1') = 1);
end $$;

reset role;

rollback;
