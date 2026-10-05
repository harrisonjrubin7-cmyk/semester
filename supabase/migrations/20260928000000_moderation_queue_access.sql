-- Whether the caller may review reports — the last piece of the §58 P0.
--
-- `20260921214500_report_status.sql` gave reports a status and
-- `20260922012000_capabilities.sql` pointed who may read and move them at
-- `report:read` and `moderation:action`. What was still missing is the screen,
-- and the screen has one question it cannot answer from the table alone: a
-- `select` that returns no rows means either "the queue is empty" or "you may
-- not read the queue", and those need different things drawn. A moderator with
-- nothing waiting should be told so; everybody else should see no queue at all.
--
-- So this answers exactly that, for the caller and nobody else: two booleans,
-- through the same `private.has_capability` the policies use, so the screen and
-- the policies cannot disagree. It reads no report and names no person.
-- `has_capability` itself stays unreachable from the client, as its own comment
-- asks — this exposes two fixed answers about the caller, not the function.
--
-- Signed-out callers get no execute grant; there is no queue for them to ask
-- about. `my_help_destinations()` in `20260927231000_help_inbox.sql` is the
-- same shape for the same reason.

create or replace function public.my_moderation_access()
returns table (can_read boolean, can_act boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_capability('report:read'),
         private.has_capability('moderation:action');
$$;

revoke all on function public.my_moderation_access() from public, anon;
grant execute on function public.my_moderation_access() to authenticated;

comment on function public.my_moderation_access() is
  'The caller''s own report:read and moderation:action, for the moderation screen to tell an empty queue from no queue. Reads no report.';

-- Rolling back: `drop function if exists public.my_moderation_access();`
-- Nothing depends on it but the screen, which then shows no queue to anybody.
