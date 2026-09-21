-- Semester — the three numbers a pilot is judged on, and nothing else.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- ## The question this answers
--
-- The build-out plan's gate for the pilot is "analytics reporting", and it
-- names the three figures it means: **activation**, **weekly active use** and
-- **30-day retention**. Those are the only three, and this table is shaped to
-- them rather than to analytics in general. Nothing here is collected because
-- it might be useful later; a column nobody has a question for is a column
-- that should not exist.
--
--   * **Activation** — of the accounts that were made, how many got a course
--     of their own into the app and then studied from it. That is the whole
--     of Stage 0's exit gate, restated as a number.
--   * **Weekly active use** — how many distinct accounts opened the app in a
--     seven-day window.
--   * **30-day retention** — of the accounts that first appeared in a given
--     week, how many were still opening the app a month later.
--
-- `ANALYTICS.md` carries the queries and what each figure is worth.
--
-- ## Why this exists at all, when `privacy.ts` says there is no analytics
--
-- It does not say that. It says, twice, that there is **no third-party**
-- analytics in this app, and that signed out nothing leaves the device. Both
-- sentences stay true here and both are load-bearing: no account, no row —
-- the function below reads `auth.uid()` and returns without writing when
-- there is not one — and nothing about this leaves the project. The
-- alternative that was not taken is the ordinary one, a script tag from an
-- analytics vendor, which would have put every student's reading of every
-- screen on somebody else's server to answer three questions that need three
-- bits.
--
-- The privacy page now names this table in the same words it names the access
-- log, because a first-party record that a student cannot read about is not
-- meaningfully better than a third-party one.
--
-- ## What is deliberately not in it
--
-- No event stream. No screen names, no titles, no course, no counts, no time
-- of day, no session length, no device, no address, no referrer. The whole
-- row is *an account, a date and one word from a list of three*, and the
-- `check` below is what makes that a property of the database rather than a
-- promise about a client.
--
-- The day bucket is the same decision `access_log` made and for the same
-- reason: a timestamp per open is a minute-by-minute record of when a
-- student's laptop is awake, which is more than any of the three questions
-- needs. "This account opened the app on Tuesday" answers all three. What
-- time on Tuesday answers none of them.
--
-- It also bounds the table. Three marks, one day, one account: an account
-- that lives in this app all term writes at most three rows a day and usually
-- one, and the whole pilot is a few thousand rows.
--
-- ## Why the marks are derived from the app's own state
--
-- The obvious build is an event: the app calls this when a syllabus finishes
-- importing, and again when a drill ends. That needs a call site at every
-- moment worth counting, each of which is a place the count can be forgotten,
-- double-fired or left behind by a refactor — and the failure is silent in
-- the direction that matters, because a missing call looks exactly like a
-- student who did not do the thing.
--
-- So the app sends *what is true of the account now*, read off the state it
-- already holds, and this table keeps the first day each became true. There
-- is one call site (`state/store.tsx`), it is idempotent, and a mark cannot
-- be missed by anybody editing a screen. `lib/activity.ts` is the other half
-- and argues it at more length.
--
-- The cost of that choice is stated rather than hidden: a mark's date is the
-- first day the app was **open** with it true, so a student who imports a
-- syllabus and closes the tab before the ping has it dated to their next
-- visit. The app re-pings when the derived set changes, so that window is the
-- few seconds between the state changing and the next render — but it is not
-- zero, and no figure here should be read as accurate to the day for a single
-- account. Every question above is about a population over weeks.

create table if not exists public.activity (
  user_id uuid not null references auth.users on delete cascade,
  -- The day, in UTC. See the header.
  day     date not null default (now() at time zone 'utc')::date,
  -- One word from a closed list, and the list is the funnel:
  --
  --   'opened'  — the app was open with this account signed in.
  --   'course'  — the account holds at least one course of its own. The
  --               sample semester does not count and cannot: it is a flag on
  --               the state row, not a course in the list.
  --   'studied' — at least one card has been answered, ever.
  --
  -- Three, because three questions. A fourth mark needs a fourth question
  -- and a line in ANALYTICS.md saying what it is for, and the `check` is what
  -- makes adding one a decision rather than a habit.
  mark    text not null check (mark in ('opened', 'course', 'studied')),
  primary key (user_id, day, mark)
);

-- The two reads this table gets. The primary key already serves "this
-- account's rows", which is the student's own view and the prune below; the
-- report is the other direction — every account on a day, or across a range —
-- and it has no index at all without this one.
create index if not exists activity_day_idx on public.activity (day);

alter table public.activity enable row level security;

-- ── Who may do what ───────────────────────────────────────────────────────
--
-- Reading and deleting, by the account the rows are about. **No insert policy
-- and no update policy**, which is the whole of the design below: the only
-- way a row gets into this table through the API is `note_activity`, and that
-- function takes neither the account nor the date from its caller.
--
-- An insert policy would have been the shorter build — `with check
-- ((select auth.uid()) = user_id)` and the client inserts its own rows — and
-- it is worse in a way that is easy to miss. That policy constrains *who* the
-- row is about and nothing else, so a client could write `day` as any date it
-- liked: a backdated row makes a cohort older than it was, and a forward
-- dated one sits in the table until the clock catches up. The figures this
-- table exists for are all differences between dates. Handing the date to the
-- client would make every one of them a claim about a client.
revoke all on public.activity from anon, authenticated;
grant select, delete on public.activity to authenticated;

-- Said here rather than inherited, for the reason `access_log` gives: a grant
-- that exists only as a Supabase default is a grant no check suite can see.
-- Select only — the report reads, and the write path is the function.
grant select on public.activity to service_role;

drop policy if exists "you can read your own activity" on public.activity;
create policy "you can read your own activity" on public.activity
  for select
  using ((select auth.uid()) = user_id);

-- The same reason `access_log` has one: "Delete my account" runs in the
-- browser, holding the publishable key, and deletes row by row. Without this
-- the record of an account's visits would outlive the account.
drop policy if exists "you can clear your own activity" on public.activity;
create policy "you can clear your own activity" on public.activity
  for delete
  using ((select auth.uid()) = user_id);

comment on table public.activity is
  'One row per account, day and mark: the three figures the pilot is judged on. Readable by the account it is about.';

-- ── The write path ────────────────────────────────────────────────────────

/*
 * One ping, from the signed-in account, about today.
 *
 * ## Why `security definer`, which is a hole and so has to be argued
 *
 * `access_log`'s `note_access` is deliberately *not* definer, and the reason
 * given there is that its only caller is the service key, which row-level
 * security does not stop anyway. This one is the opposite case: its caller is
 * a browser holding the publishable key, and it is definer precisely so that
 * the table underneath it can have no write policy at all.
 *
 * What that buys is the two columns a caller would otherwise choose. `user_id`
 * comes from `auth.uid()`, read here from the verified JWT claims rather than
 * accepted as a parameter, so this function cannot be aimed at another
 * account — there is no argument to aim. `day` comes from the database clock,
 * so it cannot be backdated by a device whose clock is wrong or whose owner
 * would like a longer streak. The only thing the caller supplies is which
 * words out of three, about itself, today.
 *
 * `set search_path = ''` is the standing requirement for a definer function
 * here — `harden_security_definer_helpers` is the migration that found the
 * ones that were missing it. Every name below is schema-qualified; `now()`
 * and `unnest()` live in `pg_catalog`, which is always reachable whatever the
 * search path says.
 *
 * ## Why an unknown mark is dropped rather than raised
 *
 * The app and the schema deploy separately, and either can be newer. A client
 * that has learned a fourth mark before this migration lands would, on a
 * `check` violation, lose the whole statement — so 'opened' and 'course' would
 * go missing for every account on that version, and the figures would show a
 * cliff that no student caused. Filtering keeps the marks this schema knows
 * and ignores the rest, which is the failure worth having.
 *
 * The column's `check` is not thereby decorative: it is the last word on a
 * row written any other way, including by hand in the dashboard, which is how
 * most of what is wrong with this schema got there.
 */
create or replace function public.note_activity(marks text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare who uuid := (select auth.uid());
begin
  -- Signed out is not an error. `lib/activity.ts` does not call this without
  -- a session, and if a future caller does, the right answer is no row rather
  -- than a message in a console nobody reads.
  if who is null then
    return;
  end if;

  insert into public.activity (user_id, day, mark)
  select who, (now() at time zone 'utc')::date, m
    from unnest(marks) as m
   where m in ('opened', 'course', 'studied')
  on conflict do nothing;

  /*
   * Pruning here rather than in a scheduled job, and 400 days rather than
   * forever. `RETENTION.md` carries the schedule and this is the entry it
   * describes.
   *
   * A record of which days you opened an app is not your work, so the privacy
   * page's "no retention schedule" — a promise about the work — is not
   * touched by a clock here. It does mean the clock has to be a real one:
   * kept-forever would be a second copy of a student's habits accumulating
   * for nobody.
   *
   * 400 is the smallest number that answers the questions asked of it. The
   * longest is retention over an academic year — a cohort that arrives in
   * September and is asked about the following September — which is 365, and
   * the extra five weeks are so that a report run at the end of a month still
   * has the whole year behind it. Nothing here asks a question spanning two
   * years, and if something does it should say so and move this number.
   *
   * On write, for `note_access`'s reason: a `pg_cron` entry is a third thing
   * to deploy and a fourth thing to notice has stopped. It runs on the one
   * account being written and touches nothing else.
   */
  delete from public.activity
   where user_id = who
     and day < ((now() at time zone 'utc')::date - 400);
end $$;

/*
 * From PUBLIC, which is the line `invites.sql` learned the hard way and
 * `access_log` repeats: Postgres grants EXECUTE on a new function to PUBLIC,
 * `anon` and `authenticated` are both members of it, and revoking from those
 * two by name leaves the inherited grant intact.
 *
 * `anon` is revoked and not re-granted. A signed-out caller would get nothing
 * out of this — `auth.uid()` is null and the function returns — but a definer
 * function reachable by the publishable key with no session is a thing to
 * argue for, and there is no argument for this one.
 */
revoke all on function public.note_activity(text[]) from public, anon;
grant execute on function public.note_activity(text[]) to authenticated;

comment on function public.note_activity(text[]) is
  'Record today''s marks for the calling account. The account and the date are the database''s, not the caller''s.';
