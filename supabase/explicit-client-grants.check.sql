-- Approved direct callers must not depend on platform defaults.
-- Catalog-only: this suite creates no users, objects or grants. Feature suites
-- (admins, classmates, calendar, access) still have to prove row isolation.
-- A missing grant must fail here even when a definer function can bypass it.
begin read only;

do $$
declare
  required record;
  verb text;
  column_name text;
  relation_name text;
begin
  for required in
    select * from (values
      ('public.profiles', 'SELECT'),
      ('public.calendar_feeds', 'SELECT'),
      ('public.calendar_feeds', 'INSERT'),
      ('public.calendar_feeds', 'UPDATE')
    ) as grants(relation_name, privilege_name)
  loop
    if not has_table_privilege('authenticated', required.relation_name,
                               required.privilege_name) then
      raise exception 'FAILED: authenticated lacks % on %',
        required.privilege_name, required.relation_name;
    end if;
  end loop;
  raise notice 'ok  the two confirmed direct-client paths have explicit access';

  -- A broad table INSERT/UPDATE would undo the school-id pin. Preserve the
  -- existing column lists instead of replacing them with table privileges.
  foreach verb in array array['INSERT', 'UPDATE'] loop
    if has_table_privilege('authenticated', 'public.profiles', verb) then
      raise exception 'FAILED: authenticated has blanket % on profiles', verb;
    end if;
    foreach column_name in array array['school_id', 'created_at', 'updated_at'] loop
      if has_column_privilege('authenticated', 'public.profiles', column_name, verb) then
        raise exception 'FAILED: authenticated can % profiles.%', verb, column_name;
      end if;
    end loop;
  end loop;
  if has_column_privilege('authenticated', 'public.profiles', 'user_id', 'UPDATE') then
    raise exception 'FAILED: authenticated can reassign profiles.user_id';
  end if;

  -- The control: denying every write would pass the pin checks above while
  -- making profile creation and editing unusable.
  foreach column_name in array array['user_id', 'handle', 'about', 'account_role'] loop
    if not has_column_privilege('authenticated', 'public.profiles', column_name, 'INSERT') then
      raise exception 'FAILED: authenticated lost INSERT on profiles.%', column_name;
    end if;
  end loop;
  foreach column_name in array array['handle', 'about', 'account_role'] loop
    if not has_column_privilege('authenticated', 'public.profiles', column_name, 'UPDATE') then
      raise exception 'FAILED: authenticated lost UPDATE on profiles.%', column_name;
    end if;
  end loop;
  raise notice 'ok  profile column pins and legitimate writes both remain';

  foreach relation_name in array array['public.profiles', 'public.calendar_feeds'] loop
    if not exists (select 1 from pg_class c
                    where c.oid = relation_name::regclass and c.relrowsecurity) then
      raise exception 'FAILED: row-level security is off on %', relation_name;
    end if;
  end loop;
  raise notice 'ok  both directly exposed tables retain row-level security';

  -- These tables are deliberately RPC/server-only. A blanket grant to every
  -- table lacking SELECT would break their access model. Column-level SELECT
  -- counts too, so an accidental narrower grant cannot escape this guard.
  foreach relation_name in array array[
    'access_gate', 'app_admins', 'beta_cohorts', 'beta_exit_requests',
    'beta_feature_flags', 'beta_feedback', 'beta_invitations', 'beta_known_issues',
    'beta_memberships', 'beta_programs', 'community_media_deletions',
    'community_safety_entries', 'connections', 'gtm_communication_events',
    'gtm_consent', 'gtm_conversion_events', 'gtm_prospects', 'gtm_suppression',
    'invites', 'lti_identity', 'lti_line_item', 'lti_link_ticket', 'lti_nonce',
    'lti_platform', 'payment_events', 'registration_completions',
    'registration_holds', 'registration_requests', 'scim_credential',
    'site_leads', 'support_ticket_messages', 'support_tickets'
  ] loop
    if has_any_column_privilege('authenticated', 'public.' || relation_name, 'SELECT') then
      raise exception 'FAILED: authenticated can directly read RPC/server-only table %', relation_name;
    end if;
  end loop;
  raise notice 'ok  intentional direct-client read denials remain intact';
end $$;

-- The next reviewed grant set: 19 tables, authenticated/anon client callers
-- and three service-role readers/worker targets. Positive assertions run in
-- every fixture. The existing profile pins and 32 RPC-only denials above are
-- unconditional too.
--
-- Strict CRUD/column boundaries are the default, including hosted previews.
-- Legacy local fixtures intentionally begin with broad table CRUD privileges;
-- this additive migration does not revoke them. Only those fixtures may set:
--   PGOPTIONS='-c semester.catalog_grants_legacy_fixture=on'
-- while running SEMESTER_CHECK_TABLE_GRANTS=legacy. The existing explicit
-- fixture mode must leave this unset/off. No privilege-based auto-detection:
-- an over-grant must fail, not select a weaker test profile.
--
-- This suite reads catalogs only. It changes no grants, defaults, policies,
-- triggers, fixtures, functions or sequences. It does not establish row
-- isolation, caller payload correctness, or exact before/after ACL deltas.
-- Feature suites, PostgREST tests and a separate migration-delta check do that.
do $$
declare
  rule record;
  column_rule record;
  live_column record;
  role_name text;
  relation_name text;
  verb text;
  column_name text;
  allowed_tables text[];
  allowed_columns jsonb;
  actual boolean;
  expected boolean;
  legacy_setting text := nullif(current_setting('semester.catalog_grants_legacy_fixture', true), '');
  legacy_fixture boolean;
  required_tables integer := 0;
  required_columns integer := 0;
begin
  if legacy_setting is not null and legacy_setting not in ('on', 'off') then
    raise exception 'FAILED: semester.catalog_grants_legacy_fixture must be on or off';
  end if;
  legacy_fixture := coalesce(legacy_setting = 'on', false);

  -- Table-wide privileges and exact column allowlists. Three pre-existing
  -- authenticated SELECTs on the service tables, organizations UPDATE
  -- (name/about/listed), and reports UPDATE(status) are retained controls,
  -- not additions to the approved migration.
  for rule in
    select * from (values
      ('authenticated', 'enrollments',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["user_id","term","code"],"UPDATE":["user_id","term","code"]}'::jsonb),
      ('authenticated', 'blocks',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["user_id","blocked"],"UPDATE":["user_id","blocked"]}'::jsonb),
      ('authenticated', 'messages',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["user_id","term","code","body"]}'::jsonb),
      ('authenticated', 'message_reactions',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["message_id","user_id","emoji","term","code"]}'::jsonb),
      ('authenticated', 'groups',
       array['SELECT']::text[], '{"INSERT":["term","code","name","created_by"],"UPDATE":["name","about","due"]}'::jsonb),
      ('authenticated', 'group_members',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["group_id","user_id"]}'::jsonb),
      ('authenticated', 'group_tasks',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["group_id","title","created_by"],"UPDATE":["title","owner","done","due"]}'::jsonb),
      ('authenticated', 'courses',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["user_id","id","data"],"UPDATE":["data"]}'::jsonb),
      ('authenticated', 'state',
       array['SELECT']::text[], '{"INSERT":["user_id","data"],"UPDATE":["data"]}'::jsonb),
      ('authenticated', 'push_devices',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["endpoint","user_id","p256dh","auth","gone_at"],"UPDATE":["endpoint","user_id","p256dh","auth","gone_at"]}'::jsonb),
      ('authenticated', 'push_queue',
       array['SELECT', 'DELETE']::text[], '{"INSERT":["user_id","id","send_at","title","body","screen","item"]}'::jsonb),
      ('authenticated', 'family_grants',
       array['SELECT']::text[], '{"UPDATE":["revoked_at"]}'::jsonb),
      ('authenticated', 'organizations',
       array['SELECT']::text[], '{"UPDATE":["name","about","listed"]}'::jsonb),
      ('authenticated', 'organization_members',
       array['SELECT']::text[], '{}'::jsonb),
      ('authenticated', 'reports',
       array['SELECT']::text[], '{"INSERT":["reporter","message_id","about","reason","copy"],"UPDATE":["status"]}'::jsonb),
      ('authenticated', 'schools',
       array['SELECT']::text[], '{}'::jsonb),
      ('authenticated', 'institution_identity_provider',
       array['SELECT']::text[], '{}'::jsonb),
      ('authenticated', 'institution_membership',
       array['SELECT']::text[], '{}'::jsonb),
      ('authenticated', 'integration_sync_runs',
       array['SELECT']::text[], '{}'::jsonb),
      ('service_role', 'institution_identity_provider',
       array[]::text[], '{"SELECT":["id","tenant_id","provider_identifier","status","domains"],"UPDATE":["attribute_mapping"]}'::jsonb),
      ('service_role', 'institution_membership',
       array[]::text[], '{"SELECT":["auth_user_id","tenant_id","identity_provider_id","status","roles"]}'::jsonb),
      ('service_role', 'integration_sync_runs',
       array['SELECT', 'INSERT', 'UPDATE']::text[], '{}'::jsonb)
    ) as expected_grants(role_name, table_name, table_grants, column_grants)
  loop
    relation_name := format('public.%I', rule.table_name);

    -- An access grant is safe only with the existing RLS envelope retained.
    -- Check policy presence as well as the enabled flag; predicate correctness
    -- remains the separate feature suites' responsibility.
    if not exists (
      select 1 from pg_class c
       where c.oid = relation_name::regclass
         and c.relkind in ('r', 'p') and c.relrowsecurity
         and exists (select 1 from pg_policy p where p.polrelid = c.oid)
    ) then
      raise exception 'FAILED: % lost its RLS-enabled table/policy envelope', relation_name;
    end if;

    -- For each client table also check anon. Its only approved addition here
    -- is schools SELECT. Existing organizations UPDATE(name/about/listed)
    -- survives from the organization migration, guarded by its row policies.
    foreach role_name in array case when rule.role_name = 'authenticated'
      then array['authenticated', 'anon'] else array['service_role'] end
    loop
      if role_name = rule.role_name then
        allowed_tables := rule.table_grants;
        allowed_columns := rule.column_grants;
      elsif rule.table_name = 'schools' then
        allowed_tables := array['SELECT'];
        allowed_columns := '{}'::jsonb;
      elsif rule.table_name = 'organizations' then
        allowed_tables := array[]::text[];
        allowed_columns := '{"UPDATE":["name","about","listed"]}'::jsonb;
      else
        allowed_tables := array[]::text[];
        allowed_columns := '{}'::jsonb;
      end if;

      foreach verb in array allowed_tables loop
        if not has_table_privilege(role_name, relation_name, verb) then
          raise exception 'FAILED: % lacks % on %', role_name, verb, relation_name;
        end if;
        required_tables := required_tables + 1;
      end loop;
      for column_rule in select key, value from jsonb_each(allowed_columns) loop
        for column_name in select jsonb_array_elements_text(column_rule.value) loop
          if not has_column_privilege(role_name, relation_name, column_name, column_rule.key) then
            raise exception 'FAILED: % lacks % on %.%',
              role_name, column_rule.key, relation_name, column_name;
          end if;
          required_columns := required_columns + 1;
        end loop;
      end loop;

      if not legacy_fixture then
        foreach verb in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
          if has_table_privilege(role_name, relation_name, verb)
             and not (verb = any(allowed_tables)) then
            raise exception 'FAILED: % has unapproved blanket % on %', role_name, verb, relation_name;
          end if;
          if has_table_privilege(role_name, relation_name, verb || ' WITH GRANT OPTION') then
            raise exception 'FAILED: % can delegate % on %', role_name, verb, relation_name;
          end if;

          -- has_any_column_privilege alone cannot prove the exact boundary.
          -- Inspect every live column, so new columns stay excluded unless
          -- the contract deliberately grants the whole-table operation.
          if verb <> 'DELETE' then
            for live_column in
              select a.attname from pg_attribute a
               where a.attrelid = relation_name::regclass
                 and a.attnum > 0 and not a.attisdropped
            loop
              expected := verb = any(allowed_tables)
                or coalesce((allowed_columns -> verb) ? live_column.attname::text, false);
              actual := has_column_privilege(role_name, relation_name, live_column.attname::text, verb);
              if actual is distinct from expected then
                raise exception 'FAILED: % %.% % = %, expected %',
                  role_name, relation_name, live_column.attname, verb, actual, expected;
              end if;
              if has_column_privilege(role_name, relation_name, live_column.attname::text,
                                      verb || ' WITH GRANT OPTION') then
                raise exception 'FAILED: % can delegate % on %.%',
                  role_name, verb, relation_name, live_column.attname;
              end if;
            end loop;
          end if;
        end loop;
      end if;
    end loop;
  end loop;
  raise notice 'ok  required table privileges (%) and column privileges (%) remain',
    required_tables, required_columns;
  raise notice 'ok  all 19 approved target tables retain RLS and policies';
  if legacy_fixture then
    raise notice 'SKIP: strict new CRUD/column boundaries in explicitly selected legacy fixture; run explicit mode too';
  else
    raise notice 'ok  exact authenticated, anon and service-role CRUD/column limits remain';
  end if;
end $$;

rollback;
