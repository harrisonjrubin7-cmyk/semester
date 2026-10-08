-- Community: every permission in 20260928032000_community.sql walked as the
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
  -- The filing window is thirty days from the decision. A decision older than
  -- that is neither offered for appeal nor accepted; one inside it still is.
  update public.community_decisions set decided_at = now() - interval '31 days' where case_id = k;
  perform pg_temp.counted('a decision past the window is not offered for appeal', pg_temp.seen(alice,
    'select 1 from public.my_community_notices() where appealable'), 0);
  perform pg_temp.expect_refused('and the author cannot appeal it', alice,
    format('select public.appeal_community_decision(%L)', p3));
  update public.community_decisions set decided_at = now() - interval '29 days' where case_id = k;
  perform pg_temp.counted('a decision inside the window is offered for appeal', pg_temp.seen(alice,
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
  -- A history three days old, from a calibration that began before it. (now() is
  -- fixed for the whole transaction, so the start is backdated to match.)
  update public.community_volunteers set status = 'active', calibration_started_at = now() - interval '4 days' where user_id = v3;
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
  -- A fresh start, not a status the old answers undo on the next request.
  perform pg_temp.become(v3);
  select count(*) into n from public.volunteer_next_tasks();
  execute 'reset role';
  select status into t from public.community_volunteers where user_id = v3;
  perform pg_temp.said('the old calibration does not re-activate them', t, 'onboarding');
  select count(*) into n from public.community_volunteer_tasks tk
    join public.community_calibration_items i on i.id = tk.item_id
   where tk.volunteer_id = v3 and tk.answered_at is null and i.kind = 'onboarding';
  perform pg_temp.counted('they are given onboarding items to calibrate on again', (n > 0)::int, 1);
  perform pg_temp.counted('twenty fresh right answers', pg_temp.work(v3, 20, 20), 20);
  select status into t from public.community_volunteers where user_id = v3;
  perform pg_temp.said('make them active again', t, 'active');
  perform pg_temp.counted('with the old controls no longer counted against them', pg_temp.seen(v3,
    'select 1 from public.my_volunteer_standing() where quality is null and onboarding_answered = 20'), 1);
  -- The transaction's clock does not move, so that fresh calibration is moved
  -- an hour back: out of the hourly cap, and before the next recalibration.
  update public.community_volunteer_tasks set assigned_at = assigned_at - interval '1 hour',
         answered_at = answered_at - interval '1 hour' where volunteer_id = v3;
  perform pg_temp.become(v3);
  select count(*) into n from public.volunteer_next_tasks();
  execute 'reset role';
  select status into t from public.community_volunteers where user_id = v3;
  perform pg_temp.said('and the next request does not pause them on the old controls', t, 'active');

  -- Sent back a second time, after a calibration they really passed.
  perform pg_temp.expect_allowed('a senior reviewer sends them back again', senior,
    format($q$select public.manage_volunteer(%L, 'recalibrate', 'second retraining')$q$, v3));
  perform pg_temp.become(v3);
  select count(*) into n from public.volunteer_next_tasks();
  execute 'reset role';
  select status into t from public.community_volunteers where user_id = v3;
  perform pg_temp.said('a calibration already passed does not count for the new one', t, 'onboarding');
  select count(*) into n from public.community_volunteer_tasks tk
    join public.community_calibration_items i on i.id = tk.item_id
   where tk.volunteer_id = v3 and tk.answered_at is null and i.kind = 'onboarding';
  perform pg_temp.counted('and items they have seen before can be given again', (n > 0)::int, 1);
  select count(*) into n from public.community_volunteer_tasks
   where volunteer_id = v3 and answered_at is null and case_id is not null;
  perform pg_temp.counted('and no real case is left in their queue from before', n, 0);

  perform pg_temp.expect_refused('a revocation needs a reason', senior,
    format($q$select public.manage_volunteer(%L, 'revoke', '')$q$, v2));
  -- Something handed out and not yet answered, so the revocation has work to take back.
  insert into public.community_volunteer_tasks (volunteer_id, item_id)
  select v2, i.id from public.community_calibration_items i where i.kind = 'control' limit 1;
  perform pg_temp.expect_allowed('a senior reviewer revokes v2', senior,
    format($q$select public.manage_volunteer(%L, 'revoke', 'shared a case outside the queue')$q$, v2));
  perform pg_temp.expect_refused('a revoked volunteer gets nothing', v2, 'select * from public.volunteer_next_tasks()');
  select count(*) into n from public.community_volunteer_tasks where volunteer_id = v2 and answered_at is null;
  perform pg_temp.counted('and nothing handed out before is left with them', n, 0);
  select count(*) into n from public.community_volunteer_events
   where volunteer_sha256 = private.role_audit_sha256(v2::text) and event = 'revoked'
     and actor_sha256 = private.role_audit_sha256(senior::text);
  perform pg_temp.counted('the revocation is attributed by hash', n, 1);
  perform pg_temp.counted('students read no volunteer events', pg_temp.seen(ben, 'select id from public.community_volunteer_events'), 0);
  perform pg_temp.expect_refused('a volunteer cannot read the roster', v1, 'select * from public.volunteer_roster()');
  perform pg_temp.expect_refused('nor can a reviewer who is not senior', rev, 'select * from public.volunteer_roster()');
  perform pg_temp.expect_refused('nor the school''s community manager', mgr, 'select * from public.volunteer_roster()');
  perform pg_temp.counted('a senior reviewer reads every volunteer', pg_temp.seen(senior,
    'select 1 from public.volunteer_roster() where tenant_id = ''pv-u'''),
    (select count(*) from public.community_volunteers where tenant_id = 'pv-u'));
  perform pg_temp.counted('with the handle, and the reason a revocation gave', pg_temp.seen(senior,
    format($q$select 1 from public.volunteer_roster() where user_id = %L and handle = 'v2' and status = 'revoked'
              and revoked_reason = 'shared a case outside the queue'$q$, v2)), 1);
  perform pg_temp.counted('progress counts only the current calibration', pg_temp.seen(senior,
    format($q$select 1 from public.volunteer_roster() where user_id = %L and onboarding_answered = 0$q$, v3)), 1);
  perform pg_temp.counted('a volunteer reads their own standing', pg_temp.seen(v1,
    $q$select 1 from public.my_volunteer_standing() where status = 'active'$q$), 1);

  -- The control plane's kill.sharing holds here too, for one school or all.
  perform pg_temp.counted('before the kill switch, the programme is on',
    private.community_program_on('pv-u', 'volunteer_moderation')::int, 1);
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('pv-u', 'kill.sharing', true, 'check: incident drill', now());
  perform pg_temp.expect_refused('an engaged kill.sharing stops the volunteer queue', v1, 'select * from public.volunteer_next_tasks()');
  perform pg_temp.expect_refused('and alias changes', ana,
    format($q$select public.claim_community_alias(%L, 'Wayfarer3')$q$, sup));
  update public.feature_kill_switch set engaged = false where tenant_id = 'pv-u' and switch_key = 'kill.sharing';
  perform pg_temp.counted('released, the programme is on again',
    private.community_program_on('pv-u', 'volunteer_moderation')::int, 1);
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values (null, 'kill.sharing', true, 'check: platform-wide drill', now());
  perform pg_temp.counted('a platform-wide kill.sharing stops it too',
    private.community_program_on('pv-u', 'volunteer_moderation')::int, 0);
  delete from public.feature_kill_switch where tenant_id is null and switch_key = 'kill.sharing';

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


-- ── Institution escalation and the private safety state ──────────────────
do $$
declare
  amy uuid; bo uuid; cy uuid; dee uuid; rev uuid; rev2 uuid; senior uuid; mgr uuid;
  grp uuid; threat uuid; dox uuid; spam uuid; minor uuid;
  k_threat uuid; k_dox uuid; k_spam uuid; k_minor uuid; e uuid; e2 uuid; dv uuid;
  n bigint; t text; v int; j jsonb;
begin
  insert into public.schools (id, name, email_domains) values ('es-u', 'Escalation University', array['es-u.example']);
  amy    := pg_temp.newuser('amy@es-u.example', 'es-u');
  bo     := pg_temp.newuser('bo@es-u.example', 'es-u');
  cy     := pg_temp.newuser('cy@es-u.example', 'es-u');
  dee    := pg_temp.newuser('dee@es-u.example', 'es-u');
  mgr    := pg_temp.newuser('mgr@es-u.example', 'es-u');
  rev    := pg_temp.newuser('rev@es.semester.example', null);
  rev2   := pg_temp.newuser('rev2@es.semester.example', null);
  senior := pg_temp.newuser('senior@es.semester.example', null);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mgr,    'community_manager',     'school',   'es-u', 'institution'),
    (rev,    'trust_safety_reviewer', 'platform', '',     'platform'),
    (rev2,   'trust_safety_reviewer', 'platform', '',     'platform'),
    (senior, 'trust_safety_senior',   'platform', '',     'platform');

  perform pg_temp.expect_allowed('amy starts a study group', amy,
    $q$select public.create_community('study_group', 'ES stats group', 'Stats', '')$q$);
  select id into grp from public.communities where name = 'ES stats group';
  perform pg_temp.expect_allowed('bo joins', bo, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('cy joins', cy, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('dee joins', dee, format('select public.join_community(%L)', grp));
  perform pg_temp.expect_allowed('bo posts', bo, format($q$select public.create_community_post(%L, 'Post for a threat report')$q$, grp));
  perform pg_temp.expect_allowed('bo posts again', bo, format($q$select public.create_community_post(%L, 'Post for a doxxing report')$q$, grp));
  perform pg_temp.expect_allowed('cy posts', cy, format($q$select public.create_community_post(%L, 'Post for a spam report')$q$, grp));
  perform pg_temp.expect_allowed('cy posts again', cy, format($q$select public.create_community_post(%L, 'Post for a minor report')$q$, grp));
  select id into threat from public.community_posts where body = 'Post for a threat report';
  select id into dox    from public.community_posts where body = 'Post for a doxxing report';
  select id into spam   from public.community_posts where body = 'Post for a spam report';
  select id into minor  from public.community_posts where body = 'Post for a minor report';
  perform pg_temp.expect_allowed('amy reports a threat', amy, format($q$select public.report_community_post(%L, 'threat_or_safety_concern')$q$, threat));
  perform pg_temp.expect_allowed('amy reports doxxing', amy, format($q$select public.report_community_post(%L, 'private_information_or_doxxing')$q$, dox));
  perform pg_temp.expect_allowed('amy reports spam', amy, format($q$select public.report_community_post(%L, 'spam_scam_or_phishing')$q$, spam));
  perform pg_temp.expect_allowed('amy reports something minor', amy, format($q$select public.report_community_post(%L, 'other')$q$, minor));
  select id into k_threat from public.community_cases where post_id = threat;
  select id into k_dox    from public.community_cases where post_id = dox;
  select id into k_spam   from public.community_cases where post_id = spam;
  select id into k_minor  from public.community_cases where post_id = minor;
  select severity into t from public.community_cases where id = k_threat;
  perform pg_temp.said('the threat case is P1', t, 'P1');
  select severity into t from public.community_cases where id = k_minor;
  perform pg_temp.said('the minor case is P3', t, 'P3');

  -- ── Escalation: off, then refused until every condition holds ─────────
  perform pg_temp.expect_refused('escalation is refused while the programme is off', rev,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  perform pg_temp.expect_refused('nobody signed in can switch it on', senior,
    $q$insert into public.community_programs (tenant_id, program, enabled) values ('es-u', 'institution_escalation', true)$q$);
  insert into public.community_programs (tenant_id, program, enabled, approved_ref)
  values ('es-u', 'institution_escalation', true, 'check');
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('es-u', 'kill.sharing', true, 'check: control', now());
  perform pg_temp.counted('kill.sharing is not escalation''s switch',
    private.community_program_on('es-u', 'institution_escalation')::int, 1);
  delete from public.feature_kill_switch where tenant_id = 'es-u';
  perform pg_temp.expect_refused('on, but with no agreement in force, it is still refused', rev,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  perform pg_temp.expect_refused('a senior reviewer cannot write the agreement', senior,
    $q$insert into public.community_escalation_policies (tenant_id, enabled, agreement_ref, categories, channel)
       values ('es-u', true, 'forged', array['threat_or_safety_concern'], 'x')$q$);
  perform pg_temp.expect_refused('nor can the school''s community manager', mgr,
    $q$insert into public.community_escalation_policies (tenant_id, enabled, agreement_ref, categories, channel)
       values ('es-u', true, 'forged', array['threat_or_safety_concern'], 'x')$q$);
  -- The service role, from a signed agreement — written first as a draft.
  insert into public.community_escalation_policies (tenant_id, enabled, agreement_ref, categories, identity_required, channel)
  values ('es-u', false, 'ES-DSA-2026-01', array['threat_or_safety_concern', 'spam_scam_or_phishing'], false, 'secure-mail:dos');
  perform pg_temp.expect_refused('a policy that is not enabled is refused', rev,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  update public.community_escalation_policies set enabled = true where tenant_id = 'es-u';
  perform pg_temp.counted('a reviewer reads the policy', pg_temp.seen(rev, 'select 1 from public.community_escalation_policies where tenant_id = ''es-u'''), 1);
  perform pg_temp.counted('a student reads none', pg_temp.seen(amy, 'select 1 from public.community_escalation_policies'), 0);
  perform pg_temp.counted('nor does the school''s manager', pg_temp.seen(mgr, 'select 1 from public.community_escalation_policies'), 0);

  perform pg_temp.expect_refused('a student cannot request an escalation', amy,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  perform pg_temp.expect_refused('nor can a community manager', mgr,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  perform pg_temp.expect_refused('a P2 case is refused even in a covered category', rev,
    format($q$select public.request_community_escalation(%L, 'a phishing wave aimed at the school')$q$, k_spam));
  perform pg_temp.expect_refused('a P0 case outside the agreement''s categories is refused', rev,
    format($q$select public.request_community_escalation(%L, 'a student''s address was posted')$q$, k_dox));
  update public.community_escalation_policies set expires_on = current_date - 1 where tenant_id = 'es-u';
  perform pg_temp.expect_refused('an agreement that has ended refuses a request', rev,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  update public.community_escalation_policies set expires_on = null where tenant_id = 'es-u';
  perform pg_temp.expect_refused('a request needs a written reason', rev,
    format($q$select public.request_community_escalation(%L, 'threat')$q$, k_threat));
  perform pg_temp.expect_allowed('a reviewer requests one for the P1 threat', rev,
    format($q$select public.request_community_escalation(%L, 'credible threat against a named student')$q$, k_threat));
  select id into e from public.community_escalations where case_id = k_threat;
  perform pg_temp.expect_refused('one live escalation per case', rev2,
    format($q$select public.request_community_escalation(%L, 'asking a second time over')$q$, k_threat));
  select count(*) into n from public.community_escalations where case_id = k_threat and requested_by_sha256 = private.role_audit_sha256(rev::text);
  perform pg_temp.counted('who asked is kept as a hash', n, 1);
  perform pg_temp.counted('a student reads no escalations', pg_temp.seen(bo, 'select id from public.community_escalations'), 0);
  perform pg_temp.counted('nor does the manager', pg_temp.seen(mgr, 'select id from public.community_escalations'), 0);

  perform pg_temp.expect_refused('the reviewer who asked cannot approve', rev,
    format($q$select public.decide_community_escalation(%L, true, 'approving my own request')$q$, e));
  perform pg_temp.expect_refused('a student cannot approve', amy,
    format($q$select public.decide_community_escalation(%L, true, 'looks right to me')$q$, e));
  perform pg_temp.expect_refused('an approval needs its own reason', rev2,
    format($q$select public.decide_community_escalation(%L, true, 'ok')$q$, e));
  select count(*) into n from public.community_escalation_deliveries;
  perform pg_temp.counted('nothing is queued before a second reviewer approves', n, 0);
  perform pg_temp.expect_allowed('a second reviewer approves', rev2,
    format($q$select public.decide_community_escalation(%L, true, 'threat names a person and a place')$q$, e));
  select payload into j from public.community_escalations where id = e;
  select string_agg(k, ',' order by k) into t from jsonb_object_keys(j) k;
  perform pg_temp.said('the payload is exactly the allowlist', t,
    'agreement_ref,case_id,category,occurred_at,severity,summary,tenant_id');
  perform pg_temp.said('it names the agreement', j->>'agreement_ref', 'ES-DSA-2026-01');
  perform pg_temp.counted('it carries no account id or email of the author', (position(bo::text in j::text) + position('bo@es-u' in j::text))::bigint, 0);
  select count(*) into n from public.community_escalation_deliveries d where d.escalation_id = e and d.channel = 'secure-mail:dos';
  perform pg_temp.counted('approval queues one delivery on the agreed channel', n, 1);
  perform pg_temp.expect_refused('it cannot be approved twice', senior,
    format($q$select public.decide_community_escalation(%L, true, 'approving it once more')$q$, e));
  select count(*) into n from public.community_case_events where case_id = k_threat and event in ('escalation_requested', 'escalation_approved');
  perform pg_temp.counted('the request and the approval are both in the case history', n, 2);
  perform pg_temp.expect_refused('a reviewer cannot read what was sent', rev, 'select payload from public.community_escalation_deliveries');
  perform pg_temp.counted('but can see that it is waiting', pg_temp.seen(rev, 'select id from public.community_escalation_deliveries where delivered_at is null'), 1);
  perform pg_temp.expect_refused('nobody signed in takes deliveries', senior, 'select * from public.take_escalation_deliveries()');
  perform pg_temp.expect_refused('or marks one sent', senior,
    format('select public.mark_escalation_delivered(%L)', (select id from public.community_escalation_deliveries where escalation_id = e)));
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('the service role takes the waiting delivery', n, 1);
  perform public.mark_escalation_delivered((select id from public.community_escalation_deliveries where escalation_id = e));
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('and once marked sent it is not taken again', n, 0);

  -- Identity only when the agreement requires it, and then as an opaque ref.
  update public.community_escalation_policies set identity_required = true, categories = array_append(categories, 'private_information_or_doxxing')
   where tenant_id = 'es-u';
  perform pg_temp.expect_allowed('the doxxing case can now be requested', rev2,
    format($q$select public.request_community_escalation(%L, 'a student''s home address was posted')$q$, k_dox));
  select id into e2 from public.community_escalations where case_id = k_dox;
  perform pg_temp.expect_allowed('and a different reviewer approves', senior,
    format($q$select public.decide_community_escalation(%L, true, 'address is real and current')$q$, e2));
  select payload into j from public.community_escalations where id = e2;
  perform pg_temp.counted('a subject ref is added', (j ? 'subject_ref')::int, 1);
  perform pg_temp.counted('and it is a hash, not the account', (j->>'subject_ref' ~ '^[0-9a-f]{64}$' and position(bo::text in j::text) = 0)::int, 1);
  perform pg_temp.said('it resolves only by recomputing against the case',
    j->>'subject_ref', private.role_audit_sha256('escalation:' || e2::text || ':' || bo::text));

  -- ── The delivery adapter's queue ──────────────────────────────────────
  select id into dv from public.community_escalation_deliveries where escalation_id = e2;
  perform pg_temp.expect_refused('nobody signed in marks a delivery failed', senior,
    format($q$select public.mark_escalation_failed(%L, 'http_500', false)$q$, dv));
  update public.community_programs set enabled = false where tenant_id = 'es-u' and program = 'institution_escalation';
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('with the switch off, an approved delivery is held', n, 0);
  select attempts into v from public.community_escalation_deliveries where id = dv;
  perform pg_temp.counted('and is not charged an attempt', v, 0);
  update public.community_programs set enabled = true where tenant_id = 'es-u' and program = 'institution_escalation';
  update public.community_escalation_policies set channel = 'webhook:somewhere_else' where tenant_id = 'es-u';
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('held too when the agreement now names another channel', n, 0);
  update public.community_escalation_policies set channel = 'secure-mail:dos', expires_on = current_date - 1 where tenant_id = 'es-u';
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('held too once the agreement has ended', n, 0);
  update public.community_escalation_policies set expires_on = null where tenant_id = 'es-u';
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('taken once the agreement matches again', n, 1);
  select attempts into v from public.community_escalation_deliveries where id = dv;
  perform pg_temp.counted('and each take counts as an attempt, which is what caps retries at five', v, 1);
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('a claimed delivery is not taken by an overlapping run', n, 0);
  perform public.mark_escalation_failed(dv, 'http_502', false);
  select count(*) into n from public.community_escalation_deliveries
   where id = dv and last_error = 'http_502' and claimed_until is null and next_attempt_at > now() + interval '3 minutes';
  perform pg_temp.counted('a failure releases the claim and backs off', n, 1);
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('and is not retried before its time', n, 0);
  perform public.mark_escalation_failed(dv, 'The receiver said: student Bo lives at 12 Elm', false);
  select last_error into t from public.community_escalation_deliveries where id = dv;
  perform pg_temp.said('an error that is not a code is stored as unknown, never as text', t, 'unknown');
  perform pg_temp.counted('a reviewer sees the error code and the next try', pg_temp.seen(rev,
    format('select last_error, next_attempt_at from public.community_escalation_deliveries where id = %L', dv)), 1);
  update public.community_escalation_deliveries set next_attempt_at = now() - interval '1 second' where id = dv;
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('its time come, it is taken again', n, 1);
  perform public.mark_escalation_failed(dv, 'payload_rejected', true);
  update public.community_escalation_deliveries set next_attempt_at = now() - interval '1 second' where id = dv;
  select count(*) into n from public.take_escalation_deliveries();
  perform pg_temp.counted('a final failure is never retried', n, 0);
  select attempts into v from public.community_escalation_deliveries where id = dv;
  perform pg_temp.counted('and reads as out of attempts', v, 5);

  -- Switched off, an approval already waiting stops.
  update public.community_escalation_policies set identity_required = false where tenant_id = 'es-u';
  delete from public.community_escalations where id = e;
  perform pg_temp.expect_allowed('a fresh request on the threat', rev,
    format($q$select public.request_community_escalation(%L, 'a second threat from the same account')$q$, k_threat));
  select id into e from public.community_escalations where case_id = k_threat and status = 'requested';
  update public.community_programs set enabled = false where tenant_id = 'es-u' and program = 'institution_escalation';
  perform pg_temp.expect_refused('switching the programme off stops an approval already waiting', rev2,
    format($q$select public.decide_community_escalation(%L, true, 'threat names a person and a place')$q$, e));
  perform pg_temp.expect_allowed('it can still be refused', rev2,
    format($q$select public.decide_community_escalation(%L, false, 'the programme has been switched off')$q$, e));
  select status into t from public.community_escalations where id = e;
  perform pg_temp.said('and says so', t, 'refused');

  -- ── Safety state: off writes nothing ──────────────────────────────────
  perform pg_temp.expect_allowed('with the programme off, a reviewer removes the spam', rev,
    format($q$select public.decide_community_case(%L, 'remove', 'spam.link')$q$, k_spam));
  select count(*) into n from public.community_safety_entries;
  perform pg_temp.counted('and no safety entry is written', n, 0);
  perform pg_temp.expect_refused('the reviewer cannot read safety state while it is off', rev,
    format($q$select public.case_author_safety(%L, 'repeat spam from this author')$q$, k_spam));

  insert into public.community_programs (tenant_id, program, enabled, approved_ref)
  values ('es-u', 'account_safety_state', true, 'check');
  perform pg_temp.expect_allowed('with it on, a reviewer removes the P3 post', rev,
    format($q$select public.decide_community_case(%L, 'remove', 'offtopic')$q$, k_minor));
  select count(*) into n from public.community_safety_entries where user_id = cy;
  perform pg_temp.counted('a P3 removal writes nothing', n, 0);
  perform pg_temp.expect_allowed('dee posts', dee, format($q$select public.create_community_post(%L, 'Post that is reported and allowed')$q$, grp));
  perform pg_temp.expect_allowed('amy reports it as a threat', amy,
    format($q$select public.report_community_post(%L, 'threat_or_safety_concern')$q$,
           (select id from public.community_posts where body = 'Post that is reported and allowed')));
  perform pg_temp.expect_allowed('a reviewer allows the P1 report', rev,
    format($q$select public.decide_community_case(%L, 'allow', 'no.violation')$q$,
           (select c.id from public.community_cases c join public.community_posts p on p.id = c.post_id
             where p.body = 'Post that is reported and allowed')));
  select count(*) into n from public.community_safety_entries where user_id = dee;
  perform pg_temp.counted('allowing, even at P1, writes nothing', n, 0);
  perform pg_temp.expect_allowed('a reviewer removes the threat', rev,
    format($q$select public.decide_community_case(%L, 'remove', 'threat.credible')$q$, k_threat));
  select delta into v from public.community_safety_entries where case_id = k_threat;
  perform pg_temp.counted('a P1 violation costs 20', v, -20);
  perform pg_temp.expect_allowed('a senior reviewer removes the doxxing', senior,
    format($q$select public.decide_community_case(%L, 'remove', 'privacy.dox')$q$, k_dox));
  select delta into v from public.community_safety_entries where case_id = k_dox;
  perform pg_temp.counted('a P0 violation costs 40', v, -40);
  select count(*) into n from public.community_safety_entries where user_id = bo and actor_sha256 = private.role_audit_sha256(rev::text);
  perform pg_temp.counted('entries carry who decided as a hash', n, 1);

  perform pg_temp.expect_refused('students cannot read safety entries', bo, 'select id from public.community_safety_entries');
  perform pg_temp.expect_refused('nor can reviewers read the table directly', rev, 'select id from public.community_safety_entries');
  perform pg_temp.expect_refused('nobody writes an entry directly', senior,
    format($q$insert into public.community_safety_entries (user_id, tenant_id, case_id, severity, delta, reason_code, actor_sha256)
              values (%L, 'es-u', %L, 'P0', -40, 'x', repeat('a', 64))$q$, amy, k_threat));
  perform pg_temp.expect_refused('nobody signed in calls the recorder', senior,
    format($q$select private.record_safety_outcome(k, 'remove', 'x', %L) from public.community_cases k where id = %L$q$, amy, k_threat));
  perform pg_temp.expect_refused('a student cannot read an author''s state', amy,
    format($q$select public.case_author_safety(%L, 'I want to know about him')$q$, k_threat));
  perform pg_temp.expect_refused('a reviewer must say why', rev,
    format($q$select public.case_author_safety(%L, 'why')$q$, k_threat));
  perform pg_temp.become(rev);
  v := public.case_author_safety(k_threat, 'deciding a second report on this author');
  execute 'reset role';
  perform pg_temp.counted('a reviewer reads 100 less both deductions', v, 40);
  select count(*) into n from public.community_case_events where case_id = k_threat and event = 'safety_state_read';
  perform pg_temp.counted('and the read is in the case history', n, 1);

  perform pg_temp.become(bo);
  t := public.my_community_standing();
  execute 'reset role';
  perform pg_temp.counted('the author is told in words, never the number', (t ~ '[0-9]')::int, 0);
  perform pg_temp.counted('that a past decision still counts', (t like 'A past decision%')::int, 1);
  perform pg_temp.become(amy);
  t := public.my_community_standing();
  execute 'reset role';
  perform pg_temp.said('somebody with no entries is in good standing', t, 'Your Community account is in good standing.');

  -- A granted appeal reverses the entry; it is kept, marked.
  perform pg_temp.expect_allowed('bo appeals the threat removal', bo, format('select public.appeal_community_decision(%L)', threat));
  perform pg_temp.expect_allowed('a reviewer who took no part grants it', rev2,
    format($q$select public.decide_community_appeal(%L, false, 'quoted lyrics, not a threat')$q$, k_threat));
  select count(*) into n from public.community_safety_entries where case_id = k_threat and reversed_at is not null;
  perform pg_temp.counted('the entry is reversed, not deleted', n, 1);
  perform pg_temp.become(rev);
  v := public.case_author_safety(k_dox, 'checking the reversal took effect');
  execute 'reset role';
  perform pg_temp.counted('and no longer counts', v, 60);

  -- Volunteers never write it.
  select count(*) into n from pg_proc where proname = 'volunteer_decide'
     and pg_get_functiondef(oid) like '%record_safety_outcome%';
  perform pg_temp.counted('the volunteer path never records safety outcomes', n, 0);

  -- The sweep forgets after a year.
  update public.community_safety_entries set created_at = now() - interval '13 months' where case_id = k_dox;
  update public.community_escalation_deliveries set delivered_at = now() - interval '100 days' where delivered_at is not null;
  perform private.sweep_community_retention();
  select count(*) into n from public.community_safety_entries where case_id = k_dox;
  perform pg_temp.counted('a year-old entry is swept', n, 0);
  select count(*) into n from public.community_safety_entries where case_id = k_threat;
  perform pg_temp.counted('a newer one stays', n, 1);
  select count(*) into n from public.community_escalation_deliveries where delivered_at is not null;
  perform pg_temp.counted('a delivery sent 90 days ago is swept', n, 0);
  perform pg_temp.become(bo);
  t := public.my_community_standing();
  execute 'reset role';
  perform pg_temp.said('with only a reversed entry left, bo is in good standing again', t, 'Your Community account is in good standing.');
end $$;


-- ── Escalation agreements, recorded by two people ────────────────────────
do $$
declare
  s1 uuid; s2 uuid; rev uuid; mgr uuid; stu uuid; n bigint; t text; b boolean;
  good text := $q$select public.save_escalation_agreement('ag-u', 'AG-DSA-2026-01',
    array['threat_or_safety_concern', 'private_information_or_doxxing'], false, 'webhook:ag_dos',
    'Dean of Students office', current_date + 365)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('ag-u', 'Agreement University', array['ag-u.example']);
  s1  := pg_temp.newuser('s1@ag.semester.example', null);
  s2  := pg_temp.newuser('s2@ag.semester.example', null);
  rev := pg_temp.newuser('rev@ag.semester.example', null);
  mgr := pg_temp.newuser('mgr@ag-u.example', 'ag-u');
  stu := pg_temp.newuser('stu@ag-u.example', 'ag-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (s1,  'trust_safety_senior',   'platform', '',     'platform'),
    (s2,  'trust_safety_senior',   'platform', '',     'platform'),
    (rev, 'trust_safety_reviewer', 'platform', '',     'platform'),
    (mgr, 'community_manager',     'school',   'ag-u', 'institution');

  perform pg_temp.counted('a senior reviewer may manage agreements', pg_temp.seen(s1,
    'select 1 where public.can_manage_escalation_agreements()'), 1);
  perform pg_temp.counted('a reviewer may not', pg_temp.seen(rev, 'select 1 where public.can_manage_escalation_agreements()'), 0);
  perform pg_temp.counted('nor the school''s own community manager', pg_temp.seen(mgr,
    'select 1 where public.can_manage_escalation_agreements()'), 0);

  perform pg_temp.expect_refused('a reviewer cannot record an agreement', rev, good);
  perform pg_temp.expect_refused('nor can the school''s community manager', mgr, good);
  perform pg_temp.expect_refused('nor a student', stu, good);
  perform pg_temp.expect_refused('nobody writes the row directly', s1,
    $q$update public.community_escalation_policies set enabled = true$q$);
  perform pg_temp.expect_refused('a channel that is an address is refused', s1, replace(good, 'webhook:ag_dos', 'https://x.example/in'));
  perform pg_temp.expect_refused('as is a channel the adapter cannot resolve', s1, replace(good, 'webhook:ag_dos', 'secure-mail:dos'));
  perform pg_temp.expect_refused('an agreement with no categories', s1,
    replace(good, $q$array['threat_or_safety_concern', 'private_information_or_doxxing']$q$, $q$array[]::text[]$q$));
  perform pg_temp.expect_refused('or an unknown one', s1,
    replace(good, $q$'private_information_or_doxxing'$q$, $q$'gossip'$q$));
  perform pg_temp.expect_refused('an agreement that has already ended', s1, replace(good, 'current_date + 365', 'current_date'));
  perform pg_temp.expect_refused('or runs past three years', s1, replace(good, 'current_date + 365', 'current_date + 1200'));
  perform pg_temp.expect_refused('or names no office at the school', s1, replace(good, 'Dean of Students office', ''));

  perform pg_temp.expect_allowed('a senior records a draft', s1, good);
  select enabled::text || '/' || (drafted_by_sha256 = private.role_audit_sha256(s1::text))::text into t
    from public.community_escalation_policies where tenant_id = 'ag-u';
  perform pg_temp.said('it is inactive, and attributed by hash', t, 'false/true');
  perform pg_temp.expect_refused('the person who drafted it cannot activate it', s1,
    $q$select public.activate_escalation_agreement('ag-u', 'read it against the signed copy')$q$);
  perform pg_temp.expect_refused('activation needs a written reason', s2,
    $q$select public.activate_escalation_agreement('ag-u', 'ok')$q$);
  perform pg_temp.expect_allowed('a second senior activates it', s2,
    $q$select public.activate_escalation_agreement('ag-u', 'read it against the signed copy')$q$);
  select enabled into b from public.community_escalation_policies where tenant_id = 'ag-u';
  perform pg_temp.counted('it is active', b::int, 1);
  perform pg_temp.expect_refused('an active agreement cannot be activated twice', s1,
    $q$select public.activate_escalation_agreement('ag-u', 'read it against the signed copy')$q$);

  -- Any edit is a new draft; the other person may then activate it.
  perform pg_temp.expect_allowed('the second senior edits the channel', s2, replace(good, 'webhook:ag_dos', 'webhook:ag_dos_v2'));
  select enabled::text || '/' || (activated_by_sha256 is null)::text into t
    from public.community_escalation_policies where tenant_id = 'ag-u';
  perform pg_temp.said('an edit leaves it inactive and clears who activated it', t, 'false/true');
  perform pg_temp.expect_refused('the editor cannot activate their own edit', s2,
    $q$select public.activate_escalation_agreement('ag-u', 'checked the new channel name')$q$);
  perform pg_temp.expect_allowed('the first senior can', s1,
    $q$select public.activate_escalation_agreement('ag-u', 'checked the new channel name')$q$);

  perform pg_temp.expect_refused('retiring needs a reason', s2, $q$select public.retire_escalation_agreement('ag-u', 'no')$q$);
  perform pg_temp.expect_refused('a reviewer cannot retire one', rev,
    $q$select public.retire_escalation_agreement('ag-u', 'the school ended the agreement')$q$);
  perform pg_temp.expect_allowed('one senior retires it alone', s1,
    $q$select public.retire_escalation_agreement('ag-u', 'the school ended the agreement')$q$);
  select enabled into b from public.community_escalation_policies where tenant_id = 'ag-u';
  perform pg_temp.counted('it is off', b::int, 0);
  perform pg_temp.expect_refused('there is nothing active left to retire', s2,
    $q$select public.retire_escalation_agreement('ag-u', 'the school ended the agreement')$q$);

  update public.community_escalation_policies set expires_on = current_date - 1 where tenant_id = 'ag-u';
  -- s1, who did not draft the current version: only the end date refuses them.
  perform pg_temp.expect_refused('an agreement past its end cannot be activated', s1,
    $q$select public.activate_escalation_agreement('ag-u', 'read it against the signed copy')$q$);

  select string_agg(event, ',' order by id) into t from public.community_escalation_agreement_events where tenant_id = 'ag-u';
  perform pg_temp.said('every change is in the history, in order', t, 'drafted,activated,drafted,activated,retired');
  select count(*) into n from public.community_escalation_agreement_events
   where tenant_id = 'ag-u' and actor_sha256 in (private.role_audit_sha256(s1::text), private.role_audit_sha256(s2::text));
  perform pg_temp.counted('attributed by hash, never by account', n, 5);
  perform pg_temp.counted('agreement staff read the history', pg_temp.seen(s2,
    'select 1 from public.community_escalation_agreement_events where tenant_id = ''ag-u'''), 5);
  perform pg_temp.counted('a reviewer does not', pg_temp.seen(rev, 'select 1 from public.community_escalation_agreement_events'), 0);
  perform pg_temp.counted('nor the school', pg_temp.seen(mgr, 'select 1 from public.community_escalation_agreement_events'), 0);
  perform pg_temp.counted('nor a student reads the agreement at all', pg_temp.seen(stu, 'select 1 from public.community_escalation_policies'), 0);
  perform pg_temp.counted('the screen never switches the school''s programme on', (select count(*) from public.community_programs where tenant_id = 'ag-u'), 0);
end $$;


-- ── Who is behind an alias: just-in-time, for one case ───────────────────
do $$
declare
  ana uuid; bo uuid; mgr uuid; r1 uuid; r2 uuid; r3 uuid;
  sup uuid; alias_post uuid; named_post uuid; k_alias uuid; k_named uuid; g uuid; g3 uuid;
  n bigint; t text; j jsonb; v text;
begin
  insert into public.schools (id, name, email_domains) values ('id-u', 'Identity University', array['id-u.example']);
  ana := pg_temp.newuser('quietana@id-u.example', 'id-u');
  bo  := pg_temp.newuser('bo@id-u.example', 'id-u');
  mgr := pg_temp.newuser('mgr@id-u.example', 'id-u');
  r1  := pg_temp.newuser('r1@id.semester.example', null);
  r2  := pg_temp.newuser('r2@id.semester.example', null);
  r3  := pg_temp.newuser('r3@id.semester.example', null);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mgr, 'community_manager',     'school',   'id-u', 'institution'),
    (r1,  'trust_safety_reviewer', 'platform', '',     'platform'),
    (r2,  'trust_safety_reviewer', 'platform', '',     'platform'),
    (r3,  'trust_safety_senior',   'platform', '',     'platform');
  insert into public.community_programs (tenant_id, program, enabled, approved_ref) values ('id-u', 'scoped_pseudonymity', true, 'check');
  perform pg_temp.expect_allowed('a manager starts a support community', mgr,
    $q$select public.create_community('support', 'ID support', 'Support', '')$q$);
  select id into sup from public.communities where name = 'ID support';
  perform pg_temp.expect_allowed('and approves pseudonyms there', mgr, format('select public.approve_community_pseudonymity(%L, true)', sup));
  perform pg_temp.expect_allowed('ana joins', ana, format('select public.join_community(%L)', sup));
  perform pg_temp.expect_allowed('bo joins', bo, format('select public.join_community(%L)', sup));
  perform pg_temp.expect_allowed('ana takes an alias', ana, format($q$select public.claim_community_alias(%L, 'Wanderer5')$q$, sup));
  perform pg_temp.expect_allowed('ana posts under it', ana, format($q$select public.create_community_post(%L, 'Alias post under review', false, true)$q$, sup));
  perform pg_temp.expect_allowed('and under her own name', ana, format($q$select public.create_community_post(%L, 'Named post under review')$q$, sup));
  select id into alias_post from public.community_posts where body = 'Alias post under review';
  select id into named_post from public.community_posts where body = 'Named post under review';
  perform pg_temp.expect_allowed('bo reports the alias post', bo, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, alias_post));
  perform pg_temp.expect_allowed('and the named one', bo, format($q$select public.report_community_post(%L, 'harassment_or_bullying')$q$, named_post));
  select id into k_alias from public.community_cases where post_id = alias_post;
  select id into k_named from public.community_cases where post_id = named_post;

  perform pg_temp.expect_refused('a student cannot ask', bo,
    format($q$select public.request_alias_identity(%L, 'I want to know who it is')$q$, k_alias));
  perform pg_temp.expect_refused('nor the community manager', mgr,
    format($q$select public.request_alias_identity(%L, 'I want to know who it is')$q$, k_alias));
  perform pg_temp.expect_refused('a named post has nothing to reveal', r1,
    format($q$select public.request_alias_identity(%L, 'pattern of harassment across posts')$q$, k_named));
  perform pg_temp.expect_refused('a request needs a reason', r1, format($q$select public.request_alias_identity(%L, 'who')$q$, k_alias));
  perform pg_temp.expect_allowed('a reviewer asks, with a reason', r1,
    format($q$select public.request_alias_identity(%L, 'pattern of harassment across posts')$q$, k_alias));
  select id into g from public.community_identity_grants where case_id = k_alias;
  perform pg_temp.expect_refused('not twice while one is waiting', r1,
    format($q$select public.request_alias_identity(%L, 'pattern of harassment across posts')$q$, k_alias));
  perform pg_temp.expect_refused('nothing is shown before approval', r1, format('select * from public.reveal_alias_identity(%L)', g));
  perform pg_temp.expect_refused('the reviewer who asked cannot approve', r1,
    format($q$select public.decide_alias_identity(%L, true, 'approving my own request')$q$, g));
  perform pg_temp.expect_refused('a student cannot approve it', bo,
    format($q$select public.decide_alias_identity(%L, true, 'looks fine to me honestly')$q$, g));
  perform pg_temp.expect_refused('nor can the school''s manager', mgr,
    format($q$select public.decide_alias_identity(%L, true, 'looks fine to me honestly')$q$, g));
  perform pg_temp.expect_refused('an approval needs its own reason', r2, format($q$select public.decide_alias_identity(%L, true, 'ok')$q$, g));
  perform pg_temp.counted('students read no grants', pg_temp.seen(bo, 'select id from public.community_identity_grants'), 0);
  perform pg_temp.counted('nor does the school', pg_temp.seen(mgr, 'select id from public.community_identity_grants'), 0);
  perform pg_temp.expect_allowed('a second reviewer approves', r2,
    format($q$select public.decide_alias_identity(%L, true, 'repeat reports from three members')$q$, g));
  select count(*) into n from public.community_identity_grants
   where id = g and expires_at between now() + interval '3 hours 59 minutes' and now() + interval '4 hours 1 minute';
  perform pg_temp.counted('the grant lasts four hours', n, 1);
  perform pg_temp.expect_refused('the approver cannot use it', r2, format('select * from public.reveal_alias_identity(%L)', g));
  perform pg_temp.expect_refused('nor can a senior who took no part', r3, format('select * from public.reveal_alias_identity(%L)', g));

  perform pg_temp.become(r1);
  select handle, vault_ref, other_cases into t, v, j from public.reveal_alias_identity(g);
  execute 'reset role';
  perform pg_temp.said('the grantee sees the account''s handle', t, 'quietana');
  perform pg_temp.counted('an opaque vault reference, not an id', (v ~ '^[0-9a-f]{64}$' and position(ana::text in v) = 0)::int, 1);
  perform pg_temp.said('the same one every time for this account', v, private.role_audit_sha256('vault:' || ana::text));
  perform pg_temp.counted('and the account''s other cases, not this one', jsonb_array_length(j), 1);
  perform pg_temp.said('including one under her own name', j->0->>'case_id', k_named::text);
  perform pg_temp.counted('never an email or an account id', (position('id-u.example' in t || v || j::text) + position(ana::text in t || v || j::text))::bigint, 0);

  select string_agg(event, ',' order by occurred_at, id) into t from public.community_case_events
   where case_id = k_alias and event like 'identity_%';
  perform pg_temp.said('the request, the approval and the look are all in the case history', t,
    'identity_requested,identity_approved,identity_revealed');

  update public.community_identity_grants set expires_at = now() - interval '1 second' where id = g;
  perform pg_temp.expect_refused('an expired grant shows nothing', r1, format('select * from public.reveal_alias_identity(%L)', g));
  perform pg_temp.expect_allowed('once it has expired, the reviewer may ask again', r1,
    format($q$select public.request_alias_identity(%L, 'second look after a new report')$q$, k_alias));

  perform pg_temp.expect_allowed('another reviewer asks', r3,
    format($q$select public.request_alias_identity(%L, 'checking for a linked account')$q$, k_alias));
  select id into g3 from public.community_identity_grants where case_id = k_alias and grantee_sha256 = private.role_audit_sha256(r3::text);
  perform pg_temp.expect_allowed('and is refused', r2,
    format($q$select public.decide_alias_identity(%L, false, 'not needed for this decision')$q$, g3));
  perform pg_temp.expect_refused('a refused grant shows nothing', r3, format('select * from public.reveal_alias_identity(%L)', g3));

  update public.community_cases set status = 'closed' where id = k_alias;
  perform pg_temp.expect_refused('a closed case cannot be asked about', r2,
    format($q$select public.request_alias_identity(%L, 'pattern of harassment across posts')$q$, k_alias));
end $$;


-- ── Images, held until scanned ───────────────────────────────────────────
create or replace function pg_temp.fails(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.verdict(kind text, sha text, phash text, known text,
                                           meta boolean default false, label text default null, conf numeric default null)
returns jsonb language sql as $$
  select jsonb_build_object('detected_kind', kind, 'bytes', 200000, 'width', 800, 'height', 600,
                            'sha256', sha, 'phash', phash, 'metadata_found', meta, 'known_abuse', known,
                            'classifier', case when label is null then null
                                               else jsonb_build_object('label', label, 'confidence', conf) end,
                            'scan_version', 'media-scan-check')
$$;

-- Reserve, upload as the reserving account, and post. Returns the post.
create or replace function pg_temp.image_post(who uuid, community uuid, body text, kind text default 'jpeg')
returns uuid language plpgsql as $$
declare mid uuid; path text; pid uuid;
begin
  perform pg_temp.become(who);
  select media_id, object_path into mid, path from public.begin_community_image(community, kind, 'A photo for the check');
  insert into storage.objects (bucket_id, name, owner) values ('community-media', path, who);
  pid := public.create_community_post(community, body, false, false, mid);
  execute 'reset role';
  return pid;
end $$;

do $$
declare
  ann uuid; ben uuid; cal uuid; eve uuid; mgr uuid; rev uuid; rev2 uuid;
  crs uuid; sup uuid; mid uuid; mid2 uuid; path text; pid uuid; k uuid; n bigint; t text; b boolean;
  near_ph text := 'f0f0f0f0f0f0f0f7'; far_ph text := '0f0f0f0f0f0f0f0f';
begin
  insert into public.schools (id, name, email_domains) values ('md-u', 'Media University', array['md-u.example']),
                                                              ('md-other', 'Other Media U', array['md-other.example']);
  ann := pg_temp.newuser('ann@md-u.example', 'md-u');
  ben := pg_temp.newuser('ben@md-u.example', 'md-u');
  cal := pg_temp.newuser('cal@md-u.example', 'md-u');
  eve := pg_temp.newuser('eve@md-other.example', 'md-other');
  mgr := pg_temp.newuser('mgr@md-u.example', 'md-u');
  rev := pg_temp.newuser('rev@md.semester.example', null);
  rev2 := pg_temp.newuser('rev2@md.semester.example', null);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mgr, 'community_manager', 'school', 'md-u', 'institution'),
    (rev, 'trust_safety_reviewer', 'platform', '', 'platform'),
    (rev2, 'trust_safety_reviewer', 'platform', '', 'platform');
  perform pg_temp.expect_allowed('a manager starts a course community', mgr,
    $q$select public.create_community('course', 'MD 101', 'Course', '')$q$);
  perform pg_temp.expect_allowed('and a support community', mgr,
    $q$select public.create_community('support', 'MD support', 'Support', '')$q$);
  select id into crs from public.communities where name = 'MD 101';
  select id into sup from public.communities where name = 'MD support';
  perform pg_temp.expect_allowed('ann joins the course', ann, format('select public.join_community(%L)', crs));
  perform pg_temp.expect_allowed('ben joins it', ben, format('select public.join_community(%L)', crs));
  perform pg_temp.expect_allowed('ann joins the support community', ann, format('select public.join_community(%L)', sup));

  -- Off until the school switches it on.
  perform pg_temp.expect_refused('no image while the school has images off', ann,
    format($q$select * from public.begin_community_image(%L, 'jpeg', 'a photo')$q$, crs));
  insert into public.community_programs (tenant_id, program, enabled, approved_ref) values ('md-u', 'image_posts', true, 'check');
  perform pg_temp.expect_refused('not in a support community', ann,
    format($q$select * from public.begin_community_image(%L, 'jpeg', 'a photo')$q$, sup));
  perform pg_temp.expect_refused('not for somebody outside the community', cal,
    format($q$select * from public.begin_community_image(%L, 'jpeg', 'a photo')$q$, crs));
  perform pg_temp.expect_refused('an image needs a description', ann,
    format($q$select * from public.begin_community_image(%L, 'jpeg', '  ')$q$, crs));
  perform pg_temp.expect_refused('JPEG, PNG or WebP only', ann,
    format($q$select * from public.begin_community_image(%L, 'gif', 'a photo')$q$, crs));

  perform pg_temp.become(ann);
  select media_id, object_path into mid, path from public.begin_community_image(crs, 'jpeg', 'a photo');
  execute 'reset role';
  perform pg_temp.said('the path is a random name, never the account', path, 'media/' || mid::text);
  perform pg_temp.counted('with no account id in it', position(ann::text in path)::bigint, 0);

  -- Storage: only the reserving account uploads, only to its reserved path, and never replaces it.
  perform pg_temp.expect_refused('ben cannot upload to ann''s reservation', ben,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('community-media', %L, %L)$q$, path, ben));
  perform pg_temp.expect_refused('ann cannot upload to a path she did not reserve', ann,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('community-media', 'media/%s', %L)$q$, gen_random_uuid(), ann));
  perform pg_temp.become(ann);
  select media_id into mid2 from public.begin_community_image(crs, 'jpeg', 'a photo');
  execute 'reset role';
  perform pg_temp.expect_refused('a reservation with nothing uploaded cannot be posted', ann,
    format($q$select public.create_community_post(%L, 'nothing here yet', false, false, %L)$q$, crs, mid2));
  perform pg_temp.expect_allowed('ann uploads to her reservation', ann,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('community-media', %L, %L)$q$, path, ann));
  perform pg_temp.expect_refused('and cannot replace it', ann,
    format($q$update storage.objects set metadata = '{"x":1}' where name = %L$q$, path));
  perform pg_temp.expect_refused('or delete it', ann, format('delete from storage.objects where name = %L', path));
  perform pg_temp.expect_refused('ben cannot post ann''s image', ben,
    format($q$select public.create_community_post(%L, 'mine now', false, false, %L)$q$, crs, mid));
  perform pg_temp.expect_allowed('ann posts it', ann,
    format($q$select public.create_community_post(%L, 'Our lab setup', false, false, %L)$q$, crs, mid));
  select post_id into pid from public.community_media where id = mid;
  select status into t from public.community_posts where id = pid;
  perform pg_temp.said('the post waits for the scan', t, 'pending');
  perform pg_temp.counted('members cannot see it yet', pg_temp.seen(ben, format('select 1 from public.community_posts where id = %L', pid)), 0);
  perform pg_temp.counted('nor its image', pg_temp.seen(ben, format('select 1 from storage.objects where name = %L', path)), 0);
  perform pg_temp.counted('its author can', pg_temp.seen(ann, format('select 1 from storage.objects where name = %L', path)), 1);
  perform pg_temp.counted('and a reviewer can', pg_temp.seen(rev, format('select 1 from storage.objects where name = %L', path)), 1);
  perform pg_temp.expect_refused('nobody reads who uploaded an image', rev, 'select uploader_id from public.community_media');
  perform pg_temp.expect_refused('or its hashes', rev, 'select sha256, phash from public.community_media');

  -- The scanner is the service role's.
  perform pg_temp.expect_refused('nobody signed in takes scans', rev, 'select * from public.take_media_scans()');
  perform pg_temp.expect_refused('or records one', rev,
    format('select public.record_media_scan(%L, %L::jsonb)', mid, pg_temp.verdict('jpeg', repeat('a', 64), 'f0f0f0f0f0f0f0f0', 'clear')));
  select count(*) into n from public.take_media_scans();
  perform pg_temp.counted('the scanner takes the waiting image', n, 1);
  select count(*) into n from public.take_media_scans();
  perform pg_temp.counted('and an overlapping run does not take it again', n, 0);
  perform pg_temp.counted('nothing is decided without a known-abuse check',
    pg_temp.fails(format('select public.record_media_scan(%L, %L::jsonb)', mid,
      pg_temp.verdict('jpeg', repeat('a', 64), 'f0f0f0f0f0f0f0f0', 'not_checked')))::int, 1);
  perform pg_temp.counted('or without both hashes',
    pg_temp.fails(format('select public.record_media_scan(%L, %L::jsonb)', mid,
      pg_temp.verdict('jpeg', repeat('a', 64), null, 'clear')))::int, 1);
  perform pg_temp.said('a clean image clears',
    public.record_media_scan(mid, pg_temp.verdict('jpeg', repeat('a', 64), 'f0f0f0f0f0f0f0f0', 'clear')), 'clear');
  select status into t from public.community_posts where id = pid;
  perform pg_temp.said('and the post publishes', t, 'published');
  perform pg_temp.counted('members now see the image', pg_temp.seen(ben, format('select 1 from storage.objects where name = %L', path)), 1);
  perform pg_temp.counted('somebody outside the community does not', pg_temp.seen(cal, format('select 1 from storage.objects where name = %L', path)), 0);
  perform pg_temp.counted('nor another school', pg_temp.seen(eve, format('select 1 from storage.objects where name = %L', path)), 0);

  -- Rejections.
  pid := pg_temp.image_post(ann, crs, 'Metadata left on');
  select id into mid from public.community_media where post_id = pid;
  perform public.take_media_scans();
  perform pg_temp.said('leftover metadata is rejected',
    public.record_media_scan(mid, pg_temp.verdict('jpeg', repeat('b', 64), '1111111111111111', 'clear', true)), 'rejected');
  select status into t from public.community_posts where id = pid;
  perform pg_temp.said('and the post is withdrawn', t, 'withdrawn');
  select count(*) into n from public.community_media_deletions d join public.community_media m on m.object_path = d.object_path where m.id = mid;
  perform pg_temp.counted('and the file is queued for deletion', n, 1);
  -- Once the rejected file is gone, nothing new can be put at its path.
  delete from storage.objects where name = (select object_path from public.community_media where id = mid);
  perform pg_temp.expect_refused('a decided image''s path cannot be uploaded to again', ann,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('community-media', %L, %L)$q$,
           (select object_path from public.community_media where id = mid), ann));
  pid := pg_temp.image_post(ann, crs, 'Not what it says');
  select id into mid from public.community_media where post_id = pid;
  perform public.take_media_scans();
  perform pg_temp.said('a file that is not what it was declared as is rejected',
    public.record_media_scan(mid, pg_temp.verdict('png', repeat('c', 64), '2222222222222222', 'clear')), 'rejected');

  -- Removal remembers the image; a near copy is held.
  select post_id into pid from public.community_media where sha256 = repeat('a', 64);
  perform pg_temp.expect_allowed('ben reports the image post', ben, format($q$select public.report_community_post(%L, 'other')$q$, pid));
  select id into k from public.community_cases where post_id = pid;
  perform pg_temp.expect_allowed('a reviewer removes it', rev, format($q$select public.decide_community_case(%L, 'remove', 'offtopic.image')$q$, k));
  select count(*) into n from public.community_media_blocklist where sha256 = repeat('a', 64) and tenant_id = 'md-u';
  perform pg_temp.counted('its hashes go on the school''s blocklist', n, 1);
  perform pg_temp.counted('members can no longer fetch it', pg_temp.seen(ben,
    format('select 1 from storage.objects where name = %L', 'media/' || (select id from public.community_media where post_id = pid)::text)), 0);
  perform pg_temp.counted('students cannot read the blocklist', pg_temp.seen(ann, 'select 1 from public.community_media_blocklist'), 0);

  pid := pg_temp.image_post(ann, crs, 'Posting it again, slightly cropped');
  select id into mid from public.community_media where post_id = pid;
  perform public.take_media_scans();
  perform pg_temp.said('a near copy of a removed image is held',
    public.record_media_scan(mid, pg_temp.verdict('jpeg', repeat('d', 64), near_ph, 'clear')), 'held');
  select c.route || '/' || s.rule_id into t from public.community_cases c join public.community_signals s on s.case_id = c.id
   where c.post_id = pid and s.detector = 'media_safety';
  perform pg_temp.said('with a case and a media-safety signal', t, 'standard/media.reupload-of-removed');
  select status into t from public.community_posts where id = pid;
  perform pg_temp.said('and the post held', t, 'held');
  pid := pg_temp.image_post(ann, crs, 'A different picture');
  select id into mid from public.community_media where post_id = pid;
  perform public.take_media_scans();
  perform pg_temp.said('a different image clears', public.record_media_scan(mid, pg_temp.verdict('jpeg', repeat('e', 64), far_ph, 'clear')), 'clear');

  -- A classifier's warning is held for a person.
  pid := pg_temp.image_post(ann, crs, 'Rough week');
  select id into mid from public.community_media where post_id = pid;
  perform public.take_media_scans();
  perform pg_temp.said('a confident self-harm label is held',
    public.record_media_scan(mid, pg_temp.verdict('jpeg', repeat('9', 64), '3333333333333333', 'clear', false, 'self_harm', 0.91)), 'held');
  select severity into t from public.community_cases where post_id = pid;
  perform pg_temp.said('as a P1 safety case', t, 'P1');
  select id into k from public.community_cases where post_id = pid;
  perform pg_temp.expect_allowed('a reviewer decides it is fine', rev,
    format($q$select public.decide_community_case(%L, 'allow', 'art.project.context')$q$, k));
  select p.status || '/' || m.status into t from public.community_posts p join public.community_media m on m.post_id = p.id where p.id = pid;
  perform pg_temp.said('which puts the post and its image back up', t, 'published/clear');
  perform pg_temp.counted('so members see the image', pg_temp.seen(ben,
    format('select 1 from storage.objects where name = %L', 'media/' || mid::text)), 1);
  -- The read rule itself: a published post does not show an image that is not clear.
  update public.community_media set status = 'held' where id = mid;
  perform pg_temp.counted('an image not clear stays unseen, even on a published post', pg_temp.seen(ben,
    format('select 1 from storage.objects where name = %L', 'media/' || mid::text)), 0);
  update public.community_media set status = 'clear' where id = mid;

  -- A known-abuse match: held, P0, and never shown to anybody.
  pid := pg_temp.image_post(ann, crs, 'Match');
  select id, object_path into mid, path from public.community_media where post_id = pid;
  perform public.take_media_scans();
  perform pg_temp.said('a known-abuse match is held', public.record_media_scan(mid, pg_temp.verdict('jpeg', repeat('f', 64), '4444444444444444', 'match')), 'held');
  select severity || '/' || route || '/' || category into t from public.community_cases where post_id = pid;
  perform pg_temp.said('as an urgent P0 case', t, 'P0/professional_urgent/nonconsensual_media');
  perform pg_temp.counted('the reviewer cannot open the file', pg_temp.seen(rev, format('select 1 from storage.objects where name = %L', path)), 0);
  perform pg_temp.counted('nor can the person who posted it', pg_temp.seen(ann, format('select 1 from storage.objects where name = %L', path)), 0);
  perform pg_temp.counted('the reviewer is told why', pg_temp.seen(rev,
    format('select 1 from public.community_media where id = %L and known_abuse_match', mid)), 1);
  select count(*) into n from public.community_media_deletions where object_path = path;
  perform pg_temp.counted('it is not queued for deletion', n, 0);
  select id into k from public.community_cases where post_id = pid;
  perform pg_temp.expect_refused('it cannot be allowed', rev, format($q$select public.decide_community_case(%L, 'allow', 'looks fine')$q$, k));
  perform pg_temp.expect_refused('or preserved and put back up', rev,
    format($q$select public.decide_community_case(%L, 'preserve_evidence', 'keep it')$q$, k));
  perform pg_temp.expect_allowed('only removed', rev, format($q$select public.decide_community_case(%L, 'remove', 'known.abuse')$q$, k));
  perform pg_temp.expect_allowed('ann appeals', ann, format('select public.appeal_community_decision(%L)', pid));
  perform pg_temp.expect_refused('and the appeal cannot be granted', rev2,
    format($q$select public.decide_community_appeal(%L, false, 'overturning this')$q$, k));
  select status into t from public.community_posts where id = pid;
  perform pg_temp.said('the post stays down', t, 'removed');
  update public.community_cases set status = 'decided', retain_until = now() - interval '1 day' where post_id = pid;
  perform private.sweep_community_retention();
  select count(*) into n from public.community_cases where post_id = pid;
  perform pg_temp.counted('and the sweep keeps its case', n, 1);

  -- Evidence outlives the account and the post; nothing else does.
  delete from public.community_posts where id = pid;
  select count(*) into n from public.community_media where id = mid and known_abuse_match and post_id is null;
  perform pg_temp.counted('a known-abuse match survives its post being deleted', n, 1);
  perform private.sweep_community_retention();
  select count(*) into n from public.community_media where id = mid;
  perform pg_temp.counted('and the sweep leaves it', n, 1);
  pid := pg_temp.image_post(ann, crs, 'Ordinary, then deleted');
  select id, object_path into mid2, path from public.community_media where post_id = pid;
  delete from public.community_posts where id = pid;
  perform private.sweep_community_retention();
  select count(*) into n from public.community_media where id = mid2;
  perform pg_temp.counted('an ordinary image goes once its post is gone', n, 0);
  select count(*) into n from public.community_media_deletions where object_path = path;
  perform pg_temp.counted('and its file is queued for deletion', n, 1);

  -- A granted appeal restores the image and lifts its blocklist entry.
  select post_id into pid from public.community_media where sha256 = repeat('a', 64);
  select id into k from public.community_cases where post_id = pid;
  perform pg_temp.expect_allowed('ann appeals the removal', ann, format('select public.appeal_community_decision(%L)', pid));
  perform pg_temp.expect_allowed('another reviewer grants it', rev2,
    format($q$select public.decide_community_appeal(%L, false, 'on topic for the lab')$q$, k));
  select status into t from public.community_media where post_id = pid;
  perform pg_temp.said('the image is clear again', t, 'clear');
  select count(*) into n from public.community_media_blocklist where sha256 = repeat('a', 64);
  perform pg_temp.counted('and off the blocklist', n, 0);

  -- Switched off, waiting images are held, not scanned.
  pid := pg_temp.image_post(ann, crs, 'Waiting');
  update public.community_programs set enabled = false where tenant_id = 'md-u' and program = 'image_posts';
  select count(*) into n from public.take_media_scans();
  perform pg_temp.counted('with images switched off, nothing is scanned', n, 0);
  perform pg_temp.expect_refused('and nothing new is reserved', ann,
    format($q$select * from public.begin_community_image(%L, 'jpeg', 'a photo')$q$, crs));

  -- Clean-up is the service role's.
  perform pg_temp.expect_refused('nobody signed in reads the deletion queue', rev, 'select * from public.community_media_deletions');
  perform pg_temp.expect_refused('or takes from it', rev, 'select * from public.take_media_deletions()');
  select count(*) into n from public.take_media_deletions();
  perform pg_temp.counted('the service role takes what is queued', (n >= 2)::int, 1);
  perform public.mark_media_deleted(array(select public.take_media_deletions()));
  select count(*) into n from public.community_media_deletions;
  perform pg_temp.counted('and clears it once deleted', n, 0);
  update public.community_programs set enabled = true where tenant_id = 'md-u' and program = 'image_posts';
  perform pg_temp.become(ann);
  select media_id into mid2 from public.begin_community_image(crs, 'jpeg', 'a photo');
  execute 'reset role';
  update public.community_media set created_at = now() - interval '2 days' where id = mid2;
  perform private.sweep_community_retention();
  select count(*) into n from public.community_media where id = mid2;
  perform pg_temp.counted('a reservation never posted lapses', n, 0);
  -- Leaving takes their images with them, except what a case is keeping.
  pid := pg_temp.image_post(ann, crs, 'Here until I leave');
  perform pg_temp.expect_allowed('ann forgets her Community data', ann, 'select public.forget_my_community()');
  select count(*) into n from public.community_media m where m.uploader_id = ann
     and not exists (select 1 from public.community_cases k where k.post_id = m.post_id) and not m.known_abuse_match;
  perform pg_temp.counted('her images are gone at once', n, 0);
  select count(*) into n from public.community_media where known_abuse_match;
  perform pg_temp.counted('a known-abuse match is kept', n, 1);
  -- An account whose only trace is an image is not an untouched one.
  k := pg_temp.newuser('dan@md-u.example', 'md-u');
  perform pg_temp.counted('a fresh account reads as untouched', public.lti_account_untouched(k)::int, 1);
  insert into public.community_media (tenant_id, community_id, uploader_id, declared_kind, alt_text)
  values ('md-u', crs, k, 'jpeg', 'a photo');
  perform pg_temp.counted('an image of its own makes it touched', public.lti_account_untouched(k)::int, 0);
end $$;

rollback;
