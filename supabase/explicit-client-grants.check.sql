-- The two confirmed T-2 blockers must not depend on platform defaults.
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

rollback;
