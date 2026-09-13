-- Semester — rooms: the reactions on a message, and who is in the room now.
--
-- Run this after classmates.sql, in the Supabase dashboard: SQL Editor → New
-- query → paste → Run. It is safe to run again; every statement is guarded.
--
-- ## Why a table and not a column on the message
--
-- A reaction belongs to the person who left it, not to the message. Counting
-- them in a column would mean everybody in the room may write to a row
-- somebody else owns, which is the one thing the message policies are built to
-- prevent — and a lost update would silently drop somebody's tap.
--
-- ## Why term and code are on the row
--
-- They are already on the message, so this is duplication, and it buys two
-- things that matter here. Realtime filters on a single column, so
-- `code=eq.ECON 1020` is what lets a room subscribe to its own reactions
-- rather than to every reaction in the instance. And the read policy can then
-- ask `private.in_class(term, code)` directly instead of joining back to
-- `messages` for every row.
--
-- They are not trusted from the client: the insert policy checks that the pair
-- on the reaction is the pair on the message it points at, so a row cannot
-- claim to belong to a room its message is not in.
--
-- ## What a reaction may be
--
-- One short string, and the app only ever sends one of the six in its picker.
-- The check is a length rather than a list because an emoji is several code
-- points more often than people expect — a list would be a rule that fails on
-- the first skin tone somebody's keyboard sends.

-- ── The table ─────────────────────────────────────────────────────────────
-- The primary key is the whole row's identity: one person, one emoji, one
-- message. Tapping the same face twice is a delete, not a second row, and the
-- key is what makes that true in the database rather than only in the client.

create table if not exists public.message_reactions (
  message_id  uuid        not null references public.messages on delete cascade,
  user_id     uuid        not null references auth.users on delete cascade,
  emoji       text        not null check (length(emoji) between 1 and 16),
  term        text        not null,
  code        text        not null,
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- The room read, which is how the app loads a screenful: every reaction in one
-- room, newest messages first.
create index if not exists reactions_by_room
  on public.message_reactions (term, code, created_at desc);

-- The foreign key cover, for the same reason messages has one: deleting an
-- account should not scan every reaction ever left. `message_id` leads the
-- primary key already, so only the user needs its own.
create index if not exists reactions_user on public.message_reactions (user_id);

alter table public.message_reactions enable row level security;

-- ── Who may read one ──────────────────────────────────────────────────────
-- The same three gates the message itself is behind: verified, in that class,
-- and not from somebody you blocked. The block check is on the person who left
-- the reaction, so a blocked account's tap does not reach the device either —
-- a name in a "who reacted" list is still a message from them.

drop policy if exists "read reactions in your classes" on public.message_reactions;
create policy "read reactions in your classes" on public.message_reactions
  for select
  using (
    private.verified_student()
    and private.in_class(term, code)
    and not exists (
      select 1 from public.blocks b
      where b.user_id = (select auth.uid()) and b.blocked = message_reactions.user_id
    )
  );

-- ── Who may leave one ─────────────────────────────────────────────────────
-- Yourself, in a class you are in, on a message that is actually in that room.
-- The last clause is the one that stops a row claiming a room its message is
-- not in, which is what the denormalised term and code would otherwise allow.

drop policy if exists "react in your classes as yourself" on public.message_reactions;
create policy "react in your classes as yourself" on public.message_reactions
  for insert
  with check (
    (select auth.uid()) = user_id
    and private.verified_student()
    and private.in_class(term, code)
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and m.term = message_reactions.term
        and m.code = message_reactions.code
    )
  );

-- Taking one back. Only your own — there is no update policy at all, because
-- changing a reaction is removing one and leaving another.
drop policy if exists "take back your own reaction" on public.message_reactions;
create policy "take back your own reaction" on public.message_reactions
  for delete
  using ((select auth.uid()) = user_id);

-- ── Live updates ──────────────────────────────────────────────────────────
-- Realtime respects row-level security, so a subscriber is sent only what the
-- select policy above would have handed them. Both events matter here: a
-- reaction taken back has to disappear from the other person's screen too, so
-- the room listens for deletes as well as inserts.
--
-- A delete payload carries only the primary key unless the table replicates
-- the whole old row, and the primary key here is (message_id, user_id, emoji)
-- — which is exactly what the client needs to remove it. So no replica
-- identity change is needed; the key is the reaction.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end
$$;

-- ── Who is in the room now ────────────────────────────────────────────────
--
-- The green dot beside a name. It is not a table: presence lives in the
-- Realtime server for as long as a browser tab is open, and a row in Postgres
-- saying somebody is online would be a row that is wrong the moment a phone
-- goes into a pocket.
--
-- **Why the channel is private.** A Realtime channel with no authorization is
-- readable by anything holding the publishable key, and presence on it would
-- publish which accounts are online in which class to anybody who guessed the
-- topic. Private channels put the same question to the same policies
-- everything else here answers to, so the topic `here:<term>:<room key>` is
-- joinable only by somebody verified who is in that class.
--
-- **What happens without this.** The client asks to join, Realtime refuses,
-- and the room shows no dots at all. Nothing else about the conversation
-- changes — messages and reactions are ordinary tables and never depended on
-- this. That is the intended failure: a missing policy costs an ornament, not
-- the room.
--
-- The topic is split on colons, which is safe because neither half can contain
-- one: a term is "2026FA" and a room key is a school id and a course code
-- joined with a slash.

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'realtime' and tablename = 'messages') then
    execute 'alter table realtime.messages enable row level security';

    execute 'drop policy if exists "read your class rooms live" on realtime.messages';
    execute $p$
      create policy "read your class rooms live" on realtime.messages
        for select
        to authenticated
        using (
          split_part(realtime.topic(), ':', 1) = 'here'
          and private.verified_student()
          and private.in_class(
            split_part(realtime.topic(), ':', 2),
            split_part(realtime.topic(), ':', 3)
          )
        )
    $p$;

    -- Saying you are here is a write, and it is gated on exactly the same
    -- question. Without it a subscriber could watch a room they are in
    -- without ever appearing in it, which is not the bargain the dot implies.
    execute 'drop policy if exists "say you are in your class room" on realtime.messages';
    execute $p$
      create policy "say you are in your class room" on realtime.messages
        for insert
        to authenticated
        with check (
          split_part(realtime.topic(), ':', 1) = 'here'
          and private.verified_student()
          and private.in_class(
            split_part(realtime.topic(), ':', 2),
            split_part(realtime.topic(), ':', 3)
          )
        )
    $p$;
  end if;
end
$$;
