-- Telling a student their registration hold was cleared (Student finance #12;
-- build plan Phase A item 4; D-1448).
--
-- Holds belong to the official system. The SIS sync worker (service role)
-- writes `registration_holds` and is the only thing that sets `released_at`;
-- Semester never clears a hold itself. What was missing is the other half: a
-- student who was told "a hold stops you adding courses" was never told when
-- it stopped. This adds the notice, and nothing that can release a hold.
--
-- When `released_at` goes from empty to a time:
-- - one row in `hold_release_notices` for that hold: the office, its link and
--   when. Never the reason, which stays where `registration_holds` keeps it.
-- - one `financial_account.notify_student_of_hold_release` event on the common
--   audit record, with the hold's school and no detail.
-- - one push, if the student has a live device. A student who switched
--   reminders off has no device row, so gets none. The push id `hold:<hold>`
--   is one per hold, and `saveQueue` leaves `hold:` rows alone when it
--   replaces the student's own reminders.
--
-- Retries and races: the notice is keyed by the hold, so a sync that writes
-- the same release twice makes one notice. A hold placed again and released
-- again re-arms the same notice (unread, new time) rather than adding a
-- second. A hold that arrives already released was never shown, so it says
-- nothing.
--
-- The student reads their own notices and marks them read; that is the whole
-- client surface. Erasure needs no new list: both foreign keys cascade, and
-- `private.account_data_map()` finds the one to `auth.users`.
--
-- Rollback:
--   drop trigger if exists notify_hold_release on public.registration_holds;
--   drop function if exists private.notify_hold_release();
--   drop table if exists public.hold_release_notices;

create table if not exists public.hold_release_notices (
  id          uuid        primary key default gen_random_uuid(),
  hold_id     uuid        not null references public.registration_holds on delete cascade,
  student     uuid        not null references auth.users on delete cascade,
  office      text        not null,
  link        text        not null default '',
  released_at timestamptz not null,
  read_at     timestamptz,
  constraint hold_release_notice_once unique (hold_id)
);
create index if not exists hold_release_notices_by_student on public.hold_release_notices (student);
alter table public.hold_release_notices enable row level security;
revoke all on table public.hold_release_notices from anon, authenticated;
grant select on table public.hold_release_notices to authenticated;
grant update (read_at) on table public.hold_release_notices to authenticated;

comment on table public.hold_release_notices is
  'One notice per cleared registration hold, for its student: office, link and when. Never the reason. Written only by private.notify_hold_release.';

drop policy if exists "a student sees their own hold notices" on public.hold_release_notices;
create policy "a student sees their own hold notices" on public.hold_release_notices
  for select using (student = (select auth.uid()));
drop policy if exists "a student marks their own hold notice read" on public.hold_release_notices;
create policy "a student marks their own hold notice read" on public.hold_release_notices
  for update using (student = (select auth.uid())) with check (student = (select auth.uid()));

create or replace function private.notify_hold_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.released_at is not null or new.released_at is null then
    return new;
  end if;

  insert into public.hold_release_notices (hold_id, student, office, link, released_at)
  values (new.id, new.student, new.office, new.link, new.released_at)
  on conflict (hold_id) do update
    set released_at = excluded.released_at, office = excluded.office,
        link = excluded.link, read_at = null;

  perform private.record_audit(new.tenant_id, 'financial_account.notify_student_of_hold_release',
                               'registration_hold', new.id::text, 'allowed');

  if exists (select 1 from public.push_devices d where d.user_id = new.student and d.gone_at is null) then
    insert into public.push_queue (user_id, id, send_at, title, body, screen)
    values (new.student, 'hold:' || new.id::text, now(), 'A hold was cleared',
            left(new.office, 120) || ' cleared a hold on your account.', 'yes')
    on conflict (user_id, id) do update
      set send_at = excluded.send_at, title = excluded.title, body = excluded.body;
  end if;
  return new;
end $$;
revoke all on function private.notify_hold_release() from public, anon, authenticated;

drop trigger if exists notify_hold_release on public.registration_holds;
create trigger notify_hold_release
  after update of released_at on public.registration_holds
  for each row execute function private.notify_hold_release();
