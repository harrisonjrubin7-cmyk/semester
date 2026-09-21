-- The indexing pass ran once, and two tables arrived after it.
--
-- `supabase/history/20260907141551_index_foreign_keys.sql` opens with
-- *"Covering indexes for the five foreign keys that had none"* and fixed
-- exactly five: `blocks.blocked`, `messages.user_id`, and the three on
-- `reports`. It ran on 7 September.
--
-- `groups`, `group_members` and `group_tasks` landed on the 11th
-- (`history/20260911151826_groups.sql`); `referrals` landed on the 21st. Both
-- are after that pass, neither was covered by it, and nothing re-runs it. The
-- project's own database linter now reports **five** unindexed foreign keys
-- again — the same number, on different tables, fourteen days later.
--
-- ## The cost, which is the one that file already stated
--
-- Not the insert. It lands on the *parent*: to delete a row in `auth.users`,
-- Postgres has to prove no child still references it, and without an index
-- that proof is a sequential scan of the child table.
--
-- **Four of these five reference `auth.users`**, so all four are in the
-- delete-my-account path — which is precisely the path the September pass was
-- written to protect, and the one `lib/cloud.ts` calls when somebody asks to
-- be off the server. That is also the operation nobody notices getting slow,
-- because it only does once there is data, and by then it is a timeout in a
-- deletion rather than a slow page somebody reports.
--
-- ## Why these columns and not composites
--
-- Checked before adding anything, the same way that file checked: the three
-- foreign keys on these tables that *are* already covered are left alone.
-- `group_members_pkey` leads with `group_id`, `group_tasks_by_group` is on
-- `group_id`, and `referrals_pkey` leads with `user_id` — each of those
-- already leads with its foreign key column, so each already serves the
-- parent-side check and a second index would be duplication.
--
-- The five below have nothing leading with the column, so each is the foreign
-- key column alone, which is the one thing missing.

-- A group's members. Deleting an account has to find every group it is in.
create index if not exists group_members_user on public.group_members (user_id);

-- Group work carries two people per row — who made it and who it is on — and
-- an account deletion has to check both.
create index if not exists group_tasks_created_by on public.group_tasks (created_by);
create index if not exists group_tasks_owner on public.group_tasks (owner);

-- Who made the group. Low volume, same proof, same scan without this.
create index if not exists groups_created_by on public.groups (created_by);

-- Not an `auth.users` reference, and still a parent-side check: retiring a
-- referral code has to prove nothing claimed it. `referrals_pkey` covers the
-- other direction and leads with `user_id`, so it does not serve this one.
create index if not exists referrals_code on public.referrals (code);


-- ── One index that was always two ─────────────────────────────────────────
--
-- `20260901000800_calendar.sql` declares the column `token text not null
-- unique`, which makes Postgres build `calendar_feeds_token_key`, and then
-- twelve lines later says
--
--     create unique index if not exists calendar_feeds_token_idx
--       on public.calendar_feeds (token);
--
-- Two identical unique indexes on one column, in one file, both doing the
-- same work on every insert and every token rotation. The linter reports it
-- as a duplicate and it is.
--
-- The standalone one goes rather than the constraint's. `calendar_feeds_token_key`
-- backs the `unique` constraint and cannot be dropped without dropping the
-- constraint itself, which is the thing actually guaranteeing a feed token is
-- unique — and that guarantee is load-bearing: a token *is* the whole of the
-- authentication for that person's calendar.
--
-- The file that creates it is deliberately left alone. It is a record of what
-- ran, `MIGRATION-HISTORY.md` is three days of recovering from a history that
-- did not match production, and editing an applied migration to tidy it is
-- how that happens again. A fresh replay therefore creates this index and then
-- drops it here, which is correct in both places and honest about the order
-- things happened in.
drop index if exists public.calendar_feeds_token_idx;
