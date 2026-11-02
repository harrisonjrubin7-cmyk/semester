\set ON_ERROR_STOP on
begin;
set local role semester_owner;
alter table iam.users force row level security;
alter table iam.tenants force row level security;
alter table iam.workspaces force row level security;
alter table iam.memberships force row level security;
alter table iam.role_assignments force row level security;
alter table app.tasks force row level security;
revoke all on iam.users from public;
revoke all on iam.tenants from public;
revoke all on iam.workspaces from public;
revoke all on iam.memberships from public;
revoke all on iam.role_assignments from public;
revoke all on app.tasks from public;
revoke insert, update, delete, truncate, references, trigger on
  iam.users, iam.tenants, iam.workspaces, iam.memberships, iam.roles,
  iam.capabilities, iam.role_capabilities, iam.role_assignments
from semester_api;
insert into iam.roles(key) values ('student'), ('workspace_task_operator'), ('company_support') on conflict (key) do nothing;
insert into iam.capabilities(key) values ('tasks.read_own'), ('tasks.create_own'), ('tasks.update_own'),
  ('tasks.delete_own'), ('tasks.read_any'), ('tasks.update_any') on conflict (key) do nothing;
insert into iam.role_capabilities(role_id, capability_id)
  select r.id, c.id from iam.roles r cross join iam.capabilities c
  where r.key = 'student' and c.key in ('tasks.read_own','tasks.create_own','tasks.update_own','tasks.delete_own')
  on conflict do nothing;
insert into iam.role_capabilities(role_id, capability_id)
  select r.id, c.id from iam.roles r cross join iam.capabilities c
  where r.key = 'workspace_task_operator' and c.key in ('tasks.read_any','tasks.update_any')
  on conflict do nothing;
commit;
