-- Semester — what a supporter actually reads, and the log of every time they do.
--
-- Slice 3 of the owner-approved consent design, docs/CONSENT-SHARING-DESIGN.md
-- (D-037, §8): "Supporter recipient page: read-only, through a
-- security-definer reader that logs reads."
--
-- ## The gap this closes
--
-- After 20260928306000_family_invites.sql a claimed code is a live
-- `family_grants` row naming items by id. Nothing on the server knows what
-- those ids *are*: a Family item — the title, the note, the due date — lives
-- in `semester.family.v1` on the student's device and nowhere else. A live
-- grant with nothing behind it is a relationship that shows the parent a list
-- of uuids.
--
-- So the student's confirmation now carries the items themselves. The Preview
-- tab already shows the recipient's exact view before the code is made; this
-- stores that view, item by item, in the same transaction as the code, so a
-- code never exists without the content it names and content is never stored
-- without a code the student confirmed.
--
-- ## What this deliberately does not do
--
--   * **No live sync.** A copy is what the student confirmed, at the moment
--     they confirmed it. Editing the item on the device afterwards changes
--     nothing the supporter sees until the student shares again and confirms
--     again. An edit that reached the supporter by itself would be a share
--     nobody previewed (design §6), and the brief bars automatic sharing.
--   * **No recipient policy on either table.** A supporter reads through
--     `read_family_share()` and only through it, because that is the one path
--     that can re-check the grant and write the log in the same breath. A
--     select policy for the recipient would be a second path that logs
--     nothing.
--   * **No summaries.** The reader returns the items and their end date, not
--     counts across categories, not "last active", nothing computed (design
--     §7: a supporter must not infer what was not shared).
--
-- Numbered 20260928307000. It was first 20260927230000, which main had
-- already used for `help_requests`; see the note in 20260928306000.
--
-- Run this after 20260928306000_family_invites.sql. Every statement is guarded.

-- ── The copies ────────────────────────────────────────────────────────────
--
-- Column limits are `FAMILY_LIMITS` in app/src/lib/family.ts, so an item the
-- device accepts is an item this accepts.

create table if not exists public.family_shared_items (
  student_id uuid        not null references auth.users on delete cascade,
  -- The code this copy was confirmed with. A copy belongs to one share: a
  -- second share of the same item is a second copy under its own code, so
  -- what one supporter was shown never changes because of another share.
  code       text        not null references public.family_invites (code) on delete cascade,
  item_id    text        not null check (length(item_id) between 1 and 100),
  -- How the student is named on the supporter's page, in their own words.
  -- A supporter has no other way to tell two students apart: the student's
  -- profile is not theirs to read, and should not become so for this.
  shown_as   text        not null check (length(btrim(shown_as)) between 1 and 80),
  category   text        not null check (category in (
                           'finances', 'aid', 'housing', 'calendar', 'academic',
                           'emergency', 'travel', 'health-admin', 'career', 'communication')),
  kind       text        not null check (kind in ('information', 'request', 'checklist', 'budget')),
  title      text        not null check (length(btrim(title)) between 1 and 180),
  body       text        not null default '' check (length(body) <= 8000),
  due        text        not null default '' check (due = '' or due ~ '^\d{4}-\d{2}-\d{2}$'),
  done       boolean     not null default false,
  amount     numeric     not null default 0 check (amount >= 0 and amount <= 10000000),
  shared_at  timestamptz not null default now(),
  primary key (code, item_id)
);

-- Deleting an account finds its copies by student; the key leads with code.
create index if not exists family_shared_items_student_idx on public.family_shared_items (student_id);

alter table public.family_shared_items enable row level security;

comment on table public.family_shared_items is
  'The copy of a Family item a student confirmed sharing. Read by a supporter only through read_family_share().';

-- The student sees and removes their own copies. No insert or update policy:
-- a copy is written by `make_family_share` alongside the code it belongs to,
-- never on its own, so there is no path that stores content without a
-- confirmed share.
drop policy if exists "your shared copies are yours" on public.family_shared_items;
create policy "your shared copies are yours" on public.family_shared_items
  for select
  using ((select auth.uid()) = student_id);

drop policy if exists "you remove your shared copies" on public.family_shared_items;
create policy "you remove your shared copies" on public.family_shared_items
  for delete
  using ((select auth.uid()) = student_id);

revoke all on table public.family_shared_items from anon, authenticated;
grant select, delete on table public.family_shared_items to authenticated;

-- ── The read log ──────────────────────────────────────────────────────────
--
-- One row per read, written by the reader and by nothing else. The student
-- reads their own log; the supporter cannot read it, cannot write it and
-- cannot remove it — a log its subject can edit is a log of nothing.

create table if not exists public.family_access_events (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references auth.users on delete cascade,
  -- Set null, not cascade, when the reader's account goes: the student's
  -- record that somebody read their share does not disappear because that
  -- somebody deleted their account afterwards.
  reader_id  uuid        references auth.users on delete set null,
  -- Which items were returned on that read, so "read" means something
  -- specific. Empty when the grant was live and nothing behind it was.
  item_ids   text[]      not null default '{}',
  read_at    timestamptz not null default now()
);

alter table public.family_access_events enable row level security;

create index if not exists family_access_events_by_student on public.family_access_events (student_id, read_at desc);
create index if not exists family_access_events_by_reader on public.family_access_events (reader_id);

comment on table public.family_access_events is
  'Every read of a supporter share, written by read_family_share(). Readable by the student it is about.';

drop policy if exists "you see who read your share" on public.family_access_events;
create policy "you see who read your share" on public.family_access_events
  for select
  using ((select auth.uid()) = student_id);

-- `deleteEverything()` empties an account table by table as the account; a
-- log row the student cannot delete would outlive the student.
drop policy if exists "your read log goes with you" on public.family_access_events;
create policy "your read log goes with you" on public.family_access_events
  for delete
  using ((select auth.uid()) = student_id);

revoke all on table public.family_access_events from anon, authenticated;
grant select, delete on table public.family_access_events to authenticated;

-- ── Sharing: the code and its content, together ──────────────────────────
--
-- `make_family_invite` does every check on the share itself (signed in,
-- confirmed account, 1–200 days, `selected`, named items). This adds the one
-- thing it cannot: that the items carried are exactly the items named, each
-- in a category the code covers. Both happen in one transaction, so a refusal
-- of either leaves neither.

create or replace function public.make_family_share(
  want_categories text[],
  want_resources text[],
  want_days integer,
  want_items jsonb,
  want_shown_as text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me   uuid := (select auth.uid());
  made text;
  it   jsonb;
  ids  text[] := '{}';
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  if want_shown_as is null or length(btrim(want_shown_as)) not between 1 and 80 then
    raise exception 'semester: say how they will see your name'
      using errcode = 'check_violation';
  end if;
  if want_items is null or jsonb_typeof(want_items) <> 'array' then
    raise exception 'semester: the items to share are missing'
      using errcode = 'check_violation';
  end if;

  -- Every rule on the share itself, and the code.
  made := public.make_family_invite(want_categories, 'selected', want_resources, want_days);

  for it in select * from jsonb_array_elements(want_items) loop
    if jsonb_typeof(it) <> 'object'
       or not (it->>'id' = any(want_resources))
       or not (it->>'category' = any(want_categories))
       or it->>'id' = any(ids) then
      raise exception 'semester: an item does not match what the code shares'
        using errcode = 'check_violation';
    end if;
    ids := ids || (it->>'id');

    insert into public.family_shared_items
      (student_id, code, item_id, shown_as, category, kind, title, body, due, done, amount)
    values (
      me, made, it->>'id', btrim(want_shown_as), it->>'category',
      coalesce(it->>'kind', 'information'), coalesce(it->>'title', ''),
      coalesce(it->>'body', ''), coalesce(it->>'due', ''),
      coalesce((it->>'done')::boolean, false), coalesce((it->>'amount')::numeric, 0)
    );
  end loop;

  -- Named but not carried is the reverse mismatch: a grant pointing at an id
  -- with nothing behind it, or behind it an older copy nobody re-confirmed.
  if cardinality(ids) <> (select count(distinct r) from unnest(want_resources) r) then
    raise exception 'semester: an item does not match what the code shares'
      using errcode = 'check_violation';
  end if;

  return made;
end $$;

revoke all on function public.make_family_share(text[], text[], integer, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.make_family_share(text[], text[], integer, jsonb, text) to authenticated;

comment on function public.make_family_share(text[], text[], integer, jsonb, text) is
  'Mint a share code and store the confirmed copies of the items it names, in one transaction.';

-- ── Reading ───────────────────────────────────────────────────────────────
--
-- `allowsFamilyRequest`'s live test, applied at every read rather than once
-- at claim: accepted, not revoked, not expired. A grant that fails any of
-- them returns nothing for its student, and the page says "This share has
-- ended" whichever it was (D3), because nothing here tells it which.
--
-- `payment` reads nothing (D5). Only items named in the grant, in the grant's
-- own category, are returned — a copy that exists but is not named, or is
-- named under another category, is not.
--
-- The log is written before anything is returned, one row per student whose
-- grant is live, including a read that found no items.

create or replace function public.read_family_share()
returns table (
  student_id uuid,
  shown_as   text,
  category   text,
  item_id    text,
  kind       text,
  title      text,
  body       text,
  due        text,
  done       boolean,
  amount     numeric,
  ends_at    timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;

  insert into public.family_access_events (student_id, reader_id, item_ids)
  select g.student_id, me,
         coalesce(array_agg(distinct si.item_id) filter (where si.item_id is not null), '{}')
    from public.family_grants g
    left join public.family_shared_items si
      on si.student_id = g.student_id
     and si.category = g.category
     and si.item_id = any(g.resource_ids)
     and si.code = g.invite_code
   where g.recipient_id = me
     and g.accepted_at is not null
     and g.accepted_at <= now()
     and g.revoked_at is null
     and g.expires_at > now()
     and g.access in ('selected', 'view')
   group by g.student_id;

  return query
    select si.student_id, si.shown_as, si.category, si.item_id, si.kind,
           si.title, si.body, si.due, si.done, si.amount, max(g.expires_at)
      from public.family_grants g
      join public.family_shared_items si
        on si.student_id = g.student_id
       and si.category = g.category
       and si.item_id = any(g.resource_ids)
       and si.code = g.invite_code
     where g.recipient_id = me
       and g.accepted_at is not null
       and g.accepted_at <= now()
       and g.revoked_at is null
       and g.expires_at > now()
       and g.access in ('selected', 'view')
     group by si.student_id, si.shown_as, si.category, si.item_id, si.kind,
              si.title, si.body, si.due, si.done, si.amount
     order by si.shown_as, si.category, si.title;
end $$;

revoke all on function public.read_family_share() from public, anon, authenticated;
grant execute on function public.read_family_share() to authenticated;

comment on function public.read_family_share() is
  'A supporter reads what live grants show them. Re-checks every grant and logs every read.';

-- ── A shared copy is a used account ──────────────────────────────────────
--
-- The complete latest definition, every row of 20260928306000 (help_requests
-- included) plus the two
-- tables above. The note there about `graduation_scenarios` (#780) holds
-- here too: whichever lands second carries both.

create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id'),
      ('public.help_requests',        'student_id'),
      ('public.mentor_requests',      'requester'),
      ('public.mentor_requests',      'recipient'),
      ('public.peer_mentor_offers',   'user_id'),
      ('public.alumni_mentor_offers', 'user_id'),
      ('public.community_posts',      'author_id'),
      ('public.community_sessions',   'host_id'),
      ('public.community_session_participants', 'user_id'),
      ('public.community_mutes',      'user_id'),
      ('public.community_members',    'user_id'),
      ('public.community_aliases',    'user_id'),
      ('public.community_volunteers', 'user_id'),
      ('public.community_media',      'uploader_id'),
      ('public.graduation_scenarios', 'user_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id'),
      ('public.family_invites',       'student_id'),
      ('public.family_shared_items',  'student_id'),
      ('public.family_access_events', 'student_id')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid)
  from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.read_family_share();
--   drop function if exists public.make_family_share(text[], text[], integer, jsonb, text);
--   drop table if exists public.family_access_events;
--   drop table if exists public.family_shared_items;
--   commit;
--
-- and re-run the lti_account_untouched definition from 20260928306000.
