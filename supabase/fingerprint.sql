-- Five md5s that say whether two databases have the same schema.
--
-- The snapshot in `schema.snapshot.sql` was proved against production by
-- queries like these, and then the queries were not written down — so the
-- proof could be quoted and not repeated, which is half a proof. This is the
-- other half. Run it anywhere and compare the five numbers.
--
--     psql -f supabase/fingerprint.sql                  # a local build
--     -- or paste it into the SQL editor of a live project
--
-- Only `public` and `private` are looked at: those are the two schemas this
-- repository creates. `auth`, `realtime`, `extensions` and the rest belong to
-- Supabase on a real project and to `local.stub.sql` on a throwaway one, and
-- comparing them would only ever measure the difference between the two.
--
-- Objects owned by an extension are excluded for the same reason — pgcrypto
-- lands in `public` locally and in `extensions` on a project, and its forty
-- functions are not something this repository decides.
--
-- What each one is sensitive to, so that a match means something:
--
--   columns      every column's schema, table, name, type and nullability
--   constraints  every primary key, foreign key, unique and check, by its
--                definition rather than its name alone
--   indexes      every index definition, which catches a dropped `where`
--                clause or a changed column order
--   functions    every function body, volatility, security and search_path
--   code         the same functions with comments and runs of whitespace
--                taken out, so that a body which differs only in what it says
--                about itself still matches
--   policies     every policy's command and both expressions — the ones that
--                decide who can read what
--
-- `functions` and `code` are both here because they answer different
-- questions and the answers have already differed. Four functions were applied
-- to production on 21 September with their comments stripped, so `functions`
-- says the two databases disagree and `code` says every statement in them is
-- the same. Neither number alone would have told you which of those it was.

\pset tuples_only on
\pset format unaligned

select 'columns      ' || md5(string_agg(x, E'\n' order by x)) from (
  select table_schema || '.' || table_name || '.' || column_name || ' ' ||
         data_type || ' ' || is_nullable as x
    from information_schema.columns
   where table_schema in ('public', 'private')
) t;

select 'constraints  ' || md5(string_agg(x, E'\n' order by x)) from (
  select n.nspname || '.' || rel.relname || '.' || con.conname || ' ' ||
         pg_get_constraintdef(con.oid) as x
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname in ('public', 'private')
) t;

select 'indexes      ' || md5(string_agg(x, E'\n' order by x)) from (
  select schemaname || '.' || indexname || ' ' || indexdef as x
    from pg_indexes
   where schemaname in ('public', 'private')
) t;

select 'functions    ' || md5(string_agg(x, E'\n' order by x)) from (
  select p.pronamespace::regnamespace || '.' || p.proname || '(' ||
         pg_get_function_identity_arguments(p.oid) || ') ' ||
         md5(pg_get_functiondef(p.oid)) as x
    from pg_proc p
   where p.pronamespace::regnamespace::text in ('public', 'private')
     and not exists (
       select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
     )
) t;

select 'code         ' || md5(string_agg(x, E'\n' order by x)) from (
  select p.pronamespace::regnamespace || '.' || p.proname || '(' ||
         pg_get_function_identity_arguments(p.oid) || ') ' ||
         md5(btrim(regexp_replace(regexp_replace(regexp_replace(p.prosrc,
           '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))) as x
    from pg_proc p
   where p.pronamespace::regnamespace::text in ('public', 'private')
     and not exists (
       select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
     )
) t;

select 'policies     ' || md5(string_agg(x, E'\n' order by x)) from (
  select schemaname || '.' || tablename || '.' || policyname || ' ' || cmd ||
         ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') as x
    from pg_policies
   where schemaname in ('public', 'private')
) t;
