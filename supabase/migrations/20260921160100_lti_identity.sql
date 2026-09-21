-- Semester — which Semester account a Brightspace launch opens, and the two
-- ways that link can be made.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `20260921160000_lti.sql` stopped deliberately short of this and said so: it
-- carried a launch far enough to be trusted and left the identity question
-- unanswered, with no foreign key to `auth.users` that would answer it by
-- accident. This is the answer, and it is two decisions rather than one.
--
-- ## One: a first launch makes an account
--
-- A professor switches the tool on and two hundred students click it that
-- week. Every one of them who is asked to go and sign up first is a student
-- who does not come back, so a launch that finds no identity **creates one**,
-- keyed on the platform's issuer and its own subject for that person.
--
-- The cost is real and is paid below: accounts now exist that nobody chose to
-- create, and `RETENTION.md` has to say what happens to them.
--
-- ## Two: attaching an account somebody already had is never automatic
--
-- The tempting version matches the email the platform asserts against an
-- existing account and links them silently. **That is account takeover with
-- extra steps**, and it is refused here rather than mitigated: an email claim
-- is a string a registered platform sends us, so anything that trusts it hands
-- over an existing account to whoever can get a registration row wrong or a
-- platform compromised. There is no code path in this migration that reads an
-- email claim, and that is the point.
--
-- What is here instead needs **two proofs at once**, which no single party
-- holds:
--
--   * a launch that has already been validated, proved by a ticket this
--     server issued and nobody else can mint, and
--   * a session on the account being attached, proved by `auth.uid()`.
--
-- A platform alone cannot move an account. A signed-in person alone cannot
-- claim a launch. Only the human who is both gets to say these are the same
-- person, which is the only party who actually knows.

-- ── Which account a launch opens ──────────────────────────────────────────
--
-- Keyed on issuer and subject, because a subject is unique only within its
-- issuer — two schools can and do hand out the same opaque id. `user_id` is
-- not unique: one person can legitimately reach Semester from two
-- institutions, and a transfer student is the ordinary case rather than the
-- clever one.

create table if not exists public.lti_identity (
  issuer      text        not null,
  subject     text        not null,
  user_id     uuid        not null references auth.users on delete cascade,
  /*
   * How this link came to exist, kept because the two are not equally
   * trusted and the difference is what `adopt_lti_identity` reads. A
   * provisioned row points at an account the launch itself made, which may be
   * retired in favour of one the student already had. A linked row points at
   * an account a human signed in to and claimed, and is never silently moved.
   */
  origin      text        not null check (origin in ('provisioned', 'linked')),
  created_at  timestamptz not null default now(),
  primary key (issuer, subject)
);

alter table public.lti_identity enable row level security;

-- Both spellings, for the reason `20260921144011_function_grants.sql` gives:
-- Postgres grants to PUBLIC and both API roles inherit it, *and* Supabase
-- grants new objects to those roles by name. Revoking one leaves the other.
revoke all on public.lti_identity from public;
revoke all on public.lti_identity from anon, authenticated;

create index if not exists lti_identity_user_id_idx on public.lti_identity (user_id);

comment on table public.lti_identity is
  'Which Semester account a launch from (issuer, subject) opens. Readable through the API by nobody.';

-- ── The ticket that proves a launch happened ──────────────────────────────
--
-- Issued by the Edge Function after a launch has passed every rule in
-- `_shared/lti.ts`, handed to the browser, and spent by `adopt_lti_identity`.
-- It is the first of the two proofs, and it is a table rather than a signed
-- string for the same reason `lti_nonce` is: this renders in an iframe, and a
-- value the server can revoke beats a value the server can only verify.
--
-- Minutes, not hours. The window is "a student who has just landed decides
-- they already have an account", which is one screen.

create table if not exists public.lti_link_ticket (
  ticket              text        primary key,
  issuer              text        not null,
  subject             text        not null,
  -- The account the launch just made, and the one that is retired if the
  -- student attaches a different one. Cascades, so a ticket cannot outlive it.
  provisioned_user_id uuid        not null references auth.users on delete cascade,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  spent_at            timestamptz
);

alter table public.lti_link_ticket enable row level security;

revoke all on public.lti_link_ticket from public;
revoke all on public.lti_link_ticket from anon, authenticated;

create index if not exists lti_link_ticket_expires_at_idx on public.lti_link_ticket (expires_at);

comment on table public.lti_link_ticket is
  'Proof that a launch was validated, spent once when a student attaches an account they already had.';

-- ── Has this account been used? ───────────────────────────────────────────
--
-- The whole adoption story rests on one claim: an account a launch just made
-- is empty, so retiring it in favour of the student's own loses nothing.
--
-- That claim is true at the instant of creation and stops being true the
-- moment the student uses the app. Somebody who launches in September, works
-- in Semester for three weeks and *then* decides to attach the account they
-- made last year is asking for a merge, not a link — so this is checked rather
-- than assumed, and the refusal it produces says so.
--
-- **The list is content, not activity, and it errs toward content.** Four
-- tables are left out because rows land in them without the person doing
-- anything that could be lost: `push_devices` and `push_queue` come from
-- registering a device, `access_log` from a feed being fetched, `profiles`
-- from signing in at all. Counting those would make every account look used
-- and turn every adoption into a refusal.
--
-- Everything else an account owns is in. That includes the ones it is tempting
-- to wave through — messages sent, a group joined, a course enrolled in, a
-- person blocked — and the asymmetry is the reason: a false *in-use* asks a
-- student to sort it out another way, and a false *untouched* deletes work
-- that was theirs. One of those is recoverable.
--
-- `blocks` is the sharpest of them and the reason the rule is "err toward
-- content": `RETENTION.md` records that a block deliberately survives the
-- blocker's own account deletion, because it is somebody else's protection.
-- Retiring an account that had made one would undo exactly that.
--
-- `OWNED_TABLES` in `app/src/lib/cloud.ts` is the full list of what an account
-- owns, and this is that list minus those four. `ltiaccount.test.ts` reads
-- both sides and fails when they disagree in either direction — because the
-- failure that matters is a content table added later that this function does
-- not know about, which would let a used account be silently retired.

create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t   record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',             'user_id'),
      ('public.courses',           'user_id'),
      ('public.notes',             'user_id'),
      ('public.tasks',             'user_id'),
      ('public.appointments',      'user_id'),
      ('public.sittings',          'user_id'),
      ('public.calendar_feeds',    'user_id'),
      ('public.messages',          'user_id'),
      ('public.message_reactions', 'user_id'),
      ('public.group_members',     'user_id'),
      ('public.enrollments',       'user_id'),
      ('public.blocks',            'user_id'),
      ('public.referrals',         'user_id'),
      ('public.referral_codes',    'user_id'),
      ('public.forms',             'owner')
    ) as x(rel, col)
  loop
    /*
     * **A table that is not there holds no rows, so skipping it loses
     * nothing** — and without this the whole migration fails to apply.
     *
     * `public.forms` is in `migrations/` and has never reached production,
     * and the renumbering left its file below the watermark, so a deploy will
     * never create it. A `language sql` body naming it resolves every
     * relation at creation time and refuses to be created at all.
     * `supabase/rehearse.sh` is what found that, and it is the only
     * instrument here that could: `check.sh` builds from empty and applies
     * every migration, so `forms` exists there and the fault is invisible.
     *
     * Skipping is safe in the one direction that matters. The danger in this
     * function is answering "untouched" about an account that has work in it,
     * and a relation that does not exist cannot be holding any. Once `forms`
     * reaches production this starts counting it with no change here.
     */
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;

    execute pg_catalog.format('select 1 from %s where %I = $1 limit 1', t.rel, t.col)
      into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end $$;

revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid) from anon, authenticated;

comment on function public.lti_account_untouched(uuid) is
  'True when an account holds no work a person did. A subset of OWNED_TABLES in cloud.ts, checked by ltiadopt.test.ts.';

-- ── Attaching an account you already had ──────────────────────────────────
--
-- Called by the signed-in student, as themselves, holding a ticket from a
-- launch that has just been validated. Both proofs, or nothing.
--
-- Returns a word, never a sentence. `app/src/lib/ltilink.ts` turns it into
-- English — the same division `claim_referral` and the invite gate draw, and
-- for the same reason: the database's message is for a log.
--
--   ok            the identity now points at the caller
--   signed-out    no session, so there is no account to attach
--   stale         the ticket is unknown, expired, or already spent
--   same-account  the caller *is* the provisioned account; nothing to do
--   in-use        the provisioned account has work in it — a merge, not a link
--
-- The ticket is spent in the same statement that reads it, for the reason
-- `spend_lti_nonce` is: a select-then-update lets two tabs both win.

create or replace function public.adopt_lti_identity(want_ticket text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid;
  got   record;
begin
  me := auth.uid();
  if me is null then return 'signed-out'; end if;

  update public.lti_link_ticket t
     set spent_at = now()
   where t.ticket = want_ticket
     and t.spent_at is null
     and t.expires_at > now()
  returning t.issuer, t.subject, t.provisioned_user_id into got;

  if got is null then return 'stale'; end if;

  /*
   * Already the right account. Not an error and not a no-op worth hiding: a
   * student who launches, lands, and presses "connect my account" while signed
   * in to the very account the launch made should be told it is already theirs
   * rather than have an account deleted underneath them.
   */
  if got.provisioned_user_id = me then return 'same-account'; end if;

  if not public.lti_account_untouched(got.provisioned_user_id) then
    return 'in-use';
  end if;

  update public.lti_identity i
     set user_id = me,
         origin  = 'linked'
   where i.issuer = got.issuer
     and i.subject = got.subject;

  /*
   * Retiring the account the launch made, now that nothing points at it and
   * `lti_account_untouched` has said there is nothing in it. Deleting the
   * `auth.users` row takes its rows in every owned table by their cascades —
   * the same mechanism `deleteEverything()` leans on, rather than a second
   * list of tables to fall out of date.
   */
  delete from auth.users u where u.id = got.provisioned_user_id;

  return 'ok';
end $$;

revoke all on function public.adopt_lti_identity(text) from public;
revoke all on function public.adopt_lti_identity(text) from anon;
-- The one function here a client may call, and only a signed-in one: the whole
-- design is that this needs a session the caller proved. `anon` is revoked
-- above by name as well as through PUBLIC, so a page holding the publishable
-- key and no session reaches nothing.
grant execute on function public.adopt_lti_identity(text) to authenticated;

comment on function public.adopt_lti_identity(text) is
  'Attach a launch identity to the account the caller is signed in to. Needs a launch ticket and a session; never an email claim.';

-- ── Sweeping spent and abandoned tickets ──────────────────────────────────

create or replace function public.sweep_lti_link_ticket()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare gone integer;
begin
  delete from public.lti_link_ticket where expires_at < now() - interval '1 hour';
  get diagnostics gone = row_count;
  return gone;
end $$;

revoke all on function public.sweep_lti_link_ticket() from public;
revoke all on function public.sweep_lti_link_ticket() from anon, authenticated;

comment on function public.sweep_lti_link_ticket() is
  'Delete link tickets an hour past expiry. Removes only tickets adopt_lti_identity already refuses.';
