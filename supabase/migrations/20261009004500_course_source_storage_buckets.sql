-- Course-source metadata already plans opaque, tenant-prefixed object keys,
-- but a plan is not permission to expose a browser upload. These two buckets
-- are therefore private and have no anon/authenticated policies. A future
-- tenant-bound adapter may use the service role only after it has reloaded the
-- metadata row and can produce the exact storage and scanner receipts required
-- by the controlled settlement functions.

create or replace function private.course_source_buckets_ensure()
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute $buckets$
    insert into storage.buckets
      (id, name, public, file_size_limit, allowed_mime_types)
    values
      (
        'student-files',
        'student-files',
        false,
        52428800,
        array[
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ]
      ),
      (
        'course-materials',
        'course-materials',
        false,
        104857600,
        array[
          'application/pdf',
          'text/plain',
          'text/markdown',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ]
      )
    on conflict (id) do update
      set name = excluded.name,
          public = false,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
  $buckets$;
end
$$;

revoke all on function private.course_source_buckets_ensure()
  from public, anon, authenticated, service_role;

-- Supabase provides Storage before project migrations run. Plain PostgreSQL
-- environments that do not have the Storage extension still apply the rest of
-- the repository, so retain the established conditional-install convention.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    perform private.course_source_buckets_ensure();
  end if;
end
$$;

comment on function private.course_source_buckets_ensure() is
  'Migration-owner-only repair for the two private course-source buckets. It grants no browser object access and is not an upload or scan adapter.';
