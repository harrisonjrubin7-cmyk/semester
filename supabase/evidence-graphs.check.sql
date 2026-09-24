-- Learning, skill and capture evidence must stay inside both its tenant and
-- its person boundary. Capture derivation additionally requires live consent.
-- LOCAL/DISPOSABLE DATABASES ONLY; every row is rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % -- expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  northstar_user uuid;
  northstar_admin uuid;
  cedar_user uuid;
  northstar_source uuid;
  northstar_claim uuid;
  active_consent uuid;
  withdrawn_consent uuid;
  active_capture uuid;
  withdrawn_capture uuid;
  n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('northstar-evidence', 'Northstar Evidence University', array['northstar-evidence.example']),
    ('cedar-evidence', 'Cedar Evidence College', array['cedar-evidence.example']);
  northstar_user := pg_temp.newuser('student@northstar-evidence.example', 'northstar-evidence');
  northstar_admin := pg_temp.newuser('admin@northstar-evidence.example', 'northstar-evidence');
  cedar_user := pg_temp.newuser('student@cedar-evidence.example', 'cedar-evidence');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (northstar_admin, 'university_admin', 'school', 'northstar-evidence', 'institution');

  perform pg_temp.become(northstar_user);
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by, expires_at)
  values
    ('northstar-evidence', northstar_user, 'lecture_capture', 'consented', '1', northstar_user, now() + interval '30 days')
  returning id into active_consent;
  insert into public.consent_record
    (tenant_id, subject_user_id, capability, status, policy_version, recorded_by, expires_at)
  values
    ('northstar-evidence', northstar_user, 'lecture_capture-withdrawn', 'consented', '1', northstar_user, now() + interval '30 days')
  returning id into withdrawn_consent;

  insert into public.evidence_reference
    (tenant_id, person_id, course_id, title, origin, authority, locator, excerpt)
  values
    ('northstar-evidence', northstar_user, 'econ', 'ECON syllabus', 'course', 'authoritative', 'page 2', 'Assessment policy')
  returning id into northstar_source;
  insert into public.concept_evidence
    (tenant_id, person_id, evidence_id, course_id, concept_id, kind, score)
  values
    ('northstar-evidence', northstar_user, northstar_source, 'econ', 'elasticity', 'practice', 0.72);
  insert into public.mistake_evidence
    (tenant_id, person_id, evidence_id, course_id, concept_id, classification, detail)
  values
    ('northstar-evidence', northstar_user, northstar_source, 'econ', 'elasticity', 'calculation', 'Reversed the ratio.');

  insert into public.skill_claim
    (tenant_id, person_id, skill_name, verification_state)
  values ('northstar-evidence', northstar_user, 'Economic reasoning', 'suggested')
  returning id into northstar_claim;
  insert into public.skill_claim_evidence
    (tenant_id, person_id, skill_claim_id, evidence_id)
  values ('northstar-evidence', northstar_user, northstar_claim, northstar_source);

  insert into public.capture_asset
    (tenant_id, person_id, course_id, consent_id, name, mime, content_hash, retained_until)
  values
    ('northstar-evidence', northstar_user, 'econ', active_consent, 'Lecture 8.mp4', 'video/mp4', 'sha256-active', now() + interval '30 days')
  returning id into active_capture;
  insert into public.capture_segment
    (tenant_id, person_id, capture_id, locator, body)
  values ('northstar-evidence', northstar_user, active_capture, '00:14:22', 'The response paper is due October 2.');
  insert into public.capture_artifact
    (tenant_id, person_id, capture_id, kind, body, created_by)
  values ('northstar-evidence', northstar_user, active_capture, 'summary', '{"title":"Lecture 8"}', northstar_user);

  insert into public.capture_asset
    (tenant_id, person_id, course_id, consent_id, name, mime, content_hash, retained_until)
  values
    ('northstar-evidence', northstar_user, 'econ', withdrawn_consent, 'Office hours.m4a', 'audio/mp4', 'sha256-withdrawn', now() + interval '30 days')
  returning id into withdrawn_capture;
  insert into public.capture_segment
    (tenant_id, person_id, capture_id, locator, body)
  values ('northstar-evidence', northstar_user, withdrawn_capture, '00:03:10', 'Bring the draft to the next meeting.');
  insert into public.capture_artifact
    (tenant_id, person_id, capture_id, kind, body, created_by)
  values ('northstar-evidence', northstar_user, withdrawn_capture, 'action', '{"action":"Bring draft"}', northstar_user);
  update public.consent_record
     set status = 'revoked', revoked_at = now()
   where id = withdrawn_consent;
  reset role;

  perform pg_temp.become(northstar_user);
  select count(*) into n from public.evidence_reference
   where id = northstar_source and title = 'ECON syllabus';
  reset role;
  perform pg_temp.counted('owner can read Northstar evidence', n, 1);

  perform pg_temp.become(cedar_user);
  select count(*) into n from public.evidence_reference where id = northstar_source;
  reset role;
  perform pg_temp.counted('another tenant cannot read Northstar evidence', n, 0);

  if not pg_temp.refused(
    northstar_user,
    format(
      'insert into public.capture_artifact (tenant_id, person_id, capture_id, kind, body, created_by) values (%L, %L, %L, %L, %L, %L)',
      'northstar-evidence', northstar_user, withdrawn_capture, 'summary', '{}', northstar_user
    )
  ) then raise exception 'FAILED: withdrawn consent allowed a derived artifact'; end if;
  raise notice 'ok  withdrawn consent blocks derived artifacts';

  if not pg_temp.refused(
    northstar_user,
    format(
      'update public.skill_claim set verification_state = %L, verified_by = %L, verified_at = now() where id = %L',
      'institution_verified', northstar_user, northstar_claim
    )
  ) then raise exception 'FAILED: student promoted a skill claim to institution verified'; end if;
  raise notice 'ok  students cannot institution-verify their own claims';

  perform pg_temp.become(northstar_admin);
  update public.skill_claim
     set verification_state = 'institution_verified', verified_by = northstar_admin, verified_at = now()
   where id = northstar_claim;
  get diagnostics n = row_count;
  reset role;
  perform pg_temp.counted('a verified same-tenant approver can verify a skill claim', n, 1);

  perform pg_temp.become(northstar_user);
  select count(*) into n from public.capture_segment where capture_id = withdrawn_capture;
  reset role;
  perform pg_temp.counted('withdrawal leaves no active segment readable', n, 0);

  reset role;
  select count(*) into n from public.capture_artifact
   where capture_id = withdrawn_capture and state = 'withdrawn';
  perform pg_temp.counted('withdrawal marks existing derived artifacts withdrawn', n, 1);

  perform pg_temp.become(northstar_user);
  delete from public.capture_asset where id = active_capture;
  select count(*) into n from public.capture_segment where capture_id = active_capture;
  reset role;
  perform pg_temp.counted('removing an original removes derived segments', n, 0);

  raise notice 'evidence graphs: every check passed';
end $$;

rollback;
