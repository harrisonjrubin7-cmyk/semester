-- supabase/admissions.check.sql — who configures a cycle, what an applicant may
-- do, and that a person decides every admission.
--
-- For 20261001060000_admissions.sql. One school, ad-u: an officer, three
-- directors (one of whom also applies), four applicants and a member with no
-- role, plus a director of another school. What it proves:
--
--   * nothing is written unless the school runs `admissions` in Core;
--   * only `admissions:configure` writes a cycle; opening it freezes its questions;
--   * an applicant starts one application per cycle, in the window, and reads and
--     writes only their own; a submitted application is frozen to everyone;
--   * a decision needs a review by someone other than the decider, every required
--     document received or waived, and is never on the decider's own application,
--     never rewritten and never changed after release;
--   * a decision is private until a director releases the cycle's decisions;
--     reviews are never the applicant's; only an admit is answered, once;
--   * a deposit follows an acceptance, once; yield is counts only;
--   * deleting the applicant takes their application; deleting staff keeps the record.
--
--   How to run it: supabase/check.sh admissions

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
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
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
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not ilike '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.ask(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
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

-- A ledger entry, written directly (the ledger's own path has its own suite).
create or replace function pg_temp.entry(school text, who text, kind text, subject text, val text, ago integer default 30)
returns void language plpgsql as $$
declare ch uuid := gen_random_uuid();
begin
  set local session_replication_role = replica;
  insert into public.academic_record_entries
    (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, change_id, override)
  values (school, who, kind, subject, 'set', val, current_date - ago, 'seed for the check', 'registrar', ch, false);
  set local session_replication_role = origin;
end $$;

do $$
declare
  officer uuid; director uuid; director2 uuid; dapp uuid; ana uuid; ben uuid; bob uuid; stranger uuid; outsider uuid;
  cyc uuid; cyc2 uuid; appa uuid; appb uuid; appd uuid; appc uuid; r jsonb; r2 jsonb; n bigint;
  questions constant text := '[{"key":"essay","label":"Why this school","kind":"text","required":true},{"key":"major","label":"Intended major","kind":"choice","required":false,"options":["Econ","History"]}]';
  checklist constant text := '[{"key":"transcript","label":"Secondary transcript","required":true},{"key":"recs","label":"Recommendation","required":false}]';
  save_sql constant text := $q$select public.admissions_cycle_save('Fall 2027 first year', '2027FA', now() - interval '1 day', now() + interval '30 days', %L::jsonb, %L::jsonb, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('ad-u', 'Admissions University', array['ad-u.example']), ('ad-other', 'Other University', array['ad-other.example']);
  officer   := pg_temp.newuser('officer@ad-u.example', 'ad-u');
  director  := pg_temp.newuser('director@ad-u.example', 'ad-u');
  director2 := pg_temp.newuser('director2@ad-u.example', 'ad-u');
  dapp      := pg_temp.newuser('dapp@ad-u.example', 'ad-u');
  ana       := pg_temp.newuser('ana@ad-u.example', 'ad-u');
  ben       := pg_temp.newuser('ben@ad-u.example', 'ad-u');
  bob       := pg_temp.newuser('bob@ad-u.example', 'ad-u');
  stranger  := pg_temp.newuser('stranger@ad-u.example', 'ad-u');
  outsider  := pg_temp.newuser('outsider@ad-other.example', 'ad-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (officer,   'admissions_officer',  'school', 'ad-u', 'institution'),
    (director,  'admissions_director', 'school', 'ad-u', 'institution'),
    (director2, 'admissions_director', 'school', 'ad-u', 'institution'),
    (dapp,      'admissions_director', 'school', 'ad-u', 'institution'),
    (outsider,  'admissions_director', 'school', 'ad-other', 'institution');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('configuring a cycle while the school is in Connect', officer, format(save_sql, questions, checklist, 'cycle-connect-key'), 'does not run admissions in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('ad-u', 'admissions', 'core', false, 'check');

  -- ── Configuring a cycle ────────────────────────────────────────
  perform pg_temp.refused_for('an applicant configuring a cycle', ana, format(save_sql, questions, checklist, 'cycle-ana-key01'), 'that needs admissions:configure');
  perform pg_temp.refused_for('a director of another school, whose school does not run admissions, configuring', outsider, format(save_sql, questions, checklist, 'cycle-out-key01'), 'does not run admissions in Core');
  perform pg_temp.refused_for('a question with no kind', officer, format(save_sql, '[{"key":"x","label":"X"}]', checklist, 'cycle-badq-key1'), 'text or choice');
  perform pg_temp.refused_for('a checklist item with a bad key', officer, format(save_sql, questions, '[{"key":"Bad Key","label":"X"}]', 'cycle-badc-key1'), 'checklist item has a key');
  r := pg_temp.ask(officer, format(save_sql, questions, checklist, 'cycle-good-key01'))::jsonb;
  cyc := (r->>'id')::uuid;
  r2 := pg_temp.ask(officer, format(save_sql, questions, checklist, 'cycle-good-key01'))::jsonb;
  perform pg_temp.said('the same key answers the same cycle', r2->>'id', r->>'id');
  perform pg_temp.counted('and wrote one', (select count(*) from public.admission_cycles), 1);

  perform pg_temp.refused_for('applying before the cycle opens', ana, format($q$select public.application_start(%L, 'start-early-key1')$q$, cyc), 'not open for applications');
  perform pg_temp.refused_for('an applicant opening a cycle', ana, format($q$select public.admissions_cycle_open(%L, 'open-ana-key001')$q$, cyc), 'that needs admissions:configure');
  perform pg_temp.works('the officer opening it', officer, format($q$select public.admissions_cycle_open(%L, 'open-off-key001')$q$, cyc));
  perform pg_temp.refused_for('opening it twice', officer, format($q$select public.admissions_cycle_open(%L, 'open-off-key002')$q$, cyc), 'already open');
  begin
    update public.admission_cycles set questions = '[]'::jsonb where id = cyc;
    raise exception 'FAILED: an open cycle''s questions were changed';
  exception when insufficient_privilege then
    raise notice 'ok  a cycle''s questions are fixed once it is opened (%)', sqlerrm;
  end;

  -- ── Starting and saving ────────────────────────────────────────
  r := pg_temp.ask(ana, format($q$select public.application_start(%L, 'start-ana-key001')$q$, cyc))::jsonb;
  appa := (r->>'id')::uuid;
  r2 := pg_temp.ask(ana, format($q$select public.application_start(%L, 'start-ana-key001')$q$, cyc))::jsonb;
  perform pg_temp.said('the same key answers the same application', r2->>'id', r->>'id');
  perform pg_temp.refused_for('starting a second application to the same cycle', ana, format($q$select public.application_start(%L, 'start-ana-key002')$q$, cyc), 'already started');
  appb := (pg_temp.ask(ben, format($q$select public.application_start(%L, 'start-ben-key001')$q$, cyc))::jsonb->>'id')::uuid;
  appd := (pg_temp.ask(dapp, format($q$select public.application_start(%L, 'start-dapp-key01')$q$, cyc))::jsonb->>'id')::uuid;
  appc := (pg_temp.ask(bob, format($q$select public.application_start(%L, 'start-bob-key001')$q$, cyc))::jsonb->>'id')::uuid;
  perform pg_temp.refused_for('a signed-out caller starting one', stranger, 'set local role anon; select public.application_start(gen_random_uuid(), ''start-anon-key01'')', 'permission denied');
  execute 'reset role';

  perform pg_temp.counted('Ana reads her own application only', pg_temp.seen(ana, 'select 1 from public.applications'), 1);
  perform pg_temp.counted('Ben reads his own', pg_temp.seen(ben, 'select 1 from public.applications'), 1);
  perform pg_temp.counted('a member with no role reads none', pg_temp.seen(stranger, 'select 1 from public.applications'), 0);
  perform pg_temp.counted('a director of another school reads none', pg_temp.seen(outsider, 'select 1 from public.applications'), 0);
  perform pg_temp.counted('the officer reads all four', pg_temp.seen(officer, 'select 1 from public.applications'), 4);
  perform pg_temp.counted('Ana reads the cycle she applied to', pg_temp.seen(ana, 'select 1 from public.admission_cycles'), 1);
  perform pg_temp.counted('a member who has not applied reads no cycle', pg_temp.seen(stranger, 'select 1 from public.admission_cycles'), 0);

  perform pg_temp.refused_for('saving someone else''s application', ben, format($q$select public.application_save(%L, '{"essay":"hi"}'::jsonb)$q$, appa), 'no such application');
  perform pg_temp.refused_for('submitting with a required answer missing', ana, format($q$select public.application_submit(%L, 'submit-ana-key01')$q$, appa), 'Why this school');
  perform pg_temp.works('saving answers', ana, format($q$select public.application_save(%L, '{"essay":"I want to study economics here.","major":"Econ","extra":"dropped"}'::jsonb)$q$, appa));
  perform pg_temp.said('only the cycle''s own questions are kept', (select (answers ? 'extra')::text from public.applications where id = appa), 'false');
  perform pg_temp.works('submitting', ana, format($q$select public.application_submit(%L, 'submit-ana-key02')$q$, appa));
  perform pg_temp.refused_for('saving a submitted application', ana, format($q$select public.application_save(%L, '{"essay":"changed"}'::jsonb)$q$, appa), 'frozen');
  begin
    update public.applications set answers = '{}'::jsonb where id = appa;
    raise exception 'FAILED: a submitted application was edited';
  exception when insufficient_privilege then
    raise notice 'ok  a submitted application is frozen even to the owner of the data (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('a client updating an application directly', ana, format($q$update public.applications set answers = '{}'::jsonb where id = %L$q$, appa), 'permission denied');
  perform pg_temp.works('Ben saving and submitting', ben, format($q$select public.application_save(%L, '{"essay":"Because."}'::jsonb)$q$, appb));
  perform pg_temp.works('Ben submitting', ben, format($q$select public.application_submit(%L, 'submit-ben-key01')$q$, appb));
  perform pg_temp.works('the director-applicant saving', dapp, format($q$select public.application_save(%L, '{"essay":"A director who also applies."}'::jsonb)$q$, appd));
  perform pg_temp.works('the director-applicant submitting', dapp, format($q$select public.application_submit(%L, 'submit-dapp-key1')$q$, appd));

  -- ── Documents ──────────────────────────────────────────────────
  perform pg_temp.refused_for('a document not on the checklist', ana, format($q$select public.application_document_mark(%L, 'passport', 'sent', '', 'doc-bad-key0001')$q$, appa), 'not on this cycle');
  perform pg_temp.works('Ana saying the transcript was sent', ana, format($q$select public.application_document_mark(%L, 'transcript', 'sent', '', 'doc-sent-key001')$q$, appa));
  perform pg_temp.refused_for('Ana marking it received', ana, format($q$select public.application_document_mark(%L, 'transcript', 'received', '', 'doc-ana-recv-k1')$q$, appa), 'that needs admissions:review');
  perform pg_temp.refused_for('Ben saying Ana''s was sent', ben, format($q$select public.application_document_mark(%L, 'transcript', 'sent', '', 'doc-ben-sent-k1')$q$, appa), 'no such application');
  perform pg_temp.refused_for('a waiver with no reason', officer, format($q$select public.application_document_mark(%L, 'recs', 'waived', '', 'doc-waive-key01')$q$, appa), 'needs a reason');
  perform pg_temp.works('the officer receiving it', officer, format($q$select public.application_document_mark(%L, 'transcript', 'received', 'Arrived by post', 'doc-recv-key001')$q$, appa));
  perform pg_temp.counted('two versions of the transcript line', (select count(*) from public.application_documents where application_id = appa and doc_key = 'transcript'), 2);
  perform pg_temp.counted('Ana reads her documents', pg_temp.seen(ana, 'select 1 from public.application_documents'), 2);
  perform pg_temp.counted('Ben reads only his (none)', pg_temp.seen(ben, 'select 1 from public.application_documents'), 0);

  -- ── Review and decision ────────────────────────────────────────
  perform pg_temp.refused_for('an applicant reviewing', ana, format($q$select public.application_review(%L, 'admit', 'nope', 'rev-ana-key0001')$q$, appa), 'that needs admissions:review');
  perform pg_temp.refused_for('the director-applicant reviewing their own', dapp, format($q$select public.application_review(%L, 'admit', 'mine', 'rev-dapp-key001')$q$, appd), 'own application');
  perform pg_temp.works('the officer reviewing Ana', officer, format($q$select public.application_review(%L, 'admit', 'Strong economics essay and record.', 'rev-off-key0001')$q$, appa));
  perform pg_temp.counted('Ana reads no review of herself', pg_temp.seen(ana, 'select 1 from public.application_reviews'), 0);
  perform pg_temp.counted('the officer reads it', pg_temp.seen(officer, 'select 1 from public.application_reviews'), 1);

  perform pg_temp.refused_for('the officer deciding', officer, format($q$select public.application_decide(%L, 'admit', 'Strong record and essay.', '', 'dec-off-key0001')$q$, appa), 'that needs admissions:decide');
  perform pg_temp.refused_for('deciding with no review by anyone else', director,
    format($q$select public.application_decide(%L, 'admit', 'No one else has reviewed this.', '', 'dec-norev-key01')$q$, appb), 'review by someone other');
  perform pg_temp.works('the director reviewing Ben', director, format($q$select public.application_review(%L, 'deny', 'Does not meet the minimum.', 'rev-dir-key0001')$q$, appb));
  perform pg_temp.refused_for('the same director deciding on their own review alone', director,
    format($q$select public.application_decide(%L, 'deny', 'Does not meet the minimum.', '', 'dec-ownrev-key1')$q$, appb), 'review by someone other');
  perform pg_temp.works('the officer reviewing Ben too', officer, format($q$select public.application_review(%L, 'deny', 'Agree with the first review.', 'rev-off-key0002')$q$, appb));
  perform pg_temp.refused_for('deciding with a required document missing', director,
    format($q$select public.application_decide(%L, 'deny', 'Does not meet the minimum.', '', 'dec-nodoc-key01')$q$, appb), 'required document');
  perform pg_temp.works('the officer waiving Ben''s transcript for the check', officer, format($q$select public.application_document_mark(%L, 'transcript', 'waived', 'Not required for the check', 'doc-waive-key02')$q$, appb));
  perform pg_temp.refused_for('a decision that is not admit, deny or waitlist', director,
    format($q$select public.application_decide(%L, 'maybe', 'Undecided for now ok.', '', 'dec-maybe-key01')$q$, appa), 'admit, deny or waitlist');
  perform pg_temp.refused_for('a decision with no real reason', director, format($q$select public.application_decide(%L, 'admit', 'ok', '', 'dec-short-key01')$q$, appa), 'check');
  r := pg_temp.ask(director, format($q$select public.application_decide(%L, 'admit', 'Strong record and essay.', 'Final transcript required', 'dec-dir-key0001')$q$, appa))::jsonb;
  r2 := pg_temp.ask(director, format($q$select public.application_decide(%L, 'admit', 'Strong record and essay.', 'Final transcript required', 'dec-dir-key0001')$q$, appa))::jsonb;
  perform pg_temp.said('the same key answers the same decision', r2->>'id', r->>'id');
  perform pg_temp.counted('and recorded one', (select count(*) from public.application_decisions where application_id = appa), 1);
  perform pg_temp.works('and Ben''s denial', director, format($q$select public.application_decide(%L, 'deny', 'Does not meet the minimum.', '', 'dec-dir-key0002')$q$, appb));
  perform pg_temp.refused_for('the director-applicant deciding their own application', dapp,
    format($q$select public.application_decide(%L, 'admit', 'Deciding myself for the check.', '', 'dec-self-key001')$q$, appd), 'own application');
  begin
    update public.application_decisions set decision = 'admit' where application_id = appb;
    raise exception 'FAILED: a decision was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a decision is never rewritten (%)', sqlerrm;
  end;
  begin
    update public.application_reviews set recommendation = 'admit';
    raise exception 'FAILED: a review was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a review is never rewritten (%)', sqlerrm;
  end;

  -- ── A decision is private until it is released ─────────────────
  perform pg_temp.counted('Ana reads no decision before release', pg_temp.seen(ana, 'select 1 from public.application_decisions'), 0);
  perform pg_temp.counted('the director reads both decisions', pg_temp.seen(director, 'select 1 from public.application_decisions'), 2);
  perform pg_temp.refused_for('answering before a release', ana, format($q$select public.application_respond(%L, 'accept', 'resp-early-key1')$q$, appa), 'no released decision');
  perform pg_temp.refused_for('the officer releasing', officer, format($q$select public.admissions_release(%L, 'rel-off-key0001')$q$, cyc), 'that needs admissions:decide');
  r := pg_temp.ask(director2, format($q$select public.admissions_release(%L, 'rel-dir2-key001')$q$, cyc))::jsonb;
  perform pg_temp.said('a second director released both decided applications', r->>'released', '2');
  perform pg_temp.refused_for('releasing again', director, format($q$select public.admissions_release(%L, 'rel-dir-key0002')$q$, cyc), 'waiting to be released');
  perform pg_temp.counted('Ana reads her decision now', pg_temp.seen(ana, 'select 1 from public.application_decisions'), 1);
  perform pg_temp.counted('and not Ben''s', pg_temp.seen(ben, 'select 1 from public.application_decisions where decision = ''admit'''), 0);
  perform pg_temp.refused_for('deciding again after the release', director,
    format($q$select public.application_decide(%L, 'deny', 'Changing my mind after release.', '', 'dec-after-key01')$q$, appa), 'released');

  -- ── The applicant answers; a deposit holds the place ───────────
  perform pg_temp.refused_for('answering a denial', ben, format($q$select public.application_respond(%L, 'accept', 'resp-ben-key001')$q$, appb), 'only an offer of admission');
  perform pg_temp.refused_for('answering someone else''s offer', ben, format($q$select public.application_respond(%L, 'accept', 'resp-ben-key002')$q$, appa), 'no such application');
  perform pg_temp.refused_for('a deposit before an acceptance', officer, format($q$select public.admissions_deposit_record(%L, 'RCPT-0001', 'dep-early-key01')$q$, appa), 'follows an accepted offer');
  r := pg_temp.ask(ana, format($q$select public.application_respond(%L, 'accept', 'resp-ana-key001')$q$, appa))::jsonb;
  r2 := pg_temp.ask(ana, format($q$select public.application_respond(%L, 'accept', 'resp-ana-key001')$q$, appa))::jsonb;
  perform pg_temp.said('the same key answers the same', r2::text, r::text);
  perform pg_temp.refused_for('answering twice', ana, format($q$select public.application_respond(%L, 'decline', 'resp-ana-key002')$q$, appa), 'already answered');
  perform pg_temp.refused_for('an applicant recording a deposit', ana, format($q$select public.admissions_deposit_record(%L, 'RCPT-0001', 'dep-ana-key0001')$q$, appa), 'that needs admissions:review');
  perform pg_temp.works('the officer recording the deposit', officer, format($q$select public.admissions_deposit_record(%L, 'RCPT-0001', 'dep-off-key0001')$q$, appa));
  perform pg_temp.refused_for('recording it twice', officer, format($q$select public.admissions_deposit_record(%L, 'RCPT-0002', 'dep-off-key0002')$q$, appa), 'already recorded');
  perform pg_temp.counted('Ana reads her deposit', pg_temp.seen(ana, 'select 1 from public.application_deposits'), 1);

  r := pg_temp.ask(director, format($q$select public.admissions_yield(%L)$q$, cyc))::jsonb;
  perform pg_temp.said('the yield counts: started 4', r->>'started', '4');
  perform pg_temp.said('submitted 3', r->>'submitted', '3');
  perform pg_temp.said('admitted 1', r->>'admitted', '1');
  perform pg_temp.said('accepted 1', r->>'accepted', '1');
  perform pg_temp.said('deposited 1', r->>'deposited', '1');
  perform pg_temp.refused_for('an applicant reading the yield', ana, format($q$select public.admissions_yield(%L)$q$, cyc), 'that needs admissions:read');

  -- ── History ────────────────────────────────────────────────────
  perform pg_temp.counted('Ana sees her events, but not the review or the decision',
    pg_temp.seen(ana, 'select 1 from public.application_events where kind in (''reviewed'', ''decided'')'), 0);
  perform pg_temp.counted('Ana sees the steps that are hers', (pg_temp.seen(ana, 'select 1 from public.application_events') > 0)::int, 1);
  perform pg_temp.counted('the officer sees the reviews and decisions in the history',
    pg_temp.seen(officer, 'select 1 from public.application_events where kind in (''reviewed'', ''decided'')'), 5);

  -- ── Withdrawing ────────────────────────────────────────────────
  perform pg_temp.works('Bob withdrawing a draft', bob, format($q$select public.application_withdraw(%L, 'withdraw-bob-key1')$q$, appc));
  perform pg_temp.refused_for('withdrawing twice', bob, format($q$select public.application_withdraw(%L, 'withdraw-bob-key2')$q$, appc), 'already withdrawn');
  perform pg_temp.refused_for('saving a withdrawn application', bob, format($q$select public.application_save(%L, '{"essay":"x"}'::jsonb)$q$, appc), 'frozen');

  -- ── The window ─────────────────────────────────────────────────
  r := pg_temp.ask(officer, format($q$select public.admissions_cycle_save('Spring 2028', '2028SP', now() + interval '10 days', now() + interval '40 days', %L::jsonb, %L::jsonb, 'cycle-later-key1')$q$, questions, checklist))::jsonb;
  cyc2 := (r->>'id')::uuid;
  perform pg_temp.works('opening a cycle whose window has not begun', officer, format($q$select public.admissions_cycle_open(%L, 'open-later-key1')$q$, cyc2));
  perform pg_temp.refused_for('applying before the window', stranger, format($q$select public.application_start(%L, 'start-later-key1')$q$, cyc2), 'not open for applications');
  perform pg_temp.works('the officer closing the first cycle', officer, format($q$select public.admissions_cycle_close(%L, 'close-off-key001')$q$, cyc));
  perform pg_temp.refused_for('applying to a closed cycle', stranger, format($q$select public.application_start(%L, 'start-closed-key1')$q$, cyc), 'not open for applications');
  perform pg_temp.refused_for('closing twice', officer, format($q$select public.admissions_cycle_close(%L, 'close-off-key002')$q$, cyc), 'already closed');

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'ad-u' and module = 'admissions';
  perform pg_temp.refused_for('reviewing while the module is frozen', officer, format($q$select public.application_review(%L, 'admit', 'x frozen', 'rev-frozen-key1')$q$, appb), 'does not run admissions in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'ad-u' and module = 'admissions';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('ad-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('responding under the kill switch', ana, format($q$select public.application_respond(%L, 'accept', 'resp-kill-key001')$q$, appa), 'does not run admissions in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'ad-u';

  -- ── An account with an application is not untouched; deleting it ─
  perform pg_temp.said('an account that applied is not untouched', public.lti_account_untouched(ana)::text, 'false');
  perform pg_temp.said('one that did not is', public.lti_account_untouched(stranger)::text, 'true');
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting the applicant took the application', (select count(*) from public.applications where id = appa), 0);
  perform pg_temp.counted('and its documents, decision, answer and deposit',
    (select count(*) from public.application_documents where application_id = appa) + (select count(*) from public.application_decisions where application_id = appa)
    + (select count(*) from public.application_responses where application_id = appa) + (select count(*) from public.application_deposits where application_id = appa), 0);
  delete from auth.users where id = officer;
  perform pg_temp.counted('deleting the officer keeps what they wrote', (select count(*) from public.application_reviews where reviewer is null), 1);
  raise notice 'admissions checks passed';
end $$;

rollback;
