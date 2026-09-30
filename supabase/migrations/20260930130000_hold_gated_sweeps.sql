-- A platform-wide legal hold now stops the two remaining sweeps that had no
-- way to hear it: the AI runtime metadata sweep and the Community retention
-- sweep.
--
-- 20260930100000_legal_holds.sql made the invite, abandoned-sign-up and audit
-- sweeps skip what a live hold covers, by editing the three functions that
-- deleted. These two are large functions defined in other migrations, and
-- copying them into this one would freeze today's body and silently override
-- any later edit to the originals. So they are left exactly as they are, and
-- the scheduler calls this instead: one small function that asks the question
-- first and only then runs the sweep it is asked for.
--
--   * A **platform** hold (placed by an operator as service_role) skips both.
--     The result says so — {"skipped": "legal_hold"} — so a paused sweep is
--     visible in the job's history and never looks like a sweep that found
--     nothing to remove.
--   * **School and account holds are handled row by row**, not here: see
--     20260930170000_hold_aware_sweeps.sql, which restates both sweeps with a
--     clause per delete. This dispatcher is the coarse gate — a platform hold
--     stops the sweep as a whole — and that migration is the fine one.
--   * It takes a name from a closed list and never builds SQL from it.
--
-- Same door as the sweeps it wraps: private, service_role only, revoked from
-- everyone else by name.

create or replace function private.run_sweep(which text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if which not in ('ai_runtime_metadata', 'community_retention') then
    raise exception 'Unknown sweep %.', which using errcode = '22023';
  end if;
  if private.platform_is_held() then
    return jsonb_build_object('skipped', 'legal_hold', 'sweep', which);
  end if;
  if which = 'ai_runtime_metadata' then
    return jsonb_build_object('removed', private.sweep_ai_runtime_metadata());
  end if;
  return private.sweep_community_retention();
end $$;

revoke all on function private.run_sweep(text) from public;
revoke all on function private.run_sweep(text) from anon, authenticated;
grant execute on function private.run_sweep(text) to service_role;

comment on function private.run_sweep(text) is
  'Run the AI-runtime or Community retention sweep unless a platform-wide legal hold is live, in which case say it was skipped. School and account holds are honoured row by row inside the sweeps (20260930170000).';
