-- A pilot's success measures cannot be deleted or reworded once it has started.
--
-- F-1 in docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md: `gtm_pilot_metrics` was
-- writable by `account:manage` with a plain `for all` policy, DELETE included.
-- The metrics are what a pilot is judged against (`gtm_pilot_problems` insists
-- on three, each with a baseline, before it can start), and an outcome is
-- signed against them. Deleting or rewording one after the pilot is running
-- moves the goalposts with no request, no second person and no record.
--
--   pilot proposed   anything, as before: the metrics are still being agreed
--   pilot active /
--   decided          no delete; no change to name, target or which pilot the
--                    metric belongs to. Adding a metric, and filling a missing
--                    baseline, are unchanged.
--
-- This is a guard, not an approval duty. There is no legitimate operator path
-- to remove a measure from a running pilot that a request would unlock; a
-- mistake is corrected by server code holding the service key, which is
-- trusted here as it is for every other table. If that ever needs a human
-- path it should be a duty then, with a reader to approve it.
--
-- It binds the client roles only. A cascade from a deleted pilot or account
-- runs as the table owner and is not stopped: a pilot that goes goes with its
-- measures.

create or replace function private.guard_gtm_pilot_metric_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  was text;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  select p.status into was from public.gtm_pilots p where p.id = old.pilot_id;
  if was is null or was = 'proposed' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'A metric of a pilot that has started cannot be deleted.' using errcode = '42501';
  end if;
  if new.name is distinct from old.name
     or new.target is distinct from old.target
     or new.pilot_id is distinct from old.pilot_id then
    raise exception 'A metric of a pilot that has started cannot be reworded or moved.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.guard_gtm_pilot_metric_frozen() from public, anon, authenticated;
drop trigger if exists gtm_pilot_metrics_frozen on public.gtm_pilot_metrics;
create trigger gtm_pilot_metrics_frozen
  before update or delete on public.gtm_pilot_metrics
  for each row execute function private.guard_gtm_pilot_metric_frozen();
