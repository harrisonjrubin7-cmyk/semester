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
  g1 uuid; g2 uuid; g3 uuid; q uuid; c2 uuid; c3 uuid; c4 uuid; kk uuid; oldk uuid; j jsonb; i int;
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
  -- These are members of long standing in communities that have existed for a
  -- term; the brigading checks below add new joiners of their own.
  update public.communities set created_at = now() - interval '60 days' where id in (grp, sup);
  update public.community_members set joined_at = now() - interval '30 days' where community_id in (grp, sup);
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

  -- ── Detectors ──────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('dave posts ordinary study talk', dave,
    format($q$select public.create_community_post(%L, 'Problem 3 on page 214 is hard, anyone free tonight?')$q$, grp));
  select id into q from public.community_posts where body like 'Problem 3 on page 214%';
  select count(*) into n from public.community_cases where post_id = q;
  perform pg_temp.counted('ordinary study talk opens no case (the control)', n, 0);

  perform pg_temp.expect_allowed('bob posts somebody else''s address', bob,
    format($q$select public.create_community_post(%L, 'Her room number is 214 in Branscomb')$q$, grp));
  select id into q from public.community_posts where body like 'Her room number is 214%';
  select status into t from public.community_posts where id = q;
  perform pg_temp.said('a high-confidence doxxing hit holds the post', t, 'held');
  select severity || '/' || route || '/' || protection into t from public.community_cases where post_id = q;
  perform pg_temp.said('as a P0 routed urgently', t, 'P0/professional_urgent/temporary_hold');
  select rule_id || '/' || confidence || '/' || version into t from public.community_signals where post_id = q;
  perform pg_temp.said('and records which rule, how sure and which version', t,
    'pii.third-party-contact/0.95/community-detectors-2026.09.1');

  perform pg_temp.expect_allowed('bob posts a threat', bob,
    format($q$select public.create_community_post(%L, 'I''m going to hurt somebody after the lecture')$q$, grp));
  select id into q from public.community_posts where body like 'I''m going to hurt%';
  select p.status || '/' || c.severity || '/' || c.route || '/' || c.protection into t
    from public.community_posts p join public.community_cases c on c.post_id = p.id where p.id = q;
  perform pg_temp.said('threat language routes to a professional and holds nothing', t,
    'published/P1/professional/queue');

  perform pg_temp.expect_allowed('bob posts about wanting to die', bob,
    format($q$select public.create_community_post(%L, 'Honestly I want to die this week, nothing is working')$q$, grp));
  select id into q from public.community_posts where body like 'Honestly I want to die%';
  select p.status || '/' || c.severity || '/' || c.route into t
    from public.community_posts p join public.community_cases c on c.post_id = p.id where p.id = q;
  perform pg_temp.said('crisis language reaches a professional and is never silenced', t, 'published/P1/professional');

  perform pg_temp.expect_allowed('bob asks for an answer key', bob,
    format($q$select public.create_community_post(%L, 'Does anyone have the answer key for the midterm?')$q$, grp));
  select c.id into kk from public.community_cases c join public.community_posts p on p.id = c.post_id
   where p.body like 'Does anyone have the answer key%';
  select severity || '/' || route || '/' || protection into t from public.community_cases where id = kk;
  perform pg_temp.said('an academic-integrity hit is a standard P2 in the queue', t, 'P2/standard/queue');

  perform pg_temp.expect_allowed('bob posts two kinds of trouble at once', bob,
    format($q$select public.create_community_post(%L, 'You should die. Go back to your country.')$q$, grp));
  select c.protection || '/' || c.severity into t from public.community_cases c join public.community_posts p on p.id = c.post_id
   where p.body = 'You should die. Go back to your country.';
  perform pg_temp.said('two different detectors put the case under monitoring', t, 'monitor/P1');

  perform pg_temp.expect_allowed('dave edits his post to add somebody''s schedule', dave,
    format($q$select public.edit_community_post(id, 'His schedule is on the board outside 214') from public.community_posts where body like 'Problem 3 on page 214%%'$q$));
  select status into t from public.community_posts where body = 'His schedule is on the board outside 214';
  perform pg_temp.said('an edit is read again, and held', t, 'held');

  -- Impersonation is only a question for unverified posts.
  perform pg_temp.expect_allowed('frank claims to be the registrar', frank,
    format($q$select public.create_community_post(%L, 'This is the registrar: drop deadlines moved')$q$, grp));
  select c.category into t from public.community_cases c join public.community_posts p on p.id = c.post_id
   where p.body like 'This is the registrar%';
  perform pg_temp.said('a student claiming an office is an impersonation signal', t, 'impersonation');

  -- A burst of posting from one account, anywhere, is a bot/rate signal.
  for i in 1..7 loop
    insert into public.community_posts (community_id, tenant_id, author_id, author_ref, author_name, body)
    values (grp, 'com-u', frank, 'x', 'frank', 'burst ' || i);
  end loop;
  perform pg_temp.expect_allowed('frank posts an eighth time in ten minutes', frank,
    format($q$select public.create_community_post(%L, 'one more')$q$, grp));
  select count(*) into n from public.community_signals s join public.community_posts p on p.id = s.post_id
   where p.body = 'one more' and s.rule_id = 'bot_rate.burst';
  perform pg_temp.counted('a burst is recorded as a bot/rate signal', n, 1);

  -- Who reads and tunes the rules.
  perform pg_temp.counted('a student reads no rules', pg_temp.seen(bob, 'select id from public.community_detector_rules'), 0);
  perform pg_temp.counted('a student reads no signals', pg_temp.seen(bob, 'select id from public.community_signals'), 0);
  perform pg_temp.counted('a reviewer reads all fifteen rules', pg_temp.seen(rev1, 'select id from public.community_detector_rules'), 15);
  perform pg_temp.expect_refused('a reviewer cannot switch a rule off', rev1,
    $q$update public.community_detector_rules set enabled = false where id = 'integrity.answers'$q$);
  perform pg_temp.expect_refused('a senior reviewer cannot rewrite a pattern', senior,
    $q$update public.community_detector_rules set pattern = 'x{3}' where id = 'integrity.answers'$q$);
  perform pg_temp.expect_allowed('a senior reviewer can switch a rule off', senior,
    $q$update public.community_detector_rules set enabled = false where id = 'integrity.answers'$q$);
  select count(*) into n from public.community_detector_rules
   where id = 'integrity.answers' and not enabled and updated_by_sha256 = private.role_audit_sha256(senior::text);
  perform pg_temp.counted('and the change is attributed by hash', n, 1);
  perform pg_temp.expect_allowed('bob asks for answers again', bob,
    format($q$select public.create_community_post(%L, 'Still looking for the answer key for the midterm')$q$, grp));
  select count(*) into n from public.community_cases c join public.community_posts p on p.id = c.post_id
   where p.body like 'Still looking for the answer key%';
  perform pg_temp.counted('a switched-off rule does not fire', n, 0);

  -- A person's decision reaches every signal on the case, and sets how long it is kept.
  perform pg_temp.expect_allowed('a reviewer allows the answer-key post', rev1,
    format($q$select public.decide_community_case(%L, 'allow', 'integrity.study_question')$q$, kk));
  select human_outcome into t from public.community_signals where case_id = kk;
  perform pg_temp.said('the signal learns the human outcome', t, 'allow');
  select count(*) into n from public.community_cases
   where id = kk and retain_until between now() + interval '89 days' and now() + interval '91 days';
  perform pg_temp.counted('a case closed with nothing wrong is kept ninety days', n, 1);

  -- ── Brigading ──────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('carol posts', carol, format($q$select public.create_community_post(%L, 'Carol on elasticity')$q$, grp));
  select id into q from public.community_posts where body = 'Carol on elasticity';
  g1 := pg_temp.newuser('g1@com-u.example', 'com-u');
  g2 := pg_temp.newuser('g2@com-u.example', 'com-u');
  g3 := pg_temp.newuser('g3@com-u.example', 'com-u');
  perform pg_temp.expect_allowed('three new accounts join', g1, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('and a second', g2, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('and a third', g3, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('the first new account reports carol', g1, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, q));
  perform pg_temp.expect_allowed('the second', g2, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, q));
  perform pg_temp.expect_allowed('the third', g3, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, q));
  select status into t from public.community_posts where id = q;
  perform pg_temp.said('three new joiners reporting together do not reduce the post', t, 'published');
  select count(*) into n from public.community_reports where post_id = q and set_aside;
  perform pg_temp.counted('their reports are set aside, not discarded', n, 3);
  select route into t from public.community_cases where post_id = q;
  perform pg_temp.said('and the case goes to integrity review', t, 'integrity_review');
  select count(*) into n from public.community_signals where post_id = q and rule_id = 'brigade.fresh-joiners';
  perform pg_temp.counted('with a brigading signal a reviewer can see', n, 1);
  perform pg_temp.expect_refused('a reporter cannot see that their report was set aside', g1,
    'select set_aside from public.community_reports');
  perform pg_temp.expect_allowed('bob, a long-standing member, reports it', bob, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, q));
  perform pg_temp.expect_allowed('frank reports it', frank, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, q));
  select status into t from public.community_posts where id = q;
  perform pg_temp.said('two genuine reporters are not topped up by the brigade', t, 'published');

  perform pg_temp.expect_allowed('carol posts again', carol, format($q$select public.create_community_post(%L, 'Carol on tariffs')$q$, grp));
  select id into q from public.community_posts where body = 'Carol on tariffs';
  perform pg_temp.expect_allowed('new account one reports doxxing', g1, format($q$select public.report_community_post(%L, 'other')$q$, q));
  perform pg_temp.expect_allowed('new account two', g2, format($q$select public.report_community_post(%L, 'other')$q$, q));
  perform pg_temp.expect_allowed('new account three reports it as doxxing', g3,
    format($q$select public.report_community_post(%L, 'private_information_or_doxxing')$q$, q));
  select status into t from public.community_posts where id = q;
  perform pg_temp.said('a set-aside doxxing report still holds, for the person it is about', t, 'held');

  -- A reporter whose reports on one author keep being closed with no action.
  perform pg_temp.expect_allowed('carol posts c2', carol, format($q$select public.create_community_post(%L, 'c2 supply')$q$, grp));
  perform pg_temp.expect_allowed('carol posts c3', carol, format($q$select public.create_community_post(%L, 'c3 demand')$q$, grp));
  perform pg_temp.expect_allowed('carol posts c4', carol, format($q$select public.create_community_post(%L, 'c4 equilibrium')$q$, grp));
  select id into c2 from public.community_posts where body = 'c2 supply';
  select id into c3 from public.community_posts where body = 'c3 demand';
  select id into c4 from public.community_posts where body = 'c4 equilibrium';
  perform pg_temp.expect_allowed('bob reports c2', bob, format($q$select public.report_community_post(%L, 'other')$q$, c2));
  perform pg_temp.expect_allowed('a reviewer finds nothing wrong', rev1,
    format($q$select public.decide_community_case(id, 'allow', 'no_violation') from public.community_cases where post_id = %L$q$, c2));
  perform pg_temp.expect_allowed('bob reports c3', bob, format($q$select public.report_community_post(%L, 'other')$q$, c3));
  perform pg_temp.expect_allowed('nothing wrong again', rev1,
    format($q$select public.decide_community_case(id, 'close_no_action', 'no_violation') from public.community_cases where post_id = %L$q$, c3));
  perform pg_temp.expect_allowed('bob reports c4', bob, format($q$select public.report_community_post(%L, 'other')$q$, c4));
  select count(*) into n from public.community_reports where post_id = c4 and set_aside;
  perform pg_temp.counted('a third report after two unfounded ones is set aside', n, 1);
  select count(*) into n from public.community_signals where post_id = c4 and rule_id = 'brigade.unfounded-repeat';
  perform pg_temp.counted('as an unfounded-repeat signal', n, 1);

  -- ── The retention sweep ────────────────────────────────────────────────
  perform pg_temp.expect_refused('nobody signed in can run the sweep', rev1, 'select private.sweep_community_retention()');
  perform pg_temp.expect_refused('not even a senior reviewer', senior, 'select private.sweep_community_retention()');
  select id into oldk from public.community_cases where post_id = c2;
  update public.community_cases set retain_until = now() - interval '1 day' where id = oldk;
  update public.community_cases set retain_until = now() - interval '1 day'
   where post_id = c4 and status = 'open';
  update public.community_sessions set starts_at = now() - interval '41 days', ends_at = now() - interval '40 days'
   where title = 'Review';
  j := private.sweep_community_retention();
  select count(*) into n from public.community_cases where id = oldk;
  perform pg_temp.counted('a closed case past its date is gone', n, 0);
  select count(*) into n from public.community_decisions where case_id = oldk;
  perform pg_temp.counted('with its decisions', n, 0);
  select count(*) into n from public.community_cases where post_id = c4 and status = 'open';
  perform pg_temp.counted('an open case is never swept, whatever its date', n, 1);
  select count(*) into n from public.community_sessions where title = 'Review';
  perform pg_temp.counted('a session that ended over thirty days ago is gone', n, 0);
  select count(*) into n from public.community_retention_runs;
  perform pg_temp.counted('and the run is recorded', n, 1);
  perform pg_temp.counted('reviewers can see that it ran', pg_temp.seen(rev1, 'select id from public.community_retention_runs'), 1);
  perform pg_temp.counted('students cannot', pg_temp.seen(bob, 'select id from public.community_retention_runs'), 0);

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
  perform pg_temp.counted('and no longer reads anybody else''s posts there', pg_temp.seen(dave,
    format($q$select id from public.community_posts where community_id = %L
               and body <> 'His schedule is on the board outside 214'$q$, grp)), 0);
end $$;

-- ═══ Scoped pseudonyms and volunteer moderation ═══════════════════════════

/*
 * Work a volunteer's queue: fetch tasks and answer each one, `right` or
 * wrong on purpose for calibration items (the harness can see the expected
 * answer; the volunteer cannot), and `on_cases` for real cases. Stops after
 * `n` answers. Returns how many it answered.
 */
create or replace function pg_temp.work(who uuid, n int, right_answers int, on_cases text default 'remove')
returns int language plpgsql as $$
declare
  done int := 0;
  ids uuid[];
  task uuid;
  expected text;
  answer text;
begin
  loop
    exit when done >= n;
    perform pg_temp.become(who);
    select array_agg(x.task_id order by x.task_id) into ids from public.volunteer_next_tasks() x;
    execute 'reset role';
    exit when ids is null;
    foreach task in array ids loop
      exit when done >= n;
      expected := null;
      select i.expected_action into expected
        from public.community_volunteer_tasks t join public.community_calibration_items i on i.id = t.item_id
       where t.id = task;
      if expected is null then
        answer := on_cases;
      elsif done < right_answers then
        answer := expected;
      else
        answer := case when expected = 'remove' then 'allow' else 'remove' end;
      end if;
      perform pg_temp.become(who);
      perform public.volunteer_decide(task, answer, 'calibration.check');
      execute 'reset role';
      done := done + 1;
    end loop;
  end loop;
  return done;
end $$;

do $$
declare
  ana uuid; ben uuid; cal uuid; fox uuid; mgr uuid; rev uuid; senior uuid;
  v1 uuid; v2 uuid; v3 uuid; young uuid;
  sup uuid; grp uuid; crs uuid; p uuid; q uuid; spam uuid; minor uuid; harsh uuid; own uuid;
  n bigint; t text; t2 text; i int; tasks jsonb;
begin
  insert into public.schools (id, name, email_domains) values ('pv-u', 'Programme University', array['pv-u.example']);
  ana    := pg_temp.newuser('ana@pv-u.example', 'pv-u');
  ben    := pg_temp.newuser('ben@pv-u.example', 'pv-u');
  cal    := pg_temp.newuser('cal@pv-u.example', 'pv-u');
  fox    := pg_temp.newuser('quietfox@pv-u.example', 'pv-u');
  mgr    := pg_temp.newuser('mgr@pv-u.example', 'pv-u');
  v1     := pg_temp.newuser('v1@pv-u.example', 'pv-u');
  v2     := pg_temp.newuser('v2@pv-u.example', 'pv-u');
  v3     := pg_temp.newuser('v3@pv-u.example', 'pv-u');
  young  := pg_temp.newuser('young@pv-u.example', 'pv-u');
  rev    := pg_temp.newuser('rev@semester.example', null);
  senior := pg_temp.newuser('senior2@semester.example', null);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mgr,    'community_manager',     'school',   'pv-u', 'institution'),
    (rev,    'trust_safety_reviewer', 'platform', '',     'platform'),
    (senior, 'trust_safety_senior',   'platform', '',     'platform');

  -- ── Aliases: off until the programme is on ─────────────────────────────
  perform pg_temp.expect_allowed('a manager starts a support community', mgr,
    $q$select public.create_community('support', 'First-gen at PV', 'Support', '')$q$);
  perform pg_temp.expect_allowed('ana starts a study group', ana,
    $q$select public.create_community('study_group', 'PV macro group', 'Problem sets', '')$q$);
  perform pg_temp.expect_allowed('the manager starts a course community', mgr,
    $q$select public.create_community('course', 'PV ECON 1010', 'Course', '')$q$);
  select id into sup from public.communities where name = 'First-gen at PV';
  select id into grp from public.communities where name = 'PV macro group';
  select id into crs from public.communities where name = 'PV ECON 1010';
  perform pg_temp.expect_refused('pseudonyms cannot be approved while the programme is off', mgr,
    format('select public.approve_community_pseudonymity(%L, true)', sup));
  perform pg_temp.expect_refused('nobody signed in can switch a programme on', senior,
    $q$insert into public.community_programs (tenant_id, program, enabled) values ('pv-u', 'scoped_pseudonymity', true)$q$);
  perform pg_temp.expect_refused('not even a manager at that school', mgr,
    $q$insert into public.community_programs (tenant_id, program, enabled) values ('pv-u', 'scoped_pseudonymity', true)$q$);

  -- The service role, as a reviewed deployment step.
  insert into public.community_programs (tenant_id, program, enabled, approved_ref)
  values ('pv-u', 'scoped_pseudonymity', true, 'check');

  perform pg_temp.expect_refused('a student cannot approve pseudonyms', ana,
    format('select public.approve_community_pseudonymity(%L, true)', grp));
  perform pg_temp.expect_refused('a course community cannot have them', mgr,
    format('select public.approve_community_pseudonymity(%L, true)', crs));
  perform pg_temp.expect_allowed('the manager approves them in the support community', mgr,
    format('select public.approve_community_pseudonymity(%L, true)', sup));
  perform pg_temp.expect_allowed('and in the study group', mgr,
    format('select public.approve_community_pseudonymity(%L, true)', grp));

  perform pg_temp.expect_allowed('ana joins the support community', ana, format('select public.join_community(%L)', sup));
  perform pg_temp.expect_allowed('ben joins it', ben, format('select public.join_community(%L)', sup));
  perform pg_temp.expect_allowed('ben joins the study group', ben, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('cal joins the study group', cal, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('ben joins the course', ben, format('select public.join_community(%L)', crs));
  perform pg_temp.expect_allowed('cal joins the course', cal, format('select public.join_community(%L)', crs));
  perform pg_temp.expect_refused('no alias in a community that has not approved them', ben,
    format($q$select public.claim_community_alias(%L, 'Pathfinder2')$q$, crs));

  perform pg_temp.expect_allowed('ana takes an alias', ana,
    format($q$select public.claim_community_alias(%L, 'Navigator1')$q$, sup));
  perform pg_temp.expect_refused('ben cannot take it in another case', ben,
    format($q$select public.claim_community_alias(%L, 'navigator1')$q$, sup));
  perform pg_temp.expect_refused('or a member''s handle', ben,
    format($q$select public.claim_community_alias(%L, 'QuietFox')$q$, sup));
  perform pg_temp.expect_refused('or something that is not a name', ben,
    format($q$select public.claim_community_alias(%L, 'x')$q$, sup));
  perform pg_temp.expect_allowed('ben takes his own', ben,
    format($q$select public.claim_community_alias(%L, 'Lantern7')$q$, sup));
  perform pg_temp.counted('ben reads only his own alias', pg_temp.seen(ben, 'select name from public.community_aliases'), 1);
  perform pg_temp.expect_refused('nobody inserts an alias directly', ben,
    format($q$insert into public.community_aliases (community_id, user_id, name) values (%L, %L, 'Sneaky9')$q$, grp, ben));

  -- Posting under an alias.
  perform pg_temp.expect_allowed('ana posts under her name', ana,
    format($q$select public.create_community_post(%L, 'Named post from ana')$q$, sup));
  perform pg_temp.expect_allowed('and under her alias', ana,
    format($q$select public.create_community_post(%L, 'Alias post from ana', false, true)$q$, sup));
  select author_ref into t from public.community_posts where body = 'Named post from ana';
  select author_ref into t2 from public.community_posts where body = 'Alias post from ana';
  if t = t2 then raise exception 'FAILED: an alias post shares a ref with its author''s named posts'; end if;
  raise notice 'ok  an alias post cannot be joined to its author''s named posts';
  select author_name || '/' || as_alias into t from public.community_posts where body = 'Alias post from ana';
  perform pg_temp.said('it shows the alias, marked as one', t, 'Navigator1/true');
  perform pg_temp.counted('ana''s own refs mark both posts as hers', pg_temp.seen(ana,
    format($q$select p.id from public.community_posts p join public.my_community_refs() r
               on r.community_id = p.community_id and r.author_ref = p.author_ref where p.community_id = %L$q$, sup)), 2);
  perform pg_temp.expect_refused('no alias post where you have no alias', ben,
    format($q$select public.create_community_post(%L, 'x', false, true)$q$, grp));

  -- Aliases post at three an hour, where names post at ten.
  perform pg_temp.expect_allowed('cal takes an alias in the study group', cal,
    format($q$select public.claim_community_alias(%L, 'Owl4ever')$q$, grp));
  for i in 1..3 loop
    perform pg_temp.expect_allowed('cal posts under the alias', cal,
      format($q$select public.create_community_post(%L, %L, false, true)$q$, grp, 'alias ' || i));
  end loop;
  perform pg_temp.expect_refused('a fourth alias post in an hour', cal,
    format($q$select public.create_community_post(%L, 'alias 4', false, true)$q$, grp));
  perform pg_temp.expect_allowed('while a named post is still within its limit', cal,
    format($q$select public.create_community_post(%L, 'named 1')$q$, grp));

  -- Blocking an alias mutes it here instead of blocking the account.
  select id into p from public.community_posts where body = 'Alias post from ana';
  perform pg_temp.expect_allowed('ben blocks the alias', ben, format('select public.block_community_author(%L)', p));
  select count(*) into n from public.blocks where user_id = ben;
  perform pg_temp.counted('no account block is written, which would unmask her', n, 0);
  select count(*) into n from public.community_mutes where user_id = ben and community_id = sup;
  perform pg_temp.counted('the alias is muted in that community', n, 1);
  perform pg_temp.counted('and ben still sees her named post', pg_temp.seen(ben,
    $q$select id from public.community_posts where body = 'Named post from ana'$q$), 1);

  -- Rotation.
  perform pg_temp.expect_refused('an alias cannot change twice in a day', ana,
    format($q$select public.claim_community_alias(%L, 'Wayfinder3')$q$, sup));
  update public.community_aliases set created_at = now() - interval '2 days' where user_id = ana;
  perform pg_temp.expect_allowed('a day later it can', ana,
    format($q$select public.claim_community_alias(%L, 'Wayfinder3')$q$, sup));
  perform pg_temp.expect_allowed('ana posts under the new alias', ana,
    format($q$select public.create_community_post(%L, 'New alias post', false, true)$q$, sup));
  select author_ref into t from public.community_posts where body = 'New alias post';
  if t = t2 then raise exception 'FAILED: a rotated alias kept its ref'; end if;
  raise notice 'ok  a new alias is a new ref';
  select id into q from public.community_posts where body = 'New alias post';
  perform pg_temp.expect_allowed('ben reports the new alias post', ben,
    format($q$select public.report_community_post(%L, 'other')$q$, q));
  update public.community_aliases set rotated_at = now() - interval '2 days' where user_id = ana;
  perform pg_temp.expect_refused('while a case on her posts is open, the name is kept', ana,
    format($q$select public.claim_community_alias(%L, 'Compass5')$q$, sup));

  update public.community_programs set enabled = false where tenant_id = 'pv-u' and program = 'scoped_pseudonymity';
  perform pg_temp.expect_refused('switching the programme off stops alias posts at once', ben,
    format($q$select public.create_community_post(%L, 'after', false, true)$q$, sup));
  perform pg_temp.expect_allowed('while named posts carry on', ben,
    format($q$select public.create_community_post(%L, 'named after')$q$, sup));

  -- ── Volunteers: off until the programme is on ──────────────────────────
  update auth.users set created_at = now() - interval '60 days' where id in (v1, v2, v3);
  perform pg_temp.expect_refused('nobody can volunteer while the programme is off', v1, 'select public.apply_to_volunteer()');
  insert into public.community_programs (tenant_id, program, enabled, approved_ref)
  values ('pv-u', 'volunteer_moderation', true, 'check');

  perform pg_temp.expect_refused('an account under 30 days old cannot volunteer', young, 'select public.apply_to_volunteer()');
  insert into public.community_restrictions (user_id, community_id, case_id, until)
  values (v3, null, gen_random_uuid(), now() + interval '1 day');
  perform pg_temp.expect_refused('nor can a restricted one', v3, 'select public.apply_to_volunteer()');
  update public.community_restrictions set lifted_at = now() where user_id = v3;
  perform pg_temp.expect_allowed('v1 applies', v1, 'select public.apply_to_volunteer()');
  perform pg_temp.expect_refused('once', v1, 'select public.apply_to_volunteer()');
  perform pg_temp.expect_allowed('v2 applies', v2, 'select public.apply_to_volunteer()');
  perform pg_temp.expect_allowed('v3 applies', v3, 'select public.apply_to_volunteer()');
  perform pg_temp.expect_refused('no tasks before training and the agreements', v1, 'select * from public.volunteer_next_tasks()');
  perform pg_temp.expect_refused('a reviewer who is not senior cannot record training', rev,
    format($q$select public.manage_volunteer(%L, 'record_training', 'completed module 1')$q$, v1));
  for i in 1..3 loop
    perform pg_temp.become((array[v1, v2, v3])[i]);
    perform public.volunteer_attest('confidentiality');
    perform public.volunteer_attest('recusal');
    execute 'reset role';
    perform pg_temp.become(senior);
    perform public.manage_volunteer((array[v1, v2, v3])[i], 'record_training', 'completed module 1');
    execute 'reset role';
  end loop;
  raise notice 'ok  three volunteers trained and signed';

  -- Calibration and control items, written by a senior reviewer.
  perform pg_temp.expect_refused('a reviewer who is not senior cannot write items', rev,
    $q$insert into public.community_calibration_items (tenant_id, kind, category, severity, body, expected_action)
       values ('pv-u', 'onboarding', 'other', 'P3', 'x', 'allow')$q$);
  for i in 1..24 loop
    perform pg_temp.become(senior);
    execute format($q$insert into public.community_calibration_items (tenant_id, kind, category, severity, body, expected_action)
                     values ('pv-u', 'onboarding', 'spam_scam_or_phishing', 'P2', %L, %L)$q$,
                   'onboarding item ' || i, case when i % 2 = 0 then 'remove' else 'allow' end);
    execute format($q$insert into public.community_calibration_items (tenant_id, kind, category, severity, body, expected_action)
                     values ('pv-u', 'control', 'other', 'P3', %L, %L)$q$,
                   'control item ' || i, case when i % 3 = 0 then 'remove' else 'allow' end);
    execute 'reset role';
  end loop;
  perform pg_temp.counted('a volunteer cannot read the items or their answers', pg_temp.seen(v1,
    'select id from public.community_calibration_items'), 0);

  -- Onboarding: 17 of 20 passes, 16 does not.
  perform pg_temp.counted('v1 works twenty onboarding items', pg_temp.work(v1, 20, 17), 20);
  select status into t from public.community_volunteers where user_id = v1;
  perform pg_temp.said('17 of 20 makes a volunteer active', t, 'active');
  perform pg_temp.expect_refused('and 20 in an hour is the cap', v1, 'select * from public.volunteer_next_tasks()');
  update public.community_volunteer_tasks set answered_at = answered_at - interval '2 hours' where volunteer_id = v1;
  perform pg_temp.counted('v2 works twenty', pg_temp.work(v2, 20, 16), 20);
  select status into t from public.community_volunteers where user_id = v2;
  perform pg_temp.said('16 of 20 stays in onboarding', t, 'onboarding');
  update public.community_volunteer_tasks set answered_at = answered_at - interval '2 hours' where volunteer_id = v2;
  -- v2's second attempt is not the point here; a senior reviewer's
  -- recalibration is walked below with v3.
  update public.community_volunteers set status = 'active' where user_id = v2;
  update public.community_volunteer_tasks set answered_at = answered_at - interval '2 hours' where volunteer_id = v2;

  -- Real cases in the course community.
  for i in 1..5 loop
    perform pg_temp.become(cal);
    perform public.create_community_post(crs, (array['Cheap tickets here', 'Off topic musing', 'You are all idiots', 'Her room number is 12', 'Ben post'])[i]);
    execute 'reset role';
  end loop;
  select id into spam from public.community_posts where body = 'Cheap tickets here';
  select id into minor from public.community_posts where body = 'Off topic musing';
  select id into harsh from public.community_posts where body = 'You are all idiots';
  select id into own from public.community_posts where body = 'Ben post';
  perform pg_temp.expect_allowed('ben reports spam', ben, format($q$select public.report_community_post(%L, 'spam_scam_or_phishing')$q$, spam));
  perform pg_temp.expect_allowed('ben reports a minor issue', ben, format($q$select public.report_community_post(%L, 'other')$q$, minor));
  perform pg_temp.expect_allowed('ben reports harassment', ben, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, harsh));
  perform pg_temp.expect_allowed('v1 joins the course', v1, format('select public.join_community(%L)', crs));
  perform pg_temp.expect_allowed('v1 reports a post themselves', v1, format($q$select public.report_community_post(%L, 'other')$q$, own));

  perform pg_temp.become(v1);
  select jsonb_agg(to_jsonb(x)) into tasks from public.volunteer_next_tasks() x;
  execute 'reset role';
  create temp table seen_tasks as
    select * from jsonb_to_recordset(tasks) as r(task_id uuid, category text, severity text, community_kind text, body text);
  select count(*) into n from seen_tasks s join public.community_volunteer_tasks t on t.id = s.task_id where t.case_id is not null;
  perform pg_temp.counted('an active volunteer is handed the two eligible cases', n, 2);
  select count(*) into n from seen_tasks s join public.community_volunteer_tasks t on t.id = s.task_id where t.item_id is not null;
  perform pg_temp.counted('with a control mixed in', n, 1);
  select count(*) into n from seen_tasks where body in ('You are all idiots', 'Her room number is 12', 'Ben post', 'New alias post');
  perform pg_temp.counted('never harassment, never P0, never a post they reported, never a support community', n, 0);
  select pg_get_function_result('public.volunteer_next_tasks()'::regprocedure) into t;
  perform pg_temp.said('a task carries no name, author, reporter or vote', t,
    'TABLE(task_id uuid, category text, severity text, community_kind text, body text)');
  perform pg_temp.counted('a volunteer reads no cases', pg_temp.seen(v1, 'select id from public.community_cases'), 0);
  perform pg_temp.counted('and no votes', pg_temp.seen(v1, 'select case_id from public.community_volunteer_votes'), 0);

  -- Two volunteers must agree to remove.
  select s.task_id into q from seen_tasks s join public.community_volunteer_tasks t on t.id = s.task_id
   join public.community_cases k on k.id = t.case_id where k.post_id = spam;
  perform pg_temp.expect_refused('a volunteer cannot restrict an account', v1,
    format($q$select public.volunteer_decide(%L, 'account_restriction', 'x1')$q$, q));
  perform pg_temp.expect_refused('or answer somebody else''s task', v2,
    format($q$select public.volunteer_decide(%L, 'remove', 'spam.link')$q$, q));
  perform pg_temp.expect_allowed('v1 votes to remove the spam', v1,
    format($q$select public.volunteer_decide(%L, 'remove', 'spam.link')$q$, q));
  select status into t from public.community_posts where id = spam;
  perform pg_temp.said('one vote removes nothing', t, 'published');
  perform pg_temp.counted('v2 answers a control and three cases', pg_temp.work(v2, 4, 4, 'remove'), 4);
  select p.status || '/' || k.status into t from public.community_posts p
    join public.community_cases k on k.post_id = p.id where p.id = spam;
  perform pg_temp.said('two independent removals decide it', t, 'removed/decided');
  select count(*) into n from public.community_case_events e join public.community_cases k on k.id = e.case_id
   where k.post_id = spam and e.actor_kind = 'volunteer' and e.event = 'decided:remove';
  perform pg_temp.counted('recorded as a volunteer decision', n, 1);

  -- Disagreement goes to a professional.
  select s.task_id into q from seen_tasks s join public.community_volunteer_tasks t on t.id = s.task_id
   join public.community_cases k on k.id = t.case_id where k.post_id = minor;
  perform pg_temp.expect_allowed('v1 votes to allow what v2 removed', v1,
    format($q$select public.volunteer_decide(%L, 'allow', 'offtopic.minor')$q$, q));
  select k.route || '/' || k.status into t from public.community_cases k where k.post_id = minor;
  perform pg_temp.said('disagreement goes to a professional, still open', t, 'professional/open');

  -- Quality: the last twenty controls, 5 points each.
  update public.community_volunteers set status = 'active' where user_id = v3;
  insert into public.community_volunteer_tasks (volunteer_id, item_id, assigned_at, answered_at, answer, correct)
  select v3, i.id, now() - interval '3 days', now() - interval '3 days' + (row_number() over ()) * interval '1 second',
         'allow', row_number() over () <= 14
    from public.community_calibration_items i where i.kind = 'control' limit 20;
  perform pg_temp.expect_refused('70 pauses a volunteer', v3, 'select * from public.volunteer_next_tasks()');
  select status into t from public.community_volunteers where user_id = v3;
  perform pg_temp.said('and says so', t, 'paused');
  perform pg_temp.expect_refused('paused is sticky', v3, 'select * from public.volunteer_next_tasks()');
  perform pg_temp.expect_allowed('a senior reviewer sends them back to calibration', senior,
    format($q$select public.manage_volunteer(%L, 'recalibrate', 'retrained on spam')$q$, v3));
  select status into t from public.community_volunteers where user_id = v3;
  perform pg_temp.said('onboarding again', t, 'onboarding');

  perform pg_temp.expect_refused('a revocation needs a reason', senior,
    format($q$select public.manage_volunteer(%L, 'revoke', '')$q$, v2));
  perform pg_temp.expect_allowed('a senior reviewer revokes v2', senior,
    format($q$select public.manage_volunteer(%L, 'revoke', 'shared a case outside the queue')$q$, v2));
  perform pg_temp.expect_refused('a revoked volunteer gets nothing', v2, 'select * from public.volunteer_next_tasks()');
  select count(*) into n from public.community_volunteer_events
   where volunteer_sha256 = private.role_audit_sha256(v2::text) and event = 'revoked'
     and actor_sha256 = private.role_audit_sha256(senior::text);
  perform pg_temp.counted('the revocation is attributed by hash', n, 1);
  perform pg_temp.counted('students read no volunteer events', pg_temp.seen(ben, 'select id from public.community_volunteer_events'), 0);
  perform pg_temp.counted('a volunteer reads their own standing', pg_temp.seen(v1,
    $q$select 1 from public.my_volunteer_standing() where status = 'active'$q$), 1);

  update public.community_programs set enabled = false where tenant_id = 'pv-u' and program = 'volunteer_moderation';
  perform pg_temp.expect_refused('switching the programme off stops the queue at once', v1, 'select * from public.volunteer_next_tasks()');

  -- Leaving takes the volunteer record and aliases, not the votes.
  perform pg_temp.expect_allowed('v1 forgets their Community data', v1, 'select public.forget_my_community()');
  select count(*) into n from public.community_volunteers where user_id = v1;
  perform pg_temp.counted('the volunteer record is gone', n, 0);
  select count(*) into n from public.community_volunteer_votes where volunteer_id = v1;
  perform pg_temp.counted('the votes stay with the cases they decided', n, 2);
  perform pg_temp.expect_allowed('ana forgets hers', ana, 'select public.forget_my_community()');
  select count(*) into n from public.community_aliases where user_id = ana;
  perform pg_temp.counted('her aliases are gone', n, 0);
end $$;

rollback;
