-- Semester — `gtm_pilot_problems` answers only somebody who may read the pilot.
--
-- Safe to run again; it replaces one function body and restates its grant.
--
-- ## The fault
--
-- `gtm_pilot_problems(uuid)` is `security definer` and granted to
-- `authenticated`, so the read policy on `gtm_pilots` ("pipeline readers read
-- pilots", `private.gtm_account_visible(account_id)`) does not stand in front
-- of it. The body looked the pilot up by id and returned its readiness list
-- with no question about the caller. Any signed-in account holding a pilot's
-- id — a student included — could learn whether its price was agreed, whether
-- it had an executive sponsor or a champion, whether its dates fit, and how
-- many metrics it had, about a commercial record the policy would not show
-- them a single column of.
--
-- Found by the Security Definer and RLS remediation register
-- (docs/DEFINER-RLS-REGISTER.md), which classifies each of the 151 definer
-- functions a signed-in account can call. It was one of two whose body named
-- neither `auth.uid()` nor any `private.` gate; the other,
-- `kill_switch_engaged`, returns one boolean the table's own read policy
-- already shows every signed-in account for the platform-wide row, and is
-- recorded there as a read helper.
--
-- ## The fix
--
-- The function asks the policy's own question, through the policy's own
-- helper, and a caller the policy would refuse gets exactly what a pilot that
-- does not exist returns: `{not_found}`. Nothing stricter than the policy —
-- sales and the school's own admin still get the whole list — because
-- `private.gtm_pilot_guard` calls this as an invoker trigger when sales moves
-- a pilot to active, and that path has to keep working.
-- `supabase/gtm.check.sql` holds all four sides of it.

create or replace function public.gtm_pilot_problems(want_pilot uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  p public.gtm_pilots;
  out text[] := '{}';
  n int;
  days int;
begin
  select * into p from public.gtm_pilots where id = want_pilot;
  if not found or not private.gtm_account_visible(p.account_id) then
    return array['not_found'];
  end if;
  days := p.end_date - p.start_date;
  if days < 60 or days > 120 then out := out || 'duration'::text; end if;
  if length(trim(p.cohort)) = 0 then out := out || 'no_cohort'::text; end if;
  if p.baseline is null then out := out || 'no_baseline'::text; end if;
  if p.executive_sponsor is null then out := out || 'no_sponsor'::text; end if;
  if p.operational_champion is null then out := out || 'no_champion'::text; end if;
  if not (p.minimum_necessary_data and p.read_only_first and p.source_labelled) then out := out || 'data_plan'::text; end if;
  select count(*) into n from public.gtm_pilot_metrics m where m.pilot_id = p.id;
  if n < 3 or n > 5 then out := out || 'metric_count'::text; end if;
  if exists (select 1 from public.gtm_pilot_metrics m where m.pilot_id = p.id and m.baseline is null) then
    out := out || 'metric_baseline'::text;
  end if;
  if p.conversion_date is null then out := out || 'no_conversion_date'::text;
  elsif p.conversion_date < p.end_date - 14 or p.conversion_date > p.end_date + 30 then
    out := out || 'conversion_outside_window'::text;
  end if;
  if not p.annual_price_agreed then out := out || 'no_price'::text; end if;
  if p.midpoint_review_date is null then out := out || 'no_midpoint'::text; end if;
  return out;
end $$;
revoke all on function public.gtm_pilot_problems(uuid) from public, anon;
grant execute on function public.gtm_pilot_problems(uuid) to authenticated;
