-- supabase/records.check.sql — final grades, signed documents, the disclosure
-- log and graduation clearance.
--
-- For 20261001050000_records_transcripts.sql. One school, rc-u: two registrars,
-- a dean, two instructors, four students (one with no record link) and a member
-- with no grant. What it proves:
--
--   * nothing is written unless the school runs `records` in Core;
--   * an instructor posts final grades and cannot accept them; a registrar turns
--     them into ledger proposals and someone else decides, so a grade is never
--     on the record by the hand that gave it; a correction before acceptance
--     supersedes, after acceptance it is refused;
--   * a document is signed; a rewrite is noticed even when its hash is made to
--     match; an expired or revoked code opens nothing; the service role alone
--     opens a document by its code; every opening is kept;
--   * a release to anyone but the student writes a disclosure with its basis,
--     and written consent names the consent; the student reads their own log;
--   * graduation clearance blocks on no catalog year, no saved audit, a stale
--     audit, a waiting change and an open hold, and clears when none is left;
--   * nobody writes through the API; deleting a staff account keeps the record.
--
--   How to run it: supabase/check.sh records

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
  reg uuid; reg2 uuid; dean uuid; prof uuid; prof2 uuid; ana uuid; ben uuid; cara uuid; dev uuid; eve uuid;
  r jsonb; r2 jsonb; dcode text; dcode2 text; dcode3 text; doc_id uuid; v jsonb; vid uuid; snap text;
  roster constant text := '[{"student":"%s","grade":"B+","credits":3}]';
begin
  insert into public.schools (id, name, email_domains) values ('rc-u', 'Records University', array['rc-u.example']);
  reg   := pg_temp.newuser('reg@rc-u.example', 'rc-u');
  reg2  := pg_temp.newuser('reg2@rc-u.example', 'rc-u');
  dean  := pg_temp.newuser('dean@rc-u.example', 'rc-u');
  prof  := pg_temp.newuser('prof@rc-u.example', 'rc-u');
  prof2 := pg_temp.newuser('hist@rc-u.example', 'rc-u');
  ana   := pg_temp.newuser('ana@rc-u.example', 'rc-u');
  ben   := pg_temp.newuser('ben@rc-u.example', 'rc-u');
  cara  := pg_temp.newuser('cara@rc-u.example', 'rc-u');
  dev   := pg_temp.newuser('dev@rc-u.example', 'rc-u');
  eve   := pg_temp.newuser('eve@rc-u.example', 'rc-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg,   'registrar',             'school', 'rc-u', 'institution'),
    (reg2,  'registrar',             'school', 'rc-u', 'institution'),
    (dean,  'dean',                  'school', 'rc-u', 'institution'),
    (prof,  'faculty',               'course', 'rc-u/ECON 1020/2026FA', 'institution'),
    (prof2, 'faculty',               'course', 'rc-u/HIST 2100/2026FA', 'institution'),
    (ana,   'undergraduate_student', 'course', 'rc-u/ECON 1020/2026FA', 'institution'),
    (ben,   'undergraduate_student', 'course', 'rc-u/ECON 1020/2026FA', 'institution'),
    (cara,  'undergraduate_student', 'course', 'rc-u/ECON 1020/2026FA', 'institution'),
    (dev,   'undergraduate_student', 'course', 'rc-u/HIST 2100/2026FA', 'institution');
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values
    ('rc-u', 'S-ANA', ana), ('rc-u', 'S-CARA', cara), ('rc-u', 'S-DEV', dev);

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('posting grades while the school is in Connect', prof,
    format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-connect-key')$q$, format(roster, ana)),
    'does not run records in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values
    ('rc-u', 'records', 'core', false, 'check'), ('rc-u', 'degree_audit', 'core', false, 'check');

  -- ── Final grades ───────────────────────────────────────────────
  perform pg_temp.refused_for('a student posting a grade', ana,
    format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-ana-key01')$q$, format(roster, ana)), 'that needs grades:release');
  perform pg_temp.refused_for('faculty of another course posting', prof2,
    format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-oth-key01')$q$, format(roster, ana)), 'that needs grades:release');
  perform pg_temp.refused_for('a student not enrolled in the course', prof,
    format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-dev-key01')$q$, format(roster, dev)), 'not enrolled');
  perform pg_temp.refused_for('a grade that is not a grade', prof,
    format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-bad-key01')$q$, replace(format(roster, ana), 'B+', 'Z')), 'check');
  r := pg_temp.ask(prof, format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-ana-key02')$q$, format(roster, ana)))::jsonb;
  perform pg_temp.said('the instructor posted one grade', r->>'posted', '1');
  r2 := pg_temp.ask(prof, format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-ana-key02')$q$, format(roster, ana)))::jsonb;
  perform pg_temp.said('the same key answers the same', r2::text, r::text);
  perform pg_temp.counted('and wrote one post', (select count(*) from public.term_grade_posts), 1);
  r := pg_temp.ask(prof, format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-ben-key01')$q$, format(roster, ben)))::jsonb;
  perform pg_temp.said('a student with no record link is skipped and said so', r->'skipped'->0->>'why', 'no record link');
  perform pg_temp.said('and nothing was posted for them', r->>'posted', '0');
  perform pg_temp.works('cara''s first grade', prof, format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-cara-key1')$q$, replace(format(roster, cara), 'B+', 'C')));
  perform pg_temp.works('cara''s corrected grade', prof, format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-cara-key2')$q$, replace(format(roster, cara), 'B+', 'A-')));
  perform pg_temp.counted('two versions of cara''s post', (select count(*) from public.term_grade_posts where student_ref = 'S-CARA'), 2);
  perform pg_temp.counted('the poster reads the posts', pg_temp.seen(prof, 'select 1 from public.term_grade_posts'), 3);
  perform pg_temp.counted('a student reads none', pg_temp.seen(ana, 'select 1 from public.term_grade_posts'), 0);
  perform pg_temp.counted('the registrar reads them', pg_temp.seen(reg, 'select 1 from public.term_grade_posts'), 3);

  -- ── Acceptance by another hand ─────────────────────────────────
  perform pg_temp.refused_for('the instructor accepting their own posts', prof,
    $q$select public.term_grades_accept('econ 1020', '2026FA', 'accept-prof-key')$q$, 'that needs records:accept');
  perform pg_temp.refused_for('the dean accepting', dean, $q$select public.term_grades_accept('econ 1020', '2026FA', 'accept-dean-key')$q$, 'that needs records:accept');
  perform pg_temp.counted('nothing is on the ledger from a post alone', (select count(*) from public.academic_record_entries), 0);
  r := pg_temp.ask(reg, $q$select public.term_grades_accept('econ 1020', '2026FA', 'accept-reg-key1')$q$)::jsonb;
  perform pg_temp.said('the registrar proposed for two students', r->>'proposed', '2');
  perform pg_temp.counted('as four proposals (grade and credit each)', (select count(*) from public.academic_record_changes where status = 'proposed'), 4);
  perform pg_temp.counted('still nothing on the ledger', (select count(*) from public.academic_record_entries), 0);
  perform pg_temp.said('cara''s proposal carries the corrected grade, not the first',
    (select value from public.academic_record_changes where student_ref = 'S-CARA' and kind = 'grade'), 'A-');
  perform pg_temp.refused_for('accepting again', reg, $q$select public.term_grades_accept('econ 1020', '2026FA', 'accept-reg-key2')$q$, 'no posted grades are waiting');
  perform pg_temp.refused_for('posting again after acceptance', prof,
    format($q$select public.term_grades_post('econ 1020', '2026FA', %L::jsonb, 'post-ana-key03')$q$, format(roster, ana)), 'already accepted');
  perform pg_temp.refused_for('the proposer approving their own proposal', reg,
    $q$update public.academic_record_changes set status = 'approved' where student_ref = 'S-ANA'$q$, 'does not decide');
  perform pg_temp.works('another registrar approving', reg2, $q$update public.academic_record_changes set status = 'approved'$q$);
  perform pg_temp.said('the grade is on the ledger under the course and term',
    (select value from public.academic_record_entries where student_ref = 'S-ANA' and kind = 'grade' and subject_key = 'ECON 1020 · Fall 2026'), 'B+');
  perform pg_temp.said('and so are its credits',
    (select value from public.academic_record_entries where student_ref = 'S-ANA' and kind = 'credit' and subject_key = 'ECON 1020 · Fall 2026'), '3');

  -- ── Documents ──────────────────────────────────────────────────
  perform pg_temp.refused_for('the dean issuing a transcript', dean,
    $q$select public.record_document_issue('S-ANA', 'transcript', '', 'student', '', '', 'issue-dean-key1')$q$, 'that needs records:issue');
  perform pg_temp.refused_for('a transcript for a student with nothing on the record', reg,
    $q$select public.record_document_issue('S-NOBODY', 'transcript', '', 'student', '', '', 'issue-nobody-k1')$q$, 'nothing on the record');
  perform pg_temp.refused_for('a release to an employer with no basis', reg,
    $q$select public.record_document_issue('S-ANA', 'transcript', 'Acme Corp', 'consent', '', 'signed form 12', 'issue-nobasis-k1')$q$, 'names the recipient and the basis');
  perform pg_temp.refused_for('a release on consent that names no consent', reg,
    $q$select public.record_document_issue('S-ANA', 'transcript', 'Acme Corp', 'consent', 'Student asked in writing', '', 'issue-noconsent1')$q$, 'names the consent');
  perform pg_temp.refused_for('a document that is not a transcript or a letter', reg,
    $q$select public.record_document_issue('S-ANA', 'diploma', '', 'student', '', '', 'issue-diploma-k1')$q$, 'a transcript or an enrollment verification');

  r := pg_temp.ask(reg, $q$select public.record_document_issue('S-ANA', 'transcript', '', 'student', '', '', 'issue-self-key01')$q$)::jsonb;
  perform pg_temp.counted('a transcript to the student writes no disclosure', (select count(*) from public.record_disclosures), 0);
  r2 := pg_temp.ask(reg, $q$select public.record_document_issue('S-ANA', 'transcript', '', 'student', '', '', 'issue-self-key01')$q$)::jsonb;
  perform pg_temp.said('the same key answers the same document', r2->>'code', r->>'code');
  perform pg_temp.counted('and issued one', (select count(*) from public.record_documents), 1);
  dcode := r->>'code';
  perform pg_temp.counted('the code is 24 hex digits', (dcode ~ '^[0-9A-F]{24}$')::int, 1);

  r := pg_temp.ask(reg, $q$select public.record_document_issue('S-ANA', 'transcript', 'Acme Corp, Human Resources', 'consent', 'Student authorised the release in writing', 'consent form 2026-12', 'issue-acme-key01')$q$)::jsonb;
  dcode2 := r->>'code';
  doc_id := (r->>'id')::uuid;
  perform pg_temp.counted('a release to an employer writes a disclosure', (select count(*) from public.record_disclosures where document_id = doc_id), 1);
  perform pg_temp.said('naming the recipient and the consent',
    (select recipient || ' / ' || consent_ref from public.record_disclosures where document_id = doc_id), 'Acme Corp, Human Resources / consent form 2026-12');
  perform pg_temp.works('an enrollment letter to a school official', reg,
    $q$select public.record_document_issue('S-ANA', 'enrollment_verification', 'Office of Financial Aid', 'school_official', 'Legitimate educational interest: aid certification', '', 'issue-letter-key1')$q$);
  perform pg_temp.counted('two disclosures', (select count(*) from public.record_disclosures), 2);

  -- ── Verification: the service role alone ───────────────────────
  perform pg_temp.refused_for('a signed-in account opening a document by code', reg, format($q$select public.record_document_verify(%L)$q$, dcode), 'permission denied');
  perform pg_temp.refused_for('a signed-out visitor opening one', reg, format($q$set local role anon; select public.record_document_verify(%L)$q$, dcode), 'permission denied');
  set local role service_role;
  v := public.record_document_verify(dcode);
  reset role;
  perform pg_temp.said('the service role opens it by its code', v->>'valid', 'true');
  perform pg_temp.said('and sees the transcript''s grade', (v->'content'->'entries' @> '[{"kind":"grade","value":"B+"}]')::text, 'true');
  perform pg_temp.said('and the school''s name', v->>'school', 'Records University');
  perform pg_temp.said('and the hash stored with it', v->>'hash', (select content_hash from public.record_documents where code = upper(dcode)));
  set local role service_role;
  v := public.record_document_verify(substr(dcode, 1, 4) || '-' || substr(dcode, 5, 4) || '-' || lower(substr(dcode, 9)));
  reset role;
  perform pg_temp.said('a code typed with dashes and lower case still opens it', v->>'valid', 'true');
  set local role service_role;
  v := public.record_document_verify('000000000000000000000000');
  reset role;
  perform pg_temp.said('a wrong code is a plain no', v->>'valid' || ':' || (v->>'reason'), 'false:unknown');
  perform pg_temp.said('and shows no content', coalesce((v->'content')::text, 'none'), 'none');
  perform pg_temp.counted('two openings were kept', (select count(*) from public.record_document_openings where outcome = 'opened'), 2);

  -- ── The record under a signature ───────────────────────────────
  perform pg_temp.refused_for('rewriting an issued document', reg, format($q$update public.record_documents set content = '{}'::jsonb where code = %L$q$, dcode), 'permission denied');
  begin
    update public.record_documents set recipient = 'Someone else' where code = dcode;
    raise exception 'FAILED: an issued document was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  an issued document is never rewritten (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('a client deleting an issued document', reg, format($q$delete from public.record_documents where code = %L$q$, dcode), 'permission denied');
  -- Someone with the power to switch the guard off rewrites the content and the
  -- hash to match; the signature is what notices.
  alter table public.record_documents disable trigger record_documents_never_rewritten;
  update public.record_documents
     set content = jsonb_set(content, '{entries,0,value}', '"A+"'),
         content_hash = private.records_hash(jsonb_set(content, '{entries,0,value}', '"A+"'))
   where code = dcode2;
  alter table public.record_documents enable trigger record_documents_never_rewritten;
  set local role service_role;
  v := public.record_document_verify(dcode2);
  reset role;
  perform pg_temp.said('a rewritten document, even with its hash made to match, is altered', v->>'valid' || ':' || (v->>'reason'), 'false:altered');
  perform pg_temp.said('and shows no content', coalesce((v->'content')::text, 'none'), 'none');

  -- Expired and revoked.
  r := pg_temp.ask(reg, $q$select public.record_document_issue('S-CARA', 'transcript', '', 'student', '', '', 'issue-cara-key01')$q$)::jsonb;
  dcode3 := r->>'code';
  alter table public.record_documents disable trigger record_documents_never_rewritten;
  update public.record_documents set expires_at = now() - interval '1 day' where code = dcode3;
  alter table public.record_documents enable trigger record_documents_never_rewritten;
  set local role service_role;
  v := public.record_document_verify(dcode3);
  reset role;
  perform pg_temp.said('an expired code says so', v->>'valid' || ':' || (v->>'reason'), 'false:expired');
  perform pg_temp.said('and shows no content', coalesce((v->'content')::text, 'none'), 'none');


  -- Revocation.
  doc_id := (select id from public.record_documents where code = dcode);
  perform pg_temp.refused_for('the dean revoking', dean, format($q$select public.record_document_revoke(%L, 'Issued in error to the wrong person', 'revoke-dean-key1')$q$, doc_id), 'that needs records:issue');
  perform pg_temp.refused_for('a revocation with no real reason', reg, format($q$select public.record_document_revoke(%L, 'oops', 'revoke-short-key')$q$, doc_id), 'check');
  perform pg_temp.works('the registrar revoking', reg, format($q$select public.record_document_revoke(%L, 'Issued in error to the wrong person', 'revoke-reg-key01')$q$, doc_id));
  set local role service_role;
  v := public.record_document_verify(dcode);
  reset role;
  perform pg_temp.said('a revoked document says so', v->>'valid' || ':' || (v->>'reason'), 'false:revoked');
  perform pg_temp.said('and shows no content', coalesce((v->'content')::text, 'none'), 'none');
  perform pg_temp.refused_for('revoking twice', reg, format($q$select public.record_document_revoke(%L, 'Issued in error to the wrong person', 'revoke-reg-key02')$q$, doc_id), 'already revoked');
  perform pg_temp.counted('every failed opening was kept', (select count(*) from public.record_document_openings where outcome in ('altered', 'expired', 'revoked')), 3);

  -- Who reads what.
  perform pg_temp.counted('Ana reads her three documents', pg_temp.seen(ana, 'select 1 from public.record_documents'), 3);
  perform pg_temp.counted('Cara reads her one', pg_temp.seen(cara, 'select 1 from public.record_documents'), 1);
  perform pg_temp.counted('Ben, with no record link, reads none', pg_temp.seen(ben, 'select 1 from public.record_documents'), 0);
  perform pg_temp.counted('a member with no grant reads none', pg_temp.seen(eve, 'select 1 from public.record_documents'), 0);
  perform pg_temp.counted('faculty read none', pg_temp.seen(prof, 'select 1 from public.record_documents'), 0);
  perform pg_temp.counted('the registrar reads all four', pg_temp.seen(reg, 'select 1 from public.record_documents'), 4);
  perform pg_temp.counted('the dean reads all four', pg_temp.seen(dean, 'select 1 from public.record_documents'), 4);
  perform pg_temp.counted('Ana reads the revocation of her document', pg_temp.seen(ana, 'select 1 from public.record_document_revocations'), 1);
  perform pg_temp.counted('Cara reads no one else''s revocation', pg_temp.seen(cara, 'select 1 from public.record_document_revocations'), 0);
  perform pg_temp.refused_for('a client reading the signing key', reg, 'select key from private.records_signing_key', 'permission denied');
  perform pg_temp.refused_for('a client writing a document directly', reg,
    $q$insert into public.record_documents (tenant_id, student_ref, kind, code, as_of, content, content_hash, signature, recipient_kind, expires_at, operation)
       values ('rc-u', 'S-ANA', 'transcript', 'AAAAAAAAAAAAAAAAAAAAAAAA', current_date, '{}'::jsonb, repeat('a', 64), repeat('a', 64), 'student', now(), 'x')$q$, 'permission denied');

  -- ── The disclosure log ─────────────────────────────────────────
  perform pg_temp.refused_for('the dean logging a release', dean,
    $q$select public.record_disclosure_log('S-ANA', 'County court', 'subpoena', 'Subpoena served on the registrar', '', 'Transcript', 'disc-dean-key01')$q$, 'that needs records:issue');
  perform pg_temp.refused_for('a consent release with no consent named', reg,
    $q$select public.record_disclosure_log('S-ANA', 'Acme Corp', 'consent', 'Student asked us to send it', '', 'Transcript', 'disc-noconsent1')$q$, 'record_disclosure_consent');
  perform pg_temp.works('the registrar logging a release made outside Semester', reg,
    $q$select public.record_disclosure_log('S-ANA', 'County court', 'subpoena', 'Subpoena served on the registrar', '', 'Transcript', 'disc-reg-key0001')$q$);
  perform pg_temp.counted('Ana reads her whole log', pg_temp.seen(ana, 'select 1 from public.record_disclosures'), 3);
  perform pg_temp.counted('Cara''s log is empty', pg_temp.seen(cara, 'select 1 from public.record_disclosures'), 0);
  perform pg_temp.counted('the dean reads every disclosure', pg_temp.seen(dean, 'select 1 from public.record_disclosures'), 3);
  perform pg_temp.counted('a member with no grant reads none', pg_temp.seen(eve, 'select 1 from public.record_disclosures'), 0);
  begin
    update public.record_disclosures set basis = 'rewritten for the check';
    raise exception 'FAILED: a disclosure was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a disclosure is never rewritten (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('a client deleting a disclosure', reg, 'delete from public.record_disclosures', 'permission denied');

  -- ── Graduation clearance ───────────────────────────────────────
  perform pg_temp.refused_for('faculty running clearance', prof, $q$select public.graduation_clearance_run('S-ANA', 'clear-prof-key1')$q$, 'that needs records:clear');
  perform pg_temp.refused_for('a student running clearance', ana, $q$select public.graduation_clearance_run('S-ANA', 'clear-ana-key01')$q$, 'that needs records:clear');
  r := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-ANA', 'clear-reg-key01')$q$)::jsonb;
  perform pg_temp.said('a student not held to a catalog year is blocked', r->>'status', 'blocked');
  perform pg_temp.said('and told why', r->'blocks'->>0, 'The student is not held to a catalog year.');

  vid := ((pg_temp.ask(reg, $q$select public.degree_version_save('ECON', 'Economics', 'major', 2026, 3, 2.0, '[{"name":"Core","kind":"all","rules":[{"course":"ECON 1020"}]}]'::jsonb, 'clear-ver-key01')$q$))::jsonb->>'id')::uuid;
  perform pg_temp.works('publishing the catalog year', reg, format($q$select public.degree_version_publish(%L, 'clear-pub-key01')$q$, vid));
  perform pg_temp.works('holding Ana to it', reg, format($q$select public.degree_declare('S-ANA', %L, 'clear-dec-key01')$q$, vid));
  r := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-ANA', 'clear-reg-key02')$q$)::jsonb;
  perform pg_temp.said('with no saved audit, blocked', r->'blocks'->>0, 'No degree audit has been saved for the catalog year they are held to.');
  perform pg_temp.works('saving the audit', reg, $q$select public.degree_audit_run('S-ANA', null, true, 'clear-run-key01')$q$);
  r := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-ANA', 'clear-reg-key03')$q$)::jsonb;
  perform pg_temp.said('a complete, fresh audit, no waiting change and no hold clears', r->>'status', 'cleared');
  perform pg_temp.said('the dean may run it too', pg_temp.ask(dean, $q$select (public.graduation_clearance_run('S-ANA', 'clear-dean-key01'))->>'status'$q$), 'cleared');
  r2 := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-ANA', 'clear-reg-key03')$q$)::jsonb;
  perform pg_temp.said('the same key answers the same clearance', r2->>'id', r->>'id');

  insert into public.registration_holds (tenant_id, student, office) values ('rc-u', ana, 'Bursar');
  r := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-ANA', 'clear-reg-key04')$q$)::jsonb;
  perform pg_temp.said('an open hold blocks, naming the office', r->'blocks'->>0, 'An open hold: Bursar.');
  update public.registration_holds set released_at = now() where student = ana;
  perform pg_temp.said('a released hold does not', pg_temp.ask(reg, $q$select (public.graduation_clearance_run('S-ANA', 'clear-reg-key05'))->>'status'$q$), 'cleared');

  perform pg_temp.entry('rc-u', 'S-ANA', 'credit', 'ECON 2010 · Fall 2026', '3');
  r := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-ANA', 'clear-reg-key06')$q$)::jsonb;
  perform pg_temp.said('a record that changed since the audit blocks', r->'blocks'->>0, 'The record has changed since the degree audit was saved; run it again.');
  perform pg_temp.works('saving the audit again', reg, $q$select public.degree_audit_run('S-ANA', null, true, 'clear-run-key02')$q$);
  perform pg_temp.said('and then it clears', pg_temp.ask(reg, $q$select (public.graduation_clearance_run('S-ANA', 'clear-reg-key07'))->>'status'$q$), 'cleared');

  perform pg_temp.works('proposing a change to her record', reg,
    $q$insert into public.academic_record_changes (tenant_id, student_ref, kind, subject_key, value, effective_on, reason, source)
       values ('rc-u', 'S-ANA', 'standing', 'Fall 2026', 'good standing', current_date, 'A standing change waiting for a decision', 'registrar')$q$);
  perform pg_temp.said('a change waiting for a decision blocks',
    pg_temp.ask(reg, $q$select (public.graduation_clearance_run('S-ANA', 'clear-reg-key08'))->'blocks'->>0$q$), 'A change to the record is waiting for a decision.');
  perform pg_temp.works('deciding it', reg2, $q$update public.academic_record_changes set status = 'rejected' where status = 'proposed'$q$);

  r := pg_temp.ask(reg, $q$select public.graduation_clearance_run('S-DEV', 'clear-reg-key09')$q$)::jsonb;
  perform pg_temp.said('a student with no catalog year is blocked, and one with no linked account too',
    ((r->'blocks')::text like '%not held to a catalog year%' and (r->'blocks')::text not like '%No account is linked%')::text, 'true');
  perform pg_temp.counted('Ana reads her clearances', pg_temp.seen(ana, 'select 1 from public.graduation_clearances'), (select count(*) from public.graduation_clearances where student_ref = 'S-ANA'));
  perform pg_temp.counted('Cara reads none', pg_temp.seen(cara, 'select 1 from public.graduation_clearances'), 0);
  begin
    update public.graduation_clearances set status = 'cleared';
    raise exception 'FAILED: a clearance was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a clearance is never rewritten (%)', sqlerrm;
  end;

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'rc-u' and module = 'records';
  perform pg_temp.refused_for('issuing while the module is frozen', reg,
    $q$select public.record_document_issue('S-ANA', 'transcript', '', 'student', '', '', 'issue-frozen-key')$q$, 'does not run records in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'rc-u' and module = 'records';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('rc-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('issuing under the kill switch', reg,
    $q$select public.record_document_issue('S-ANA', 'transcript', '', 'student', '', '', 'issue-killed-key')$q$, 'does not run records in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'rc-u';
  perform pg_temp.works('and again once it is released', reg, $q$select public.record_document_issue('S-ANA', 'transcript', '', 'student', '', '', 'issue-thawed-key')$q$);

  -- ── Deleting a staff account keeps the record ──────────────────
  delete from auth.users where id = reg;
  perform pg_temp.counted('the documents survive their issuer', (select count(*) from public.record_documents where issued_by is null), 5);
  perform pg_temp.counted('and the disclosures survive their releaser', (select count(*) from public.record_disclosures where released_by is null), 3);
  perform pg_temp.counted('and the clearances survive their runner', (select count(*) from public.graduation_clearances where run_by is null), 9);
  raise notice 'records checks passed';
end $$;

rollback;
