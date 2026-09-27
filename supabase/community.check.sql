-- Community: every permission in 20260927170000_community.sql walked as the
-- account it is about, and every refusal attempted as the account that should
-- be refused. LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always
-- rolled back.
--
--   supabase/check.sh community

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  -- A statement that ran but touched no row was refused by RLS.
  return n = 0;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was allowed', what;
  end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was refused', what;
  end if;
  raise notice 'ok  % is allowed', what;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

do $$
declare
  alice uuid; bob uuid; carol uuid; dave uuid; frank uuid; eve uuid;
  rev1 uuid; rev2 uuid; senior uuid; mgr uuid; admin uuid; oldmod uuid;
  grp uuid; sup uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid; bp uuid; k uuid;
  venue uuid; far_venue uuid; sess uuid; n bigint; t text; t2 text;
begin
  insert into public.schools (id, name, email_domains) values
    ('com-u', 'Community University', array['com-u.example']),
    ('com-other', 'Other University', array['com-other.example']);

  alice  := pg_temp.newuser('alice@com-u.example', 'com-u');
  bob    := pg_temp.newuser('bob@com-u.example', 'com-u');
  carol  := pg_temp.newuser('carol@com-u.example', 'com-u');
  dave   := pg_temp.newuser('dave@com-u.example', 'com-u');
  frank  := pg_temp.newuser('frank@com-u.example', 'com-u');
  eve    := pg_temp.newuser('eve@com-other.example', 'com-other');
  mgr    := pg_temp.newuser('mgr@com-u.example', 'com-u');
  rev1   := pg_temp.newuser('rev1@semester.example', null);
  rev2   := pg_temp.newuser('rev2@semester.example', null);
  senior := pg_temp.newuser('senior@semester.example', null);
  admin  := pg_temp.newuser('admin@semester.example', null);
  oldmod := pg_temp.newuser('oldmod@semester.example', null);

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (rev1,   'trust_safety_reviewer', 'platform', '',      'platform'),
    (rev2,   'trust_safety_reviewer', 'platform', '',      'platform'),
    (senior, 'trust_safety_senior',   'platform', '',      'platform'),
    (admin,  'platform_admin',        'platform', '',      'platform'),
    (oldmod, 'moderator',             'platform', '',      'platform'),
    (mgr,    'community_manager',     'school',   'com-u', 'institution');

  -- ── Creating and joining ───────────────────────────────────────────────
  perform pg_temp.expect_allowed('a verified student starts a study group', alice,
    $q$select public.create_community('study_group', 'ECON 1010 study group', 'Problem sets', '')$q$);
  perform pg_temp.expect_refused('a student starts a course community', alice,
    $q$select public.create_community('course', 'ECON 1010', 'Official', '')$q$);
  perform pg_temp.expect_allowed('a community manager starts a support community', mgr,
    $q$select public.create_community('support', 'First-generation students', 'Support', '')$q$);
  select id into grp from public.communities where name = 'ECON 1010 study group';
  select id into sup from public.communities where name = 'First-generation students';
  select verification into t from public.communities where id = sup;
  perform pg_temp.said('a managed community is institution verified', t, 'institution_verified');
  select verification into t from public.communities where id = grp;
  perform pg_temp.said('a student one is student-created', t, 'student_created');

  perform pg_temp.counted('another school''s student sees none of these communities',
    pg_temp.seen(eve, 'select id from public.communities'), 0);
  perform pg_temp.expect_refused('and cannot join one', eve,
    format('select public.join_community(%L)', grp));
  perform pg_temp.expect_refused('nobody reads the ref salt', bob,
    'select ref_salt from public.communities');
  perform pg_temp.expect_refused('nobody inserts a membership directly', bob,
    format($q$insert into public.community_members (community_id, user_id, role) values (%L, %L, 'owner')$q$, grp, bob));

  perform pg_temp.expect_allowed('bob joins', bob, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('carol joins', carol, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('dave joins', dave, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('frank joins', frank, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('alice joins the support community', alice, format('select public.join_community(%L)', sup));
  perform pg_temp.counted('a member sees only their own membership, never the roster',
    pg_temp.seen(bob, 'select community_id from public.community_members'), 1);
  perform pg_temp.counted('the manager who made the support community sees only their own row in it',
    pg_temp.seen(mgr, format('select 1 from public.community_members where community_id = %L', sup)), 1);

  -- ── Posting ────────────────────────────────────────────────────────────
  perform pg_temp.expect_refused('a post with a phone number and no confirmation', alice,
    format($q$select public.create_community_post(%L, 'Text me at 615-555-0142', false)$q$, grp));
  perform pg_temp.expect_allowed('the same post once the author confirms it is theirs', alice,
    format($q$select public.create_community_post(%L, 'Text me at 615-555-0142', true)$q$, grp));
  perform pg_temp.expect_allowed('alice posts', alice, format($q$select public.create_community_post(%L, 'Post one')$q$, grp));
  perform pg_temp.expect_allowed('alice posts again', alice, format($q$select public.create_community_post(%L, 'Post two')$q$, grp));
  perform pg_temp.expect_allowed('and a third', alice, format($q$select public.create_community_post(%L, 'Post three')$q$, grp));
  perform pg_temp.expect_allowed('and a fourth', alice, format($q$select public.create_community_post(%L, 'Post four')$q$, grp));
  perform pg_temp.expect_allowed('alice posts in the support community', alice,
    format($q$select public.create_community_post(%L, 'Support post')$q$, sup));
  perform pg_temp.expect_refused('eve cannot post where she is not a member', eve,
    format($q$select public.create_community_post(%L, 'Hello')$q$, grp));
  select id into p1 from public.community_posts where body = 'Post one';
  select id into p2 from public.community_posts where body = 'Post two';
  select id into p3 from public.community_posts where body = 'Post three';
  select id into p4 from public.community_posts where body = 'Post four';

  perform pg_temp.counted('a member reads the posts', pg_temp.seen(bob,
    format('select id from public.community_posts where community_id = %L', grp)), 5);
  perform pg_temp.counted('a non-member reads none', pg_temp.seen(eve,
    'select id from public.community_posts'), 0);
  perform pg_temp.expect_refused('nobody reads a post''s author_id', bob, 'select author_id from public.community_posts');
  perform pg_temp.expect_refused('not even a reviewer', rev1, 'select author_id from public.community_posts');
  perform pg_temp.expect_refused('nobody writes a post directly', alice,
    format($q$insert into public.community_posts (community_id, tenant_id, author_id, author_ref, author_name, body) values (%L, 'com-u', %L, 'x', 'x', 'x')$q$, grp, alice));

  select author_ref into t from public.community_posts where id = p1;
  select author_ref into t2 from public.community_posts where body = 'Support post';
  if t = t2 then raise exception 'FAILED: one author has the same ref in two communities'; end if;
  raise notice 'ok  one author has a different ref in each community';

  perform pg_temp.counted('alice''s own ref marks exactly her posts', pg_temp.seen(alice,
    format($q$select p.id from public.community_posts p join public.my_community_refs() r
               on r.community_id = p.community_id and r.author_ref = p.author_ref
              where p.community_id = %L$q$, grp)), 5);
  perform pg_temp.counted('and bob''s marks none of hers', pg_temp.seen(bob,
    format($q$select p.id from public.community_posts p join public.my_community_refs() r
               on r.community_id = p.community_id and r.author_ref = p.author_ref
              where p.community_id = %L$q$, grp)), 0);

  -- ── Blocking ───────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('frank posts', frank, format($q$select public.create_community_post(%L, 'Frank here')$q$, grp));
  select id into bp from public.community_posts where body = 'Frank here';
  perform pg_temp.expect_allowed('alice blocks frank through his post', alice, format('select public.block_community_author(%L)', bp));
  perform pg_temp.counted('alice no longer sees frank''s posts', pg_temp.seen(alice,
    format('select id from public.community_posts where id = %L', bp)), 0);
  perform pg_temp.counted('and frank no longer sees alice''s', pg_temp.seen(frank,
    format('select id from public.community_posts where id = %L', p1)), 0);

  -- ── Reporting and triage ───────────────────────────────────────────────
  perform pg_temp.expect_refused('an author reports their own post', alice,
    format($q$select public.report_community_post(%L, 'other')$q$, p1));
  perform pg_temp.expect_allowed('carol reports post one', carol,
    format($q$select public.report_community_post(%L, 'other', false, 'off topic')$q$, p1));
  perform pg_temp.expect_refused('carol cannot report it twice', carol,
    format($q$select public.report_community_post(%L, 'other')$q$, p1));
  select status into t from public.community_posts where id = p1;
  perform pg_temp.said('one ordinary report only queues: the post stays up', t, 'published');
  select severity || '/' || protection || '/' || route into t from public.community_cases where post_id = p1;
  perform pg_temp.said('and opens a P3 case in the standard queue', t, 'P3/queue/standard');

  perform pg_temp.counted('a reviewer sees the case', pg_temp.seen(rev1, 'select id from public.community_cases'), 1);
  perform pg_temp.counted('a student does not', pg_temp.seen(bob, 'select id from public.community_cases'), 0);
  perform pg_temp.counted('a platform admin does not', pg_temp.seen(admin, 'select id from public.community_cases'), 0);
  perform pg_temp.counted('the old message moderator does not', pg_temp.seen(oldmod, 'select id from public.community_cases'), 0);
  perform pg_temp.expect_refused('a reviewer cannot read who reported', rev1, 'select reporter_id from public.community_reports');
  perform pg_temp.counted('a reviewer reads the report itself', pg_temp.seen(rev1, 'select id, category from public.community_reports'), 1);
  perform pg_temp.counted('the reporter sees their own report', pg_temp.seen(carol, 'select id from public.community_reports'), 1);
  perform pg_temp.counted('the author does not see it', pg_temp.seen(alice, 'select id from public.community_reports'), 0);

  -- Three distinct reporters inside an hour reduce distribution.
  perform pg_temp.expect_allowed('carol reports post two', carol, format($q$select public.report_community_post(%L, 'spam_scam_or_phishing')$q$, p2));
  select protection into t from public.community_cases where post_id = p2;
  perform pg_temp.said('one reporter: queue', t, 'queue');
  perform pg_temp.expect_allowed('dave reports post two', dave, format($q$select public.report_community_post(%L, 'spam_scam_or_phishing')$q$, p2));
  select protection into t from public.community_cases where post_id = p2;
  perform pg_temp.said('two reporters: monitor', t, 'monitor');
  perform pg_temp.expect_allowed('bob reports post two', bob, format($q$select public.report_community_post(%L, 'spam_scam_or_phishing')$q$, p2));
  select status into t from public.community_posts where id = p2;
  perform pg_temp.said('three reporters in an hour: reduced, not removed', t, 'reduced');

  -- One high-risk report holds.
  perform pg_temp.expect_allowed('carol reports post three as doxxing', carol,
    format($q$select public.report_community_post(%L, 'private_information_or_doxxing')$q$, p3));
  select status into t from public.community_posts where id = p3;
  perform pg_temp.said('a doxxing report holds the post', t, 'held');
  select severity || '/' || route into t from public.community_cases where post_id = p3;
  perform pg_temp.said('as P0, routed urgently to professionals', t, 'P0/professional_urgent');
  perform pg_temp.counted('members no longer see the held post', pg_temp.seen(bob,
    format('select id from public.community_posts where id = %L', p3)), 0);
  perform pg_temp.counted('its author still does', pg_temp.seen(alice,
    format('select id from public.community_posts where id = %L', p3)), 1);

  -- ── Standing ───────────────────────────────────────────────────────────
  perform pg_temp.become(bob);
  select public.community_reviewer_standing() into t; reset role;
  perform pg_temp.said('a student is not a reviewer', t, 'none');
  perform pg_temp.become(admin);
  select public.community_reviewer_standing() into t; reset role;
  perform pg_temp.said('neither is a platform admin', t, 'none');
  perform pg_temp.become(rev1);
  select public.community_reviewer_standing() into t; reset role;
  perform pg_temp.said('a reviewer is', t, 'reviewer');
  perform pg_temp.become(senior);
  select public.community_reviewer_standing() into t; reset role;
  perform pg_temp.said('and a senior reviewer is senior', t, 'senior');

  -- ── Decisions ──────────────────────────────────────────────────────────
  select id into k from public.community_cases where post_id = p3;
  perform pg_temp.expect_refused('a student decides a case', bob,
    format($q$select public.decide_community_case(%L, 'remove', 'dox')$q$, k));
  perform pg_temp.expect_refused('a platform admin decides a case', admin,
    format($q$select public.decide_community_case(%L, 'remove', 'dox')$q$, k));
  perform pg_temp.expect_refused('a reviewer restricts an account on a P0', rev1,
    format($q$select public.decide_community_case(%L, 'account_restriction', 'dox')$q$, k));
  perform pg_temp.expect_allowed('a reviewer removes the post', rev1,
    format($q$select public.decide_community_case(%L, 'remove', 'privacy.dox')$q$, k));
  select status into t from public.community_posts where id = p3;
  perform pg_temp.said('the post is removed', t, 'removed');

  select count(*) into n from public.community_case_events where case_id = k;
  perform pg_temp.counted('the case history has an open, a hold and a decision', n, 3);
  select count(*) into n from public.community_case_events
   where case_id = k and actor_sha256 is not null and actor_sha256 = private.role_audit_sha256(rev1::text);
  perform pg_temp.counted('the decision is attributed by hash', n, 1);
  perform pg_temp.expect_refused('a reviewer rewrites history', rev1,
    format($q$update public.community_case_events set reason_code = 'x' where case_id = %L$q$, k));
  perform pg_temp.expect_refused('or deletes it', rev1,
    format($q$delete from public.community_case_events where case_id = %L$q$, k));

  select count(*) into n from public.community_decisions d where d.case_id = k;
  perform pg_temp.counted('one decision recorded', n, 1);
  perform pg_temp.expect_refused('nobody reads who decided through the API', rev1,
    'select actor_id from public.community_decisions');

  -- ── Notices and appeals ────────────────────────────────────────────────
  perform pg_temp.counted('the author is told, and can appeal', pg_temp.seen(alice,
    'select 1 from public.my_community_notices() where appealable'), 1);
  perform pg_temp.expect_refused('somebody else appeals alice''s decision', bob,
    format('select public.appeal_community_decision(%L)', p3));
  perform pg_temp.expect_allowed('alice appeals', alice, format('select public.appeal_community_decision(%L)', p3));
  perform pg_temp.expect_refused('the reviewer who decided cannot decide the appeal', rev1,
    format($q$select public.decide_community_appeal(%L, false, 'context')$q$, k));
  perform pg_temp.expect_refused('a student cannot decide it', bob,
    format($q$select public.decide_community_appeal(%L, false, 'context')$q$, k));
  perform pg_temp.expect_allowed('an independent reviewer grants it', rev2,
    format($q$select public.decide_community_appeal(%L, false, 'context.own_details')$q$, k));
  select p.status || '/' || c.status into t
    from public.community_posts p join public.community_cases c on c.post_id = p.id where p.id = p3;
  perform pg_temp.said('the post is restored and the case closed', t, 'published/closed');
  perform pg_temp.counted('the notice says the appeal was granted', pg_temp.seen(alice,
    $q$select 1 from public.my_community_notices() where appeal_status = 'granted'$q$), 1);

  -- ── Restrictions ───────────────────────────────────────────────────────
  select id into k from public.community_cases where post_id = p2;
  perform pg_temp.expect_allowed('a reviewer restricts alice in the study group', rev1,
    format($q$select public.decide_community_case(%L, 'community_restriction', 'spam.repeat')$q$, k));
  perform pg_temp.expect_refused('alice cannot post in the study group', alice,
    format($q$select public.create_community_post(%L, 'Still here')$q$, grp));
  perform pg_temp.expect_allowed('but can in the support community', alice,
    format($q$select public.create_community_post(%L, 'Support again')$q$, sup));
  perform pg_temp.counted('alice sees her own restriction', pg_temp.seen(alice,
    'select id from public.community_restrictions'), 1);
  perform pg_temp.counted('bob does not', pg_temp.seen(bob, 'select id from public.community_restrictions'), 0);

  -- ── Withdrawing ────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('carol reports post four', carol,
    format($q$select public.report_community_post(%L, 'other')$q$, p4));
  perform pg_temp.expect_allowed('alice deletes post four while it is under review', alice,
    format('select public.delete_community_post(%L)', p4));
  select status into t from public.community_posts where id = p4;
  perform pg_temp.said('a post under review is withdrawn, not destroyed', t, 'withdrawn');
  perform pg_temp.counted('and nobody but a reviewer sees it', pg_temp.seen(alice,
    format('select id from public.community_posts where id = %L', p4)), 0);
  perform pg_temp.expect_allowed('alice deletes post one''s sibling with no case', alice,
    format($q$select public.delete_community_post(id) from public.community_posts where body = 'Text me at 615-555-0142'$q$));
  select count(*) into n from public.community_posts where body = 'Text me at 615-555-0142';
  perform pg_temp.counted('a post with no case is deleted outright', n, 0);

  -- ── Venues and study sessions ──────────────────────────────────────────
  perform pg_temp.expect_refused('a student adds a venue', alice,
    $q$insert into public.community_venues (tenant_id, name, kind) values ('com-u', 'My dorm', 'library')$q$);
  perform pg_temp.expect_allowed('a community manager adds one', mgr,
    $q$insert into public.community_venues (tenant_id, name, kind) values ('com-u', 'Central Library', 'library')$q$);
  insert into public.community_venues (tenant_id, name, kind) values ('com-other', 'Far library', 'library')
    returning id into far_venue;
  select id into venue from public.community_venues where name = 'Central Library';

  perform pg_temp.expect_refused('a session at another school''s venue', bob,
    format($q$select public.create_study_session(%L, %L, 'Review', now() + interval '1 day', now() + interval '25 hours', 2)$q$, grp, far_venue));
  perform pg_temp.expect_refused('a session over twelve places', bob,
    format($q$select public.create_study_session(%L, %L, 'Review', now() + interval '1 day', now() + interval '25 hours', 20)$q$, grp, venue));
  perform pg_temp.expect_allowed('bob hosts a two-place session', bob,
    format($q$select public.create_study_session(%L, %L, 'Review', now() + interval '1 day', now() + interval '25 hours', 2)$q$, grp, venue));
  select id into sess from public.community_sessions where title = 'Review';
  perform pg_temp.expect_refused('eve cannot join', eve, format('select public.join_study_session(%L)', sess));
  perform pg_temp.expect_allowed('carol joins', carol, format('select public.join_study_session(%L)', sess));
  perform pg_temp.expect_refused('dave finds it full', dave, format('select public.join_study_session(%L)', sess));
  perform pg_temp.counted('members see places taken, not who took them', pg_temp.seen(dave,
    format('select 1 from public.community_session_counts(%L) where taken = 2', grp)), 1);
  perform pg_temp.counted('dave sees no participant rows but his own', pg_temp.seen(dave,
    'select session_id from public.community_session_participants'), 0);
  perform pg_temp.expect_refused('nobody reads a session host', dave, 'select host_id from public.community_sessions');
  perform pg_temp.expect_allowed('carol leaves', carol,
    format('delete from public.community_session_participants where session_id = %L', sess));

  -- A block keeps two people out of the same session, and says nothing about why.
  perform pg_temp.expect_allowed('frank hosts', frank,
    format($q$select public.create_study_session(%L, %L, 'Frank review', now() + interval '2 days', now() + interval '49 hours', 4)$q$, grp, venue));
  select id into sess from public.community_sessions where title = 'Frank review';
  perform pg_temp.expect_refused('alice, who blocked frank, cannot join his session', alice,
    format('select public.join_study_session(%L)', sess));

  -- ── Mutes ──────────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('bob mutes an author', bob,
    format($q$insert into public.community_mutes (user_id, community_id, author_ref) values (%L, %L, 'abcdef')$q$, bob, grp));
  perform pg_temp.counted('carol cannot see bob''s mutes', pg_temp.seen(carol, 'select 1 from public.community_mutes'), 0);
  perform pg_temp.expect_refused('carol cannot mute on bob''s behalf', carol,
    format($q$insert into public.community_mutes (user_id, community_id, author_ref) values (%L, %L, 'zzzzzz')$q$, bob, grp));

  -- ── Deleting an account ────────────────────────────────────────────────
  -- Alice has posts with cases (p1, p2, p3, p4) and without (the support posts).
  perform pg_temp.expect_allowed('alice forgets her Community data', alice, 'select public.forget_my_community()');
  select count(*) into n from public.community_posts where author_id = alice and status <> 'withdrawn';
  perform pg_temp.counted('none of her posts remain visible', n, 0);
  select count(*) into n from public.community_posts where author_id = alice and status = 'withdrawn' and author_name = 'Deleted account';
  perform pg_temp.counted('the four under a case stay as evidence, anonymised', n, 4);
  select count(*) into n from public.community_members where user_id = alice;
  perform pg_temp.counted('her memberships are gone', n, 0);
  select count(*) into n from public.community_members where user_id = bob;
  perform pg_temp.counted('bob''s are untouched', n, 1);
  select count(*) into n from public.community_cases where post_id in (p1, p2, p3, p4);
  perform pg_temp.counted('and the cases survive', n, 4);

  -- ── Leaving ────────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('dave leaves the group', dave,
    format('delete from public.community_members where community_id = %L', grp));
  perform pg_temp.counted('and no longer reads its posts', pg_temp.seen(dave,
    format('select id from public.community_posts where community_id = %L', grp)), 0);
end $$;

rollback;
