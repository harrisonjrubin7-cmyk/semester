-- Synthetic registrar fixtures: 40 extra students in Tenant A, one 10-seat section, one full section,
-- one closed section, one section in Tenant B.
\set ON_ERROR_STOP on
begin;
insert into iam.users (id, display_name)
  select ('00000000-0000-0000-0001-' || lpad(to_hex(g), 12, '0'))::uuid, 'Student ' || g from generate_series(1, 40) g;
insert into iam.memberships (tenant_id, user_id, status)
  select 'a0000000-0000-0000-0000-00000000000a', ('00000000-0000-0000-0001-' || lpad(to_hex(g), 12, '0'))::uuid, 'active'
  from generate_series(1, 40) g;
insert into iam.role_assignments (tenant_id, membership_id, role_id)
  select m.tenant_id, m.id, '00000000-0000-0000-0000-0000000000c1' from iam.memberships m
  where m.user_id::text like '00000000-0000-0000-0001-%';
insert into app.course_sections (id, tenant_id, workspace_id, code, capacity, enrolled_count, state) values
  ('00000000-0000-0000-0002-000000000001', 'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'ECON 1010-01', 10, 0, 'open'),
  ('00000000-0000-0000-0002-000000000002', 'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'ECON 1010-02 (full)', 1, 1, 'open'),
  ('00000000-0000-0000-0002-000000000003', 'a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'ECON 1010-03 (closed)', 30, 0, 'closed'),
  ('00000000-0000-0000-0002-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'B-HIST 100', 30, 0, 'open');
commit;
