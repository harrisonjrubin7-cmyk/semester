-- Individual-beta support questions are operational records, not permanent
-- profiles. Resolved and student-closed tickets without a signed deployment
-- association are retained for 180 days after their last activity, then
-- removed with their messages and notification intents. Tickets opened under
-- an effective signed order form remain outside this sweep until an
-- institution-specific contract rule is configured. An active account, tenant
-- or platform legal hold always wins.

-- A tenant hold protects the record, not merely the student's current profile.
-- Keep a signed deployment tenant at creation time so leaving a school cannot
-- detach an existing ticket from a hold that still covers it. Domain-based
-- school membership alone is not a deployment and must keep the individual
-- beta clock. The value deliberately has no school foreign key: retained
-- evidence must survive tenant offboarding.
alter table public.support_tickets
  add column if not exists tenant_id text,
  add column if not exists retention_classified boolean not null default false,
  add column if not exists retention_subject_id uuid;

-- A pre-classifier ticket can outlive account erasure only while its
-- historical authority is still unknown. Detach it from auth.users before
-- that account is removed, but retain the opaque former subject id so an
-- evidence-backed review can still associate records from the same matter.
-- Classified tickets never use this path.
alter table public.support_tickets alter column student_id drop not null;
do $$ begin
  alter table public.support_tickets
    add constraint support_ticket_live_or_preserved_subject check (
      (student_id is not null and retention_subject_id is null)
      or
      (student_id is null and retention_subject_id is not null
       and not retention_classified and not email_notice_enabled)
    );
exception when duplicate_object then null;
end $$;

create index if not exists support_tickets_preserved_subject
  on public.support_tickets (retention_subject_id)
  where student_id is null;

-- Bound the daily sweep to rows it can actually remove. Signed-deployment
-- and unclassified legacy tickets are outside this partial index, so their
-- growth cannot lengthen the legal-hold lock window.
create index if not exists support_tickets_retention_due
  on public.support_tickets (updated_at, student_id)
  where retention_classified
    and tenant_id is null
    and status in ('resolved', 'closed');

-- Do not infer a historical tenant from today's profile or today's contract
-- state. Older tickets predate the durable snapshot, and the membership audit
-- does not prove every revocation/move interval. They therefore stay
-- unclassified and outside automated deletion until an operator verifies the
-- contemporaneous membership and contract evidence. Every ticket opened
-- through the function below is classified atomically at creation time.

comment on column public.support_tickets.tenant_id is
  'Effective signed deployment tenant when the ticket was opened; null for school-domain membership alone and retained after membership changes so tenant legal holds continue to cover the record.';

comment on column public.support_tickets.retention_classified is
  'True only when the ticket was classified from contemporaneous membership and contract state; false legacy rows are preserved pending evidence-backed classification.';

comment on column public.support_tickets.retention_subject_id is
  'Opaque former account UUID used only for an unclassified legacy ticket detached during account erasure; it is not a foreign key and is never returned by student or support functions.';

-- Re-state the only client entry point so every new ticket snapshots the
-- caller's effective signed deployment tenant. Staff-facing reads still omit
-- both account and tenant identity.
create or replace function public.open_support_ticket(
  want_category text, want_subject text, want_body text, want_context jsonb,
  want_email_notice boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  made uuid;
  who uuid := (select auth.uid());
  membership_tenant text;
  ticket_tenant text;
begin
  if who is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support_ticket:' || who::text, 0));
  if (select count(*) from public.support_tickets t
       where t.student_id = who and t.created_at > now() - interval '1 day') >= 5 then
    raise exception 'five questions a day is the limit; reply on an open one instead'
      using errcode = 'check_violation';
  end if;
  -- Keep claim_school/leave_school from changing membership between the
  -- snapshot decision and the ticket insert.
  select p.school_id into membership_tenant
    from public.profiles p
   where p.user_id = who
     for update of p;
  select membership_tenant into ticket_tenant
   where membership_tenant is not null
     and exists (
       select 1
         from public.billing_account_tenants bt
         join public.contracts c on c.billing_account_id = bt.billing_account_id
        where bt.tenant_id = membership_tenant
          and c.kind = 'order_form'
          and c.status = 'signed'
          and c.effective_at <= now()
          and (c.ends_at is null or c.ends_at > now())
     );
  insert into public.support_tickets
    (student_id, tenant_id, retention_classified, category, subject, body, context, priority,
     first_response_due, email_notice_enabled)
  values (
    who, ticket_tenant, true, want_category, want_subject, want_body,
    coalesce(want_context, '{}'::jsonb),
    case when want_category in ('accessibility', 'privacy') then 'high' else 'normal' end,
    now() + make_interval(hours => private.support_first_response_hours(want_category)),
    coalesce(want_email_notice, false)
  ) returning id into made;
  return made;
end $$;

-- The delivery mechanics passed UAT, but Resend's vendor review and executed
-- terms/DPA are not on file. Park the production worker until that gate is
-- recorded and SUPPORT_NOTIFY_VENDOR_APPROVED is enabled on the function.
do $$
begin
  if to_regproc('cron.alter_job') is not null then
    execute $cron$
      select cron.alter_job(
        (select jobid from cron.job where jobname = 'support-reply-notify'),
        active := false
      )
      where exists (select 1 from cron.job where jobname = 'support-reply-notify')
    $cron$;
  end if;
end $$;

-- Activating a vendor must not release notices accumulated while delivery was
-- parked. The Edge Function supplies the recorded activation instant on every
-- claim. This transaction deletes older, still-pending intents before it can
-- claim any newer work; a missing activation instant has no callable overload.
drop function if exists public.claim_support_notifications(uuid, integer);
create or replace function public.claim_support_notifications(
  want_message uuid, want_limit integer, want_not_before timestamptz
)
returns table (message_id uuid, ticket_id uuid, attempts integer, claim_id uuid)
language sql volatile security invoker set search_path = '' as $$
  with expired as (
    delete from public.support_notification_outbox o
     where want_not_before is not null
       and o.queued_at < want_not_before
       and o.accepted_at is null
       and o.dead_lettered_at is null
       and o.claim_id is null
    returning o.message_id
  ), due as (
    select o.message_id
      from public.support_notification_outbox o
      join public.support_tickets t on t.id = o.ticket_id
     where want_not_before is not null
       and o.queued_at >= want_not_before
       and t.email_notice_enabled
       and o.accepted_at is null
       and o.dead_lettered_at is null
       and o.next_attempt_at <= now()
       and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
       and (want_message is null or o.message_id = want_message)
     order by o.queued_at
     limit greatest(1, least(coalesce(want_limit, 100), 100))
     for update of o skip locked
  ), claimed as (
    update public.support_notification_outbox o
       set claim_id = pg_catalog.gen_random_uuid(), claimed_at = now()
      from due
     where o.message_id = due.message_id
    returning o.message_id, o.ticket_id, o.attempts, o.claim_id
  )
  select c.message_id, c.ticket_id, c.attempts, c.claim_id from claimed c;
$$;

revoke all on function public.claim_support_notifications(uuid, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_support_notifications(uuid, integer, timestamptz) to service_role;

revoke all on function public.open_support_ticket(text, text, text, jsonb, boolean) from public, anon;
grant execute on function public.open_support_ticket(text, text, text, jsonb, boolean) to authenticated;

create or replace function private.sweep_support_ticket_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare removed integer;
begin
  -- Serialize the hold decision with every placement or release. INSERT and
  -- UPDATE take ROW EXCLUSIVE on legal_holds, which conflicts with SHARE, so
  -- no hold can become active between this check and the DELETE below.
  lock table public.legal_holds in share mode;
  delete from public.support_tickets t
   where t.status in ('resolved', 'closed')
     and t.retention_classified
     and t.tenant_id is null
     and t.updated_at < now() - interval '180 days'
     and not private.account_is_held(t.student_id)
     and not (t.tenant_id is not null and private.tenant_is_held(t.tenant_id));
  get diagnostics removed = row_count;
  return jsonb_build_object('support_tickets', removed);
end $$;

revoke all on function private.sweep_support_ticket_retention() from public, anon, authenticated;
grant execute on function private.sweep_support_ticket_retention() to service_role;

comment on function private.sweep_support_ticket_retention() is
  'Deletes individual-beta resolved or closed support tickets after 180 days unless an active legal hold applies; signed-deployment tickets await a configured institutional contract rule.';

-- A direct self-service deletion is still a deletion and therefore must obey
-- the same hold as the scheduled sweep. Account erasure already checks holds,
-- but this narrower RPC is independently callable by authenticated users.
create or replace function public.forget_my_support_tickets()
returns void language plpgsql security definer set search_path = '' as $$
declare who uuid := (select auth.uid());
begin
  if who is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  -- Membership changes update this same row. Hold it through the decision and
  -- deletion so claim_school/leave_school cannot move the account into or out
  -- of a held tenant after account_is_held has read its school_id.
  perform 1
    from public.profiles p
   where p.user_id = who
     for update of p;
  -- Hold placement and release write legal_holds and therefore wait for this
  -- transaction. Recheck only after taking the lock, then keep it through the
  -- deletion so a new hold cannot slip into the check/delete boundary.
  lock table public.legal_holds in share mode;
  if private.account_is_held(who)
     or exists (
       select 1 from public.support_tickets t
        where t.student_id = who
          and t.tenant_id is not null
          and private.tenant_is_held(t.tenant_id)
     ) then
    raise exception 'support tickets are preserved by an active legal hold'
      using errcode = '55006';
  end if;
  -- A narrow ticket-only deletion cannot decide the historical authority of
  -- a pre-classifier row. Whole-account erasure must not strand the account,
  -- but it also cannot destroy a legacy row that may have been opened under a
  -- signed deployment whose tenant was never snapshotted. Detach that row
  -- from auth.users and disable delivery while retaining an opaque subject
  -- reference for evidence-backed review. Properly classified rows still
  -- delete below.
  if current_setting('semester.erasing_account', true) is distinct from who::text
     and exists (
    select 1 from public.support_tickets t
     where t.student_id = who and not t.retention_classified
  ) then
    raise exception 'legacy support tickets await evidence-backed retention classification'
      using errcode = '55000';
  end if;
  if current_setting('semester.erasing_account', true) = who::text then
    update public.support_tickets
       set retention_subject_id = student_id,
           student_id = null,
           email_notice_enabled = false,
           status = 'closed'
     where student_id = who
       and not retention_classified;
  end if;
  delete from public.support_tickets where student_id = who;
end $$;

revoke all on function public.forget_my_support_tickets() from public, anon;
grant execute on function public.forget_my_support_tickets() to authenticated;

comment on function public.forget_my_support_tickets() is
  'Deletes the caller''s classified support tickets unless a legal hold requires preservation; narrow deletion of legacy tickets needs evidence-backed classification, while whole-account erasure detaches and preserves them without retaining the auth account.';

-- Every account-removal path eventually deletes auth.users, including paths
-- that do not call erase_account. Strengthen the existing universal delete
-- trigger so a snapshotted support-ticket tenant hold cannot be bypassed by a
-- later membership change. Ambiguous pre-classifier evidence is detached
-- before the foreign-key cascade; classified, unheld rows keep normal cascade
-- semantics.
create or replace function private.refuse_delete_while_held()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare ticket record;
begin
  lock table public.legal_holds in share mode;
  if private.account_is_held(old.id)
     or exists (
       select 1 from public.support_tickets t
        where t.student_id = old.id
          and t.tenant_id is not null
          and private.tenant_is_held(t.tenant_id)
     ) then
    raise exception 'This account or its support evidence is under a legal hold and cannot be deleted until the hold is released.'
      using errcode = '55006';
  end if;

  for ticket in
    select t.id from public.support_tickets t
     where t.student_id = old.id and not t.retention_classified
     order by t.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('support_notice:' || ticket.id::text, 0));
  end loop;

  delete from public.support_notification_outbox o
   using public.support_tickets t
   where t.student_id = old.id
     and not t.retention_classified
     and o.ticket_id = t.id;
  -- Ticket-bound support access has a composite FK without ON UPDATE. Revoke
  -- and audit those grants before detaching the preserved legacy ticket, or
  -- the student_id update would strand the whole account deletion.
  delete from public.support_access_grant g
   using public.support_tickets t
   where t.student_id = old.id
     and not t.retention_classified
     and g.ticket_id = t.id;
  update public.support_tickets
     set retention_subject_id = student_id,
         student_id = null,
         email_notice_enabled = false,
         status = 'closed'
   where student_id = old.id
     and not retention_classified;
  return old;
end $$;

revoke all on function private.refuse_delete_while_held() from public, anon, authenticated;

-- Preserved legacy evidence is not an active support conversation. Keep it
-- out of the ordinary staff queue and thread reader, even for a staff member
-- who retained an old SUP reference.
create or replace function public.support_ticket_queue()
returns table (id uuid, category text, subject text, status text, priority text,
               created_at timestamptz, first_response_due timestamptz, first_responded_at timestamptz, overdue boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  return query
    select t.id, t.category, t.subject, t.status, t.priority, t.created_at, t.first_response_due,
           t.first_responded_at, (t.first_responded_at is null and t.first_response_due < now())
      from public.support_tickets t
     where t.student_id is not null
       and t.status in ('open', 'waiting_on_student')
     order by (t.priority = 'high') desc, t.first_response_due;
end $$;

create or replace function public.support_ticket_thread(want_ticket uuid)
returns table (from_side text, body text, context jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  return query
    select 'student'::text, t.body, t.context, t.created_at
      from public.support_tickets t
     where t.id = want_ticket and t.student_id is not null
    union all
    select m.from_side, m.body, null::jsonb, m.created_at
      from public.support_ticket_messages m
      join public.support_tickets t on t.id = m.ticket_id
     where t.id = want_ticket and t.student_id is not null
    order by 4;
end $$;

-- support_reply inserts the message before it updates the ticket, so guard
-- the message boundary itself. A preserved record can only be handled by a
-- future evidence-review workflow, not by the ordinary support console.
create or replace function private.guard_preserved_support_ticket_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.support_tickets t
     where t.id = new.ticket_id and t.student_id is null
  ) then
    raise exception 'preserved legacy support evidence is not an active conversation'
      using errcode = '55000';
  end if;
  return new;
end $$;

revoke all on function private.guard_preserved_support_ticket_message() from public, anon, authenticated;
drop trigger if exists guard_preserved_support_ticket_message on public.support_ticket_messages;
create trigger guard_preserved_support_ticket_message
before insert or update on public.support_ticket_messages
for each row execute function private.guard_preserved_support_ticket_message();

-- scheduler.sql remains the complete infrastructure source. This one
-- credential-free job is also installed by the migration when pg_cron is
-- available, so the retention promise cannot land without its enforcement.
-- The dynamic calls keep the plain-Postgres verification harness valid.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute $cron$
      select cron.schedule(
        'support-ticket-retention',
        '43 5 * * *',
        $job$select private.sweep_support_ticket_retention()$job$
      )
    $cron$;
    execute $cron$
      select cron.alter_job(
        (select jobid from cron.job where jobname = 'support-ticket-retention'),
        active := true
      )
    $cron$;
  end if;
end $$;
