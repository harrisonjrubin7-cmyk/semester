-- Settle one claimed delivery and append its terminal or retry event.

create or replace function public.settle_notification_delivery(
  want_id uuid, want_claim uuid, want_outcome text, want_error_code text default null,
  want_retry_after timestamptz default null
) returns public.notification_deliveries
language plpgsql security definer set search_path = '' as $$
declare row_now public.notification_deliveries; next_state text; next_attempt integer;
begin
  select * into row_now from public.notification_deliveries where id=want_id for update;
  if row_now.id is null or row_now.state <> 'claimed' or row_now.claim_id is distinct from want_claim then
    raise exception 'delivery claim mismatch';
  end if;
  next_attempt := row_now.attempts + 1;
  if want_outcome = 'delivered' then next_state := 'delivered';
  elsif want_outcome = 'suppressed' then next_state := 'suppressed';
  elsif want_outcome = 'retry' and next_attempt < 8 and want_retry_after is not null and want_retry_after > now() then next_state := 'retry';
  elsif want_outcome in ('retry','dead_letter') then next_state := 'dead_letter';
  else raise exception 'invalid delivery outcome'; end if;

  update public.notification_deliveries set state=next_state, attempts=next_attempt,
    claim_id=null, claimed_at=null, delivered_at=case when next_state='delivered' then now() else null end,
    deliver_after=case when next_state='retry' then want_retry_after else deliver_after end,
    last_error_code=case when next_state in ('retry','dead_letter') then want_error_code else null end, updated_at=now()
  where id=want_id returning * into row_now;
  insert into public.notification_delivery_events (delivery_id, school_id, recipient_id, state, attempt, reason_code)
  values (row_now.id, row_now.school_id, row_now.recipient_id, next_state, next_attempt, row_now.last_error_code);
  return row_now;
end $$;

revoke all on function public.settle_notification_delivery(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.settle_notification_delivery(uuid,uuid,text,text,timestamptz) to service_role;
