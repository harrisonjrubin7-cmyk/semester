-- Advisor check-ins on a student's share (Advising #5 and part of #6; D-1448).
--
-- An advisor who has opened a student's share can write back: what was talked
-- about, and up to five next steps. The student sees every check-in on the
-- share it belongs to, and can turn a next step into one of their own actions.
-- Nothing here is a caseload: an advisor reaches a student only through a share
-- that student made, and only while it is live.
--
-- Who can do what:
-- - The advisor writes through `record_advisor_check_in` and reads back through
--   `list_share_check_ins`. Both are gated exactly as `read_advisor_share` is:
--   the caller is the share's advisor, the share is neither revoked nor
--   expired, and the advisor still holds a live academic_advisor grant at the
--   share's school. The advisor never reads the table.
-- - The student reads the table (rows on their own shares) and may delete a
--   check-in. Revoking the share stops new check-ins; deleting it takes its
--   check-ins with it.
-- - A retry with the same `check_in_key` returns the check-in the first call
--   made, so a double submit or a lost response never writes two.
--
-- Erasure and export need no new list: the table cascades from
-- `advisor_shares`, which `forget_my_advisor_shares()` removes at either end,
-- and `private.account_data_map()` finds both foreign keys to `auth.users`.
--
-- Additive. Nothing about who may share or read a share changes.
--
-- Rollback:
--   drop function if exists public.list_share_check_ins(uuid);
--   drop function if exists public.record_advisor_check_in(uuid, text, text[], uuid);
--   drop function if exists private.audit_advisor_check_in();
--   drop table if exists public.advisor_check_ins;

create table if not exists public.advisor_check_ins (
  id          uuid        primary key default gen_random_uuid(),
  share_id    uuid        not null references public.advisor_shares on delete cascade,
  advisor_id  uuid        references auth.users on delete set null,
  note        text        not null check (length(trim(note)) between 1 and 2000),
  next_steps  text[]      not null default '{}' check (cardinality(next_steps) <= 5),
  client_key  uuid        not null,
  created_at  timestamptz not null default now(),
  constraint advisor_check_in_once unique (share_id, client_key)
);
create index if not exists advisor_check_ins_by_advisor on public.advisor_check_ins (advisor_id);
alter table public.advisor_check_ins enable row level security;
revoke all on table public.advisor_check_ins from anon, authenticated;
grant select, delete on table public.advisor_check_ins to authenticated;

drop policy if exists "a student sees check-ins on their shares" on public.advisor_check_ins;
create policy "a student sees check-ins on their shares" on public.advisor_check_ins
  for select using (exists (select 1 from public.advisor_shares s
                             where s.id = share_id and s.student_id = (select auth.uid())));
drop policy if exists "a student deletes a check-in on their share" on public.advisor_check_ins;
create policy "a student deletes a check-in on their share" on public.advisor_check_ins
  for delete using (exists (select 1 from public.advisor_shares s
                             where s.id = share_id and s.student_id = (select auth.uid())));

-- The share, if the caller may act on it as its advisor right now; else none.
create or replace function private.live_share_for_advisor(want_share uuid)
returns public.advisor_shares
language sql
stable
security definer
set search_path = ''
as $$
  select x.* from public.advisor_shares x
   where x.id = want_share
     and x.advisor_id = (select auth.uid())
     and x.revoked_at is null
     and x.expires_at > now()
     and exists (select 1 from public.role_grants g
                  where g.subject = x.advisor_id
                    and g.role = 'academic_advisor'
                    and g.scope_kind = 'school'
                    and g.scope_id = x.tenant_id
                    and g.revoked_at is null
                    and (g.expires_at is null or g.expires_at > now()));
$$;
revoke all on function private.live_share_for_advisor(uuid) from public, anon, authenticated;

create or replace function public.record_advisor_check_in(
  want_share uuid, check_in_note text, check_in_steps text[], check_in_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.advisor_shares;
  steps text[];
  made uuid;
begin
  s := private.live_share_for_advisor(want_share);
  if s.id is null then
    raise exception 'not shared with you' using errcode = '42501';
  end if;
  if check_in_key is null then
    raise exception 'a check-in needs a key' using errcode = '22023';
  end if;
  select coalesce(array_agg(trim(x) order by n), '{}') into steps
    from unnest(coalesce(check_in_steps, '{}')) with ordinality as u(x, n)
   where length(trim(x)) > 0;
  if cardinality(steps) > 5 then
    raise exception 'at most five next steps' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(steps) x where length(x) > 200) then
    raise exception 'a next step is at most 200 characters' using errcode = '22023';
  end if;
  insert into public.advisor_check_ins (share_id, advisor_id, note, next_steps, client_key)
  values (s.id, s.advisor_id, trim(coalesce(check_in_note, '')), steps, check_in_key)
  on conflict (share_id, client_key) do nothing
  returning id into made;
  if made is null then
    select c.id into made from public.advisor_check_ins c
     where c.share_id = s.id and c.client_key = check_in_key;
  end if;
  return made;
end $$;
revoke all on function public.record_advisor_check_in(uuid, text, text[], uuid) from public, anon, authenticated;
grant execute on function public.record_advisor_check_in(uuid, text, text[], uuid) to authenticated;

create or replace function public.list_share_check_ins(want_share uuid)
returns table (id uuid, note text, next_steps text[], created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.advisor_shares;
begin
  s := private.live_share_for_advisor(want_share);
  if s.id is null then
    raise exception 'not shared with you' using errcode = '42501';
  end if;
  return query
    select c.id, c.note, c.next_steps, c.created_at
      from public.advisor_check_ins c
     where c.share_id = s.id
     order by c.created_at desc;
end $$;
revoke all on function public.list_share_check_ins(uuid) from public, anon, authenticated;
grant execute on function public.list_share_check_ins(uuid) to authenticated;

-- On the common audit record, as the share's own lifecycle is
-- (20260930190000_advisor_share_audit.sql): the verb and the share's school,
-- never the note.
create or replace function private.audit_advisor_check_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text;
begin
  select s.tenant_id into school from public.advisor_shares s
   where s.id = coalesce(new.share_id, old.share_id);
  if tg_op = 'INSERT' then
    perform private.record_audit(school, 'check_in.recorded', 'advisor_check_in', new.id::text, 'allowed');
    return new;
  end if;
  -- A cascade from a deleted share finds no school; the share's own delete
  -- is already on the record.
  if school is not null then
    perform private.record_audit(school, 'check_in.deleted', 'advisor_check_in', old.id::text, 'allowed');
  end if;
  return old;
end $$;
revoke all on function private.audit_advisor_check_in() from public, anon, authenticated;

drop trigger if exists audit_advisor_check_in on public.advisor_check_ins;
create trigger audit_advisor_check_in
  after insert or delete on public.advisor_check_ins
  for each row execute function private.audit_advisor_check_in();
