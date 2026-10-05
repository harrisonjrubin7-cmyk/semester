-- The go-to-market foundation: the rules in app/src/lib/gtm, held by the database.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh gtm
--
-- Every refusal below names the error it expects, not just "an error": a typo
-- in a statement is also an error, and a suite that counts any exception as a
-- refusal passes on a statement that never reached the guard.
--
-- What this covers, each as the account it is about:
--
--   * No signed-in account holds any privilege on contacts, consent,
--     suppression, sends or conversions, and the contact table has no column
--     beyond the allow-list (so there is nothing sensitive to target on).
--   * An audience naming a sensitive or unclassified field is refused.
--   * A campaign is born draft, is reviewed only in review and never by its
--     owner, is approved only by its named approver after all three reviews,
--     and activates only through the release gate: module on, kill switch
--     released, every required field. Content changes only in draft, and an
--     edit voids the reviews before it.
--   * Another school's staff see none of it.
--   * A send decision is refused without current consent, after STOP, on a
--     withdrawn topic, in the recipient's quiet hours, over the cap, to a
--     suppressed contact, for an inactive campaign, or with a stale consent
--     version; transactional email needs no marketing consent.
--   * Results are suppressed counts, and every read is logged.
--   * Sponsor placements: protected surfaces, prohibited categories and
--     unlabelled placements are refused; the author cannot approve; live needs
--     the school's policy and the module.
--   * The pipeline is Semester's; a customer school reads only its own account.
--     A pilot starts only when ready and converts only when signed and clean.
--   * Campaign and review changes are audited.

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
  raise notice 'ok  %', what;
end $$;

-- Run as someone and require success; returns the row count.
create or replace function pg_temp.run(who uuid, statement text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  if who is null then execute 'set local role postgres'; else perform pg_temp.become(who); end if;
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end $$;

-- Run as someone (null = the worker) and require an error whose message
-- matches `pattern`. Anything else — success, or a different error — fails.
create or replace function pg_temp.refused_with(what text, who uuid, statement text, pattern text)
returns void language plpgsql as $$
declare msg text;
begin
  begin
    if who is null then execute 'set local role postgres'; else perform pg_temp.become(who); end if;
    execute statement;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg ~* pattern then
      raise notice 'ok  % is refused', what;
      return;
    end if;
    raise exception 'FAILED: % — refused, but for the wrong reason: %', what, msg;
  end;
  raise exception 'FAILED: % — was allowed', what;
end $$;

-- An update or delete a policy filters out: no error, no rows.
create or replace function pg_temp.moved_nothing(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  perform pg_temp.counted(what || ' moves nothing', pg_temp.run(who, statement), 0);
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

-- ── The outer lock and the shape of a contact ─────────────────────────────

do $$
declare t text; p text; n bigint;
begin
  foreach t in array array['gtm_prospects', 'gtm_consent', 'gtm_suppression',
                           'gtm_communication_events', 'gtm_conversion_events'] loop
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      perform pg_temp.said(format('authenticated holds no %s on %s', p, t),
        has_table_privilege('authenticated', 'public.' || t, p)::text, 'false');
      perform pg_temp.said(format('nor does anon hold %s on %s', p, t),
        has_table_privilege('anon', 'public.' || t, p)::text, 'false');
    end loop;
  end loop;

  -- The allow-list is the schema. A new column here is a new thing someone
  -- could target on, and it must be argued for in lib/gtm/campaign.ts first.
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public' and table_name = 'gtm_prospects'
     and column_name not in ('id', 'tenant_id', 'public_id', 'crm_reference', 'time_zone', 'created_at', 'updated_at',
                             'lifecycle_stage', 'entry_term', 'program_interest', 'declared_interest',
                             'learner_type', 'region', 'event_registered', 'preferred_language');
  perform pg_temp.counted('a contact has no column outside the allow-list', n, 0);

  -- The control for the count above: it sees the columns that are there.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'gtm_prospects';
  perform pg_temp.counted('and the same query sees all fifteen that are', n, 15);

  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname like 'gtm\_%' and c.relkind = 'r' and not c.relrowsecurity;
  perform pg_temp.counted('every gtm table has row-level security on', n, 0);
end $$;

-- ── Campaigns ─────────────────────────────────────────────────────────────

create temporary table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

do $$
declare
  mgr uuid; mgr2 uuid; reviewer uuid; reviewer2 uuid; approver uuid; analyst uuid; admin uuid; admin2 uuid;
  student uuid; other_mgr uuid; other_analyst uuid; sales uuid;
  camp uuid; n bigint; failures text[];
  page constant text := 'https://gtm-u.example/start?utm_source=email&utm_medium=email&utm_campaign=gtm-u_fall2027_admitted_deposit';
begin
  insert into public.schools (id, name, email_domains) values
    ('gtm-u', 'GTM University', array['gtm-u.example']),
    ('gtm-other', 'Other University', array['gtm-other.example']);

  mgr           := pg_temp.newuser('mgr@gtm-u.example', 'gtm-u');
  mgr2          := pg_temp.newuser('mgr2@gtm-u.example', 'gtm-u');
  reviewer      := pg_temp.newuser('reviewer@gtm-u.example', 'gtm-u');
  reviewer2     := pg_temp.newuser('reviewer2@gtm-u.example', 'gtm-u');
  approver      := pg_temp.newuser('approver@gtm-u.example', 'gtm-u');
  analyst       := pg_temp.newuser('analyst@gtm-u.example', 'gtm-u');
  admin         := pg_temp.newuser('admin@gtm-u.example', 'gtm-u');
  admin2        := pg_temp.newuser('admin2@gtm-u.example', 'gtm-u');
  student       := pg_temp.newuser('student@gtm-u.example', 'gtm-u');
  other_mgr     := pg_temp.newuser('mgr@gtm-other.example', 'gtm-other');
  other_analyst := pg_temp.newuser('analyst@gtm-other.example', 'gtm-other');
  sales         := pg_temp.newuser('sales@semester.example', 'gtm-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (mgr,           'marketing_admin',   'school', 'gtm-u', 'institution'),
    (mgr2,          'marketing_admin',   'school', 'gtm-u', 'institution'),
    (reviewer,      'campaign_reviewer', 'school', 'gtm-u', 'institution'),
    (reviewer2,     'campaign_reviewer', 'school', 'gtm-u', 'institution'),
    (approver,      'campaign_reviewer', 'school', 'gtm-u', 'institution'),
    (analyst,       'marketing_analyst', 'school', 'gtm-u', 'institution'),
    (admin,         'university_admin',  'school', 'gtm-u', 'institution'),
    (admin2,        'university_admin',  'school', 'gtm-u', 'institution'),
    (other_mgr,     'marketing_admin',   'school', 'gtm-other', 'institution'),
    (other_analyst, 'marketing_analyst', 'school', 'gtm-other', 'institution'),
    (sales,         'account_executive', 'platform', '', 'institution');

  insert into ids values ('mgr', mgr), ('mgr2', mgr2), ('reviewer', reviewer), ('reviewer2', reviewer2),
    ('approver', approver), ('analyst', analyst), ('admin', admin), ('admin2', admin2), ('student', student),
    ('other_mgr', other_mgr), ('other_analyst', other_analyst), ('sales', sales);

  -- Audience criteria ------------------------------------------------------
  perform pg_temp.refused_with('an audience on GPA', mgr,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date, audience_criteria)
       values ('gtm-u', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01',
               '[{"field":"gpa","op":"eq","value":"4.0"}]')$q$, 'gtm_campaigns_audience_criteria_check');
  perform pg_temp.refused_with('an audience on aid status', mgr,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date, audience_criteria)
       values ('gtm-u', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01',
               '[{"field":"financial_aid_status","op":"eq","value":"pending"}]')$q$, 'gtm_campaigns_audience_criteria_check');
  perform pg_temp.refused_with('an audience with an extra key smuggling a filter', mgr,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date, audience_criteria)
       values ('gtm-u', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01',
               '[{"field":"region","op":"eq","value":"tn","and":"gpa>3"}]')$q$, 'gtm_campaigns_audience_criteria_check');
  perform pg_temp.refused_with('a landing page carrying other parameters', mgr,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date, landing_page)
       values ('gtm-u', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01',
               'https://gtm-u.example/start?utm_source=email&utm_medium=email&utm_campaign=gtm-u_fall2027_admitted_deposit&email=a@b.edu')$q$,
    'gtm_campaigns_landing_page_check');
  perform pg_temp.refused_with('a campaign at another school', mgr,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date) values ('gtm-other', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01')$q$,
    'row-level security');
  perform pg_temp.refused_with('a campaign born active', mgr,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date, status) values ('gtm-u', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01', 'active')$q$,
    'created as a draft');
  perform pg_temp.refused_with('a student creating a campaign', student,
    $q$insert into public.gtm_campaigns (tenant_id, name, objective, cycle, audience, funnel_stage, channels,
       start_date, end_date) values ('gtm-u', 'x', 'deposit', 'fall2027', 'admitted', 7, '{email}', '2027-03-01', '2027-05-01')$q$,
    'row-level security');

  -- A complete draft ---------------------------------------------------------
  perform pg_temp.run(mgr, format($q$insert into public.gtm_campaigns
     (tenant_id, name, objective, cycle, audience, funnel_stage, channels, start_date, end_date, review_date,
      audience_criteria, primary_cta, approver_id, privacy_basis, consent_requirements, frequency_max,
      frequency_window_days, landing_page, success_metric, escalation_path, claims_substantiated,
      opt_out_tested, conversion_instrumentation_tested, quiet_start, quiet_end)
     values ('gtm-u', 'Admitted — deposit', 'deposit', 'fall2027', 'admitted', 7, '{email,sms}',
      current_date - 1, current_date + 60, current_date + 75,
      '[{"field":"lifecycle_stage","op":"eq","value":"7"},{"field":"program_interest","op":"in","value":["nursing","biology"]}]',
      'Submit your deposit', %L, 'Consented recruitment communication', '{email-v2,sms-v3}', 2, 7, %L,
      'Admit-to-deposit rate', 'admissions-ops', true, true, true,
      extract(hour from now() at time zone 'UTC')::int, (extract(hour from now() at time zone 'UTC')::int + 1) %% 24)$q$,
     approver, page));
  select id into camp from public.gtm_campaigns where tenant_id = 'gtm-u';
  insert into ids values ('camp', camp);

  -- Who sees it
  perform pg_temp.counted('its manager sees it', pg_temp.seen(mgr, 'select 1 from public.gtm_campaigns'), 1);
  perform pg_temp.counted('a reviewer sees it', pg_temp.seen(reviewer, 'select 1 from public.gtm_campaigns'), 1);
  perform pg_temp.counted('an analyst sees it', pg_temp.seen(analyst, 'select 1 from public.gtm_campaigns'), 1);
  perform pg_temp.counted('a student does not', pg_temp.seen(student, 'select 1 from public.gtm_campaigns'), 0);
  perform pg_temp.counted('another school''s manager does not', pg_temp.seen(other_mgr, 'select 1 from public.gtm_campaigns'), 0);
  perform pg_temp.moved_nothing('another school''s manager renaming it', other_mgr,
    format('update public.gtm_campaigns set name = %L where id = %L', 'hijack', camp));

  -- Reviews happen in review, never by the owner --------------------------
  perform pg_temp.refused_with('a review of a draft', reviewer,
    format($q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision) values ('gtm-u', %L, 'privacy', 'approved')$q$, camp),
    'while it is in review');
  perform pg_temp.run(mgr, format($q$update public.gtm_campaigns set status = 'in_review' where id = %L$q$, camp));
  perform pg_temp.refused_with('a review by a manager without the review capability', mgr2,
    format($q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision) values ('gtm-u', %L, 'brand', 'approved')$q$, camp),
    'row-level security');
  perform pg_temp.refused_with('content changed while in review', mgr,
    format($q$update public.gtm_campaigns set name = 'changed' where id = %L$q$, camp), 'Only a draft campaign');
  perform pg_temp.run(reviewer, format($q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision) values ('gtm-u', %L, 'privacy', 'approved')$q$, camp));
  perform pg_temp.run(reviewer, format($q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision) values ('gtm-u', %L, 'accessibility', 'approved')$q$, camp));
  perform pg_temp.refused_with('approval with the brand review missing', approver,
    format($q$update public.gtm_campaigns set status = 'approved' where id = %L$q$, camp), 'Reviews outstanding: brand');
  perform pg_temp.run(reviewer2, format($q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision) values ('gtm-u', %L, 'brand', 'approved')$q$, camp));
  -- Another reviewer is not the approver, so the update policy does not reach the row.
  perform pg_temp.moved_nothing('approval by someone other than the named approver', reviewer,
    format($q$update public.gtm_campaigns set status = 'approved' where id = %L$q$, camp));
  -- A manager does reach it, and the trigger refuses: only the approver approves.
  perform pg_temp.refused_with('approval by the campaign''s manager', mgr,
    format($q$update public.gtm_campaigns set status = 'approved' where id = %L$q$, camp), 'Only the named approver');
  perform pg_temp.refused_with('a review being rewritten', null,
    format($q$update public.gtm_campaign_reviews set decision = 'approved' where campaign_id = %L$q$, camp), 'append-only');
  perform pg_temp.counted('the approver approves once all three are in',
    pg_temp.run(approver, format($q$update public.gtm_campaigns set status = 'approved' where id = %L$q$, camp)), 1);

  -- The release gate ------------------------------------------------------
  select public.gtm_activation_failures(camp) into failures;
  perform pg_temp.said('with the module off, the gate names only the flag', array_to_string(failures, ','), 'flag');
  perform pg_temp.refused_with('activation with the module off', mgr,
    format($q$update public.gtm_campaigns set status = 'active' where id = %L$q$, camp), 'cannot activate: flag');

  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('gtm-u', 'module.campaign_manager', 'preview');
  perform pg_temp.refused_with('activation with the module only in preview', mgr,
    format($q$update public.gtm_campaigns set status = 'active' where id = %L$q$, camp), 'cannot activate: flag');
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'gtm-u' and capability = 'module.campaign_manager';

  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('gtm-u', 'kill.sharing', true, 'check');
  perform pg_temp.refused_with('activation with kill.sharing engaged', mgr,
    format($q$update public.gtm_campaigns set status = 'active' where id = %L$q$, camp), 'cannot activate: kill_switch');
  update public.feature_kill_switch set engaged = false, reason = '' where tenant_id = 'gtm-u';

  perform pg_temp.counted('activation passes the gate',
    pg_temp.run(mgr, format($q$update public.gtm_campaigns set status = 'active' where id = %L$q$, camp)), 1);
  perform pg_temp.refused_with('an active campaign edited in place', mgr,
    format($q$update public.gtm_campaigns set frequency_max = 50 where id = %L$q$, camp), 'Only a draft campaign');
  perform pg_temp.refused_with('an active campaign sent back to draft', mgr,
    format($q$update public.gtm_campaigns set status = 'draft' where id = %L$q$, camp), 'cannot move from active to draft');

  -- An edit voids the reviews before it -----------------------------------
  perform pg_temp.run(mgr, format($q$insert into public.gtm_campaigns
     (tenant_id, name, objective, cycle, audience, funnel_stage, channels, start_date, end_date, approver_id)
     values ('gtm-u', 'Second', 'inquiry', 'fall2027', 'first-year', 3, '{email}', '2027-01-01', '2027-02-01', %L)$q$, approver));
  perform pg_temp.run(mgr, $q$update public.gtm_campaigns set status = 'in_review' where name = 'Second'$q$);
  perform pg_temp.run(reviewer, $q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision)
     select 'gtm-u', id, k, 'approved' from public.gtm_campaigns, unnest(array['privacy','accessibility']) k where name = 'Second'$q$);
  perform pg_temp.run(reviewer2, $q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision)
     select 'gtm-u', id, 'brand', 'approved' from public.gtm_campaigns where name = 'Second'$q$);
  perform pg_temp.run(approver, $q$update public.gtm_campaigns set status = 'approved' where name = 'Second'$q$);
  perform pg_temp.run(mgr, $q$update public.gtm_campaigns set status = 'draft' where name = 'Second'$q$);
  perform pg_temp.run(mgr, $q$update public.gtm_campaigns set primary_cta = 'Changed after approval' where name = 'Second'$q$);
  perform pg_temp.run(mgr, $q$update public.gtm_campaigns set status = 'in_review' where name = 'Second'$q$);
  perform pg_temp.refused_with('re-approval on reviews older than the edit', approver,
    $q$update public.gtm_campaigns set status = 'approved' where name = 'Second'$q$, 'Reviews outstanding: accessibility, brand, privacy');

  -- An owner who names themselves approver cannot approve, even holding the
  -- review capability and with every review in.
  perform pg_temp.run(mgr2, format($q$insert into public.gtm_campaigns
     (tenant_id, name, objective, cycle, audience, funnel_stage, channels, start_date, end_date)
     values ('gtm-u', 'Fourth', 'inquiry', 'fall2027', 'adult', 3, '{email}', '2027-01-01', '2027-02-01')$q$));

  -- The owner cannot review their own, even holding the capability
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (mgr2, 'campaign_reviewer', 'school', 'gtm-u', 'institution');
  perform pg_temp.run(mgr2, format($q$insert into public.gtm_campaigns
     (tenant_id, name, objective, cycle, audience, funnel_stage, channels, start_date, end_date)
     values ('gtm-u', 'Third', 'inquiry', 'fall2027', 'transfer', 3, '{email}', '2027-01-01', '2027-02-01')$q$));
  perform pg_temp.run(mgr2, $q$update public.gtm_campaigns set status = 'in_review' where name = 'Third'$q$);
  perform pg_temp.refused_with('an owner reviewing their own campaign', mgr2,
    $q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision)
       select 'gtm-u', id, 'privacy', 'approved' from public.gtm_campaigns where name = 'Third'$q$, 'owner does not review');

  perform pg_temp.run(mgr2, format($q$update public.gtm_campaigns set approver_id = %L where name = 'Fourth'$q$, mgr2));
  perform pg_temp.run(mgr2, $q$update public.gtm_campaigns set status = 'in_review' where name = 'Fourth'$q$);
  perform pg_temp.run(reviewer, $q$insert into public.gtm_campaign_reviews (tenant_id, campaign_id, kind, decision)
     select 'gtm-u', id, k, 'approved' from public.gtm_campaigns, unnest(array['privacy','accessibility','brand']) k
      where name = 'Fourth'$q$);
  perform pg_temp.refused_with('an owner approving a campaign they named themselves approver of', mgr2,
    $q$update public.gtm_campaigns set status = 'approved' where name = 'Fourth'$q$, 'owner does not approve');

  -- Audit
  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'gtm-u' and entity_type = 'gtm_campaigns' and entity_id = camp::text;
  perform pg_temp.counted('the campaign''s creation and four moves are audited', n, 4);
  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'gtm-u' and entity_type = 'gtm_campaigns' and entity_id = camp::text and actor_id = mgr and actor_grant_id is not null;
  perform pg_temp.counted('with the manager and their grant named on their three', n, 3);
  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'gtm-u' and entity_type = 'gtm_campaign_reviews';
  perform pg_temp.counted('and every review is audited', n, 9);
end $$;

-- ── Sends ─────────────────────────────────────────────────────────────────

do $$
declare
  camp uuid := (select id from ids where name = 'camp');
  here uuid; away uuid; quiet uuid; n bigint;
  ins text := $q$insert into public.gtm_communication_events
    (tenant_id, campaign_id, prospect_id, kind, channel, purpose, topic, template_id, template_version, consent_version, allowed)
    values ('gtm-u', %L, %L, 'decision', %L, %L, 'deadlines', 'deposit-reminder', '4', %L, true)$q$;
begin
  -- `away` is twelve hours ahead of UTC; the campaign's quiet hour is the
  -- current UTC hour, so `quiet` (in UTC) is in quiet hours and `away` is not.
  insert into public.gtm_prospects (tenant_id, crm_reference, lifecycle_stage, program_interest, time_zone)
  values ('gtm-u', 'slate-1', 7, '{nursing}', 'Etc/GMT-12') returning id into away;
  insert into public.gtm_prospects (tenant_id, crm_reference, lifecycle_stage, program_interest, time_zone)
  values ('gtm-u', 'slate-2', 7, '{biology}', 'UTC') returning id into quiet;
  insert into public.gtm_prospects (tenant_id, crm_reference, lifecycle_stage, program_interest, time_zone)
  values ('gtm-u', 'slate-3', 7, '{history}', 'Etc/GMT-12') returning id into here;
  insert into ids values ('away', away), ('quiet', quiet);

  perform pg_temp.refused_with('a contact in an unknown time zone', null,
    $q$insert into public.gtm_prospects (tenant_id, crm_reference, lifecycle_stage, time_zone) values ('gtm-u', 'x', 1, 'Mars/Olympus')$q$,
    'Unknown time zone');

  perform pg_temp.become((select id from ids where name = 'mgr'));
  n := public.gtm_audience_count(camp);
  execute 'reset role';
  perform pg_temp.counted('the audience count matches the two in nursing or biology', n, 2);

  perform pg_temp.refused_with('SMS with no consent at all', null, format(ins, camp, away, 'sms', 'marketing', 'sms-v3'), 'no_consent');
  perform pg_temp.refused_with('and even when it calls itself transactional', null,
    format(ins, camp, away, 'sms', 'transactional', 'sms-v3'), 'no_consent');
  perform pg_temp.counted('transactional email needs no marketing consent',
    pg_temp.run(null, format(ins, camp, away, 'email', 'transactional', null)), 1);

  insert into public.gtm_consent (tenant_id, prospect_id, channel, granted, version, source, recorded_at) values
    ('gtm-u', away,  'sms', true, 'sms-v3', 'form', now() - interval '10 days'),
    ('gtm-u', quiet, 'sms', true, 'sms-v3', 'form', now() - interval '10 days');

  perform pg_temp.refused_with('a decision recording a stale consent version', null,
    format(ins, camp, away, 'sms', 'marketing', 'sms-v2'), 'not the current one');
  perform pg_temp.refused_with('a decision with no consent version', null,
    format(ins, camp, away, 'sms', 'marketing', null), 'not the current one');
  perform pg_temp.refused_with('SMS in the recipient''s quiet hours', null,
    format(ins, camp, quiet, 'sms', 'marketing', 'sms-v3'), 'quiet_hours');
  perform pg_temp.counted('SMS outside them, with consent, is recorded',
    pg_temp.run(null, format(ins, camp, away, 'sms', 'marketing', 'sms-v3')), 1);
  -- The second is transactional. It still interrupts, so it counts toward the
  -- cap: without that, the marketing text after it would be let through.
  perform pg_temp.counted('and a transactional one, reaching the cap of two',
    pg_temp.run(null, format(ins, camp, away, 'sms', 'transactional', 'sms-v3')), 1);
  perform pg_temp.refused_with('a third inside the window', null,
    format(ins, camp, away, 'sms', 'marketing', 'sms-v3'), 'frequency_cap');

  -- A topic withdrawn, and then STOP: the later row wins.
  insert into public.gtm_consent (tenant_id, prospect_id, channel, topic, granted, version, source)
  values ('gtm-u', quiet, 'sms', 'deadlines', false, 'sms-v3', 'preference_center');
  insert into public.gtm_consent (tenant_id, prospect_id, channel, granted, version, source)
  values ('gtm-u', away, 'sms', false, 'sms-v3', 'sms_keyword');
  perform pg_temp.refused_with('SMS after STOP', null, format(ins, camp, away, 'sms', 'marketing', 'sms-v3'), 'no_consent');

  insert into public.gtm_consent (tenant_id, prospect_id, channel, granted, version, source)
  values ('gtm-u', here, 'email', true, 'email-v2', 'form');
  insert into public.gtm_consent (tenant_id, prospect_id, channel, topic, granted, version, source)
  values ('gtm-u', here, 'email', 'deadlines', false, 'email-v2', 'preference_center');
  perform pg_temp.refused_with('email on a withdrawn topic', null,
    format(ins, camp, here, 'email', 'marketing', 'email-v2'), 'topic_unsubscribed');

  perform pg_temp.refused_with('a consent row rewritten', null,
    format($q$update public.gtm_consent set granted = true where prospect_id = %L$q$, away), 'append-only');

  insert into public.gtm_suppression (prospect_id, tenant_id, reason) values (here, 'gtm-u', 'complaint');
  perform pg_temp.refused_with('transactional email to a suppressed contact', null,
    format(ins, camp, here, 'email', 'transactional', null), 'suppressed');

  perform pg_temp.refused_with('a marketing send for a campaign that is not active', null,
    format(ins, (select id from public.gtm_campaigns where name = 'Second'), away, 'email', 'marketing', 'email-v2'),
    'campaign_inactive');
  perform pg_temp.refused_with('a decision with no template version', null,
    format($q$insert into public.gtm_communication_events
      (tenant_id, campaign_id, prospect_id, kind, channel, purpose, topic, template_id, template_version, allowed)
      values ('gtm-u', %L, %L, 'decision', 'email', 'transactional', 'deadlines', 't', ' ', true)$q$, camp, away),
    'template_version_check');
  perform pg_temp.refused_with('a contact filed under another school', null,
    format($q$insert into public.gtm_communication_events
      (tenant_id, campaign_id, prospect_id, kind, channel, purpose, topic, template_id, template_version, allowed)
      values ('gtm-other', %L, %L, 'decision', 'email', 'transactional', 'deadlines', 't', '1', true)$q$, camp, away),
    'foreign key');

  -- Results: suppressed, logged, scoped
  insert into public.gtm_conversion_events (tenant_id, prospect_id, stage, campaign_id, utm_source, utm_medium, utm_campaign)
  select 'gtm-u', away, 8, camp, 'email', 'email', 'gtm-u_fall2027_admitted_deposit';
  perform pg_temp.refused_with('a conversion with a malformed campaign name', null,
    format($q$insert into public.gtm_conversion_events (tenant_id, prospect_id, stage, utm_campaign)
       values ('gtm-u', %L, 8, 'Fall 2027 deposit')$q$, away), 'utm_campaign_check');
end $$;

-- ── What a send answers to beyond consent (Codex review on #817) ──────────

do $$
declare
  camp uuid := (select id from ids where name = 'camp');
  late uuid;
  ins text := $q$insert into public.gtm_communication_events
    (tenant_id, campaign_id, prospect_id, kind, channel, purpose, topic, template_id, template_version, consent_version, allowed)
    values ('gtm-u', %L, %L, 'decision', %L, 'marketing', 'deadlines', 'deposit-reminder', '4', %L, true)$q$;
begin
  insert into public.gtm_prospects (tenant_id, crm_reference, lifecycle_stage, program_interest, time_zone)
  values ('gtm-u', 'slate-4', 7, '{nursing}', 'Etc/GMT-12') returning id into late;
  insert into public.gtm_consent (tenant_id, prospect_id, channel, granted, version, source) values
    ('gtm-u', late, 'sms', true, 'sms-v2', 'form'),
    ('gtm-u', late, 'push', true, 'push-v1', 'form'),
    ('gtm-u', late, 'email', true, 'email-v2', 'form');

  perform pg_temp.refused_with('a send on a channel the campaign was not approved for', null,
    format(ins, camp, late, 'push', 'push-v1'), 'channel_not_in_campaign');
  perform pg_temp.refused_with('a send under a consent version the campaign does not accept', null,
    format(ins, camp, late, 'sms', 'sms-v2'), 'consent_version_not_required');

  update public.tenant_feature_policy set state = 'off' where tenant_id = 'gtm-u' and capability = 'module.campaign_manager';
  perform pg_temp.refused_with('a send after the module is switched off, on an active campaign', null,
    format(ins, camp, late, 'email', 'email-v2'), 'module_off');
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'gtm-u' and capability = 'module.campaign_manager';

  update public.feature_kill_switch set engaged = true, reason = 'check' where tenant_id = 'gtm-u' and switch_key = 'kill.sharing';
  perform pg_temp.refused_with('a send while kill.sharing is engaged, on an active campaign', null,
    format(ins, camp, late, 'email', 'email-v2'), 'kill_switch');
  update public.feature_kill_switch set engaged = false, reason = '' where tenant_id = 'gtm-u' and switch_key = 'kill.sharing';

  -- A race cannot be staged in one session, so this is structural: the count
  -- and the insert are serialized per contact and channel.
  perform pg_temp.said('the cap count is taken under a per-contact, per-channel lock',
    (pg_get_functiondef('private.gtm_send_guard'::regproc) ~ 'pg_advisory_xact_lock')::text, 'true');
end $$;

do $$
declare
  camp uuid := (select id from ids where name = 'camp');
  analyst uuid := (select id from ids where name = 'analyst');
  student uuid := (select id from ids where name = 'student');
  other_analyst uuid := (select id from ids where name = 'other_analyst');
  admin uuid := (select id from ids where name = 'admin');
  n bigint; v bigint;
begin
  perform pg_temp.become(analyst);
  select count(*) into n from public.gtm_campaign_report(camp);
  select value into v from public.gtm_campaign_report(camp) where metric = 'sent';
  execute 'reset role';
  perform pg_temp.counted('the analyst reads the campaign''s metrics', n, 3);
  perform pg_temp.said('and a count under ten is suppressed, not shown', coalesce(v::text, 'suppressed'), 'suppressed');

  perform pg_temp.refused_with('a student reading results', student,
    format('select * from public.gtm_campaign_report(%L)', camp), 'No such campaign');
  perform pg_temp.refused_with('another school''s analyst reading results', other_analyst,
    format('select * from public.gtm_campaign_report(%L)', camp), 'No such campaign');
  perform pg_temp.refused_with('an analyst counting an audience', analyst,
    format('select public.gtm_audience_count(%L)', camp), 'No such campaign');

  select count(*) into n from public.gtm_report_access where campaign_id = camp;
  perform pg_temp.counted('each of the analyst''s two reads is logged', n, 2);
  perform pg_temp.counted('the school''s configurer can see that log',
    pg_temp.seen(admin, 'select 1 from public.gtm_report_access'), 2);
  perform pg_temp.counted('the analyst cannot', pg_temp.seen(analyst, 'select 1 from public.gtm_report_access'), 0);
end $$;

-- ── Sponsorship ───────────────────────────────────────────────────────────

do $$
declare
  admin uuid := (select id from ids where name = 'admin');
  admin2 uuid := (select id from ids where name = 'admin2');
  mgr uuid := (select id from ids where name = 'mgr');
  ins text := $q$insert into public.gtm_sponsor_placements
    (tenant_id, sponsor_name, category, surface, label, why_shown, complaint_route, audit_due)
    values ('gtm-u', 'Acme Internships', %L, %L, %L, 'Shown on career events to everyone.', '/report', current_date + 30)$q$;
begin
  perform pg_temp.refused_with('a placement on an AI answer', admin, format(ins, 'education_career', 'ai_answer', 'Sponsored'), 'surface_check');
  perform pg_temp.refused_with('a placement on the aid deadline', admin, format(ins, 'education_career', 'financial_aid_deadline', 'Sponsored'), 'surface_check');
  perform pg_temp.refused_with('a prohibited category', admin, format(ins, 'predatory_lending', 'career_events', 'Sponsored'), 'category_check');
  perform pg_temp.refused_with('an unlabelled placement', admin, format(ins, 'education_career', 'career_events', 'Featured'), 'label_check');
  perform pg_temp.refused_with('a marketing manager drafting one', mgr, format(ins, 'education_career', 'career_events', 'Sponsored'), 'row-level security');
  perform pg_temp.refused_with('a school listing a protected surface in its policy', admin,
    $q$insert into public.gtm_sponsor_policy (tenant_id, enabled, surfaces) values ('gtm-u', true, '{advising}')$q$, 'surfaces_check');

  perform pg_temp.run(admin, format(ins, 'education_career', 'career_events', 'Sponsored'));
  perform pg_temp.refused_with('its author approving it', admin,
    $q$update public.gtm_sponsor_placements set status = 'approved' where tenant_id = 'gtm-u'$q$, 'did not write it');
  perform pg_temp.counted('another reviewer approves it',
    pg_temp.run(admin2, $q$update public.gtm_sponsor_placements set status = 'approved' where tenant_id = 'gtm-u'$q$), 1);
  perform pg_temp.refused_with('an approved placement edited', admin2,
    $q$update public.gtm_sponsor_placements set label = 'Sponsored — now bigger' where tenant_id = 'gtm-u'$q$, 'not edited');
  perform pg_temp.refused_with('going live with no school policy', admin2,
    $q$update public.gtm_sponsor_placements set status = 'live' where tenant_id = 'gtm-u'$q$, 'cannot go live');

  perform pg_temp.run(admin, $q$insert into public.gtm_sponsor_policy (tenant_id, enabled, categories, surfaces)
    values ('gtm-u', true, '{education_career}', '{career_events}')$q$);
  perform pg_temp.refused_with('going live with the module off', admin2,
    $q$update public.gtm_sponsor_placements set status = 'live' where tenant_id = 'gtm-u'$q$, 'cannot go live');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('gtm-u', 'module.sponsorship', 'production');
  perform pg_temp.counted('live, once the school and the module both say so',
    pg_temp.run(admin2, $q$update public.gtm_sponsor_placements set status = 'live' where tenant_id = 'gtm-u'$q$), 1);
  perform pg_temp.counted('removed on a complaint',
    pg_temp.run(admin, $q$update public.gtm_sponsor_placements set status = 'removed' where tenant_id = 'gtm-u'$q$), 1);
  perform pg_temp.refused_with('a removed placement brought back', admin2,
    $q$update public.gtm_sponsor_placements set status = 'live' where tenant_id = 'gtm-u'$q$, 'stays removed');
end $$;

-- ── The institutional pipeline ────────────────────────────────────────────

do $$
declare
  sales uuid := (select id from ids where name = 'sales');
  admin uuid := (select id from ids where name = 'admin');
  mgr uuid := (select id from ids where name = 'mgr');
  other_mgr uuid := (select id from ids where name = 'other_mgr');
  student uuid := (select id from ids where name = 'student');
  acct uuid; pilot uuid;
begin
  perform pg_temp.refused_with('a school admin creating a pipeline account', admin,
    $q$insert into public.gtm_accounts (name, segment) values ('X', 'research')$q$, 'row-level security');
  perform pg_temp.run(sales, $q$insert into public.gtm_accounts (name, segment) values ('GTM University', 'research')$q$);
  select id into acct from public.gtm_accounts where name = 'GTM University';

  perform pg_temp.run(sales, format($q$insert into public.gtm_decision_log
    (account_id, committee_role, question, category, owner, target_date) values
    (%L, 'ciso_privacy', 'HECVAT full', 'security', 'Sam', current_date + 14)$q$, acct));
  perform pg_temp.refused_with('an approval with no evidence', sales,
    format($q$update public.gtm_decision_log set status = 'approved', resolution_date = current_date where account_id = %L$q$, acct),
    'gtm_decision_evidence');
  perform pg_temp.refused_with('an approval with no resolution date', sales,
    format($q$update public.gtm_decision_log set status = 'approved', evidence_links = '{https://trust.example/hecvat}' where account_id = %L$q$, acct),
    'gtm_decision_resolved');

  perform pg_temp.counted('before the account is linked, the school admin sees nothing',
    pg_temp.seen(admin, 'select 1 from public.gtm_decision_log'), 0);
  perform pg_temp.run(sales, format($q$update public.gtm_accounts set tenant_id = 'gtm-u', status = 'pilot' where id = %L$q$, acct));
  perform pg_temp.counted('after, they read their own decision log',
    pg_temp.seen(admin, 'select 1 from public.gtm_decision_log'), 1);
  perform pg_temp.counted('a marketing manager at that school does not',
    pg_temp.seen(mgr, 'select 1 from public.gtm_decision_log'), 0);
  perform pg_temp.counted('nor does another school''s staff', pg_temp.seen(other_mgr, 'select 1 from public.gtm_accounts'), 0);
  perform pg_temp.moved_nothing('the school admin editing the log', admin,
    format($q$update public.gtm_decision_log set status = 'declined', resolution_date = current_date where account_id = %L$q$, acct));

  -- A pilot that is really a free trial
  perform pg_temp.run(sales, format($q$insert into public.gtm_pilots (account_id, workflow, start_date, end_date)
    values (%L, 'Orientation checklist', '2027-01-11', '2027-12-31')$q$, acct));
  select id into pilot from public.gtm_pilots where account_id = acct;

  -- `gtm_pilot_problems` is security definer, so the read policy on
  -- `gtm_pilots` does not stand in front of it: the function has to ask the
  -- same question itself. Somebody the policy would not show the pilot to is
  -- told what a pilot that does not exist would tell them, and nothing about
  -- its price, sponsor or dates. Sales and the school's own admin — the two
  -- the policy admits — still get the whole list, so the answer is the
  -- policy's and not a stricter one.
  perform pg_temp.counted('sales reads a pilot''s readiness problems',
    pg_temp.seen(sales, format('select 1 from unnest(public.gtm_pilot_problems(%L)) x where x <> ''not_found''', pilot)), 10);
  perform pg_temp.counted('so does that school''s admin',
    pg_temp.seen(admin, format('select 1 from unnest(public.gtm_pilot_problems(%L)) x where x <> ''not_found''', pilot)), 10);
  perform pg_temp.counted('a student at the school is told only that there is no such pilot',
    pg_temp.seen(student, format('select 1 from unnest(public.gtm_pilot_problems(%L)) x where x <> ''not_found''', pilot)), 0);
  perform pg_temp.counted('and is told that',
    pg_temp.seen(student, format('select 1 from unnest(public.gtm_pilot_problems(%L)) x where x = ''not_found''', pilot)), 1);
  perform pg_temp.counted('another school''s staff learn nothing either',
    pg_temp.seen(other_mgr, format('select 1 from unnest(public.gtm_pilot_problems(%L)) x where x <> ''not_found''', pilot)), 0);

  perform pg_temp.refused_with('starting a pilot with nothing agreed', sales,
    format($q$update public.gtm_pilots set status = 'active' where id = %L$q$, pilot),
    'not ready: duration, no_cohort, no_baseline, no_sponsor, no_champion, data_plan, metric_count, no_conversion_date, no_price, no_midpoint');

  perform pg_temp.run(sales, format($q$update public.gtm_pilots set end_date = '2027-07-12', cohort = 'Fall 2027 transfers',
    baseline = '54%% by week 2', executive_sponsor = 'VP Student Affairs', operational_champion = 'Transfer Center',
    minimum_necessary_data = true, read_only_first = true, source_labelled = true, conversion_date = '2027-07-20',
    annual_price_agreed = true, midpoint_review_date = '2027-04-12' where id = %L$q$, pilot));
  perform pg_temp.run(sales, format($q$insert into public.gtm_pilot_metrics (pilot_id, name, target, baseline) values
    (%L, 'Activation', '60%%', 'new'), (%L, 'Checklist by week 2', '70%%', '54%%'), (%L, 'Usefulness', '4/5', null)$q$, pilot, pilot, pilot));
  perform pg_temp.refused_with('starting with a metric that has no baseline', sales,
    format($q$update public.gtm_pilots set status = 'active' where id = %L$q$, pilot), 'not ready: metric_baseline');
  perform pg_temp.run(sales, format($q$update public.gtm_pilot_metrics set baseline = 'kickoff survey' where pilot_id = %L and baseline is null$q$, pilot));
  -- Every pilot runs exactly 26 weeks (D-134): 109 days, inside the old 60–120, is refused.
  perform pg_temp.run(sales, format($q$update public.gtm_pilots set end_date = '2027-04-30', conversion_date = '2027-05-15' where id = %L$q$, pilot));
  perform pg_temp.refused_with('a pilot that is not 26 weeks', sales,
    format($q$update public.gtm_pilots set status = 'active' where id = %L$q$, pilot), 'not ready: duration');
  perform pg_temp.run(sales, format($q$update public.gtm_pilots set end_date = '2027-07-12', conversion_date = '2027-07-20' where id = %L$q$, pilot));
  perform pg_temp.counted('a ready pilot starts',
    pg_temp.run(sales, format($q$update public.gtm_pilots set status = 'active' where id = %L$q$, pilot)), 1);

  perform pg_temp.refused_with('deciding a pilot with nothing signed', sales,
    format($q$update public.gtm_pilots set status = 'decided' where id = %L$q$, pilot), 'signed outcome');
  perform pg_temp.refused_with('converting over an open high-severity issue', sales,
    format($q$insert into public.gtm_pilot_outcomes (pilot_id, decision, signed_by, signed_at, unresolved_high_severity)
      values (%L, 'convert', 'VP', current_date, 1)$q$, pilot), 'gtm_outcome_no_convert_over_open_issue');
  perform pg_temp.run(sales, format($q$insert into public.gtm_pilot_outcomes (pilot_id, decision, signed_by, signed_at, unresolved_high_severity)
      values (%L, 'convert', 'VP', current_date, 0)$q$, pilot));
  perform pg_temp.counted('and a signed, clean outcome decides it',
    pg_temp.run(sales, format($q$update public.gtm_pilots set status = 'decided' where id = %L$q$, pilot)), 1);
  perform pg_temp.counted('the school admin reads the outcome', pg_temp.seen(admin, 'select 1 from public.gtm_pilot_outcomes'), 1);
end $$;

-- ── A staff member can still delete their account ─────────────────────────
--
-- Every account here has left a mark: the manager owns an active campaign,
-- the reviewers' reviews are on it, the approver approved it, one admin wrote
-- a placement and another approved it, and sales owns a pipeline account.
-- Deleting any of them must succeed and leave the record, with the reference
-- cleared — not refuse the deletion, and not remove the school's campaign.

do $$
declare
  camp uuid := (select id from ids where name = 'camp');
  who text;
  n bigint;
begin
  foreach who in array array['mgr', 'reviewer', 'reviewer2', 'approver', 'admin', 'admin2', 'sales'] loop
    begin
      delete from auth.users where id = (select id from ids where name = who);
      raise notice 'ok  % can delete their account', who;
    exception when others then
      raise exception 'FAILED: deleting % was refused: %', who, sqlerrm;
    end;
  end loop;
  perform pg_temp.said('the campaign stays, with no owner', (select (owner_id is null)::text from public.gtm_campaigns where id = camp), 'true');
  perform pg_temp.said('and no approver', (select (approver_id is null)::text from public.gtm_campaigns where id = camp), 'true');
  select count(*) into n from public.gtm_campaign_reviews where campaign_id = camp and reviewer_id is null;
  perform pg_temp.counted('its reviews stay, unattributed', n, 3);
  perform pg_temp.said('the placement stays', (select count(*)::text from public.gtm_sponsor_placements where tenant_id = 'gtm-u'), '1');
  perform set_config('request.jwt.claims', '', true); -- as the worker, not whoever signed in last
  perform pg_temp.said('an ownerless campaign names that as unfinished',
    (select ('owner' = any (public.gtm_activation_failures(camp)))::text), 'true');
end $$;

rollback;
