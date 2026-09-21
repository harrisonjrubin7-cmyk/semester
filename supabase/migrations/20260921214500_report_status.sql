-- ═══════════════════════════════════════════════════════════════════════════
-- A report somebody can actually read
--
-- Run once. Idempotent: every statement is written so a second run is a no-op.
--
-- ── What was wrong ────────────────────────────────────────────────────────
--
-- `public.reports` has taken reports since `20260901000200_classmates.sql` and
-- nobody has ever been able to read one. That file says so in a comment, one
-- line under the insert policy:
--
--   -- No select policy at all, which means no client can read this table.
--
-- Which was honest, and is not a moderation system. A student who is being
-- harassed is invited to do something about it, and the something lands in a
-- table with no reader — not "unread", but unreadable, by anybody, through
-- any client, in principle.
--
-- The app has never claimed otherwise. `lib/classmates.ts`:
--
--   **Reports are stored, not moderated.** Nobody is watching a queue. Saying
--   otherwise would be the worst kind of lie in a feature like this — somebody
--   would rely on it. Blocking is the remedy that works, and it is immediate.
--
-- That sentence stays true after this migration and must not be edited by it.
-- A table an administrator *may* read is not a queue somebody *is* watching;
-- the first is a precondition for the second and nothing more. The sentence
-- changes when a person is actually watching, and not before.
--
-- ── What this does ────────────────────────────────────────────────────────
--
-- Two things, both of which the moderation requirement names outright:
-- reports must have statuses, and there must be a way to review them.
--
--   1. A `status` column, four values, defaulting to `open`.
--   2. Select and update policies for `private.is_app_admin()` — the identity
--      added in `20260921161500_roles.sql`, which is written only by the
--      service key and readable only by policies.
--
-- ── What this deliberately does not do ────────────────────────────────────
--
-- **It does not let a reporter read their own report back.** The temptation is
-- obvious and the shape is wrong: `reports.about` names the account somebody
-- reported, so a row is a statement about a third party, and a reporter who
-- can re-read it can also enumerate what they have said about whom across
-- devices. The one thing a reporter actually needs — that the report was
-- received — is the insert succeeding, which they already have.
--
-- **It adds no `handled_by`.** Recording which administrator resolved a report
-- is an audit trail, and an audit trail nobody reads is the fault this
-- migration exists to fix, one level up. `public.access_log` already exists
-- for the case where that is wanted, and wiring this into it is a decision
-- about retention rather than a column default.
--
-- **It does not backfill anything but the default.** Every existing row
-- becomes `open`, which is what an unreviewed report is.

alter table public.reports
  add column if not exists status text not null default 'open';

-- The constraint is separate from the column so that a re-run over a table
-- that already has the column still gets it, and so the four values live
-- somewhere a reader can find them.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reports_status_known'
  ) then
    alter table public.reports
      add constraint reports_status_known
      check (status in ('open', 'under_review', 'resolved', 'dismissed'));
  end if;
end $$;

comment on column public.reports.status is
  'open | under_review | resolved | dismissed. Defaults to open, which is what an unreviewed report is.';

-- The queue read. `open` first is the ordinary query, and without this it is a
-- sequential scan over every report ever filed to find the handful that are
-- not finished with.
create index if not exists reports_open_first on public.reports (status, created_at desc);

-- ── Who may read one ──────────────────────────────────────────────────────
--
-- `private.is_app_admin()` and nothing else. It is `security definer` because
-- `app_admins` has no select policy of its own, so a caller running as
-- themselves cannot read even the row that is about them — which is what makes
-- this policy un-spoofable from the client.
--
-- No `anon` clause and no reporter clause: a signed-out visitor and an
-- ordinary account both still read nothing, exactly as before. The table goes
-- from unreadable-by-everyone to readable-by-administrators, and by no other
-- step.
drop policy if exists "administrators may read reports" on public.reports;
create policy "administrators may read reports" on public.reports
  for select
  using (private.is_app_admin());

-- Reviewing one means moving its status, and means nothing else.
--
-- **A row-level policy cannot say that.** The first draft of this migration
-- carried an `for update` policy and a comment claiming the reason and the
-- copy were not editable. The comment was false and a probe said so in one
-- line: as an administrator, `update public.reports set reason = …` affected
-- one row and the complaint read back rewritten. RLS chooses *rows*; it has
-- nothing to say about *columns*.
--
-- That matters more here than almost anywhere else in this schema. A
-- moderation tool whose operator can edit the complaint is worse than no tool:
-- it turns a record of what somebody said into a record of what the reviewer
-- would prefer they had said, and it does so invisibly, because the edited row
-- looks exactly like an original.
--
-- So the column privilege carries it, the way `schools.sql` pins `school_id`:
-- the update grant is narrowed to `status` alone, and row-level security then
-- decides which rows that grant reaches. A non-administrator keeps the column
-- grant and matches no row, which is the same nothing they had before.
revoke update on public.reports from anon, authenticated;
grant update (status) on public.reports to authenticated;

-- `with check` repeats the `using` clause deliberately. Without it an
-- administrator could update a row into a shape they could no longer read,
-- which is not reachable while the predicate is constant — but it will not
-- stay constant, and the pair is the form that survives the next edit.
drop policy if exists "administrators may move a report along" on public.reports;
create policy "administrators may move a report along" on public.reports
  for update
  using (private.is_app_admin())
  with check (private.is_app_admin());

comment on table public.reports is
  'Reports of a message or an account. Readable only by public.app_admins, through private.is_app_admin().';
