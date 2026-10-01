-- supabase/advancement.check.sql — who is an alumnus, who records a gift, what a
-- receipt says, and that a refund needs a second person.
--
-- For 20261001100000_advancement.sql. One school, av-u: a director, two gift
-- officers, someone holding both roles, two graduates, a current student, a
-- member with no role and a director of another school. What it proves:
--
--   * nothing is written unless the school runs `advancement` in Core;
--   * an alumni profile exists only because a graduate with a conferred degree
--     opted in; a current student cannot; a profile and a donor hold nothing
--     academic; a donor is not linked to a record;
--   * an alumnus switches solicitation off and the office can no longer record a
--     solicitation, while a thank-you is still allowed; contact permission is
--     only ever withdrawn; an opt-out is for good and the alumnus is no longer
--     recorded as a constituent;
--   * a gift cannot be recorded until the school has set its receipt wording, then
--     issues a numbered receipt from that wording in the same transaction; a gift
--     and a receipt are never rewritten;
--   * a refund is by someone other than who recorded the gift, even where one
--     person holds both roles and even when the row is written directly;
--   * an officer reads the donors in their portfolio and the notes they wrote, a
--     director all, an alumnus their own giving; a member reads a campaign's goal
--     and total and no names;
--   * deleting an alumnus removes their profile and keeps the school's gifts.
--
--   How to run it: supabase/check.sh advancement

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
  director uuid; officer uuid; officer2 uuid; dual uuid; ana uuid; ben uuid; cara uuid; eve uuid; outsider uuid;
  pa uuid; pc uuid; donor_a jsonb; donor_f jsonb; fund jsonb; camp jsonb; g1 jsonb; g2 jsonb; g3 jsonb; r jsonb; r2 jsonb; pl jsonb; n bigint;
  gift_sql constant text := $q$select public.adv_gift_record(%L, %L, %L, null, %s, %s, 'check', %L, '', %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values ('av-u', 'Advancement University', array['av-u.example']), ('av-other', 'Other University', array['av-other.example']);
  director := pg_temp.newuser('director@av-u.example', 'av-u');
  officer  := pg_temp.newuser('officer@av-u.example', 'av-u');
  officer2 := pg_temp.newuser('officer2@av-u.example', 'av-u');
  dual     := pg_temp.newuser('dual@av-u.example', 'av-u');
  ana      := pg_temp.newuser('ana@av-u.example', 'av-u');
  ben      := pg_temp.newuser('ben@av-u.example', 'av-u');
  cara     := pg_temp.newuser('cara@av-u.example', 'av-u');
  eve      := pg_temp.newuser('eve@av-u.example', 'av-u');
  outsider := pg_temp.newuser('outsider@av-other.example', 'av-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (director, 'advancement_director', 'school', 'av-u', 'institution'),
    (officer,  'advancement_officer',  'school', 'av-u', 'institution'),
    (officer2, 'advancement_officer',  'school', 'av-u', 'institution'),
    (dual,     'advancement_officer',  'school', 'av-u', 'institution'),
    (dual,     'advancement_director', 'school', 'av-u', 'institution'),
    (outsider, 'advancement_director', 'school', 'av-other', 'institution');
  insert into public.academic_record_subjects (tenant_id, student_ref, user_id) values ('av-u', 'S-ANA', ana), ('av-u', 'S-BEN', ben), ('av-u', 'S-CARA', cara);
  -- Ana and Cara have graduated; Ben is a current student.
  perform pg_temp.entry('av-u', 'S-ANA', 'conferral', 'BA Economics', 'conferred');
  perform pg_temp.entry('av-u', 'S-CARA', 'conferral', 'BA History', 'conferred');
  perform pg_temp.entry('av-u', 'S-BEN', 'grade', 'ECON 1010 · Fall 2026', 'B');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('opting in while the school is in Connect', ana, $q$select public.alumni_opt_in('Ana A.', 2026, 'optin-connect-key')$q$, 'does not run advancement in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('av-u', 'advancement', 'core', false, 'check');

  -- ── Alumni opt in, and only graduates ──────────────────────────
  perform pg_temp.refused_for('a current student opting in', ben, $q$select public.alumni_opt_in('Ben B.', 2029, 'optin-ben-key001')$q$, 'conferred degree');
  perform pg_temp.refused_for('a member with no record link opting in', eve, $q$select public.alumni_opt_in('Eve E.', 2020, 'optin-eve-key001')$q$, 'conferred degree');
  r := pg_temp.ask(ana, $q$select public.alumni_opt_in('Ana A.', 2026, 'optin-ana-key001')$q$)::jsonb;
  r2 := pg_temp.ask(ana, $q$select public.alumni_opt_in('Ana A.', 2026, 'optin-ana-key001')$q$)::jsonb;
  perform pg_temp.said('opting in, and the same key answers the same', r2->>'id', r->>'id');
  perform pg_temp.refused_for('opting in twice', ana, $q$select public.alumni_opt_in('Ana A.', 2026, 'optin-ana-key002')$q$, 'already opted in');
  pa := (r->>'id')::uuid;
  pc := (pg_temp.ask(cara, $q$select public.alumni_opt_in('Cara C.', 2025, 'optin-cara-key01')$q$)::jsonb->>'id')::uuid;
  perform pg_temp.counted('two alumni, no students', (select count(*) from public.alumni_profiles), 2);
  perform pg_temp.counted('an alumni profile holds nothing academic', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'alumni_profiles' and column_name ~ 'student|grade|record|credit|gpa'), 0);
  perform pg_temp.counted('and neither does a donor', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'advancement_donors' and column_name ~ 'student|grade|record|credit|gpa'), 0);
  perform pg_temp.counted('Ana reads her own profile', pg_temp.seen(ana, 'select 1 from public.alumni_profiles'), 1);
  perform pg_temp.counted('a member reads none', pg_temp.seen(eve, 'select 1 from public.alumni_profiles'), 0);
  perform pg_temp.counted('a current student reads none', pg_temp.seen(ben, 'select 1 from public.alumni_profiles'), 0);
  perform pg_temp.counted('the gift office reads both opted-in profiles', pg_temp.seen(officer, 'select 1 from public.alumni_profiles'), 2);
  perform pg_temp.counted('an officer of another school reads none', pg_temp.seen(outsider, 'select 1 from public.alumni_profiles'), 0);
  perform pg_temp.refused_for('a client writing a profile directly', ana, $q$insert into public.alumni_profiles (tenant_id, user_id, display_name, class_year) values ('av-u', gen_random_uuid(), 'X', 2020)$q$, 'permission denied');

  -- ── Receipt wording before gifts ───────────────────────────────
  perform pg_temp.refused_for('the officer setting receipt wording', officer, $q$select public.adv_settings_set('Advancement University', 'The institution received your gift; no goods or services were provided.', '', 'set-off-key0001')$q$, 'that needs adv:configure');
  perform pg_temp.refused_for('wording too short to be wording', director, $q$select public.adv_settings_set('Advancement University', 'Thanks!', '', 'set-short-key01')$q$, 'check');
  fund := pg_temp.ask(director, $q$select public.adv_fund_save('unr-1', 'Annual Fund', 'unrestricted', 'fund-dir-key0001')$q$)::jsonb;
  perform pg_temp.refused_for('the officer saving a fund', officer, $q$select public.adv_fund_save('SCH-1', 'Scholarships', 'restricted', 'fund-off-key0001')$q$, 'that needs adv:configure');
  perform pg_temp.refused_for('a fund code that is not a code', director, $q$select public.adv_fund_save('bad code!', 'X', 'restricted', 'fund-bad-key0001')$q$, 'check');
  camp := pg_temp.ask(director, $q$select public.adv_campaign_save('Giving Day 2026', 'giving_day', 5000000, current_date - 1, current_date + 1, 'UNR-1', 'camp-dir-key0001')$q$)::jsonb;
  perform pg_temp.refused_for('a campaign that ends before it begins', director, $q$select public.adv_campaign_save('Backwards', 'campaign', 100, current_date, current_date - 5, '', 'camp-bad-key0001')$q$, 'advancement_campaign_dates');
  perform pg_temp.counted('a member reads funds and campaigns', pg_temp.seen(eve, 'select 1 from public.advancement_funds') + pg_temp.seen(eve, 'select 1 from public.advancement_campaigns'), 2);

  -- ── Donors ─────────────────────────────────────────────────────
  perform pg_temp.refused_for('a member saving a donor', eve, format($q$select public.adv_donor_save('friend', 'Friend', '', null, 'donor-eve-key0001')$q$), 'that needs adv:gift');
  perform pg_temp.refused_for('an alumnus donor with no profile', officer, $q$select public.adv_donor_save('alumnus', 'Nobody', '', null, 'donor-nopro-key1')$q$, 'opted in');
  perform pg_temp.refused_for('a friend linked to an alumni profile', officer, format($q$select public.adv_donor_save('friend', 'Friend', '', %L, 'donor-link-key01')$q$, pa), 'only an alumnus donor links');
  donor_a := pg_temp.ask(officer, format($q$select public.adv_donor_save('alumnus', 'Ana A.', 'ana@example.org', %L, 'donor-ana-key0001')$q$, pa))::jsonb;
  donor_f := pg_temp.ask(officer, $q$select public.adv_donor_save('friend', 'A Friend of the School', '', null, 'donor-fr-key00001')$q$)::jsonb;
  perform pg_temp.said('an opted-in alumnus is solicitable by default', (select contact_ok::text from public.advancement_donors where id = (donor_a->>'id')::uuid), 'true');
  perform pg_temp.said('a friend is not, until someone records that they agreed', (select contact_ok::text from public.advancement_donors where id = (donor_f->>'id')::uuid), 'false');

  -- ── Portfolios ─────────────────────────────────────────────────
  perform pg_temp.counted('before an assignment an officer reads no donor', pg_temp.seen(officer, 'select 1 from public.advancement_donors'), 0);
  perform pg_temp.refused_for('an officer assigning', officer, format($q$select public.adv_assign(%L, %L, 'assign-off-key001')$q$, donor_a->>'id', officer), 'that needs adv:configure');
  perform pg_temp.refused_for('assigning to someone who is not a gift officer', director, format($q$select public.adv_assign(%L, %L, 'assign-eve-key001')$q$, donor_a->>'id', eve), 'not a gift officer');
  perform pg_temp.works('the director assigning Ana to the officer', director, format($q$select public.adv_assign(%L, %L, 'assign-dir-key001')$q$, donor_a->>'id', officer));
  perform pg_temp.counted('the officer now reads that donor', pg_temp.seen(officer, 'select 1 from public.advancement_donors'), 1);
  perform pg_temp.counted('the other officer reads none', pg_temp.seen(officer2, 'select 1 from public.advancement_donors'), 0);
  perform pg_temp.counted('the director reads both', pg_temp.seen(director, 'select 1 from public.advancement_donors'), 2);
  perform pg_temp.counted('Ana reads her own donor record', pg_temp.seen(ana, 'select 1 from public.advancement_donors'), 1);
  perform pg_temp.counted('a member reads none', pg_temp.seen(eve, 'select 1 from public.advancement_donors'), 0);
  perform pg_temp.works('re-assigning Ana to the other officer', director, format($q$select public.adv_assign(%L, %L, 'assign-dir-key002')$q$, donor_a->>'id', officer2));
  perform pg_temp.counted('the first officer no longer reads her', pg_temp.seen(officer, 'select 1 from public.advancement_donors'), 0);
  perform pg_temp.counted('the second does', pg_temp.seen(officer2, 'select 1 from public.advancement_donors'), 1);
  perform pg_temp.works('and back, for the rest of the check', director, format($q$select public.adv_assign(%L, %L, 'assign-dir-key003')$q$, donor_a->>'id', officer));

  -- ── Gifts and receipts ─────────────────────────────────────────
  perform pg_temp.refused_for('a gift before the school has set its receipt wording', officer, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '10000', 'current_date', 'CHK-1001', 'gift-early-key01'), 'not set its receipt wording');
  perform pg_temp.works('the director setting the wording', director, $q$select public.adv_settings_set('Advancement University', 'Advancement University is a tax-exempt institution. No goods or services were provided in exchange for this gift.', 'None.', 'set-dir-key00001')$q$);
  perform pg_temp.refused_for('a member recording a gift', eve, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '10000', 'current_date', 'CHK-1002', 'gift-eve-key0001'), 'that needs adv:gift');
  perform pg_temp.refused_for('a gift of nothing', officer, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '0', 'current_date', 'CHK-1003', 'gift-zero-key001'), 'check');
  perform pg_temp.refused_for('a gift dated tomorrow', officer, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '100', 'current_date + 1', 'CHK-1004', 'gift-future-key1'), 'when it is received');
  perform pg_temp.refused_for('a gift to a fund that does not exist', officer, format(gift_sql, donor_a->>'id', 'NOPE-1', camp->>'id', '100', 'current_date', 'CHK-1005', 'gift-nofund-key1'), 'no such fund');
  g1 := pg_temp.ask(officer, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '250000', 'current_date', 'CHK-1006', 'gift-off-key0001'))::jsonb;
  r2 := pg_temp.ask(officer, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '250000', 'current_date', 'CHK-1006', 'gift-off-key0001'))::jsonb;
  perform pg_temp.said('the same key answers the same gift', r2->>'id', g1->>'id');
  perform pg_temp.said('the first receipt is numbered 000001', g1->>'receipt', 'R-' || extract(year from current_date)::int || '-000001');
  g2 := pg_temp.ask(officer, format(gift_sql, donor_f->>'id', 'UNR-1', camp->>'id', '50000', 'current_date', 'CHK-1007', 'gift-off-key0002'))::jsonb;
  perform pg_temp.said('the second is 000002', g2->>'receipt', 'R-' || extract(year from current_date)::int || '-000002');
  perform pg_temp.counted('two gifts, two receipts', (select count(*) from public.advancement_gifts) * 10 + (select count(*) from public.advancement_receipts), 22);
  perform pg_temp.said('the receipt carries the school''s own wording', ((select content->>'statement' from public.advancement_receipts where gift_id = (g1->>'id')::uuid) like 'Advancement University is a tax-exempt%')::text, 'true');
  perform pg_temp.said('and a hash of what it says', (select (content_hash = encode(sha256(convert_to(content::text, 'UTF8')), 'hex'))::text from public.advancement_receipts where gift_id = (g1->>'id')::uuid), 'true');
  begin
    update public.advancement_gifts set amount_cents = 1;
    raise exception 'FAILED: a gift was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a gift is never rewritten (%)', sqlerrm;
  end;
  begin
    update public.advancement_receipts set content = '{}'::jsonb;
    raise exception 'FAILED: a receipt was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a receipt is never rewritten (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('a client writing a gift directly', officer, format($q$insert into public.advancement_gifts (tenant_id, donor_id, fund_id, amount_cents, received_on, method, reference, operation) values ('av-u', %L, %L, 1, current_date, 'cash', 'abc', 'x')$q$, donor_a->>'id', fund->>'id'), 'permission denied');

  -- The donor portal.
  perform pg_temp.counted('Ana reads her gift and its receipt', pg_temp.seen(ana, 'select 1 from public.advancement_gifts') * 10 + pg_temp.seen(ana, 'select 1 from public.advancement_receipts'), 11);
  perform pg_temp.counted('Cara reads none', pg_temp.seen(cara, 'select 1 from public.advancement_gifts'), 0);
  perform pg_temp.counted('the other officer reads only the gifts they recorded (none)', pg_temp.seen(officer2, 'select 1 from public.advancement_gifts'), 0);
  perform pg_temp.counted('the officer reads the gifts they recorded', pg_temp.seen(officer, 'select 1 from public.advancement_gifts'), 2);
  perform pg_temp.counted('the director reads all', pg_temp.seen(director, 'select 1 from public.advancement_gifts'), 2);

  -- ── Refunds: a second person ───────────────────────────────────
  perform pg_temp.refused_for('the officer refunding', officer, format($q$select public.adv_gift_refund(%L, 'Donor asked for it back in writing', 'REF-1', 'refund-off-key01')$q$, g2->>'id'), 'that needs adv:refund');
  g3 := pg_temp.ask(dual, format(gift_sql, donor_f->>'id', 'UNR-1', camp->>'id', '1000', 'current_date', 'CHK-1008', 'gift-dual-key0001'))::jsonb;
  perform pg_temp.refused_for('someone holding both roles refunding their own recording', dual, format($q$select public.adv_gift_refund(%L, 'Recorded in error by me.', 'REF-2', 'refund-dual-key01')$q$, g3->>'id'), 'someone other than who recorded');
  begin
    insert into public.advancement_refunds (gift_id, tenant_id, reason, refunded_by, operation) values ((g3->>'id')::uuid, 'av-u', 'Recorded in error by me.', dual, 'x');
    raise exception 'FAILED: a gift was refunded by its recorder';
  exception when insufficient_privilege then
    raise notice 'ok  a gift is never refunded by its recorder, whatever writes it (%)', sqlerrm;
  end;
  r := pg_temp.ask(director, format($q$select public.adv_gift_refund(%L, 'Donor asked for it back in writing', 'REF-3', 'refund-dir-key01')$q$, g2->>'id'))::jsonb;
  r2 := pg_temp.ask(director, format($q$select public.adv_gift_refund(%L, 'Donor asked for it back in writing', 'REF-3', 'refund-dir-key01')$q$, g2->>'id'))::jsonb;
  perform pg_temp.said('refunding, and the same key answers the same', r2::text, r::text);
  perform pg_temp.refused_for('refunding twice', director, format($q$select public.adv_gift_refund(%L, 'Donor asked for it back in writing', 'REF-4', 'refund-dir-key02')$q$, g2->>'id'), 'already refunded');

  -- ── A campaign's progress, for anyone, naming no one ───────────
  r := pg_temp.ask(eve, format($q$select public.adv_campaign_progress(%L)$q$, camp->>'id'))::jsonb;
  perform pg_temp.said('a member reads the goal and what is raised, net of the refund', (r->>'goal_cents') || ':' || (r->>'raised_cents') || ':' || (r->>'gifts'), '5000000:251000:2');
  perform pg_temp.refused_for('a member of another school reading it', outsider, format($q$select public.adv_campaign_progress(%L)$q$, camp->>'id'), 'no such campaign');

  -- ── Pledges ────────────────────────────────────────────────────
  perform pg_temp.refused_for('a one-time pledge of three installments', officer, format($q$select public.adv_pledge_save(%L, 'UNR-1', null, 120000, 'one_time', 3, current_date, 'pledge-bad-key001')$q$, donor_a->>'id'), 'one installment');
  pl := pg_temp.ask(officer, format($q$select public.adv_pledge_save(%L, 'UNR-1', null, 12000, 'monthly', 12, current_date, 'pledge-off-key001')$q$, donor_a->>'id'))::jsonb;
  perform pg_temp.counted('Ana reads her pledge', pg_temp.seen(ana, 'select 1 from public.advancement_pledges'), 1);
  perform pg_temp.works('a gift against the pledge', officer, format($q$select public.adv_gift_record(%L, 'UNR-1', null, %L, 12000, current_date, 'card', 'CARD-PLEDGE-1', '', 'gift-pledge-key01')$q$, donor_a->>'id', pl->>'id'));
  perform pg_temp.refused_for('a gift against someone else''s pledge', officer, format($q$select public.adv_gift_record(%L, 'UNR-1', null, %L, 12000, current_date, 'card', 'CARD-PLEDGE-2', '', 'gift-pledge-key02')$q$, donor_f->>'id', pl->>'id'), 'not this donor');
  perform pg_temp.works('cancelling the pledge', officer, format($q$select public.adv_pledge_cancel(%L, 'The donor moved overseas.', 'pledge-cancel-key1')$q$, pl->>'id'));
  perform pg_temp.refused_for('cancelling it twice', officer, format($q$select public.adv_pledge_cancel(%L, 'Already cancelled above.', 'pledge-cancel-key2')$q$, pl->>'id'), 'already cancelled');

  -- ── Contact notes and solicitation ─────────────────────────────
  perform pg_temp.refused_for('a note on a donor outside the portfolio', officer2, format($q$select public.adv_note_add(%L, 'call', 'Rang her.', 'note-off2-key001')$q$, donor_a->>'id'), 'not in your portfolio');
  perform pg_temp.works('a solicitation note on a solicitable alumna', officer, format($q$select public.adv_note_add(%L, 'solicitation', 'Asked about the annual fund.', 'note-off-key0001')$q$, donor_a->>'id'));
  perform pg_temp.counted('the author reads it', pg_temp.seen(officer, 'select 1 from public.advancement_notes'), 1);
  perform pg_temp.counted('the other officer does not', pg_temp.seen(officer2, 'select 1 from public.advancement_notes'), 0);
  perform pg_temp.counted('the director does', pg_temp.seen(director, 'select 1 from public.advancement_notes'), 1);
  perform pg_temp.counted('the alumna does not read what is written about her', pg_temp.seen(ana, 'select 1 from public.advancement_notes'), 0);

  -- ── The alumna's own preferences ───────────────────────────────
  perform pg_temp.refused_for('a stranger setting preferences', eve, $q$select public.alumni_preferences(true, true, false, 'prefs-eve-key0001')$q$, 'not opted in');
  perform pg_temp.works('Ana turning solicitation off and the directory on', ana, $q$select public.alumni_preferences(true, false, false, 'prefs-ana-key0001')$q$);
  perform pg_temp.said('her donor record stops being contactable', (select contact_ok::text from public.advancement_donors where id = (donor_a->>'id')::uuid), 'false');
  perform pg_temp.refused_for('a solicitation note after that', officer, format($q$select public.adv_note_add(%L, 'solicitation', 'Asked again.', 'note-off-key0002')$q$, donor_a->>'id'), 'may not be solicited');
  perform pg_temp.works('a stewardship note is still allowed (thanking her)', officer, format($q$select public.adv_note_add(%L, 'stewardship', 'Sent a thank-you note.', 'note-off-key0003')$q$, donor_a->>'id'));
  begin
    update public.advancement_donors set contact_ok = true where id = (donor_a->>'id')::uuid;
    raise exception 'FAILED: contact permission was granted by a rewrite';
  exception when insufficient_privilege then
    raise notice 'ok  contact permission is only ever withdrawn (%)', sqlerrm;
  end;
  perform pg_temp.works('Cara opting out entirely', cara, $q$select public.alumni_preferences(false, false, true, 'prefs-cara-key0001')$q$);
  perform pg_temp.refused_for('opting back in by preferences', cara, $q$select public.alumni_preferences(true, true, false, 'prefs-cara-key0002')$q$, 'that stays');
  begin
    update public.alumni_profiles set opted_out_at = null, solicitable = true where id = pc;
    raise exception 'FAILED: an opt-out was undone';
  exception when insufficient_privilege then
    raise notice 'ok  an opt-out is for good (%)', sqlerrm;
  end;
  perform pg_temp.refused_for('recording an alumnus who opted out as a donor', officer, format($q$select public.adv_donor_save('alumnus', 'Cara C.', '', %L, 'donor-cara-key001')$q$, pc), 'opted out');

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'av-u' and module = 'advancement';
  perform pg_temp.refused_for('recording a gift while the module is frozen', officer, format(gift_sql, donor_a->>'id', 'UNR-1', camp->>'id', '100', 'current_date', 'CHK-2001', 'gift-frozen-key1'), 'does not run advancement in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'av-u' and module = 'advancement';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('av-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('opting out under the kill switch', ana, $q$select public.alumni_preferences(false, false, true, 'prefs-ana-killed1')$q$, 'does not run advancement in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'av-u';

  -- ── Deleting accounts keeps the school's financial record ──────
  perform pg_temp.said('an account that opted in is not untouched', public.lti_account_untouched(ana)::text, 'false');
  perform pg_temp.said('a current student with none is', public.lti_account_untouched(eve)::text, 'true');
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting the alumna took her profile', (select count(*) from public.alumni_profiles where id = pa), 0);
  perform pg_temp.counted('and unlinked her donor record, which stays with its gifts', (select count(*) from public.advancement_donors where id = (donor_a->>'id')::uuid and alumni_profile_id is null), 1);
  perform pg_temp.counted('and her gifts and receipts remain', (select count(*) from public.advancement_gifts where donor_id = (donor_a->>'id')::uuid) * 10 + (select count(*) from public.advancement_receipts r join public.advancement_gifts g on g.id = r.gift_id where g.donor_id = (donor_a->>'id')::uuid), 22);
  delete from auth.users where id = officer;
  perform pg_temp.counted('deleting the officer keeps what they recorded', (select count(*) from public.advancement_gifts where recorded_by is null), 3);
  raise notice 'advancement checks passed';
end $$;

rollback;
