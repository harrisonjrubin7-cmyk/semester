-- Semester — the database runs every pilot for exactly 26 weeks, as the app does (D-134).
--
-- Safe to run again; it replaces one function body and restates its grant.
--
-- ## Why
--
-- The owner set every pilot to 26 weeks (182 days), and `gtm/pilot.ts`'s
-- `pilotReadiness` refuses any other length. `gtm_pilot_problems` still
-- refused anything outside 60–120 days, and `private.gtm_pilot_guard` calls it
-- when sales moves a pilot to active, so every pilot the app accepted the
-- database would have refused. Found by Codex's review of #967.
--
-- ## What changes
--
-- The duration line, and nothing else: the body is
-- `20260929120000_gtm_pilot_problems_visibility.sql`'s, with its visibility
-- gate, which the definer register holds to this file now that it is the
-- winning definition. `supabase/gtm.check.sql` shows a 109-day pilot refused
-- for `duration` and a 182-day one starting.

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
  if days <> 182 then out := out || 'duration'::text; end if;
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
