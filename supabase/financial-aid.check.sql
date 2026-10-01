-- supabase/financial-aid.check.sql — who proposes and approves an offer, what a
-- student may answer, what may be disbursed, and that a person decides standing.
--
-- For 20261001070000_financial_aid.sql. One school, fa-u: an officer, someone
-- holding both roles, a director, two students linked to their records, a member
-- with no grant and a director of another school. What it proves:
--
--   * nothing is written unless the school runs `financial_aid` in Core;
--   * an offer is proposed by `aid:propose` and approved by a different holder of
--     `aid:approve`, even where one person holds both roles and even when the row
--     is written directly; the student reads nothing until it is approved;
--   * only the linked student answers a part of the current approved version, once;
--   * a disbursement needs an approved, current version and an accepted part,
--     never exceeds what the part holds and never follows a suspension;
--   * progress is a rule applied to the ledger (GPA, attempted, earned, transfer
--     credit) and a person decides: never the person who ran the evaluation,
--     never satisfactory after a failing one, a reinstatement only after a
--     suspension and with its reason;
--   * every row is never rewritten; deleting staff or the student keeps the record.
--
--   How to run it: supabase/check.sh financial-aid

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
  officer uuid; dual uuid; director uuid; ana uuid; ben uuid; eve uuid; outsider uuid;
  v1 jsonb; v2 jsonb; v3 jsonb; bv jsonb; r jsonb; r2 jsonb; ev_ana jsonb; ev_ben jsonb; ev_ben2 jsonb; pol jsonb; n bigint;
  comps constant text := '[{"key":"pell","kind":"grant","name":"Pell Grant","amount_cents":300000},{"key":"loan1","kind":"loan","name":"Direct Subsidized Loan","amount_cents":550000}]';
  propose_sql constant text := $q$select public.aid_offer_propose(%L, '2026-27', %L::jsonb, 'First offer', %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('fa-u', 'Aid University', array['fa-u.example']), ('fa-other', 'Other University', array['fa-other.example']);
  officer  := pg_temp.newuser('officer@fa-u.example', 'fa-u');
  dual     := pg_temp.newuser('dual@fa-u.example', 'fa-u');
  director := pg_temp.newuser('director@fa-u.example', 'fa-u');
  ana      := pg_temp.newuser('ana@fa-u.example', 'fa-u');
  ben      := pg_temp.newuser('ben@fa-u.example', 'fa-u');
  eve      := pg_temp.newuser('eve@fa-u.example', 'fa-u');
  outsider := pg_temp.newuser('outsider@fa-other.example', 'fa-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (officer,  'financial_aid_officer',  'school', 'fa-u', 'institution'),
    (dual,     'financial_aid_officer',  'school', 'fa-u', 'institution'),
    (dual,     'financial_aid_director', 'school', 'fa-u', 'institution'),
    (director, 'financial_aid_director', 'school', 'fa-u', 'institution'),
    (outsider, 'financial_aid_director', 'school', 'fa-other', 'institution');
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('fa-u', 'S-ANA', ana), ('fa-u', 'S-BEN', ben);

  -- Ana: 3.5 over six credits and four transferred. Ben: failing.
  perform pg_temp.entry('fa-u', 'S-ANA', 'grade', 'ECON 1010 · Fall 2025', 'B');
  perform pg_temp.entry('fa-u', 'S-ANA', 'credit', 'ECON 1010 · Fall 2025', '3');
  perform pg_temp.entry('fa-u', 'S-ANA', 'grade', 'ECON 1020 · Spring 2026', 'A');
  perform pg_temp.entry('fa-u', 'S-ANA', 'credit', 'ECON 1020 · Spring 2026', '3');
  perform pg_temp.entry('fa-u', 'S-ANA', 'transfer_credit', 'PHYS 1001', '4');
  perform pg_temp.entry('fa-u', 'S-BEN', 'grade', 'MATH 1010 · Fall 2025', 'F');
  perform pg_temp.entry('fa-u', 'S-BEN', 'credit', 'MATH 1010 · Fall 2025', '3');
  perform pg_temp.entry('fa-u', 'S-BEN', 'grade', 'ECON 1010 · Fall 2025', 'F');
  perform pg_temp.entry('fa-u', 'S-BEN', 'credit', 'ECON 1010 · Fall 2025', '3');
  perform pg_temp.entry('fa-u', 'S-BEN', 'grade', 'HIST 1100 · Fall 2025', 'C');
  perform pg_temp.entry('fa-u', 'S-BEN', 'credit', 'HIST 1100 · Fall 2025', '3');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('proposing while the school is in Connect', officer, format(propose_sql, 'S-ANA', comps, 'prop-connect-key'), 'does not run financial aid in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('fa-u', 'financial_aid', 'core', false, 'check');

  -- ── Proposing ──────────────────────────────────────────────────
  perform pg_temp.refused_for('a student proposing an offer', ana, format(propose_sql, 'S-ANA', comps, 'prop-ana-key001'), 'that needs aid:propose');
  perform pg_temp.refused_for('a director (who does not propose) proposing', director, format(propose_sql, 'S-ANA', comps, 'prop-dir-key001'), 'that needs aid:propose');
  perform pg_temp.refused_for('a director of another school proposing here', outsider, format(propose_sql, 'S-ANA', comps, 'prop-out-key001'), 'that needs aid:propose');
  perform pg_temp.refused_for('an offer with no components', officer, format(propose_sql, 'S-ANA', '[]', 'prop-empty-key1'), 'at least one component');
  perform pg_temp.refused_for('a component with an amount of zero', officer, format(propose_sql, 'S-ANA', '[{"key":"x","kind":"grant","name":"X","amount_cents":0}]', 'prop-zero-key01'), 'amount in cents');
  perform pg_temp.refused_for('a component of an unknown kind', officer, format(propose_sql, 'S-ANA', '[{"key":"x","kind":"gift","name":"X","amount_cents":100}]', 'prop-kind-key01'), 'amount in cents');
  perform pg_temp.refused_for('two components with one key', officer,
    format(propose_sql, 'S-ANA', '[{"key":"x","kind":"grant","name":"X","amount_cents":100},{"key":"x","kind":"loan","name":"Y","amount_cents":100}]', 'prop-dupe-key01'), 'its own key');
  perform pg_temp.refused_for('an offer for a student with nothing on the record', officer, format(propose_sql, 'S-NOBODY', comps, 'prop-nobody-key'), 'nothing on the record');
  v1 := pg_temp.ask(officer, format(propose_sql, 'S-ANA', comps, 'prop-ana-offer1'))::jsonb;
  r2 := pg_temp.ask(officer, format(propose_sql, 'S-ANA', comps, 'prop-ana-offer1'))::jsonb;
  perform pg_temp.said('the same key answers the same version', r2->>'id', v1->>'id');
  perform pg_temp.counted('and wrote one', (select count(*) from public.aid_offer_versions), 1);
  perform pg_temp.refused_for('the same key for a different request', officer, format(propose_sql, 'S-ANA', '[{"key":"x","kind":"grant","name":"X","amount_cents":100}]', 'prop-ana-offer1'), 'already used for a different request');
  v2 := pg_temp.ask(officer, format(propose_sql, 'S-ANA', comps, 'prop-ana-offer2'))::jsonb;
  perform pg_temp.said('a second proposal is version 2 of the same offer', v2->>'version' || ':' || (v2->>'offer' = v1->>'offer')::text, '2:true');
  perform pg_temp.counted('one offer, two versions', (select count(*) from public.aid_offers) * 10 + (select count(*) from public.aid_offer_versions), 12);

  perform pg_temp.counted('Ana reads nothing of an unapproved offer', pg_temp.seen(ana, 'select 1 from public.aid_offers') + pg_temp.seen(ana, 'select 1 from public.aid_offer_versions'), 0);
  perform pg_temp.counted('a member with no grant reads none', pg_temp.seen(eve, 'select 1 from public.aid_offer_versions'), 0);
  perform pg_temp.counted('the officer reads both versions', pg_temp.seen(officer, 'select 1 from public.aid_offer_versions'), 2);
  perform pg_temp.counted('a director of another school reads none', pg_temp.seen(outsider, 'select 1 from public.aid_offer_versions'), 0);

  -- ── Approving: a second person ─────────────────────────────────
  perform pg_temp.refused_for('the proposer, who lacks aid:approve, approving', officer, format($q$select public.aid_offer_approve(%L, 'appr-off-key001')$q$, v2->>'id'), 'that needs aid:approve');
  perform pg_temp.refused_for('a student approving', ana, format($q$select public.aid_offer_approve(%L, 'appr-ana-key001')$q$, v2->>'id'), 'that needs aid:approve');
  perform pg_temp.refused_for('approving a superseded version', director, format($q$select public.aid_offer_approve(%L, 'appr-old-key001')$q$, v1->>'id'), 'superseded');
  v3 := pg_temp.ask(dual, format($q$select public.aid_offer_propose('S-BEN', '2026-27', %L::jsonb, 'Ben first offer', 'prop-ben-offer1')$q$, '[{"key":"grant1","kind":"grant","name":"Institutional grant","amount_cents":200000}]'))::jsonb;
  perform pg_temp.refused_for('someone holding both roles approving their own proposal', dual, format($q$select public.aid_offer_approve(%L, 'appr-dual-key01')$q$, v3->>'id'), 'someone other than who proposed');
  begin
    insert into public.aid_offer_approvals (offer_version_id, tenant_id, approved_by) values ((v3->>'id')::uuid, 'fa-u', dual);
    raise exception 'FAILED: an offer was approved by its proposer';
  exception when insufficient_privilege then
    raise notice 'ok  an offer is never approved by its proposer, whatever writes it (%)', sqlerrm;
  end;
  r := pg_temp.ask(director, format($q$select public.aid_offer_approve(%L, 'appr-dir-key001')$q$, v2->>'id'))::jsonb;
  r2 := pg_temp.ask(director, format($q$select public.aid_offer_approve(%L, 'appr-dir-key001')$q$, v2->>'id'))::jsonb;
  perform pg_temp.said('approving, and the same key answers the same', r2::text, r::text);
  perform pg_temp.refused_for('approving it again', director, format($q$select public.aid_offer_approve(%L, 'appr-dir-key002')$q$, v2->>'id'), 'already approved');
  perform pg_temp.works('approving Ben''s', director, format($q$select public.aid_offer_approve(%L, 'appr-dir-key003')$q$, v3->>'id'));

  -- ── The student answers ────────────────────────────────────────
  perform pg_temp.counted('Ana now reads her offer', pg_temp.seen(ana, 'select 1 from public.aid_offers'), 1);
  perform pg_temp.counted('and only the approved version', pg_temp.seen(ana, 'select 1 from public.aid_offer_versions'), 1);
  perform pg_temp.counted('Ben reads his, not hers', pg_temp.seen(ben, 'select 1 from public.aid_offers'), 1);
  perform pg_temp.refused_for('Ben answering Ana''s offer', ben, format($q$select public.aid_offer_respond(%L, 'pell', 'accept', 'resp-ben-key001')$q$, v2->>'id'), 'no such offer');
  perform pg_temp.refused_for('answering the unapproved first version', ana, format($q$select public.aid_offer_respond(%L, 'pell', 'accept', 'resp-ana-old-k1')$q$, v1->>'id'), 'no such offer');
  perform pg_temp.refused_for('answering a part that is not in the offer', ana, format($q$select public.aid_offer_respond(%L, 'tuition', 'accept', 'resp-ana-bad-k1')$q$, v2->>'id'), 'not a part');
  perform pg_temp.refused_for('answering with something else', ana, format($q$select public.aid_offer_respond(%L, 'pell', 'maybe', 'resp-ana-maybe1')$q$, v2->>'id'), 'accept or decline');
  r := pg_temp.ask(ana, format($q$select public.aid_offer_respond(%L, 'pell', 'accept', 'resp-ana-pell01')$q$, v2->>'id'))::jsonb;
  r2 := pg_temp.ask(ana, format($q$select public.aid_offer_respond(%L, 'pell', 'accept', 'resp-ana-pell01')$q$, v2->>'id'))::jsonb;
  perform pg_temp.said('accepting a part, and the same key answers the same', r2::text, r::text);
  perform pg_temp.refused_for('answering the same part twice', ana, format($q$select public.aid_offer_respond(%L, 'pell', 'decline', 'resp-ana-pell02')$q$, v2->>'id'), 'already answered');
  perform pg_temp.works('declining the loan', ana, format($q$select public.aid_offer_respond(%L, 'loan1', 'decline', 'resp-ana-loan01')$q$, v2->>'id'));
  perform pg_temp.counted('Ana reads her two answers', pg_temp.seen(ana, 'select 1 from public.aid_offer_responses'), 2);
  perform pg_temp.counted('Ben reads none of hers', pg_temp.seen(ben, 'select 1 from public.aid_offer_responses'), 0);

  -- ── Disbursement ───────────────────────────────────────────────
  perform pg_temp.refused_for('a director disbursing', director, format($q$select public.aid_disburse(%L, 'pell', '2026FA', 150000, 'EFT-0001', 'disb-dir-key001')$q$, v2->>'id'), 'that needs aid:disburse');
  perform pg_temp.refused_for('disbursing a part the student declined', officer, format($q$select public.aid_disburse(%L, 'loan1', '2026FA', 100000, 'EFT-0002', 'disb-loan-key01')$q$, v2->>'id'), 'not been accepted');
  perform pg_temp.refused_for('disbursing an unapproved version', officer, format($q$select public.aid_disburse(%L, 'pell', '2026FA', 100000, 'EFT-0003', 'disb-v1-key0001')$q$, v1->>'id'), 'not approved');
  perform pg_temp.refused_for('an amount of zero', officer, format($q$select public.aid_disburse(%L, 'pell', '2026FA', 0, 'EFT-0004', 'disb-zero-key01')$q$, v2->>'id'), 'above zero');
  perform pg_temp.refused_for('a term that is not a term', officer, format($q$select public.aid_disburse(%L, 'pell', 'Fall', 100000, 'EFT-0005', 'disb-term-key01')$q$, v2->>'id'), 'check');
  r := pg_temp.ask(officer, format($q$select public.aid_disburse(%L, 'pell', '2026FA', 150000, 'EFT-0001', 'disb-off-key001')$q$, v2->>'id'))::jsonb;
  r2 := pg_temp.ask(officer, format($q$select public.aid_disburse(%L, 'pell', '2026FA', 150000, 'EFT-0001', 'disb-off-key001')$q$, v2->>'id'))::jsonb;
  perform pg_temp.said('disbursing half, and the same key answers the same', r2->>'id', r->>'id');
  perform pg_temp.said('with half remaining', r->>'remaining_cents', '150000');
  perform pg_temp.counted('and recorded once', (select count(*) from public.aid_disbursements), 1);
  perform pg_temp.refused_for('disbursing more than the part holds', officer, format($q$select public.aid_disburse(%L, 'pell', '2026SP', 150001, 'EFT-0006', 'disb-over-key01')$q$, v2->>'id'), 'more than this part holds');
  perform pg_temp.works('disbursing the rest', officer, format($q$select public.aid_disburse(%L, 'pell', '2027SP', 150000, 'EFT-0007', 'disb-off-key002')$q$, v2->>'id'));
  perform pg_temp.refused_for('disbursing anything more', officer, format($q$select public.aid_disburse(%L, 'pell', '2027SP', 1, 'EFT-0008', 'disb-off-key003')$q$, v2->>'id'), 'more than this part holds');
  perform pg_temp.counted('Ana reads her two disbursements', pg_temp.seen(ana, 'select 1 from public.aid_disbursements'), 2);
  perform pg_temp.counted('Ben reads none of hers', pg_temp.seen(ben, 'select 1 from public.aid_disbursements'), 0);
  begin
    update public.aid_disbursements set amount_cents = 1;
    raise exception 'FAILED: a disbursement was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a disbursement is never rewritten (%)', sqlerrm;
  end;
  begin
    update public.aid_offer_versions set components = '[]'::jsonb;
    raise exception 'FAILED: an offer version was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  an offer version is never rewritten (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('a client writing a disbursement directly', officer,
    format($q$insert into public.aid_disbursements (tenant_id, offer_version_id, component_key, term, amount_cents, reference, operation) values ('fa-u', %L, 'pell', '2026FA', 1, 'EFT-9', 'x')$q$, v2->>'id'), 'permission denied');

  -- ── Progress: a policy, a rule, then a person ──────────────────
  perform pg_temp.refused_for('an evaluation before any policy', officer, $q$select public.aid_sap_evaluate('S-ANA', 'sap-nopol-key01')$q$, 'not set a progress policy');
  perform pg_temp.refused_for('the officer setting the policy', officer, $q$select public.aid_sap_policy_set(2.0, 67, 'Catalog policy', 'pol-off-key0001')$q$, 'that needs aid:determine');
  pol := pg_temp.ask(director, $q$select public.aid_sap_policy_set(2.0, 67, 'Catalog policy 2026-27', 'pol-dir-key0001')$q$)::jsonb;
  perform pg_temp.said('the first policy is version 1', pol->>'version', '1');
  perform pg_temp.said('a change is version 2', pg_temp.ask(director, $q$select (public.aid_sap_policy_set(2.0, 67, 'Same thresholds, reissued', 'pol-dir-key0002'))->>'version'$q$), '2');
  perform pg_temp.counted('the officer cannot read the policy (staff with aid:read can)', pg_temp.seen(officer, 'select 1 from public.aid_sap_policies'), 2);
  perform pg_temp.counted('a student cannot', pg_temp.seen(ana, 'select 1 from public.aid_sap_policies'), 0);
  perform pg_temp.refused_for('a student evaluating', ana, $q$select public.aid_sap_evaluate('S-ANA', 'sap-ana-key0001')$q$, 'that needs aid:evaluate');
  perform pg_temp.refused_for('a director (who does not evaluate) evaluating', director, $q$select public.aid_sap_evaluate('S-ANA', 'sap-dir-key0001')$q$, 'that needs aid:evaluate');
  ev_ana := pg_temp.ask(officer, $q$select public.aid_sap_evaluate('S-ANA', 'sap-ana-eval001')$q$)::jsonb;
  perform pg_temp.said('Ana''s GPA is 3.5 over six graded credits', ev_ana->>'gpa', '3.5');
  perform pg_temp.said('attempted counts transfer credit: 3 + 3 + 4', ev_ana->>'attempted', '10');
  perform pg_temp.said('earned does too', ev_ana->>'earned', '10');
  perform pg_temp.said('completion is 100', ev_ana->>'completion_pct', '100');
  perform pg_temp.said('she meets both', (ev_ana->>'meets_gpa') || ':' || (ev_ana->>'meets_completion'), 'true:true');
  ev_ben := pg_temp.ask(dual, $q$select public.aid_sap_evaluate('S-BEN', 'sap-ben-eval001')$q$)::jsonb;
  perform pg_temp.said('Ben''s GPA is 0.667 (F, F, C over nine credits)', ev_ben->>'gpa', '0.667');
  perform pg_temp.said('his completion is 33.33', ev_ben->>'completion_pct', '33.33');
  perform pg_temp.said('he meets neither', (ev_ben->>'meets_gpa') || ':' || (ev_ben->>'meets_completion'), 'false:false');
  perform pg_temp.said('the evaluation is against the newest policy', (select p.version::text from public.aid_sap_evaluations e join public.aid_sap_policies p on p.id = e.policy_id where e.id = (ev_ana->>'id')::uuid), '2');

  perform pg_temp.refused_for('the officer determining', officer, format($q$select public.aid_sap_determine(%L, '2026-27', 'satisfactory', 'Meets the policy in full.', 'det-off-key0001')$q$, ev_ana->>'id'), 'that needs aid:determine');
  perform pg_temp.refused_for('someone determining their own evaluation', dual, format($q$select public.aid_sap_determine(%L, '2026-27', 'suspended', 'Does not meet the policy at all.', 'det-dual-key001')$q$, ev_ben->>'id'), 'someone other than who ran');
  perform pg_temp.refused_for('satisfactory on an evaluation that failed', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'satisfactory', 'A person''s kindness is not a rule.', 'det-sat-key0001')$q$, ev_ben->>'id'), 'does not meet the policy');
  perform pg_temp.refused_for('a reason too short', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'warning', 'short', 'det-short-key01')$q$, ev_ben->>'id'), 'check');
  perform pg_temp.refused_for('reinstating a student who is not suspended', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'reinstated', 'An appeal outcome that has nothing to appeal.', 'det-reinst-key1')$q$, ev_ana->>'id'), 'follows a suspension');
  perform pg_temp.works('satisfactory for Ana', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'satisfactory', 'Meets the policy in full.', 'det-dir-key0001')$q$, ev_ana->>'id'));
  perform pg_temp.said('Ana''s standing is satisfactory', private.aid_standing('fa-u', 'S-ANA', '2026-27'), 'satisfactory');
  perform pg_temp.counted('Ana reads her evaluation and determination', pg_temp.seen(ana, 'select 1 from public.aid_sap_evaluations') + pg_temp.seen(ana, 'select 1 from public.aid_sap_determinations'), 2);
  perform pg_temp.counted('Ben reads none of hers', pg_temp.seen(ben, 'select 1 from public.aid_sap_evaluations where student_ref = ''S-ANA'''), 0);

  -- ── A suspension stops disbursement; a reinstatement lifts it ──
  perform pg_temp.works('Ben accepting his grant', ben, format($q$select public.aid_offer_respond(%L, 'grant1', 'accept', 'resp-ben-grant1')$q$, v3->>'id'));
  perform pg_temp.works('the director suspending Ben', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'suspended', 'Below the policy on both measures.', 'det-dir-key0002')$q$, ev_ben->>'id'));
  perform pg_temp.refused_for('disbursing to a suspended student', officer, format($q$select public.aid_disburse(%L, 'grant1', '2026FA', 100000, 'EFT-1001', 'disb-ben-key001')$q$, v3->>'id'), 'suspended');
  perform pg_temp.refused_for('a reinstatement with a thin reason', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'reinstated', 'Appeal granted.', 'det-reinst-key2')$q$, ev_ben->>'id'), 'twenty characters');
  perform pg_temp.works('a reinstatement with its reason', director, format($q$select public.aid_sap_determine(%L, '2026-27', 'reinstated', 'Appeal upheld: documented medical leave in the fall term.', 'det-reinst-key3')$q$, ev_ben->>'id'));
  perform pg_temp.works('and disbursement again', officer, format($q$select public.aid_disburse(%L, 'grant1', '2026FA', 100000, 'EFT-1001', 'disb-ben-key002')$q$, v3->>'id'));

  -- ── A newer approved version supersedes ────────────────────────
  r := pg_temp.ask(officer, format($q$select public.aid_offer_propose('S-ANA', '2026-27', %L::jsonb, 'Third offer', 'prop-ana-offer3')$q$, comps))::jsonb;
  perform pg_temp.works('approving the third version', director, format($q$select public.aid_offer_approve(%L, 'appr-dir-key004')$q$, r->>'id'));
  perform pg_temp.refused_for('disbursing against the replaced version', officer, format($q$select public.aid_disburse(%L, 'pell', '2027SU', 1, 'EFT-0009', 'disb-old-key001')$q$, v2->>'id'), 'replaced by a newer approved version');
  perform pg_temp.refused_for('answering the replaced version', ana, format($q$select public.aid_offer_respond(%L, 'pell', 'accept', 'resp-ana-old-k2')$q$, v2->>'id'), 'replaced by a newer one');

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'fa-u' and module = 'financial_aid';
  perform pg_temp.refused_for('disbursing while the module is frozen', officer, format($q$select public.aid_disburse(%L, 'grant1', '2026SP', 1, 'EFT-2001', 'disb-frozen-key')$q$, v3->>'id'), 'does not run financial aid in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'fa-u' and module = 'financial_aid';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('fa-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('answering under the kill switch', ben, format($q$select public.aid_offer_respond(%L, 'grant1', 'decline', 'resp-ben-killed1')$q$, v3->>'id'), 'does not run financial aid in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'fa-u';

  -- ── Deleting accounts ──────────────────────────────────────────
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting the student keeps the school''s aid record', (select count(*) from public.aid_disbursements where offer_version_id = (v2->>'id')::uuid), 2);
  perform pg_temp.counted('and clears who answered', (select count(*) from public.aid_offer_responses where responder is null), 2);
  delete from auth.users where id = officer;
  perform pg_temp.counted('deleting the officer keeps what they proposed and disbursed',
    (select count(*) from public.aid_offer_versions where proposed_by is null) + (select count(*) from public.aid_disbursements where disbursed_by is null), 3 + 3);
  raise notice 'financial aid checks passed';
end $$;

rollback;
