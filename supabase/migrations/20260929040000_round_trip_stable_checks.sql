-- Three check constraints, rewritten so a dump and a restore give them back as
-- they were.
--
-- `length(trim(x)) between 2 and 200 and <more>` is stored as an AND whose
-- first argument is itself an AND — `between` is expanded into one after
-- the parser has already flattened the chain around it. `pg_dump` prints that
-- nested form with its brackets, and reading those brackets back flattens it
-- into a single three- or four-way AND. The constraint means the same thing on
-- both sides, but `pg_get_constraintdef` reads differently, so the
-- `constraints` line of `fingerprint.sql` does too, and every restore drill —
-- `restore.sh` and `restore-drill.sh` alike — reported the schema as changed.
--
-- `restore.sh` had been red on that line since 27 September, when the first
-- landed (#828); nothing ran it. The third, on `family_invites`, arrived on
-- main while this was being written, which is the case for running it in CI.
--
-- The rewrite spells `between` out as its two comparisons, which parses flat
-- the first time and so survives the round trip unchanged. Every row that
-- passed the old check passes the new one: the expressions are the same.
-- Idempotent: drop if exists, then add.

alter table public.governance_steward_assignments
  drop constraint if exists governance_steward_assignments_person_name_check,
  add constraint governance_steward_assignments_person_name_check check (
    length(trim(person_name)) >= 2
    and length(trim(person_name)) <= 200
    and position('@' in person_name) = 0
    and trim(person_name) !~* '^(tbd|tba|todo|n/?a|none|unknown|vacant|team|office|department|inbox)$');

alter table public.provider_evidence
  drop constraint if exists provider_evidence_verified_by_name_check,
  add constraint provider_evidence_verified_by_name_check check (
    length(trim(verified_by_name)) >= 2
    and length(trim(verified_by_name)) <= 200
    and trim(verified_by_name) !~* '^(system|script|auto|bot)\M');

alter table public.family_invites
  drop constraint if exists family_invites_categories_check,
  add constraint family_invites_categories_check check (
    cardinality(categories) >= 1
    and cardinality(categories) <= 10
    and categories <@ array[
      'finances', 'aid', 'housing', 'calendar', 'academic',
      'emergency', 'travel', 'health-admin', 'career',
      'communication']::text[]);
