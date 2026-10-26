-- Claim due deliveries with row locks, and audit each successful claim.

create or replace function public.claim_notification_deliveries(want_claim uuid, want_limit integer default 100)
returns setof public.notification_deliveries
language plpgsql security definer set search_path = '' as $$
declare claimed public.notification_deliveries;
begin
  for claimed in
    with due as (
      select d.id from public.notification_deliveries d
       where want_claim is not null and d.state in ('queued','retry') and d.deliver_after <= now()
       order by d.deliver_after, d.created_at
       for update skip locked limit least(greatest(coalesce(want_limit,100),1),500)
    )
    update public.notification_deliveries d
       set state='claimed', claim_id=want_claim, claimed_at=now(), updated_at=now()
      from due where d.id=due.id returning d.*
  loop
    insert into public.notification_delivery_events (delivery_id, school_id, recipient_id, state, attempt)
    values (claimed.id, claimed.school_id, claimed.recipient_id, 'claimed', claimed.attempts);
    return next claimed;
  end loop;
  return;
end $$;

revoke all on function public.claim_notification_deliveries(uuid,integer) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(uuid,integer) to service_role;
