-- A record of the live database, as it was, not a migration.
--
-- Generated 21 September 2026 from the `semester` project (lzrqvlugnawcgywkhqlz,
-- PostgreSQL 17) by reading its catalogs. It is step 1 of MIGRATION-HISTORY.md
-- and it exists for one reason: eight of the twenty-one rows in that project's
-- `supabase_migrations.schema_migrations` carry no SQL, so the migrations cannot
-- rebuild the schema they claim to have built. Until that is repaired this file
-- is the only complete description of what production actually is.
--
-- ## Do not apply this to production
--
-- It is not a migration and must never be added to `supabase/migrations/`. It
-- creates objects that already exist there. `create table if not exists` is
-- used throughout so that applying it to an *empty* database is safe, which is
-- how it is verified, and that is the only place it should ever run.
--
-- ## How far through the ledger this reaches
--
-- SNAPSHOT-THROUGH: 20260921002658
--
-- That line is read by `supabase/rehearse.sh` and is not decoration. This file
-- was generated when the live ledger had **twenty-one rows**, the last of them
-- `20260921002658_revoke_function_execute_from_supabase_default_roles`. The
-- ledger has thirty-seven now, so this file is sixteen rows behind it.
--
-- The rehearsal has to know that. It starts from this file and applies only
-- what is newer than the ledger's *newest* row, so without the line above it
-- would assume everything up to `20260921211500` were already here — and
-- silently rehearse a deploy against a schema missing `public.forms`,
-- `public.lti_platform`, `public.schools`, `public.app_admins` and
-- `private.is_app_admin()`, among others. The first migration to reference one
-- of those failed with `function private.is_app_admin() does not exist`, on a
-- branch whose own SQL was sound.
--
-- **Whoever regenerates this file updates this line in the same commit.** It is
-- the one fact about the snapshot that cannot be derived from its contents.
--
-- ## What it does not contain
--
-- Data. Roles, extensions and the `auth`/`storage`/`realtime` schemas Supabase
-- owns — `supabase/local.stub.sql` stands in for those when this is replayed.
-- The `supabase_migrations` table itself.
--
-- ## How it was checked
--
-- Transcribed from query output, which is a step that can go wrong silently, so
-- it is proved rather than trusted: the file is applied to a throwaway cluster
-- and the same catalog queries are re-run against it, and the result must match
-- what production returned. See MIGRATION-HISTORY.md, step 1.

create schema if not exists private;

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.access_gate (
  only_one boolean default true not null,
  invite_only boolean default false not null,
  changed_at timestamp with time zone default now() not null
);

create table if not exists public.appointments (
  user_id uuid not null,
  id text not null,
  data jsonb not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table if not exists public.blocks (
  user_id uuid not null,
  blocked uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.calendar_feeds (
  user_id uuid not null,
  token text not null,
  body text default ''::text not null,
  name text default 'Semester'::text not null,
  events integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.courses (
  user_id uuid not null,
  id text not null,
  data jsonb not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table if not exists public.enrollments (
  user_id uuid not null,
  term text not null,
  code text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.group_members (
  group_id uuid not null,
  user_id uuid not null,
  joined_at timestamp with time zone default now() not null
);

create table if not exists public.group_tasks (
  id uuid default gen_random_uuid() not null,
  group_id uuid not null,
  title text not null,
  owner uuid,
  done boolean default false not null,
  due text default ''::text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.groups (
  id uuid default gen_random_uuid() not null,
  term text not null,
  code text not null,
  name text not null,
  about text default ''::text not null,
  due text default ''::text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.invites (
  email text not null,
  invited_at timestamp with time zone default now() not null,
  note text
);

create table if not exists public.message_reactions (
  message_id uuid not null,
  user_id uuid not null,
  emoji text not null,
  term text not null,
  code text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() not null,
  term text not null,
  code text not null,
  user_id uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.notes (
  user_id uuid not null,
  id text not null,
  data jsonb not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table if not exists public.profiles (
  user_id uuid not null,
  handle text not null,
  about text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.push_devices (
  endpoint text not null,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now() not null,
  gone_at timestamp with time zone
);

create table if not exists public.push_queue (
  user_id uuid not null,
  id text not null,
  send_at timestamp with time zone not null,
  title text not null,
  body text not null,
  screen text default ''::text not null,
  item text default ''::text not null
);

create table if not exists public.referral_codes (
  user_id uuid not null,
  code text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.referrals (
  user_id uuid not null,
  code text not null,
  at timestamp with time zone default now() not null
);

create table if not exists public.reports (
  id uuid default gen_random_uuid() not null,
  reporter uuid not null,
  message_id uuid,
  about uuid,
  reason text not null,
  copy text default ''::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.sittings (
  user_id uuid not null,
  id text not null,
  data jsonb not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table if not exists public.state (
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.tasks (
  user_id uuid not null,
  id text not null,
  data jsonb not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table if not exists public.usage (
  user_id uuid not null,
  month text not null,
  calls integer default 0 not null,
  input_tokens bigint default 0 not null,
  output_tokens bigint default 0 not null,
  updated_at timestamp with time zone default now() not null
);

-- ── Primary keys ──────────────────────────────────────────────────────────

alter table public.access_gate add constraint access_gate_pkey PRIMARY KEY (only_one);
alter table public.appointments add constraint appointments_pkey PRIMARY KEY (user_id, id);
alter table public.blocks add constraint blocks_pkey PRIMARY KEY (user_id, blocked);
alter table public.calendar_feeds add constraint calendar_feeds_pkey PRIMARY KEY (user_id);
alter table public.courses add constraint courses_pkey PRIMARY KEY (user_id, id);
alter table public.enrollments add constraint enrollments_pkey PRIMARY KEY (user_id, term, code);
alter table public.group_members add constraint group_members_pkey PRIMARY KEY (group_id, user_id);
alter table public.group_tasks add constraint group_tasks_pkey PRIMARY KEY (id);
alter table public.groups add constraint groups_pkey PRIMARY KEY (id);
alter table public.invites add constraint invites_pkey PRIMARY KEY (email);
alter table public.message_reactions add constraint message_reactions_pkey PRIMARY KEY (message_id, user_id, emoji);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.notes add constraint notes_pkey PRIMARY KEY (user_id, id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (user_id);
alter table public.push_devices add constraint push_devices_pkey PRIMARY KEY (endpoint);
alter table public.push_queue add constraint push_queue_pkey PRIMARY KEY (user_id, id);
alter table public.referral_codes add constraint referral_codes_pkey PRIMARY KEY (user_id);
alter table public.referrals add constraint referrals_pkey PRIMARY KEY (user_id);
alter table public.reports add constraint reports_pkey PRIMARY KEY (id);
alter table public.sittings add constraint sittings_pkey PRIMARY KEY (user_id, id);
alter table public.state add constraint state_pkey PRIMARY KEY (user_id);
alter table public.tasks add constraint tasks_pkey PRIMARY KEY (user_id, id);
alter table public.usage add constraint usage_pkey PRIMARY KEY (user_id, month);

-- ── Unique ────────────────────────────────────────────────────────────────

alter table public.calendar_feeds add constraint calendar_feeds_token_key UNIQUE (token);
alter table public.referral_codes add constraint referral_codes_code_key UNIQUE (code);

-- ── Check ─────────────────────────────────────────────────────────────────

alter table public.access_gate add constraint access_gate_only_one_check CHECK (only_one);
alter table public.blocks add constraint no_self_block CHECK ((user_id <> blocked));
alter table public.enrollments add constraint enrollments_code_check CHECK ((code ~ '^[a-z0-9][a-z0-9-]{0,60}/[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'::text));
alter table public.enrollments add constraint enrollments_term_check CHECK ((term ~ '^[0-9]{4}(FA|SP|SU)$'::text));
alter table public.group_tasks add constraint group_tasks_title_check CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 200)));
alter table public.groups add constraint groups_about_check CHECK ((length(about) <= 400));
alter table public.groups add constraint groups_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120)));
alter table public.message_reactions add constraint message_reactions_emoji_check CHECK (((length(emoji) >= 1) AND (length(emoji) <= 16)));
alter table public.messages add constraint messages_body_check CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 2000)));
alter table public.profiles add constraint profiles_about_check CHECK ((length(about) <= 140));
alter table public.profiles add constraint profiles_handle_check CHECK (((length(TRIM(BOTH FROM handle)) >= 2) AND (length(TRIM(BOTH FROM handle)) <= 40)));
alter table public.referral_codes add constraint referral_codes_code_check CHECK ((code ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$'::text));
alter table public.reports add constraint reports_reason_check CHECK (((length(TRIM(BOTH FROM reason)) >= 1) AND (length(TRIM(BOTH FROM reason)) <= 500)));

-- ── Foreign keys ──────────────────────────────────────────────────────────

alter table public.appointments add constraint appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.blocks add constraint blocks_blocked_fkey FOREIGN KEY (blocked) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.blocks add constraint blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.calendar_feeds add constraint calendar_feeds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.courses add constraint courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.enrollments add constraint enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.group_members add constraint group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public.group_members add constraint group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.group_tasks add constraint group_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.group_tasks add constraint group_tasks_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public.group_tasks add constraint group_tasks_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.groups add constraint groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.message_reactions add constraint message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
alter table public.message_reactions add constraint message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notes add constraint notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_devices add constraint push_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_queue add constraint push_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.referral_codes add constraint referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.referrals add constraint referrals_code_fkey FOREIGN KEY (code) REFERENCES referral_codes(code) ON DELETE CASCADE;
alter table public.referrals add constraint referrals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reports add constraint reports_about_fkey FOREIGN KEY (about) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.reports add constraint reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL;
alter table public.reports add constraint reports_reporter_fkey FOREIGN KEY (reporter) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.sittings add constraint sittings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.state add constraint state_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.usage add constraint usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Indexes not backing a constraint ──────────────────────────────────────

CREATE INDEX appointments_changed ON public.appointments USING btree (user_id, updated_at);
CREATE INDEX blocks_blocked ON public.blocks USING btree (blocked);
CREATE UNIQUE INDEX calendar_feeds_token_idx ON public.calendar_feeds USING btree (token);
CREATE INDEX courses_changed ON public.courses USING btree (user_id, updated_at);
CREATE INDEX enrollments_by_class ON public.enrollments USING btree (term, code);
CREATE INDEX group_tasks_by_group ON public.group_tasks USING btree (group_id, created_at);
CREATE INDEX groups_by_room ON public.groups USING btree (term, code, created_at DESC);
CREATE INDEX messages_by_room ON public.messages USING btree (term, code, created_at DESC);
CREATE INDEX messages_user ON public.messages USING btree (user_id);
CREATE INDEX notes_changed ON public.notes USING btree (user_id, updated_at);
CREATE INDEX push_devices_user ON public.push_devices USING btree (user_id);
CREATE INDEX push_queue_due ON public.push_queue USING btree (send_at) WHERE (send_at IS NOT NULL);
CREATE INDEX reactions_by_room ON public.message_reactions USING btree (term, code, created_at DESC);
CREATE INDEX reactions_user ON public.message_reactions USING btree (user_id);
CREATE INDEX reports_about ON public.reports USING btree (about);
CREATE INDEX reports_message ON public.reports USING btree (message_id);
CREATE INDEX reports_reporter ON public.reports USING btree (reporter);
CREATE INDEX sittings_changed ON public.sittings USING btree (user_id, updated_at);
CREATE INDEX tasks_changed ON public.tasks USING btree (user_id, updated_at);

-- ── Functions ─────────────────────────────────────────────────────────────
--
-- **Ordered by dependency, not by name.** A SQL-language function is parsed
-- when it is created, so `private.group_in_my_class` cannot be created before
-- `private.in_class`, which it calls. The first draft of this file listed them
-- alphabetically, which is how production's catalog returns them and is not
-- how they can be replayed — applying it to an empty database failed at
-- `function private.in_class(text, text) does not exist`. Keep this order.

CREATE OR REPLACE FUNCTION private.classmate(other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.enrollments mine
    join public.enrollments theirs
      on theirs.term = mine.term and theirs.code = mine.code
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
  );
$function$;

CREATE OR REPLACE FUNCTION private.in_class(want_term text, want_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = (select auth.uid()) and e.term = want_term and e.code = want_code
  );
$function$;

CREATE OR REPLACE FUNCTION private.in_group(want_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.group_members m
    where m.group_id = want_group and m.user_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION private.group_room(want_group uuid)
 RETURNS TABLE(term text, code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.term, g.code from public.groups g where g.id = want_group;
$function$;

CREATE OR REPLACE FUNCTION private.group_in_my_class(want_group uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.groups g
    where g.id = want_group and private.in_class(g.term, g.code)
  );
$function$;

CREATE OR REPLACE FUNCTION private.verified_student()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
  );
$function$;

CREATE OR REPLACE FUNCTION public.referral_active_days()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 14 $function$;

CREATE OR REPLACE FUNCTION public.referral_new_days()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 7 $function$;

CREATE OR REPLACE FUNCTION public.gen_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  made     text;
  i        integer;
  tries    integer := 0;
begin
  loop
    made := '';
    for i in 1..8 loop
      made := made || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes rc where rc.code = made);
    tries := tries + 1;
    if tries > 100 then
      raise exception 'semester: could not generate an unused referral code';
    end if;
  end loop;
  return made;
end $function$;

CREATE OR REPLACE FUNCTION public.claim_referral(given text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid; owner uuid; born timestamptz; want text;
begin
  me := auth.uid();
  if me is null then return 'signed-out'; end if;

  want := upper(btrim(coalesce(given, '')));
  if want = '' then return 'unknown'; end if;

  select rc.user_id into owner from public.referral_codes rc where rc.code = want;
  if owner is null then return 'unknown'; end if;

  if owner = me then return 'self'; end if;

  if exists (select 1 from public.referrals r where r.user_id = me) then
    return 'already';
  end if;

  select u.created_at into born from auth.users u where u.id = me;
  if born is null or born < now() - (public.referral_new_days() || ' days')::interval then
    return 'late';
  end if;

  insert into public.referrals (user_id, code) values (me, want)
  on conflict (user_id) do nothing;
  return 'ok';
end $function$;

CREATE OR REPLACE FUNCTION public.make_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid; mine text;
begin
  me := auth.uid();
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;

  select rc.code into mine from public.referral_codes rc where rc.user_id = me;
  if mine is not null then return mine; end if;

  insert into public.referral_codes (user_id, code)
  values (me, public.gen_referral_code())
  on conflict (user_id) do nothing;

  select rc.code into mine from public.referral_codes rc where rc.user_id = me;
  return mine;
end $function$;

CREATE OR REPLACE FUNCTION public.referral_standing()
 RETURNS TABLE(code text, joined integer, active integer, signup_open boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid; mine text;
begin
  me := auth.uid();
  if me is null then return; end if;

  select rc.code into mine from public.referral_codes rc where rc.user_id = me;

  return query
    select
      mine,
      (select count(*)::integer from public.referrals r where r.code = mine),
      (select count(*)::integer
         from public.referrals r
         join public.state s on s.user_id = r.user_id
        where r.code = mine
          and s.updated_at >= now() - (public.referral_active_days() || ' days')::interval),
      (select not coalesce(g.invite_only, false) from public.access_gate g where g.only_one);
end $function$;

CREATE OR REPLACE FUNCTION public.only_invited()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare gated boolean;
begin
  select invite_only into gated from public.access_gate where only_one;
  if not coalesce(gated, false) then
    return new;
  end if;

  if exists (select 1 from public.invites where lower(email) = lower(new.email)) then
    return new;
  end if;

  raise exception 'semester: not on the invite list'
    using errcode = 'check_violation';
end $function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_invite_only(on_off boolean)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.access_gate (only_one, invite_only, changed_at)
  values (true, on_off, now())
  on conflict (only_one) do update set invite_only = excluded.invite_only, changed_at = now()
  returning invite_only;
$function$;

CREATE OR REPLACE FUNCTION public.sweep_tombstones(older_than interval DEFAULT '90 days'::interval)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  t text;
  n integer := 0;
  hit integer;
begin
  foreach t in array array['notes', 'tasks', 'appointments', 'sittings', 'courses']
  loop
    execute format(
      'delete from public.%1$s where deleted_at is not null and deleted_at < now() - $1', t)
      using older_than;
    get diagnostics hit = row_count;
    n := n + hit;
  end loop;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ── Triggers ──────────────────────────────────────────────────────────────
--
-- `courses` carries two of these doing the same thing — `courses_touch` and
-- `touch_courses`. Both are in production; they are recorded rather than
-- tidied, because this file is a record of what is there.

CREATE TRIGGER calendar_feeds_touch BEFORE UPDATE ON public.calendar_feeds FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER courses_touch BEFORE INSERT OR UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER group_tasks_touch BEFORE INSERT OR UPDATE ON public.group_tasks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER only_invited_users BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION only_invited();
CREATE TRIGGER profiles_touch BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER state_touch BEFORE INSERT OR UPDATE ON public.state FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_appointments BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_courses BEFORE INSERT OR UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_notes BEFORE INSERT OR UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_sittings BEFORE INSERT OR UPDATE ON public.sittings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_tasks BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Event trigger ─────────────────────────────────────────────────────────
--
-- One of the seven event triggers in production is recorded here; the other
-- six belong to Supabase (owner `supabase_admin`, functions in `extensions`)
-- and are not, because they are not ours to restore. It is what makes
-- RLS-on-by-default true, so a schema rebuilt without it would be quietly
-- less safe than the original.
--
-- **It is this project's**, which the first version of this file said and a
-- later one withdrew. The withdrawal reasoned that Supabase's "automatically
-- enable RLS" setting installs it — the code is in Supabase's house style
-- rather than this repository's, and the one migration that named it only
-- revoked EXECUTE, which is a thing you do to something that already exists.
--
-- Two Supabase-built preview branches settled it on 21 September. One whose
-- migrations do not create the trigger came up with six event triggers, every
-- one the platform's own, and no `ensure_rls`; one whose migrations do create
-- it came up with seven. Both had applied all their migrations. The platform
-- does not supply this, and the house style is explained instead by Supabase's
-- documentation, which prints this exact function and trigger under
-- *Auto-enable RLS for new tables* as a recipe to run yourself. Somebody did.
--
-- So `20260901000100_schema.sql` creates it, and `local.stub.sql` — which is
-- deployed nowhere — no longer does. It is still recorded here because this
-- file is a record of production and production has it.
--
-- Guarded all the same, and the guard is what matters rather than the reason
-- for it: a replay that applies the migrations first, or an earlier stub that
-- still carried the trigger, would otherwise die on this line with
-- `event trigger "ensure_rls" already exists`. Which it did, on the rehearsal
-- that found the collision.
--
-- Needs superuser, which is why it is last: everything above applies without
-- it, and this is the only line that will fail for a non-superuser.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
      WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      EXECUTE FUNCTION public.rls_auto_enable();
  END IF;
END $$;

-- ── Row-level security ────────────────────────────────────────────────────
--
-- Every table in `public` has it on: the catalog reports none without it.

alter table public.access_gate enable row level security;
alter table public.appointments enable row level security;
alter table public.blocks enable row level security;
alter table public.calendar_feeds enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.group_members enable row level security;
alter table public.group_tasks enable row level security;
alter table public.groups enable row level security;
alter table public.invites enable row level security;
alter table public.message_reactions enable row level security;
alter table public.messages enable row level security;
alter table public.notes enable row level security;
alter table public.profiles enable row level security;
alter table public.push_devices enable row level security;
alter table public.push_queue enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.reports enable row level security;
alter table public.sittings enable row level security;
alter table public.state enable row level security;
alter table public.tasks enable row level security;
alter table public.usage enable row level security;

-- ── Policies ──────────────────────────────────────────────────────────────
--
-- `access_gate` and `invites` have RLS on and no policy at all, which is how a
-- table is closed to anon and authenticated entirely; only `service_role`,
-- which bypasses RLS, reaches them. That is deliberate and is why the grants
-- below name it alone for those two.

create policy "own rows" on public.appointments as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "blocks are yours alone" on public.blocks as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "feeds are managed by their owner" on public.calendar_feeds as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "courses are private" on public.courses as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "change your own enrollment" on public.enrollments as PERMISSIVE for UPDATE to public using (((select auth.uid() as uid) = user_id)) with check ((((select auth.uid() as uid) = user_id) AND private.verified_student()));
create policy "join your own classes" on public.enrollments as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = user_id) AND private.verified_student()));
create policy "leave your own classes" on public.enrollments as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "see who shares a class" on public.enrollments as PERMISSIVE for SELECT to public using ((((select auth.uid() as uid) = user_id) OR private.classmate(user_id)));
create policy "join a group yourself" on public.group_members as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = user_id) AND private.verified_student() AND private.group_in_my_class(group_id)));
create policy "leave a group yourself" on public.group_members as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "see who is in a group in your class" on public.group_members as PERMISSIVE for SELECT to public using ((private.verified_student() AND private.group_in_my_class(group_id)));
create policy "members add parts" on public.group_tasks as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = created_by) AND private.in_group(group_id)));
create policy "members change the parts" on public.group_tasks as PERMISSIVE for UPDATE to public using (private.in_group(group_id)) with check (private.in_group(group_id));
create policy "members read the parts" on public.group_tasks as PERMISSIVE for SELECT to public using (private.in_group(group_id));
create policy "members remove parts" on public.group_tasks as PERMISSIVE for DELETE to public using (private.in_group(group_id));
create policy "groups are visible to the class" on public.groups as PERMISSIVE for SELECT to public using ((private.verified_student() AND private.in_class(term, code)));
create policy "members may edit their group" on public.groups as PERMISSIVE for UPDATE to public using (private.in_group(id)) with check (private.in_group(id));
create policy "only the starter may delete a group" on public.groups as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = created_by));
create policy "start a group in a class you are in" on public.groups as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = created_by) AND private.verified_student() AND private.in_class(term, code)));
create policy "react in your classes as yourself" on public.message_reactions as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = user_id) AND private.verified_student() AND private.in_class(term, code) AND (EXISTS (SELECT 1 FROM messages m WHERE ((m.id = message_reactions.message_id) AND (m.term = message_reactions.term) AND (m.code = message_reactions.code))))));
create policy "read reactions in your classes" on public.message_reactions as PERMISSIVE for SELECT to public using ((private.verified_student() AND private.in_class(term, code) AND (NOT (EXISTS (SELECT 1 FROM blocks b WHERE ((b.user_id = (select auth.uid() as uid)) AND (b.blocked = message_reactions.user_id)))))));
create policy "take back your own reaction" on public.message_reactions as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "delete your own messages" on public.messages as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "post to your classes as yourself" on public.messages as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = user_id) AND private.verified_student() AND private.in_class(term, code)));
create policy "read your classes" on public.messages as PERMISSIVE for SELECT to public using ((private.verified_student() AND private.in_class(term, code) AND (NOT (EXISTS (SELECT 1 FROM blocks b WHERE ((b.user_id = (select auth.uid() as uid)) AND (b.blocked = messages.user_id)))))));
create policy "own rows" on public.notes as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "create your own profile" on public.profiles as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = user_id) AND private.verified_student()));
create policy "delete your own profile" on public.profiles as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "edit your own profile" on public.profiles as PERMISSIVE for UPDATE to public using (((select auth.uid() as uid) = user_id)) with check ((((select auth.uid() as uid) = user_id) AND private.verified_student()));
create policy "profiles are visible to classmates" on public.profiles as PERMISSIVE for SELECT to public using ((((select auth.uid() as uid) = user_id) OR private.classmate(user_id)));
create policy "own devices" on public.push_devices as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own queue" on public.push_queue as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "your referral code goes with you" on public.referral_codes as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "your referral code is yours" on public.referral_codes as PERMISSIVE for SELECT to public using (((select auth.uid() as uid) = user_id));
create policy "your own arrival goes with you" on public.referrals as PERMISSIVE for DELETE to public using (((select auth.uid() as uid) = user_id));
create policy "your own arrival is yours" on public.referrals as PERMISSIVE for SELECT to public using (((select auth.uid() as uid) = user_id));
create policy "anyone verified may report" on public.reports as PERMISSIVE for INSERT to public with check ((((select auth.uid() as uid) = reporter) AND private.verified_student()));
create policy "own rows" on public.sittings as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "state is private" on public.state as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "own rows" on public.tasks as PERMISSIVE for ALL to public using (((select auth.uid() as uid) = user_id)) with check (((select auth.uid() as uid) = user_id));
create policy "usage is readable by its owner" on public.usage as PERMISSIVE for SELECT to public using (((select auth.uid() as uid) = user_id));

-- ── Grants ────────────────────────────────────────────────────────────────
--
-- Written as `all` rather than seven separate lines per role per table. For a
-- table `all` is exactly SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
-- and TRIGGER, which is what the catalog lists for each of these, so this is a
-- shorter spelling of the same grant and not a broader one.
--
-- These look alarming and are not what protects anything: Supabase grants them
-- by default on `public`, and the policies above are what decide which rows a
-- request may touch. `access_gate` and `invites` are the two tables where the
-- grant itself is the protection, because they have no policy.

grant all on public.appointments to anon, authenticated, service_role;
grant all on public.blocks to anon, authenticated, service_role;
grant all on public.calendar_feeds to anon, authenticated, service_role;
grant all on public.courses to anon, authenticated, service_role;
grant all on public.enrollments to anon, authenticated, service_role;
grant all on public.group_members to anon, authenticated, service_role;
grant all on public.group_tasks to anon, authenticated, service_role;
grant all on public.groups to anon, authenticated, service_role;
grant all on public.message_reactions to anon, authenticated, service_role;
grant all on public.messages to anon, authenticated, service_role;
grant all on public.notes to anon, authenticated, service_role;
grant all on public.profiles to anon, authenticated, service_role;
grant all on public.push_devices to anon, authenticated, service_role;
grant all on public.push_queue to anon, authenticated, service_role;
grant all on public.referral_codes to anon, authenticated, service_role;
grant all on public.referrals to anon, authenticated, service_role;
grant all on public.reports to anon, authenticated, service_role;
grant all on public.sittings to anon, authenticated, service_role;
grant all on public.state to anon, authenticated, service_role;
grant all on public.tasks to anon, authenticated, service_role;
grant all on public.usage to anon, authenticated, service_role;

grant all on public.access_gate to service_role;
grant all on public.invites to service_role;
