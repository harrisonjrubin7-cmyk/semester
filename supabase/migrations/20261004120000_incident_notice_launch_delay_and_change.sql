-- Two notices that are not incidents: a launch that is on hold, and a change
-- that is about to happen.
--
-- incident-comms.ts gained `launch_delay` and `change_notice`; this gives the
-- table the same two audiences, because a notice can be recorded by something
-- other than compose() and the rule has to hold there too. Nothing here is
-- retroactive: every notice already recorded is one of the eleven audiences
-- the old constraint allowed, and each stays valid under the new one.
--
--   launch_delay   approved by the Founder; the next update within a week (the
--                  steering meeting's cadence); states the check not yet
--                  complete and whether any account or data changed.
--   change_notice  approved by the Product owner, the Privacy owner and Legal;
--                  the next update within 30 days; states when it takes effect
--                  and whether the reader's work is affected.
--
-- The registry blocks below replace the ones in 20260927235000 and
-- 20260927235500; schema.test.ts reads the latest of each.

alter table public.governance_incident_notices
  drop constraint if exists governance_incident_notices_audience_check;
alter table public.governance_incident_notices
  add constraint governance_incident_notices_audience_check check (audience in (
    -- registry:audiences
    'student_outage', 'admin_outage', 'integration_delay', 'security', 'privacy',
    'accessibility', 'ai_quality', 'marketplace_sponsor', 'community_safety',
    'scheduled_maintenance', 'feature_rollback', 'launch_delay', 'change_notice'
    -- end registry
  ));

create or replace function private.check_incident_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- registry:sections
  sections constant text[] := array['what_happened', 'who_is_affected', 'what_is_impacted', 'what_to_do_now',
                                    'what_semester_is_doing', 'next_update', 'where_to_get_help'];
  -- end registry
  -- registry:avoid
  avoid constant text[] := array['we believe', 'probably', 'hereinafter', 'notwithstanding',
                                 'out of an abundance of caution'];
  -- end registry
  -- registry:required-details
  required jsonb := case new.audience
    when 'student_outage'    then '{"deadline_contact": null}'
    when 'integration_delay' then '{"source_system": null, "last_successful_sync": null}'
    when 'security'          then '{"data_exposure": ["Not indicated", "Suspected", "Confirmed", "Unknown"]}'
    when 'privacy'           then '{"data_classes": null, "data_exposure": ["Not indicated", "Suspected", "Confirmed", "Unknown"]}'
    when 'accessibility'     then '{"alternative_route": null}'
    when 'ai_quality'        then '{"outputs_to_distrust": null, "feature_paused": ["Yes", "No"]}'
    when 'community_safety'  then '{"crisis_contact": null}'
    when 'feature_rollback'  then '{"instead": null, "work_affected": ["Yes", "No"]}'
    when 'launch_delay'      then '{"gate_pending": null, "data_changed": ["Yes", "No"]}'
    when 'change_notice'     then '{"effective_date": null, "work_affected": ["Yes", "No"]}'
    else '{}' end::jsonb;
  -- end registry
  -- registry:cadence
  cadence integer := case new.audience
    when 'student_outage'        then 60
    when 'admin_outage'          then 60
    when 'integration_delay'     then 240
    when 'security'              then 60
    when 'privacy'               then 60
    when 'accessibility'         then 240
    when 'ai_quality'            then 240
    when 'marketplace_sponsor'   then 240
    when 'community_safety'      then 60
    when 'scheduled_maintenance' then 1440
    when 'feature_rollback'      then 1440
    when 'launch_delay'          then 10080
    when 'change_notice'         then 43200 end;
  -- end registry
  s text; k text; allowed jsonb; body text := '';
begin
  foreach s in array sections loop
    if jsonb_typeof(new.sections -> s) is distinct from 'string' or length(trim(new.sections ->> s)) = 0 then
      raise exception 'Incident notice section % is missing.', s;
    end if;
    body := body || E'\n' || (new.sections ->> s);
  end loop;
  for k, allowed in select * from jsonb_each(required) loop
    if jsonb_typeof(new.details -> k) is distinct from 'string' or length(trim(new.details ->> k)) = 0 then
      raise exception 'A % notice must state %.', new.audience, k;
    end if;
    if jsonb_typeof(allowed) = 'array' and not allowed ? trim(new.details ->> k) then
      raise exception '% must be one of %.', k, allowed;
    end if;
    body := body || E'\n' || (new.details ->> k);
  end loop;
  -- Bracketed text of any case is an unfilled placeholder; a markdown link is not.
  if body ~ '\[[^]\n]+\]($|[^(])' then
    raise exception 'An incident notice still carries a placeholder.';
  end if;
  foreach s in array avoid loop
    if position(s in lower(body)) > 0 then
      raise exception 'An incident notice may not say "%": no speculation or legalese.', s;
    end if;
  end loop;
  if new.next_update_at <= new.sent_at
     or new.next_update_at > new.sent_at + make_interval(mins => cadence) then
    raise exception 'A % notice promises its next update within % minutes.', new.audience, cadence;
  end if;
  return new;
end $$;
revoke all on function private.check_incident_notice() from public, anon, authenticated;

create or replace function private.check_notice_approvers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- registry:approvers
  required text[] := case new.audience
    when 'student_outage'        then array['Incident commander']
    when 'admin_outage'          then array['Incident commander']
    when 'integration_delay'     then array['Integration owner']
    when 'security'              then array['Security owner', 'Legal']
    when 'privacy'               then array['Privacy owner', 'Legal']
    when 'accessibility'         then array['Accessibility lead']
    when 'ai_quality'            then array['AI platform lead', 'AI governance chair']
    when 'marketplace_sponsor'   then array['Trust & Safety lead', 'Legal']
    when 'community_safety'      then array['Trust & Safety lead']
    when 'scheduled_maintenance' then array['Operations lead']
    when 'feature_rollback'      then array['Product owner']
    when 'launch_delay'          then array['Founder']
    when 'change_notice'         then array['Product owner', 'Privacy owner', 'Legal']
  end;
  -- end registry
begin
  if array_position(new.approved_by, null) is not null
     or exists (select 1 from unnest(new.approved_by) a where length(trim(a)) = 0) then
    raise exception 'An approver is blank.';
  end if;
  if not new.approved_by @> required then
    raise exception 'A % notice must be approved by %.', new.audience, array_to_string(required, ', ');
  end if;
  return new;
end $$;
revoke all on function private.check_notice_approvers() from public, anon, authenticated;
