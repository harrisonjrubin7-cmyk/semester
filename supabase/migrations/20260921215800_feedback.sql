-- Semester — saying something is wrong, without writing an email about it.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- ## What this replaces
--
-- `app/src/screens/settings/About.tsx` answered "something is broken" with an
-- address and a request: *write to us, and a bug report that names the screen
-- and what you expected is worth ten that say it is broken*. Both halves of
-- that were the app asking the student to do its own job. The screen they were
-- on is something the app knows. The build they are running is something only
-- the app knows. And somebody who has just hit a bug is the least likely
-- person in the world to open a mail client and compose a tidy report.
--
-- ## The context is a shape, and Postgres is what makes that true
--
-- `access_log` reached this first and for the same reason: it records which
-- *family* of client fetched a calendar, out of a fixed list, and keeps no
-- user-agent string, because a log of addresses is a log of where a student
-- was. The check constraint there is what makes that a property of the
-- database rather than a promise about a function.
--
-- A route is the same problem in different clothes. `#/course/econ` is mild;
-- `#/course/greek-orthodox-theology-seminar` is a disclosure, and nothing can
-- tell them apart, because a course id is whatever the syllabus was called.
-- `?room=` carries a room key.
--
-- So `route` is not a route. It is a screen name from a fixed alphabet with
-- `:id` standing in for everything after it, and the constraint below refuses
-- anything else. `app/src/lib/feedback.ts` produces exactly that shape and
-- `app/src/lib/feedback.test.ts` holds it to it — but a future caller that got
-- it wrong would be refused here, which is the difference between a rule and a
-- hope.
--
-- Same for `device`: three classes read off the viewport, never a user-agent.
--
-- ## What is deliberately not in it
--
-- No IP address, no user-agent, no session token, no page content, no email
-- address — the author is a foreign key, so who sent it is answerable without
-- copying anything. Nothing the student did not type and did not see: the form
-- prints the three context values above the Send button, so there is no field
-- here the sender was not shown.

create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  author     uuid        not null references auth.users on delete cascade,
  -- The five offered in `lib/feedback.ts`. A sixth would need this migration,
  -- which is the point: the column is the list.
  kind       text        not null check (kind in ('bug', 'confusing', 'idea', 'wrong', 'other')),
  -- A paragraph, not an essay. The floor is one character on purpose: "Back
  -- button does nothing" is a good report and a minimum that turned it away
  -- would be the form preferring its own tidiness to the information.
  note       text        not null check (length(trim(note)) between 1 and 2000),
  -- A shape, never an address. `/today`, `/course/:id`, `/other`, or `/`.
  route      text        not null default '/'
                         check (route ~ '^(/|/other|/[a-z][a-z-]{0,23}(/:id)?)$'),
  -- A class, never a fingerprint.
  device     text        not null check (device in ('phone', 'tablet', 'desktop')),
  -- Which build, when the build stamped one. Bounded so it cannot become a
  -- place to put something else.
  version    text        not null default '' check (length(version) <= 40),
  created_at timestamptz not null default now()
);

-- The one lookup the app makes: this account, most recent first.
create index if not exists feedback_mine_idx
  on public.feedback (author, created_at desc);

alter table public.feedback enable row level security;

-- ── Who may do what ───────────────────────────────────────────────────────
--
-- Writing and reading your own, and deleting it. No update policy at all: a
-- report is a thing that was said at a moment, and a row that can be rewritten
-- after the fact is a worse record for everybody, including the person who
-- sent it.
--
-- Said explicitly rather than inherited, for the reason `access_log` gives —
-- Supabase's platform defaults hand `service_role` everything on a new table,
-- so a grant that exists only as a default is a grant no check suite can see.
revoke all on public.feedback from anon, authenticated;
grant select, insert, delete on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;

drop policy if exists "you can send feedback as yourself" on public.feedback;
create policy "you can send feedback as yourself" on public.feedback
  for insert
  with check ((select auth.uid()) = author);

-- Readable by its author, so the app can say what was sent rather than asking
-- them to take its word for it. Nobody else reads it through the API.
drop policy if exists "you can read your own feedback" on public.feedback;
create policy "you can read your own feedback" on public.feedback
  for select
  using ((select auth.uid()) = author);

-- Deleting matters for one reason, and it is `access_log`'s: "Delete my
-- account" removes rows by user_id from the client, because a browser holding
-- the publishable key cannot delete an auth user and should not be able to.
-- Without this a deleted account would leave its reports behind — a table that
-- outlives the person it is about.
drop policy if exists "you can withdraw your own feedback" on public.feedback;
create policy "you can withdraw your own feedback" on public.feedback
  for delete
  using ((select auth.uid()) = author);

comment on table public.feedback is
  'What a student said was wrong, with the screen shape, device class and build the app supplied. Readable and deletable by its author; no update path.';
