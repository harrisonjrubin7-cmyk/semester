-- Durable job queue. Written and leased by the workflow worker over its own
-- connection; no client-facing role can read it.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'leased', 'done', 'failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  leased_at timestamptz
);

create index jobs_ready_idx on public.jobs (created_at) where status = 'ready';

alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated, semester_app;

-- The worker's own subject role. Its connection role must be granted membership
-- in semester_worker. It may lease and finish jobs, and nothing else.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'semester_worker') then
    create role semester_worker nologin noinherit;
  end if;
end $$;

grant select, update on public.jobs to semester_worker;
create policy jobs_worker_queue on public.jobs
  for all to semester_worker
  using (true)
  with check (true);
