-- The scheduler's token check for the integration-tick Edge Function, run as
-- the roles that will and must not call it. LOCAL/DISPOSABLE DATABASES ONLY;
-- always rolled back.
--
--   supabase/check.sh integration-tick-auth
--
-- A plain Postgres has no Vault, so a stand-in `vault.decrypted_secrets` is
-- made inside this transaction when the real one is absent.

begin;

do $$
begin
  if to_regclass('vault.decrypted_secrets') is null then
    create schema if not exists vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
    grant usage on schema vault to service_role;
  end if;
end $$;

create or replace function pg_temp.said(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.asked(token text)
returns boolean language plpgsql as $$
declare r boolean;
begin
  execute 'set local role service_role';
  select public.integration_tick_authorized(token) into r;
  execute 'reset role';
  return r;
end $$;

do $$
-- A stand-in token made here rather than written down, so no literal looks like a credential.
declare secret text := encode(sha256(convert_to('integration-tick-check', 'UTF8')), 'hex');
begin
  -- Who may ask at all.
  perform pg_temp.said('a signed-in account can call it',
    has_function_privilege('authenticated', 'public.integration_tick_authorized(text)', 'execute'), false);
  perform pg_temp.said('anon can call it',
    has_function_privilege('anon', 'public.integration_tick_authorized(text)', 'execute'), false);
  perform pg_temp.said('the service role can call it',
    has_function_privilege('service_role', 'public.integration_tick_authorized(text)', 'execute'), true);

  -- No secret in Vault: nothing is right, not even an empty guess.
  delete from vault.decrypted_secrets where name = 'integration_cron_secret';
  perform pg_temp.said('with no secret stored, a token is refused', pg_temp.asked(secret), false);

  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'vault' and c.relname = 'decrypted_secrets' and c.relkind = 'r') = 1 then
    insert into vault.decrypted_secrets (name, decrypted_secret) values ('integration_cron_secret', secret);
  else
    perform vault.create_secret(secret, 'integration_cron_secret', 'check', null);
  end if;

  perform pg_temp.said('the stored secret is accepted', pg_temp.asked(secret), true);
  perform pg_temp.said('one character off is refused', pg_temp.asked(left(secret, -1) || 'X'), false);
  perform pg_temp.said('a prefix is refused', pg_temp.asked(left(secret, 32)), false);
  perform pg_temp.said('an empty token is refused', pg_temp.asked(''), false);
  perform pg_temp.said('a null token is refused', pg_temp.asked(null), false);
end $$;

rollback;
