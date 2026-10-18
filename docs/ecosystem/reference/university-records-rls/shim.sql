-- Minimal Supabase surface the reference needs; not a Supabase emulation.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$; do $$ begin create role supabase_auth_admin nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated, supabase_auth_admin;
grant select on auth.users to anon, authenticated;
create schema extensions;
