-- Prospective institutional-intake retention.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- New, unconverted `plan_institution_launch` requests expire after 90 days.
-- The CTA route is server-owned; visitor JSON is not authority. Historical or
-- other-route rows are deliberately unclassified and never inferred into the
-- purge. Converted customer records stay under their separate policy. A live
-- platform legal hold pauses the whole sweep. The sweep is not scheduled.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.raises(sql text)
returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end $$;

do $$
declare
  account_a uuid;
  account_b uuid;
  stakeholder uuid;
  billing_a uuid;
  billing_b uuid;
  result jsonb;
begin
  insert into public.gtm_accounts (name, segment, status)
  values ('Retention A University', 'other', 'engaged') returning id into account_a;
  insert into public.gtm_accounts (name, segment, status)
  values ('Retention B University', 'other', 'engaged') returning id into account_b;
  insert into public.gtm_stakeholders (account_id, committee_role, display_name)
  values (account_a, 'operational_owner', 'Pat Retention') returning id into stakeholder;
  insert into public.billing_accounts (kind, gtm_account_id, name)
  values ('institution', account_a, 'Retention A University') returning id into billing_a;
  insert into public.billing_accounts (kind, gtm_account_id, name)
  values ('institution', account_b, 'Retention B University') returning id into billing_b;

  -- Exact new requests are classified from their server-owned route and get
  -- a deadline from their own immutable creation time.
  insert into public.site_leads
    (reference, route_key, destination, name, email, organization, fields, gtm_account_id,
     gtm_stakeholder_id, created_at)
  values
    ('SL-0000000001', 'plan_institution_launch', 'crm_lead', 'Old request', 'old@retention.example',
     'Retention A University', '{"requested_product":"semester_institutional"}', account_a,
     stakeholder, '2026-01-01 00:00:00+00'),
    ('SL-0000000002', 'plan_institution_launch', 'crm_lead', 'Recent request', 'recent@retention.example',
     'Retention A University', '{"requested_product":"semester_institutional"}', account_a,
     stakeholder, '2026-03-15 00:00:01+00'),
    ('SL-0000000003', 'plan_institution_launch', 'crm_lead', 'Boundary request', 'boundary@retention.example',
     'Retention A University', '{"requested_product":"semester_institutional"}', account_a,
     stakeholder, '2026-01-01 00:00:00+00');

  perform pg_temp.counted('exact new setup requests receive the 90-day class and deadline',
    (select count(*) from public.site_leads
      where reference in ('SL-0000000001', 'SL-0000000002', 'SL-0000000003')
        and retention_class = 'institution_setup_unconverted_90d'
        and purge_after = created_at + interval '90 days'), 3);

  -- The existing topic-only form uses the same server-owned route and is
  -- classified prospectively. Other routes fail closed regardless of their
  -- visitor-supplied product marker.
  insert into public.site_leads
    (reference, route_key, destination, name, email, organization, fields, created_at)
  values
    ('SL-0000000004', 'plan_institution_launch', 'crm_lead', 'Legacy request', 'legacy@retention.example',
     'Legacy University', '{"topic":"An institutional pilot"}'::jsonb, '2026-03-15'),
    ('SL-0000000005', 'plan_department_launch', 'crm_lead', 'Ambiguous request', 'ambiguous@retention.example',
     'Ambiguous University', '{"requested_product":"semester_enterprise"}', '2020-01-01'),
    ('SL-0000000006', 'general_contact', 'support', 'Other lead', 'other@retention.example',
     'Other University', '{"requested_product":"semester_institutional"}', '2020-01-01');
  perform pg_temp.counted('a new topic-only request receives the prospective class',
    (select count(*) from public.site_leads where reference = 'SL-0000000004'
      and retention_class = 'institution_setup_unconverted_90d'
      and purge_after = created_at + interval '90 days'), 1);
  perform pg_temp.counted('other routes remain unclassified regardless of visitor fields',
    (select count(*) from public.site_leads
      where reference in ('SL-0000000005', 'SL-0000000006')
        and retention_class is null and purge_after is null), 2);

  -- Simulate a row that predated this migration: adding the columns must not
  -- backfill it, even if its old JSON now resembles the exact category.
  alter table public.site_leads disable trigger site_lead_retention_stamp;
  insert into public.site_leads
    (reference, route_key, destination, name, email, organization, fields, created_at)
  values
    ('SL-0000000007', 'plan_institution_launch', 'crm_lead', 'Historical request', 'history@retention.example',
     'History University', '{"requested_product":"semester_institutional"}', '2019-01-01');
  alter table public.site_leads enable trigger site_lead_retention_stamp;
  perform pg_temp.counted('a historical matching row remains outside the prospective policy',
    (select count(*) from public.site_leads where reference = 'SL-0000000007'
      and retention_class is null and purge_after is null), 1);

  -- Conversion is explicit and must link the same GTM account to a real
  -- institutional billing account. A mismatched account cannot relabel it.
  perform pg_temp.counted('a mismatched customer link is refused',
    pg_temp.raises(format('select private.mark_site_lead_converted(%L, %L)',
      'SL-0000000003', billing_b))::int, 1);
  perform private.mark_site_lead_converted('SL-0000000003', billing_a);
  perform pg_temp.counted('conversion records the separate customer link once',
    (select count(*) from public.site_leads where reference = 'SL-0000000003'
      and converted_at is not null and converted_billing_account_id = billing_a), 1);
  perform pg_temp.counted('conversion evidence cannot be rewritten',
    pg_temp.raises($q$update public.site_leads set converted_at = converted_at + interval '1 second'
      where reference = 'SL-0000000003'$q$)::int, 1);
  perform pg_temp.counted('retention classification cannot be rewritten',
    pg_temp.raises($q$update public.site_leads set purge_after = purge_after + interval '1 day'
      where reference = 'SL-0000000002'$q$)::int, 1);
  perform pg_temp.counted('the server-owned route cannot be changed after classification',
    pg_temp.raises($q$update public.site_leads set route_key = 'general_contact'
      where reference = 'SL-0000000002'$q$)::int, 1);
  perform pg_temp.counted('a classified request cannot be manually deleted around the sweep',
    pg_temp.raises($q$delete from public.site_leads where reference = 'SL-0000000002'$q$)::int, 1);

  set local role service_role;
  perform set_config('semester.site_lead_retention', 'sweep', true);
  perform pg_temp.counted('service_role cannot forge the sweep flag and delete directly',
    pg_temp.raises($q$delete from public.site_leads where reference = 'SL-0000000002'$q$)::int, 1);
  perform set_config('semester.site_lead_conversion', 'mark', true);
  perform pg_temp.counted('service_role cannot forge the conversion flag and update evidence directly',
    pg_temp.raises(format($q$update public.site_leads set converted_at = now(), converted_billing_account_id = %L
      where reference = 'SL-0000000002'$q$, billing_a))::int, 1);
  perform pg_temp.counted('service_role cannot bypass row guards with truncate',
    pg_temp.raises($q$truncate table public.site_leads$q$)::int, 1);
  perform set_config('semester.site_lead_retention', '', true);
  perform set_config('semester.site_lead_conversion', '', true);
  reset role;

  -- Dry-run is the default and mutates no lead.
  result := private.site_lead_retention_run('2026-04-01 00:00:00+00');
  perform pg_temp.counted('dry-run reports the one eligible unconverted row', (result ->> 'candidates')::bigint, 1);
  perform pg_temp.counted('dry-run deletes nothing', (result ->> 'deleted')::bigint, 0);
  perform pg_temp.counted('dry-run leaves both candidates',
    (select count(*) from public.site_leads where reference in ('SL-0000000001', 'SL-0000000003')), 2);
  perform pg_temp.counted('a deleting run cannot move the clock into the future',
    pg_temp.raises($q$select private.site_lead_retention_run('2099-01-01', 200, false)$q$)::int, 1);

  -- A platform hold pauses both dry and deleting runs. Tenant/account holds
  -- are never guessed from a prospect's email or domain.
  insert into public.legal_holds (subject_kind, subject_id, reason, matter_ref, placed_by)
  values ('platform', '', 'Retention test hold', 'MATTER-RETENTION-1', gen_random_uuid());
  result := private.site_lead_retention_run('2026-04-01 00:00:00+00', 200, false);
  perform pg_temp.counted('a platform legal hold makes the deleting run skip',
    ((result ->> 'skipped') = 'legal_hold')::int, 1);
  perform pg_temp.counted('a held run deletes nothing', (result ->> 'deleted')::bigint, 0);
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Retention test complete'
   where matter_ref = 'MATTER-RETENTION-1';

  -- At the exact 90-day boundary the unconverted row is eligible. Converted,
  -- recent, historical and ambiguous rows stay, and deleting the intake does
  -- not delete its GTM account or stakeholder.
  result := private.site_lead_retention_run('2026-04-01 00:00:00+00', 200, false);
  perform pg_temp.counted('the active sweep deletes only one due unconverted request',
    (result ->> 'deleted')::bigint, 1);
  perform pg_temp.counted('the due unconverted request is gone',
    (select count(*) from public.site_leads where reference = 'SL-0000000001'), 0);
  perform pg_temp.counted('the converted request remains',
    (select count(*) from public.site_leads where reference = 'SL-0000000003'), 1);
  perform pg_temp.counted('the recent exact request remains',
    (select count(*) from public.site_leads where reference = 'SL-0000000002'), 1);
  perform pg_temp.counted('recent, historical and other-route requests remain',
    (select count(*) from public.site_leads
      where reference in ('SL-0000000004', 'SL-0000000005', 'SL-0000000006', 'SL-0000000007')), 4);
  perform pg_temp.counted('the GTM account remains',
    (select count(*) from public.gtm_accounts where id = account_a), 1);
  perform pg_temp.counted('the GTM stakeholder remains',
    (select count(*) from public.gtm_stakeholders where id = stakeholder), 1);

  result := private.site_lead_retention_run('2026-04-01 00:00:00+00', 200, false);
  perform pg_temp.counted('a second deleting run is idempotent', (result ->> 'deleted')::bigint, 0);

  perform pg_temp.counted('every run journal row contains coherent counts',
    (select count(*) from public.site_lead_retention_runs where candidates >= deleted),
    (select count(*) from public.site_lead_retention_runs));
  perform pg_temp.counted('the run journal has no lead payload columns',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'site_lead_retention_runs'
        and column_name in ('lead_id', 'reference', 'name', 'email', 'organization', 'fields', 'message')), 0);
end $$;

do $$
begin
  perform pg_temp.counted('authenticated cannot run the retention sweep',
    has_function_privilege('authenticated', 'private.site_lead_retention_run(timestamptz,integer,boolean)', 'execute')::int, 0);
  perform pg_temp.counted('anon cannot run the retention sweep',
    has_function_privilege('anon', 'private.site_lead_retention_run(timestamptz,integer,boolean)', 'execute')::int, 0);
  perform pg_temp.counted('only the service role can run the retention sweep',
    has_function_privilege('service_role', 'private.site_lead_retention_run(timestamptz,integer,boolean)', 'execute')::int, 1);
  perform pg_temp.counted('authenticated cannot mark a request converted',
    has_function_privilege('authenticated', 'private.mark_site_lead_converted(text,uuid)', 'execute')::int, 0);
  perform pg_temp.counted('the run journal is not exposed to authenticated',
    has_table_privilege('authenticated', 'public.site_lead_retention_runs', 'select')::int, 0);
  perform pg_temp.counted('service_role may read but not mutate the run journal',
    (has_table_privilege('service_role', 'public.site_lead_retention_runs', 'select')
      and not has_table_privilege('service_role', 'public.site_lead_retention_runs', 'insert')
      and not has_table_privilege('service_role', 'public.site_lead_retention_runs', 'update')
      and not has_table_privilege('service_role', 'public.site_lead_retention_runs', 'delete'))::int, 1);
  perform pg_temp.counted('service_role cannot truncate retained leads',
    has_table_privilege('service_role', 'public.site_leads', 'truncate')::int, 0);
  perform pg_temp.counted('service_role cannot rewrite the server-owned retention route',
    has_column_privilege('service_role', 'public.site_leads', 'route_key', 'update')::int, 0);
end $$;

rollback;
