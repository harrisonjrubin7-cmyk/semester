-- The advisor-share lifecycle on the common audit record (full-beta M2, G-04).
--
-- A student can share a meeting plan with an advisor, the advisor reads it, the
-- student revokes or deletes it. Each of those already left a trace of a sort
-- (`advisor_share_events` records reads, for the student) but none reached the
-- record a school's auditor reads, so "who shared what with whom" could not be
-- answered from one place.
--
-- Triggers rather than rewriting `share_with_advisor` and `read_advisor_share`:
-- revoke and delete are direct table writes from the client, so a function-only
-- hook would miss two of the four; a trigger sees every path, including a
-- delete by account erasure (recorded as the service acting).
--
-- What is written is deliberately thin: the verb, a pseudonym of the share, the
-- school, and for a new share how many days it lasts. Not the title, not the
-- payload, not the advisor's address. `audit_event` refuses more than 2 KB of
-- detail in any case.
--
-- Additive. Nothing about who may share or read changes.

create or replace function private.audit_advisor_share_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_audit(
      new.tenant_id, 'share.created', 'advisor_share', new.id::text, 'allowed', null,
      jsonb_build_object('audience', 'advisor',
                         'days', greatest(0, round(extract(epoch from (new.expires_at - new.created_at)) / 86400)::int)));
  elsif tg_op = 'UPDATE' then
    if old.revoked_at is null and new.revoked_at is not null then
      perform private.record_audit(new.tenant_id, 'share.revoked', 'advisor_share', new.id::text, 'allowed');
    end if;
  elsif tg_op = 'DELETE' then
    perform private.record_audit(old.tenant_id, 'share.deleted', 'advisor_share', old.id::text, 'allowed');
    return old;
  end if;
  return new;
end $$;

revoke all on function private.audit_advisor_share_change() from public, anon, authenticated;

drop trigger if exists audit_advisor_share_change on public.advisor_shares;
create trigger audit_advisor_share_change
  after insert or update of revoked_at or delete on public.advisor_shares
  for each row execute function private.audit_advisor_share_change();

-- A read is the moment the content leaves the student's control, so it is on
-- the record too. `advisor_share_events` is written by `read_advisor_share`
-- with the advisor as the caller, so the actor pseudonym is the advisor.
create or replace function private.audit_advisor_share_read()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text;
begin
  select s.tenant_id into school from public.advisor_shares s where s.id = new.share_id;
  perform private.record_audit(school, 'share.read', 'advisor_share', new.share_id::text, 'allowed');
  return new;
end $$;

revoke all on function private.audit_advisor_share_read() from public, anon, authenticated;

drop trigger if exists audit_advisor_share_read on public.advisor_share_events;
create trigger audit_advisor_share_read
  after insert on public.advisor_share_events
  for each row execute function private.audit_advisor_share_read();
