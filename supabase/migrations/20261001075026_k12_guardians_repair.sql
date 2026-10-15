-- Production repair record.
--
-- `20260930233000_k12_guardians.sql` is the executable migration. Production
-- already held that version under the name and SQL of the data-subject request
-- migration, so db push treated the guardian migration as applied while none of
-- its objects existed. The guardian SQL was applied through the management API
-- on 1 October 2026 under this version. This inert file keeps the repository's
-- migration set aligned with the live ledger; a database built from empty has
-- already run the executable guardian migration at 20260930233000.

