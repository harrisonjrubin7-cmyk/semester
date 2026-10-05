-- Seeds one suite with the 12 canonical workflows for the first user. Run after signing up once:
--   supabase db reset   (local)   or paste into the SQL editor with :owner set.
do $$
declare owner uuid := (select id from auth.users order by created_at limit 1); suite uuid;
begin
  if owner is null then raise notice 'Sign up a user first'; return; end if;
  insert into public.benchmark_suites (owner_id, name, description) values (owner, 'Semester canonical 12', 'Claude Artifacts vs ChatGPT Canvas vs v0 across the 12 canonical workflows') returning id into suite;
  insert into public.benchmark_tasks (suite_id, number, slug, title, category, prompt, recommended_platform, requires_persistence) values
  (suite, 1, 'artifact-tracker', 'Sortable artifact tracker', 'Interactive tool', 'Build a single-file React tracker of every Semester artifact with search, filters, sortable columns and CSV export.', 'claude-artifacts', false),
  (suite, 2, 'onboarding-prototype', 'Interactive onboarding prototype', 'Product prototype', 'Prototype Semester student onboarding with consent one decision at a time.', 'claude-artifacts', false),
  (suite, 3, 'b2b-landing', 'B2B SaaS landing page', 'Marketing page', 'Design a Semester institution landing page with a capability status map.', 'claude-artifacts', false),
  (suite, 4, 'architecture-diagram', 'Multi-tenant system architecture diagram', 'Diagram', 'Draw Semester multi-tenant architecture as Mermaid with the RLS boundary.', 'claude-artifacts', false),
  (suite, 5, 'tech-design-doc', 'Technical design document', 'Document', 'Write a TDD for Semester degree-audit sync.', 'chatgpt-canvas', false),
  (suite, 6, 'launch-presentation', 'Product launch presentation', 'Presentation', 'Draft a 10-slide pilot launch presentation for registrars.', 'chatgpt-canvas', false),
  (suite, 7, 'subscription-csv', 'Subscription CSV analysis', 'Data analysis', 'Analyse a subscription CSV: MRR, churn, cohorts.', 'chatgpt-canvas', false),
  (suite, 8, 'metric-dashboard', 'Reusable React metric dashboard', 'React component', 'Build a reusable typed <MetricDashboard> component with all states.', 'claude-artifacts', false),
  (suite, 9, 'auth-route-handler', 'Authenticated Next.js route handler', 'Full-stack feature', 'Implement an authenticated route handler with Supabase, getUser and Zod.', 'v0', true),
  (suite, 10, 'supabase-crud', 'Supabase artifact CRUD workflow', 'Full-stack feature', 'Create artifact CRUD with migration, RLS and server actions.', 'v0', true),
  (suite, 11, 'cookie-auth', 'Cookie-based Supabase Auth', 'Full-stack feature', 'Implement cookie-based Supabase Auth with @supabase/ssr and middleware refresh.', 'v0', true),
  (suite, 12, 'multi-tenant-workspace', 'Multi-tenant SaaS workspace', 'Full-stack feature', 'Build organizations, roles and org-scoped RLS.', 'v0', true);
end $$;
