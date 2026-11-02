-- A hand-off is guessed at five times, then it is revoked; and the service role can
-- revoke one that has not been used (P5-N28).
--
-- `consume_handoff` answers null to a wrong id, a wrong nonce, a used or an expired
-- hand-off, so a caller learns nothing from the answer. What stopped a guesser was
-- only that the nonce is 16 or more characters, with no limit on tries while the
-- fifteen minutes ran. The `revoked` status existed in the table's check and nothing
-- set it, so a link sent to the wrong person could not be cancelled.
--
-- A wrong nonce against a hand-off that is still live now counts. The fifth revokes
-- it, and the right nonce is refused from then on. A made-up id, a nonce too short to
-- be real, and an already used or expired hand-off count against nothing. The count
-- is committed with the null answer, because the function returns rather than raises.

alter table public.handoff_transactions
  add column if not exists attempts integer not null default 0
    constraint handoff_attempts_bounded check (attempts between 0 and 5);

create or replace function public.consume_handoff(p_id uuid, p_nonce text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  got record;
begin
  if me is null then
    raise exception 'consume_handoff needs a signed-in account' using errcode = '28000';
  end if;
  if p_nonce is null or length(p_nonce) not between 16 and 200 then
    return null;
  end if;

  update public.handoff_transactions h
     set status = 'consumed', consumed_at = now(), consumed_by = me
   where h.id = p_id
     and h.status = 'created'
     and h.expires_at > now()
     and h.nonce_hash = encode(sha256(convert_to(p_nonce, 'utf8')), 'hex')
  returning h.route, h.entry_context into got;

  if not found then
    -- Not the right nonce for a live hand-off: count it, and revoke on the fifth.
    update public.handoff_transactions h
       set attempts = h.attempts + 1,
           status   = case when h.attempts + 1 >= 5 then 'revoked' else h.status end
     where h.id = p_id
       and h.status = 'created'
       and h.expires_at > now();
    return null;
  end if;

  insert into public.onboarding_events (account_id, event_key, metadata)
  values (me, 'handoff_consumed', jsonb_build_object('route', got.route));
  return jsonb_build_object('route', got.route, 'entry', got.entry_context);
end $$;

-- Cancels a hand-off that has not been used. True when one was revoked.
create or replace function public.revoke_handoff(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.handoff_transactions
     set status = 'revoked'
   where id = p_id and status = 'created';
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.revoke_handoff(uuid) from public, anon, authenticated;
grant execute on function public.revoke_handoff(uuid) to service_role;
