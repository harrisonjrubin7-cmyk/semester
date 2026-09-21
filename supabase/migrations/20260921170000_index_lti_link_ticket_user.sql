-- The one foreign key the indexing sweep could not have covered.
--
-- `20260921155500_index_foreign_keys_added_since.sql` swept the foreign keys
-- that had arrived since the first pass, and `indexes.check.sql` is the guard
-- that stops the next one going uncovered. Both landed before
-- `20260921160100_lti_identity.sql` created `public.lti_link_ticket`, so its
-- key was written into a schema whose sweep had already run — which is the
-- exact shape of gap that sweep exists about, arriving forty minutes after it.
--
-- The check has been failing on `main` since, naming this column.
--
-- ## Why an index rather than an exemption
--
-- The suite offers both: "add one per column, or say here why the scan is
-- acceptable." The column is `provisioned_user_id uuid not null references
-- auth.users on delete cascade`, and the cascade is what decides it. Deleting
-- an account makes Postgres look for that account's tickets, and with no index
-- it reads every row in the table to do it.
--
-- Today that table is small and the scan is cheap, which is the argument for
-- an exemption and it is an argument about *today*. A ticket is written on
-- every Brightspace launch that provisions an account, and the pilot is about
-- to start making those. "Delete my account" is also the one operation in this
-- app that must not be slow or half-done — `lib/cloud.ts` deletes row by row
-- from a browser, and a cascade that scans is a cascade that can time out
-- while some tables are already empty.
--
-- So: the index. It is one B-tree over a uuid on a table that holds a few
-- rows per launch, and it is bounded by `lti_ticket_sweep` clearing the spent
-- and expired ones.

create index if not exists lti_link_ticket_provisioned_user_id_idx
  on public.lti_link_ticket (provisioned_user_id);

comment on index public.lti_link_ticket_provisioned_user_id_idx is
  'Covers the foreign key to auth.users, so deleting an account does not scan every ticket.';
