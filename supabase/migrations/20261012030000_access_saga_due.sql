-- The worker's question: which sagas are due a move?
--
-- `access_saga_due` lists, oldest first, the sagas a tick should claim. It
-- follows what the runner does with each state on a tick, and lists nothing
-- the runner would only claim and release:
--
--   * a working state (RECEIVED, VALIDATING, EVALUATING, PREPARING,
--     INSTALLING, VERIFYING, RECONCILING, REVOKING, RECOVERY_REQUIRED) is due
--     once `next_attempt_at` has passed: the runner moves it or retries it;
--   * a waiting state (WAITING_STEP_UP, WAITING_APPROVAL) is due only once its
--     provisioning deadline has passed, when the runner expires it. A wake
--     (`access_saga_wake`) moves it to VALIDATING itself, so a signalled saga
--     is due as a working state at the next tick;
--   * ACTIVE is due only once its grant has expired, when the runner revokes
--     it. Enforcement and reconciliation of a live grant are not the tick's;
--   * a finished state (DENIED, EXPIRED, REVOKED) is never due.
--
-- It only lists; `access_saga_claim` still decides. Two ticks reading the
-- same list race on the claim and exactly one wins each saga, and a saga that
-- moves between the list and the claim is re-read by the claim.
--
-- Service role only, like the five Store functions: the worker is the only
-- caller and it runs with the service key.
create or replace function public.access_saga_due(p_limit integer)
returns setof text
language sql security definer stable set search_path = '' as $$
  with now_ms as (select (extract(epoch from clock_timestamp()) * 1000)::bigint as t)
  select s.id
    from public.access_sagas s, now_ms
   where (s.lease_token is null or s.lease_expires_at <= clock_timestamp())
     and case
           when s.state in ('DENIED', 'EXPIRED', 'REVOKED') then false
           when s.state in ('WAITING_STEP_UP', 'WAITING_APPROVAL') then s.deadline_at <= now_ms.t
           when s.state = 'ACTIVE' then s.grant_expires_at is not null and s.grant_expires_at <= now_ms.t
           else s.next_attempt_at <= now_ms.t
         end
   order by s.next_attempt_at, s.id
   limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

revoke all on function public.access_saga_due(integer) from public, anon, authenticated;
grant execute on function public.access_saga_due(integer) to service_role;
