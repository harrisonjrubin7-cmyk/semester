-- Covering indexes for the five foreign keys that had none.
--
-- ── What an unindexed foreign key actually costs ──────────────────────────
--
-- Not the insert. The cost lands on the *parent*: to delete or re-key a row
-- in `auth.users` or `messages`, Postgres has to prove no child still
-- references it, and without an index that proof is a sequential scan of the
-- child table. Deleting one account would scan every message ever posted.
--
-- That is also the operation nobody tests, because it only gets slow once
-- there is data, and by then it is a timeout in a delete-my-account path
-- rather than a slow page anybody reported.
--
-- ── Why these columns and not composites ──────────────────────────────────
--
-- The reads are already covered and were checked before adding anything:
-- `blocks_pkey` is on (user_id, blocked), which is exactly the shape the
-- message read policy probes; `messages_by_room` is on (term, code,
-- created_at desc), which is the room. Neither leads with the foreign key
-- column, so neither helps the parent-side check — and a composite here would
-- duplicate an index that already exists for the query side.
--
-- So each of these is the foreign key column alone, which is the one thing
-- missing.

-- Deleting an account has to check who they blocked, and who blocked them.
-- The second direction is the one with no index.
create index if not exists blocks_blocked on public.blocks (blocked);

-- The big one. `messages` is the table with no natural ceiling here, and it
-- also serves "delete your own messages", which filters on this column.
create index if not exists messages_user on public.messages (user_id);

-- Moderation records. Low volume, but they reference both users involved and
-- the message itself, so an account deletion touches all three.
create index if not exists reports_about on public.reports (about);
create index if not exists reports_message on public.reports (message_id);
create index if not exists reports_reporter on public.reports (reporter);