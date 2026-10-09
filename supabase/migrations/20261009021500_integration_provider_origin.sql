-- Per-connection provider origin for server-side pull adapters.
-- It is configuration, not a credential: secrets remain indirect references.
alter table public.integration_connections
  add column if not exists provider_base_url text;

alter table public.integration_connections
  drop constraint if exists integration_provider_base_url_shape;
alter table public.integration_connections
  add constraint integration_provider_base_url_shape check (
    provider_base_url is null or (
      length(provider_base_url) between 12 and 300
      and provider_base_url ~ '^https://[A-Za-z0-9.-]+(:443)?$'
      and provider_base_url !~ '@'
    )
  );

grant select (provider_base_url) on public.integration_connections to authenticated;
grant insert (provider_base_url) on public.integration_connections to authenticated;
grant update (provider_base_url) on public.integration_connections to authenticated;

comment on column public.integration_connections.provider_base_url is
  'Approved HTTPS provider origin only; adapters enforce provider-specific host policy before every request.';
