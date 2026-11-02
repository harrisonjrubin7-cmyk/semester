BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE semester.housing_allocations (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 cycle_id uuid NOT NULL,
 bed_id uuid NOT NULL,
 person_id uuid NOT NULL,
 occupancy_range tstzrange NOT NULL,
 state text NOT NULL CHECK(state IN ('reserved','offered','contracted','occupied','completed','cancelled','expired')),
 expires_at timestamptz,
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1),
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,request_key),
 FOREIGN KEY(tenant_id) REFERENCES semester.institutions(id),
 FOREIGN KEY(tenant_id,cycle_id) REFERENCES semester.housing_cycles(tenant_id,id),
 FOREIGN KEY(tenant_id,bed_id) REFERENCES semester.housing_beds(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES semester.people(tenant_id,id),
 CHECK(NOT isempty(occupancy_range) AND NOT lower_inf(occupancy_range) AND NOT upper_inf(occupancy_range) AND lower_inc(occupancy_range) AND NOT upper_inc(occupancy_range)),
 CHECK(state<>'reserved' OR expires_at IS NOT NULL),
 CONSTRAINT housing_bed_overlap EXCLUDE USING gist(tenant_id WITH =,bed_id WITH =,occupancy_range WITH &&) WHERE(state IN ('reserved','offered','contracted','occupied')),
 CONSTRAINT housing_person_overlap EXCLUDE USING gist(tenant_id WITH =,person_id WITH =,occupancy_range WITH &&) WHERE(state IN ('reserved','offered','contracted','occupied'))
);
CREATE INDEX housing_allocations_person_idx ON semester.housing_allocations(tenant_id,person_id,state);
CREATE INDEX housing_allocations_cycle_idx ON semester.housing_allocations(tenant_id,cycle_id,state);
CREATE INDEX housing_allocations_expiry_idx ON semester.housing_allocations(tenant_id,expires_at) WHERE state='reserved';
CREATE FUNCTION semester.housing_allocation_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN RAISE EXCEPTION 'Allocation tenant cannot change' USING ERRCODE='23514'; END IF;
 NEW.created_at:=OLD.created_at;
 NEW.updated_at:=clock_timestamp();
 NEW.version:=OLD.version+1;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION semester.housing_allocation_version() FROM PUBLIC;
CREATE TRIGGER housing_allocation_version BEFORE UPDATE ON semester.housing_allocations FOR EACH ROW EXECUTE FUNCTION semester.housing_allocation_version();
ALTER TABLE semester.housing_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester.housing_allocations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON semester.housing_allocations FROM PUBLIC;
COMMIT;
