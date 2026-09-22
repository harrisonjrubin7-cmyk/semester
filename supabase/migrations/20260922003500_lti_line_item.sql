-- The gradebook column a launch arrived from, so a score can find its way back.
--
-- Grade passback is the last of the three LTI directions and the only one
-- that starts on this side. A launch is Brightspace calling us; deep linking
-- is Brightspace asking us a question and waiting; this is Semester, later,
-- with no launch in progress, telling Brightspace a number. To do that it has
-- to remember where the number goes — and that is all this table is.
--
-- ## What decides whether anything is ever sent
--
-- Not this tool. When an instructor places a link in a course and marks it as
-- graded, the launch carries an Assignment and Grade Services claim naming a
-- *line item*: the gradebook column that link owns. When they place it as an
-- ordinary link, the claim carries no line item, `readEndpoint` in
-- `_shared/ltiags.ts` refuses with `not-graded`, and nothing is written here.
--
-- So a row in this table is an instructor's decision, recorded. The tool
-- never invents a column, never reports to a course whose instructor did not
-- ask, and a student whose school has not installed Semester at all can never
-- have a row. `RETENTION.md` says what a student sees of it.
--
-- ## The key, and the rule it encodes
--
-- One row per (issuer, subject, context). A context — a course — may hold
-- several Semester links, each with its own line item; keying on the context
-- means **the most recent launch wins** and the column it names is the one a
-- score goes to. That is the deliberate simplification: the score endpoint
-- is called from the app by course code, and the app does not know which of
-- three links in a course it was opened from. Storing the resource link id
-- anyway keeps the door open to keying on it later without a migration that
-- has to guess.
--
-- The foreign key is to `lti_identity` rather than to `auth.users`, and the
-- difference matters for deletion: a line item belongs to the *binding*
-- between a platform subject and an account, so when that binding goes — the
-- account is deleted, or a provisioned account is retired in favour of one
-- the student already had — the memory of where their grade went goes with
-- it. A row that outlived its identity would be an address with nobody at it.
--
-- ## Why there is no covering index
--
-- `indexes.check.sql` asks that every foreign key be covered, and this one
-- is: (issuer, subject) is a prefix of the primary key. A separate index on it
-- would be exactly the duplicate that suite went red on twice in one
-- afternoon in September.

create table if not exists public.lti_line_item (
  issuer            text        not null,
  subject           text        not null,
  context_id        text        not null,
  -- The registration a callback signs against. Carried here because
  -- `lti_identity` is keyed on issuer and subject alone, and one issuer may
  -- hold more than one registration of this tool.
  client_id         text        not null,
  -- The course's name as the platform sent it. The score endpoint matches
  -- this against a Semester course code, because the app knows codes and the
  -- platform knows titles, and nobody has typed the mapping anywhere.
  context_title     text,
  resource_link_id  text,
  -- The two addresses this tool will *post* to with a token it minted. Both
  -- https by constraint, for the reason `token_url` is.
  lineitem_url      text        not null check (lineitem_url like 'https://%'),
  lineitems_url     text        check (lineitems_url is null or lineitems_url like 'https://%'),
  -- What the platform granted at launch. Recorded so a later refusal can say
  -- which scope was missing rather than "403".
  scopes            text[]      not null default '{}',
  seen_at           timestamptz not null default now(),
  primary key (issuer, subject, context_id),
  foreign key (issuer, subject)
    references public.lti_identity (issuer, subject) on delete cascade
);

alter table public.lti_line_item enable row level security;

-- Both spellings, for the reason `20260921144011_function_grants.sql` gives:
-- Postgres grants to PUBLIC and both API roles inherit it, *and* Supabase
-- grants new objects to those roles by name. Revoking one leaves the other.
revoke all on public.lti_line_item from public;
revoke all on public.lti_line_item from anon, authenticated;

-- No policy of any kind. The only writer is the launch endpoint, holding the
-- service key, and the only reader is the score endpoint, holding the same.
-- A client that could read this would learn which of its courses are graded
-- in Brightspace, which is the instructor's information; one that could write
-- it could point a score at any column it liked.
