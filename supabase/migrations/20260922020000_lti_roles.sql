-- Semester — write down what the launch already told us.
--
-- The third of the four foundations in `docs/ROLE_REQUIREMENTS.md`, and the one
-- it calls the smallest and the most blocking:
--
--     Persisting what the LTI launch already says — the only
--     institutionally-vouched role data the platform receives, currently
--     discarded per request. Every faculty, TA, advisor and department item is
--     blocked on it.
--
-- `supabase/functions/_shared/lti.ts` reads the `roles` claim on every launch,
-- keeps role URIs it does not recognise rather than dropping them, and computes
-- one boolean — `teaches` — from a set of five. Then nothing persists.
-- `public.lti_identity` stores an issuer, a subject, a user and an origin, and
-- no roles. So the one role source in the system that an institution actually
-- vouches for is read, reduced to one bit, used for the length of one request,
-- and thrown away.
--
-- Items 246, 247, 250, 251 and 274 all say the same thing in different words:
-- faculty, TA, advisor and department access **must be institutionally
-- authorized**. That authorization has been arriving all along.
--
-- ## What this is careful about, and it is the whole file
--
-- A launch is a signed assertion from somebody else's system about who this
-- person is. Believing it about *their course* is the point. Believing it about
-- *Semester* would be handing an LMS administrator the keys, so the map below
-- is deliberately short and the omissions are the design rather than an
-- oversight.

-- ── The map, and what is not on it ────────────────────────────────────────
--
-- Matched on the suffix after the last `#`, which is what
-- `functions/_shared/lti.ts` already does and for the reason its comment gives:
-- the standard's role URIs come in a short form and a longer context-scoped
-- form for the same role, and a tool that compares whole URIs silently treats
-- one of them as a student.
--
-- Three roles are on it. **Three more are deliberately absent**, and each
-- absence is a refusal:
--
--   * `Administrator` — an administrator *of the LMS*. Item 275 says a
--     university administrator must not see private student activity, and
--     `university_admin` is a role Semester grants deliberately; a launch is not
--     the place. A platform that mis-asserted this claim, or an instructor with
--     a course-builder account on a permissive deployment, would otherwise walk
--     straight into it.
--   * `Mentor` — in the standard this is an observer, and which person it means
--     varies by deployment: a parent in one, an academic advisor in another.
--     Item 251 requires an advisor's access to be institutionally authorized and
--     item 245 makes a parent's a consent-gated `family_grants` row. Guessing
--     between the two from a URI is how somebody ends up seeing a record they
--     were never granted.
--   * `ContentDeveloper` — real in the standard and meaningless here: it is
--     permission to edit an LMS course's materials, and Semester's course
--     communities are item 247's separate thing.
--
-- `teaches` in the shared module keeps all five, because it answers a different
-- question — "can this person see other people's work" — and for *that* question
-- Administrator and Mentor belong in the set. This map answers "what may they
-- do in Semester", and the two must not be the same list. That difference is
-- exactly what item 250 warns about for teaching assistants.

create table if not exists public.lti_role_map (
  lti_role text primary key,
  role     text not null references public.app_roles (role),
  -- Why this one is trusted, in one line, for the same reason
  -- `app_capabilities.about` exists: a trust decision whose reasoning lives only
  -- in a commit message is one the next person re-derives from the name.
  about    text not null check (length(trim(about)) between 1 and 300)
);

create index if not exists lti_role_map_by_role on public.lti_role_map (role);

insert into public.lti_role_map (lti_role, role, about) values
  ('Instructor',        'faculty',
   'Teaches the course the launch came from. Item 247''s course community is scoped to exactly this.'),
  ('TeachingAssistant', 'teaching_assistant',
   'Assists on that course. Item 250: course-specific, and not what an instructor holds.'),
  ('Learner',           'student',
   'Enrolled on that course — the institution saying so, which is a different fact from an account having typed student into its own profile.'),
  ('Student',           'student',
   'Some deployments send this instead of Learner. The same assertion under another spelling.')
on conflict (lti_role) do nothing;

alter table public.lti_role_map enable row level security;
revoke all on table public.lti_role_map from anon, authenticated;
grant select on table public.lti_role_map to authenticated;

create policy "the launch role map is public to signed-in accounts" on public.lti_role_map
  for select to authenticated using (true);

comment on table public.lti_role_map is
  'Which LTI launch roles become which Semester roles, and why each is trusted. Written only by migration.';

-- ── The one writer ────────────────────────────────────────────────────────
--
-- `public` rather than `private`, unlike every other function this repository
-- has added lately, and the reason is mechanical: PostgREST's `rpc` reaches
-- `public` only, the launch runs as `service_role` through it, and a function in
-- `private` could not be called at all. It is still not reachable by a client —
-- execute is revoked from `public`, `anon` and `authenticated` and granted to
-- `service_role` alone, so `grants.check.sql`'s sweep of what a client may call
-- does not see it, which is the property that matters rather than the schema.
--
-- **Institution-provenance rows only, and one scope at a time.** The function
-- may not touch a `self` grant — item 254's tutor opted in — or a `platform`
-- grant, which is Semester's own staff decision. A launch is authoritative
-- about the course it came from and about nothing else, and that sentence is
-- enforced by the `where` clauses rather than promised by this comment.
--
-- **It revokes what the launch stops asserting.** A professor who no longer
-- teaches a course sends a launch without `Instructor`, and the grant has to go,
-- or the institution is the source of truth only in the direction that adds
-- access. Revoked rather than deleted, because `RETENTION.md` records that a
-- person may read their own revoked grants — it is how somebody finds out why a
-- workspace they had yesterday is gone.
--
-- Returns the number of grants live for that scope afterwards, so the caller can
-- log a figure rather than a boolean.
create or replace function public.record_lti_roles(
  want_subject uuid,
  want_issuer  text,
  want_context text,
  want_roles   text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  scope   text;
  mapped  text[];
  live    integer;
begin
  -- A launch with no context claim is not about a course, so there is nothing
  -- to scope a grant to and nothing is written. Silence would be worse than the
  -- zero: the caller logs it.
  if want_context is null or length(trim(want_context)) = 0 then
    return 0;
  end if;
  if want_subject is null or want_issuer is null or length(trim(want_issuer)) = 0 then
    return 0;
  end if;

  /*
   * The platform's own course id, qualified by the platform that asserted it.
   *
   * Deliberately **not** translated into a Semester course code
   * (`school/CODE`, the shape `public.groups.code` uses). No correspondence
   * between a Brightspace org-unit id and a Semester course has been
   * established anywhere, and inventing one here would put a grant on a course
   * nobody said it was about. When that mapping exists it is item 129–183's
   * work and this is the row it will move.
   */
  scope := trim(want_issuer) || '/' || trim(want_context);

  select coalesce(array_agg(distinct m.role), '{}')
    into mapped
    from unnest(coalesce(want_roles, '{}')) as u(uri)
    join public.lti_role_map m
      on m.lti_role = regexp_replace(u.uri, '^.*#', '')
   where length(trim(u.uri)) > 0;

  -- What the launch asserts, refreshed. A re-launch is an update rather than a
  -- second row, so `granted_at` moves and a revocation from a previous launch is
  -- lifted — which is what re-enrolment looks like.
  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, granted_at, expires_at, revoked_at)
  select want_subject, r, 'course', scope, 'institution', now(), null, null
    from unnest(mapped) as t(r)
  on conflict on constraint role_grants_one_per_scope do update
     set provenance = 'institution',
         granted_at = now(),
         expires_at = null,
         revoked_at = null
   where public.role_grants.provenance = 'institution';

  -- And what it has stopped asserting. `self` and `platform` rows are not this
  -- function's business in either direction.
  update public.role_grants g
     set revoked_at = now()
   where g.subject = want_subject
     and g.scope_kind = 'course'
     and g.scope_id = scope
     and g.provenance = 'institution'
     and g.revoked_at is null
     and not (g.role = any (mapped));

  select count(*) into live
    from public.role_grants g
   where g.subject = want_subject
     and g.scope_kind = 'course'
     and g.scope_id = scope
     and g.revoked_at is null;

  return live;
end $$;

revoke all on function public.record_lti_roles(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.record_lti_roles(uuid, text, text, text[]) to service_role;

comment on function public.record_lti_roles(uuid, text, text, text[]) is
  'Records what one LTI launch asserted about one person on one course, as institution-provenance role grants. Callable by service_role alone.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Safe. Nothing above changes an existing table or column; it adds one table,
-- one index, one policy and one function. Grants this function has already
-- written are ordinary `role_grants` rows and survive it — dropping the writer
-- does not un-grant anything, which is the correct direction for a rollback to
-- fail in.
--
--   begin;
--   drop function if exists public.record_lti_roles(uuid, text, text, text[]);
--   drop table if exists public.lti_role_map;
--   commit;
