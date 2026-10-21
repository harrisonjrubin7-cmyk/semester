-- DRAFT: requires existing Course Studio migration and private.role_audit_sha256(text).
-- This wrapper does NOT grant any role or change the canonical capability predicate.
-- It preserves the inspected profile-school/course scope; not multi-school membership support.
begin;
create table private.course_guidance_command_receipt (
  actor_id uuid not null references auth.users(id) on delete cascade,
  command_id uuid not null,
  school_id text not null references public.schools(id),
  request_digest text not null check (request_digest ~ '^[0-9a-f]{64}$'),
  published_version integer not null check (published_version > 0),
  created_at timestamptz not null default now(),
  primary key (actor_id, command_id)
);
create index course_guidance_receipt_school
  on private.course_guidance_command_receipt(school_id);
alter table private.course_guidance_command_receipt enable row level security;
revoke all on private.course_guidance_command_receipt from public, anon, authenticated;

create function public.publish_course_guidance_once(
  want_command uuid,
  want_school text,
  want_course text,
  want_term text,
  want_body text,
  want_expected_version integer
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  code text := private.course_code(want_course);
  school text;
  digest text;
  receipt private.course_guidance_command_receipt%rowtype;
  current_version integer;
  published_version integer;
begin
  -- Authorize even a replay. Revoked access cannot replay a receipt through this command.
  school := private.course_publisher(code);
  if want_school is null or school is distinct from want_school then
    raise exception 'Context does not match the authorized school.' using errcode = '42501';
  end if;
  if want_command is null or want_expected_version is null or want_expected_version < 0
     or want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$'
     or want_body is null or length(want_body) > 4000 then
    raise exception 'Invalid publication command.' using errcode = '23514';
  end if;
  digest := private.role_audit_sha256(jsonb_build_array(
    school, code, want_term, btrim(want_body), want_expected_version
  )::text);
  perform pg_advisory_xact_lock(hashtext('guidance-command:' || me::text || ':' || want_command::text));
  select * into receipt from private.course_guidance_command_receipt r
   where r.actor_id = me and r.command_id = want_command;
  if found then
    if receipt.request_digest <> digest then
      raise exception 'Command key was reused for different content.' using errcode = '23514';
    end if;
    return receipt.published_version;
  end if;
  -- Same lock identity used by the existing publisher, so old and new callers serialize versions.
  perform pg_advisory_xact_lock(hashtext('course_guidance:' || school || '/' || code || '/' || want_term));
  select coalesce(max(g.version), 0) into current_version
    from public.course_guidance g
   where g.tenant_id = school and g.course_code = code and g.term = want_term;
  if current_version <> want_expected_version then
    raise exception 'Publication changed; review the current version.' using errcode = '40001';
  end if;
  published_version := public.publish_course_guidance(code, want_term, btrim(want_body));
  insert into private.course_guidance_command_receipt
    (actor_id, command_id, school_id, request_digest, published_version)
  values (me, want_command, school, digest, published_version);
  return published_version;
end;
$$;
revoke all on function public.publish_course_guidance_once(uuid,text,text,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.publish_course_guidance_once(uuid,text,text,text,text,integer)
  to authenticated;
commit;
