-- Support questions are operational records, not permanent profiles.
-- Resolved and student-closed tickets are retained for 180 days after their
-- last activity, then removed with their messages and notification intents.
-- An active account, tenant or platform legal hold always wins.

create or replace function private.sweep_support_ticket_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare removed integer;
begin
  delete from public.support_tickets t
   where t.status in ('resolved', 'closed')
     and t.updated_at < now() - interval '180 days'
     and not private.account_is_held(t.student_id);
  get diagnostics removed = row_count;
  return jsonb_build_object('support_tickets', removed);
end $$;

revoke all on function private.sweep_support_ticket_retention() from public, anon, authenticated;
grant execute on function private.sweep_support_ticket_retention() to service_role;

comment on function private.sweep_support_ticket_retention() is
  'Deletes resolved or closed support tickets after 180 days unless an active legal hold applies; messages and notification intents cascade.';
