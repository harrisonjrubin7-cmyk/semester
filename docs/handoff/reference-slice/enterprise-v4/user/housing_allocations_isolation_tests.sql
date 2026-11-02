-- DEMO fixtures match 000 only. Adapt fixture inserts for real catalog schemas.
BEGIN;
SET LOCAL search_path=public,semester;
CREATE EXTENSION IF NOT EXISTS pgtap SCHEMA public;
SELECT plan(18);
INSERT INTO semester.institutions(id,name) VALUES('00000000-0000-0000-0000-000000000001','A'),('00000000-0000-0000-0000-000000000002','B');
INSERT INTO semester.people(tenant_id,id,name) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','A1'),('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','A2'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000013','B1');
INSERT INTO semester.housing_cycles(tenant_id,id,name) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','A cycle'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','B cycle');
INSERT INTO semester.housing_beds(tenant_id,id,label) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000031','A bed1'),('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000032','A bed2'),('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000033','B bed1');
INSERT INTO semester.housing_allocations(tenant_id,cycle_id,bed_id,person_id,occupancy_range,state,request_key) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011','[2026-08-01,2026-12-20)','occupied','fixture-a1'),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000012','[2026-08-01,2026-12-20)','occupied','fixture-a2'),
('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000013','[2026-08-01,2026-12-20)','occupied','fixture-b1');
CREATE ROLE ha_test_student NOLOGIN NOSUPERUSER NOBYPASSRLS IN ROLE semester_ha_reader;
CREATE ROLE ha_test_staff NOLOGIN NOSUPERUSER NOBYPASSRLS IN ROLE semester_ha_reader;
CREATE ROLE ha_test_unbound NOLOGIN NOSUPERUSER NOBYPASSRLS IN ROLE semester_ha_reader;
INSERT INTO semester_ha_auth.principal_bindings(login_name,tenant_id,person_id,access_kind) VALUES('ha_test_student','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','student'),('ha_test_staff','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000012','housing_staff');

SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='semester.housing_allocations'::regclass),'RLS enabled and forced');
SELECT ok((SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='semester_ha_reader'),'Reader cannot bypass RLS');
SELECT is((SELECT count(*) FROM pg_policy WHERE polrelid='semester.housing_allocations'::regclass),2::bigint,'Expected two policies only');
SELECT ok(NOT has_table_privilege('semester_ha_reader','semester.housing_allocations','TRUNCATE'),'Reader cannot truncate');
SELECT throws_ok($q$INSERT INTO semester.housing_allocations(tenant_id,cycle_id,bed_id,person_id,occupancy_range,state,request_key) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000013','[2027-01-01,2027-02-01)','offered','wrong-person')$q$,'23503',NULL,'Cross-tenant person FK rejected');
SELECT throws_ok($q$INSERT INTO semester.housing_allocations(tenant_id,cycle_id,bed_id,person_id,occupancy_range,state,request_key) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000011','[2027-01-01,2027-02-01)','offered','wrong-bed')$q$,'23503',NULL,'Cross-tenant bed FK rejected');
SELECT throws_ok($q$INSERT INTO semester.housing_allocations(tenant_id,cycle_id,bed_id,person_id,occupancy_range,state,request_key) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000012','[2026-09-01,2026-10-01)','offered','bed-collision')$q$,'23P01',NULL,'Overlapping bed rejected');
SELECT throws_ok($q$INSERT INTO semester.housing_allocations(tenant_id,cycle_id,bed_id,person_id,occupancy_range,state,request_key) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000011','[2026-09-01,2026-10-01)','offered','person-collision')$q$,'23P01',NULL,'Overlapping person rejected');
SELECT lives_ok($q$INSERT INTO semester.housing_allocations(tenant_id,cycle_id,bed_id,person_id,occupancy_range,state,request_key) VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011','[2026-12-20,2027-01-01)','offered','adjacent')$q$,'Adjacent half-open occupancy allowed');
DELETE FROM semester.housing_allocations WHERE request_key='adjacent';
SET SESSION AUTHORIZATION ha_test_unbound;
SELECT is((SELECT count(*) FROM semester.housing_allocations),0::bigint,'Unbound principal defaults to deny');
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION ha_test_student;
SELECT is((SELECT count(*) FROM semester.housing_allocations),1::bigint,'Student sees own populated row');
SELECT is((SELECT count(*) FROM semester.housing_allocations WHERE tenant_id='00000000-0000-0000-0000-000000000002'),0::bigint,'Student cannot see other tenant');
SELECT is((SELECT count(*) FROM semester.housing_allocations WHERE person_id='00000000-0000-0000-0000-000000000012'),0::bigint,'Student cannot see same-tenant peer');
SELECT throws_ok($q$UPDATE semester.housing_allocations SET state='cancelled'$q$,'42501',NULL,'Direct student mutation denied');
SELECT throws_ok($q$SELECT * FROM semester_ha_auth.principal_bindings$q$,'42501',NULL,'Student cannot read identity bindings');
RESET SESSION AUTHORIZATION;
SET SESSION AUTHORIZATION ha_test_staff;
SELECT is((SELECT count(*) FROM semester.housing_allocations),2::bigint,'Staff sees only assigned tenant rows');
SELECT is((SELECT count(*) FROM semester.housing_allocations WHERE tenant_id='00000000-0000-0000-0000-000000000002'),0::bigint,'Staff cannot see other tenant');
RESET SESSION AUTHORIZATION;
UPDATE semester_ha_auth.principal_bindings SET active=false WHERE login_name='ha_test_student';
SET SESSION AUTHORIZATION ha_test_student;
SELECT is((SELECT count(*) FROM semester.housing_allocations),0::bigint,'Revoked binding takes effect');
RESET SESSION AUTHORIZATION;
SELECT * FROM finish();
ROLLBACK;
