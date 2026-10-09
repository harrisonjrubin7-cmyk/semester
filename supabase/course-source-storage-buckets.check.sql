-- The course-source buckets are private infrastructure, not browser upload
-- surfaces. Prove their exact limits, repair behavior and browser denial.

begin;

create or replace function pg_temp.counted(label text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % (got %, wanted %)', label, got, want;
  end if;
  raise notice 'ok  %', label;
end
$$;

create or replace function pg_temp.expect_refused(label text, role_name text, statement text)
returns void language plpgsql as $$
begin
  begin
    execute format('set local role %I', role_name);
    execute statement;
    reset role;
    raise exception 'FAILED: % was allowed', label;
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'ok  %', label;
  end;
end
$$;

create or replace function pg_temp.seen(role_name text, statement text)
returns bigint language plpgsql as $$
declare
  got bigint;
begin
  execute format('set local role %I', role_name);
  execute statement into got;
  reset role;
  return got;
exception when others then
  reset role;
  raise;
end
$$;

create or replace function pg_temp.affected(role_name text, statement text)
returns bigint language plpgsql as $$
declare
  got bigint;
begin
  execute format('set local role %I', role_name);
  execute statement;
  get diagnostics got = row_count;
  reset role;
  return got;
exception when others then
  reset role;
  raise;
end
$$;

do $test$
declare
  wanted_types text[] := array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];
begin
  perform pg_temp.counted(
    'both course-source buckets exist and are private',
    (select count(*) from storage.buckets
      where id in ('student-files', 'course-materials')
        and name = id
        and not public),
    2
  );

  perform pg_temp.counted(
    'student files retain the student-private 50 MiB cap and exact document types',
    (select count(*) from storage.buckets
      where id = 'student-files'
        and file_size_limit = 52428800
        and allowed_mime_types = wanted_types),
    1
  );

  perform pg_temp.counted(
    'published course material retains the internal 100 MiB cap and exact document types',
    (select count(*) from storage.buckets
      where id = 'course-materials'
        and file_size_limit = 104857600
        and allowed_mime_types = wanted_types),
    1
  );

  update storage.buckets
     set public = true,
         file_size_limit = null,
         allowed_mime_types = null
   where id = 'student-files';
  delete from storage.buckets where id = 'course-materials';
  perform private.course_source_buckets_ensure();

  perform pg_temp.counted(
    'the migration-owner repair closes drift and restores both exact buckets',
    (select count(*) from storage.buckets
      where (id = 'student-files' and not public and file_size_limit = 52428800 and allowed_mime_types = wanted_types)
         or (id = 'course-materials' and not public and file_size_limit = 104857600 and allowed_mime_types = wanted_types)),
    2
  );

  if has_function_privilege('anon', 'private.course_source_buckets_ensure()', 'execute')
     or has_function_privilege('authenticated', 'private.course_source_buckets_ensure()', 'execute')
     or has_function_privilege('service_role', 'private.course_source_buckets_ensure()', 'execute') then
    raise exception 'FAILED: a runtime role can reconfigure course-source buckets';
  end if;
  raise notice 'ok  only the migration owner can repair course-source buckets';

  insert into storage.objects (bucket_id, name, owner)
  values
    ('student-files', 't/source-u/student_private/2026-10/source-proof', gen_random_uuid()),
    ('course-materials', 't/source-u/internal/2026-10/material-proof', gen_random_uuid());

  perform pg_temp.expect_refused(
    'authenticated cannot upload directly to student files',
    'authenticated',
    $$insert into storage.objects (bucket_id, name) values ('student-files', 't/other/student_private/2026-10/bypass')$$
  );
  perform pg_temp.counted(
    'authenticated cannot list student files',
    pg_temp.seen('authenticated', $$select count(*) from storage.objects where bucket_id = 'student-files'$$),
    0
  );
  perform pg_temp.expect_refused(
    'authenticated cannot upload directly to course materials',
    'authenticated',
    $$insert into storage.objects (bucket_id, name) values ('course-materials', 't/other/internal/2026-10/bypass')$$
  );
  perform pg_temp.counted(
    'authenticated cannot list course materials',
    pg_temp.seen('authenticated', $$select count(*) from storage.objects where bucket_id = 'course-materials'$$),
    0
  );
  perform pg_temp.counted(
    'anonymous cannot read course-source objects',
    pg_temp.seen('anon', $$select count(*) from storage.objects where bucket_id in ('student-files', 'course-materials')$$),
    0
  );
  perform pg_temp.counted(
    'authenticated cannot replace a course-source object',
    pg_temp.affected('authenticated', $$update storage.objects set metadata = '{"bypass":true}' where bucket_id = 'student-files'$$),
    0
  );
  perform pg_temp.counted(
    'authenticated cannot delete a course-source object',
    pg_temp.affected('authenticated', $$delete from storage.objects where bucket_id = 'course-materials'$$),
    0
  );
end
$test$;

rollback;
