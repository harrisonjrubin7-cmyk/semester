-- 090_tenant_activation.sql — PROPOSED. A capability can't be enabled for a tenant unless its activation package is
-- approved with every prerequisite evidenced. Replaces the bare approval_ref check on live_tenant_capabilities.
create table if not exists semester_core.tenant_activations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  capability text not null,
  state text not null default 'planned' check (state in ('planned','preparing','rehearsed','approved','live','hypercare','steady','paused')),
  prerequisites jsonb not null default '{}'::jsonb,   -- { item: { evidence_id, at, by } }
  required_items text[] not null,
  approved_by_semester uuid references semester_core.accounts(id),
  approved_by_institution uuid references semester_core.accounts(id),
  approved_at timestamptz,
  unique (tenant_id, capability),
  check (state not in ('approved','live','hypercare','steady') or (approved_by_semester is not null and approved_by_institution is not null and approved_by_semester <> approved_by_institution and approved_at is not null))
);
alter table semester_core.tenant_activations enable row level security;
alter table semester_core.tenant_activations force row level security;

create or replace function semester_core.activation_complete(p_tenant uuid, p_cap text) returns boolean
language sql stable security definer set search_path = semester_core, pg_temp as $$
  select coalesce((select state in ('approved','live','hypercare','steady')
     and not exists (select 1 from unnest(required_items) i where not (prerequisites ? i and prerequisites->i ? 'evidence_id'))
   from semester_core.tenant_activations where tenant_id = p_tenant and capability = p_cap), false)
$$;

-- Gate the live switch: enabling requires a complete, approved activation package.
create or replace function public.live_capability_gate() returns trigger language plpgsql as $$
begin
  if new.enabled and not coalesce(old.enabled, false) and not semester_core.activation_complete(new.institution_id, new.capability) then
    raise exception 'activation package for % at % is not approved with full evidence', new.capability, new.institution_id using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists live_capability_gate on public.live_tenant_capabilities;
create trigger live_capability_gate before insert or update of enabled on public.live_tenant_capabilities for each row execute function public.live_capability_gate();
-- kill_switch is never gated: turning things OFF must always work.
