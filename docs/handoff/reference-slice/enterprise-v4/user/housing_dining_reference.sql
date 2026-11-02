-- Fresh-schema reference; not an additive migration. Not PostgreSQL-executed.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SCHEMA semester;
SET LOCAL search_path=semester,public;
CREATE TABLE institutions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,slug text NOT NULL UNIQUE,default_timezone text NOT NULL,status text NOT NULL);

-- shared
CREATE TABLE people(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  preferred_name text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- shared
CREATE TABLE campuses(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- shared
CREATE TABLE academic_terms(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (ends_on >= starts_on)
);

-- shared
CREATE TABLE policy_versions(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_type text NOT NULL,
  version_number integer NOT NULL,
  definition jsonb NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- shared
CREATE TABLE documents(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_person_id uuid,
  storage_key text NOT NULL,
  classification text NOT NULL,
  scan_status text NOT NULL,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- shared
CREATE TABLE integration_connections(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  authority_mode text NOT NULL,
  credential_reference text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- shared
CREATE TABLE billing_charges(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (amount_minor >= 0),
  CHECK (currency ~ '^[A-Z]{3}$')
);

-- shared
CREATE TABLE payment_orders(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  merchant_reference text NOT NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (amount_minor > 0),
  UNIQUE (tenant_id,idempotency_key),
  CHECK (currency ~ '^[A-Z]{3}$')
);

-- housing
CREATE TABLE housing_cycles(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  name text NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (closes_at > opens_at)
);

-- housing
CREATE TABLE housing_buildings(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_rooms(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  room_number text NOT NULL,
  room_type text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,building_id,room_number)
);

-- housing
CREATE TABLE housing_beds(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  bed_label text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,room_id,bed_label)
);

-- housing
CREATE TABLE housing_applications(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  status text NOT NULL,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,person_id,cycle_id)
);

-- housing
CREATE TABLE housing_preferences(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  preference_code text NOT NULL,
  rank smallint,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_eligibility_results(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  result text NOT NULL,
  reason_codes text[] NOT NULL,
  evaluated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_placement_instructions(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  instruction_code text NOT NULL,
  approved_requirement text NOT NULL,
  authorization_reference text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE roommate_groups(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  owner_person_id uuid NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE roommate_group_members(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  person_id uuid NOT NULL,
  invitation_status text NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,group_id,person_id)
);

-- housing
CREATE TABLE housing_selection_windows(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  person_id uuid,
  group_id uuid,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (num_nonnulls(person_id,group_id)=1),
  CHECK (closes_at > opens_at)
);

-- housing
CREATE TABLE housing_allocations(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  person_id uuid NOT NULL,
  occupancy_range tstzrange NOT NULL,
  state text NOT NULL,
  expires_at timestamptz,
  request_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,request_key),
  CHECK (state IN ('reserved','offered','contracted','occupied','completed','cancelled','expired')),
  CHECK (NOT isempty(occupancy_range) AND NOT lower_inf(occupancy_range) AND NOT upper_inf(occupancy_range) AND lower_inc(occupancy_range) AND NOT upper_inc(occupancy_range)),
  CHECK (state <> 'reserved' OR expires_at IS NOT NULL)
);

-- housing
CREATE TABLE housing_assignments(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL,
  application_id uuid,
  assigned_by uuid NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,allocation_id)
);

-- housing
CREATE TABLE housing_contracts(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  template_version_id uuid NOT NULL,
  document_id uuid NOT NULL,
  signature_reference text,
  status text NOT NULL,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_inspections(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  inspector_id uuid NOT NULL,
  inspection_type text NOT NULL,
  status text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_inspection_items(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL,
  item_code text NOT NULL,
  condition_code text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_inspection_evidence(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  inspection_item_id uuid NOT NULL,
  document_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_work_orders(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  assigned_team_reference text,
  category text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  entry_permission text NOT NULL,
  reported_at timestamptz NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_extension_requests(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  decided_by uuid,
  requested_until timestamptz NOT NULL,
  approved_until timestamptz,
  status text NOT NULL,
  reason_code text NOT NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_deadline_evaluations(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  policy_version_id uuid NOT NULL,
  extension_request_id uuid,
  official_deadline timestamptz,
  input_references jsonb NOT NULL,
  reason_codes text[] NOT NULL,
  evaluation_status text NOT NULL,
  evaluated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_checkout_events(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  scheduled_at timestamptz,
  completed_at timestamptz,
  keys_returned_at timestamptz,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_assessments(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  inspection_item_id uuid,
  billing_charge_id uuid,
  reason_code text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- housing
CREATE TABLE housing_assessment_appeals(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  decided_by uuid,
  reason text NOT NULL,
  status text NOT NULL,
  submitted_at timestamptz NOT NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE dining_plan_versions(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL,
  rules_version_id uuid NOT NULL,
  plan_code text NOT NULL,
  version_number integer NOT NULL,
  name text NOT NULL,
  price_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,plan_code,version_number),
  CHECK (price_minor >= 0),
  CHECK (currency ~ '^[A-Z]{3}$')
);

-- dining
CREATE TABLE dining_eligibility_rules(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL,
  definition jsonb NOT NULL,
  effective_from date NOT NULL,
  effective_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE dining_plan_enrollments(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  plan_version_id uuid NOT NULL,
  source_connection_id uuid,
  external_id text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (ends_on >= starts_on)
);

-- dining
CREATE TABLE dining_plan_change_requests(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  requested_plan_version_id uuid NOT NULL,
  decided_by uuid,
  requested_effective_on date NOT NULL,
  status text NOT NULL,
  submitted_at timestamptz NOT NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE dining_entitlement_types(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  unit text NOT NULL,
  usage_rules jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,code)
);

-- dining
CREATE TABLE dining_plan_benefits(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL,
  entitlement_type_id uuid NOT NULL,
  grant_quantity integer NOT NULL,
  reset_rule jsonb NOT NULL,
  rollover_rule jsonb NOT NULL,
  expiration_rule jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (grant_quantity >= 0)
);

-- dining
CREATE TABLE dining_entitlement_periods(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_enrollment_id uuid NOT NULL,
  entitlement_type_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (ends_at > starts_at),
  UNIQUE (tenant_id,plan_enrollment_id,entitlement_type_id,starts_at)
);

-- dining
CREATE TABLE campus_wallet_types(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  usage_rules jsonb NOT NULL,
  refund_rules jsonb NOT NULL,
  expiration_rules jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,code)
);

-- dining
CREATE TABLE campus_wallets(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  wallet_type_id uuid NOT NULL,
  authority_connection_id uuid,
  currency text NOT NULL,
  external_account_id text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (currency ~ '^[A-Z]{3}$')
);

-- dining
CREATE TABLE dining_locations(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campus_id uuid NOT NULL,
  name text NOT NULL,
  place_reference text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE dining_location_acceptance(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  wallet_type_id uuid,
  entitlement_type_id uuid,
  policy_version_id uuid NOT NULL,
  effective_from date NOT NULL,
  effective_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK (num_nonnulls(wallet_type_id,entitlement_type_id)=1)
);

-- dining
CREATE TABLE dining_hours(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  service_date date NOT NULL,
  opens_at timestamptz,
  closes_at timestamptz,
  closure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE menus(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  service_date date NOT NULL,
  service_period text NOT NULL,
  version_number integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,location_id,service_date,service_period,version_number)
);

-- dining
CREATE TABLE menu_items(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  ingredient_source text,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE menu_item_attributes(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL,
  attribute_code text NOT NULL,
  verification_status text NOT NULL,
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE menu_entries(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL,
  menu_item_id uuid NOT NULL,
  station_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE dining_transactions(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  location_id uuid,
  source_connection_id uuid,
  external_transaction_id text,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,source_connection_id,external_transaction_id)
);

-- dining
CREATE TABLE dining_transaction_lines(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  wallet_id uuid,
  entitlement_period_id uuid,
  amount_minor bigint,
  quantity integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK ((wallet_id IS NOT NULL AND entitlement_period_id IS NULL AND amount_minor IS NOT NULL AND amount_minor > 0 AND quantity IS NULL) OR (wallet_id IS NULL AND entitlement_period_id IS NOT NULL AND quantity IS NOT NULL AND quantity > 0 AND amount_minor IS NULL))
);

-- dining
CREATE TABLE dining_disputes(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  person_id uuid NOT NULL,
  reason_code text NOT NULL,
  status text NOT NULL,
  submitted_at timestamptz NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id)
);

-- dining
CREATE TABLE dining_adjustment_requests(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid,
  entitlement_period_id uuid,
  dispute_id uuid,
  requested_by uuid NOT NULL,
  approved_by uuid,
  delta_minor bigint,
  delta_quantity integer,
  reason_code text NOT NULL,
  status text NOT NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK ((wallet_id IS NOT NULL AND entitlement_period_id IS NULL AND delta_minor IS NOT NULL AND delta_minor <> 0 AND delta_quantity IS NULL) OR (wallet_id IS NULL AND entitlement_period_id IS NOT NULL AND delta_quantity IS NOT NULL AND delta_quantity <> 0 AND delta_minor IS NULL)),
  CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

-- dining
CREATE TABLE dining_entitlement_entries(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL,
  transaction_line_id uuid,
  adjustment_request_id uuid,
  reverses_entry_id uuid,
  delta_quantity integer NOT NULL,
  entry_type text NOT NULL,
  idempotency_key text NOT NULL,
  posted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,idempotency_key),
  CHECK (delta_quantity <> 0)
);

-- dining
CREATE TABLE campus_wallet_entries(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL,
  transaction_line_id uuid,
  adjustment_request_id uuid,
  payment_order_id uuid,
  reverses_entry_id uuid,
  delta_minor bigint NOT NULL,
  entry_type text NOT NULL,
  idempotency_key text NOT NULL,
  posted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,idempotency_key),
  CHECK (delta_minor <> 0)
);

-- dining
CREATE TABLE dining_balance_snapshots(
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wallet_id uuid,
  entitlement_period_id uuid,
  source_connection_id uuid NOT NULL,
  money_balance_minor bigint,
  quantity_balance integer,
  source_version text,
  as_of timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id,id),
  CHECK ((wallet_id IS NOT NULL AND entitlement_period_id IS NULL AND money_balance_minor IS NOT NULL AND quantity_balance IS NULL) OR (wallet_id IS NULL AND entitlement_period_id IS NOT NULL AND quantity_balance IS NOT NULL AND money_balance_minor IS NULL))
);

ALTER TABLE documents ADD FOREIGN KEY(tenant_id,owner_person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON documents(tenant_id,owner_person_id);

ALTER TABLE billing_charges ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON billing_charges(tenant_id,person_id);

ALTER TABLE payment_orders ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON payment_orders(tenant_id,person_id);

ALTER TABLE housing_cycles ADD FOREIGN KEY(tenant_id,term_id) REFERENCES academic_terms(tenant_id,id);
CREATE INDEX ON housing_cycles(tenant_id,term_id);

ALTER TABLE housing_cycles ADD FOREIGN KEY(tenant_id,policy_version_id) REFERENCES policy_versions(tenant_id,id);
CREATE INDEX ON housing_cycles(tenant_id,policy_version_id);

ALTER TABLE housing_buildings ADD FOREIGN KEY(tenant_id,campus_id) REFERENCES campuses(tenant_id,id);
CREATE INDEX ON housing_buildings(tenant_id,campus_id);

ALTER TABLE housing_rooms ADD FOREIGN KEY(tenant_id,building_id) REFERENCES housing_buildings(tenant_id,id);
CREATE INDEX ON housing_rooms(tenant_id,building_id);

ALTER TABLE housing_beds ADD FOREIGN KEY(tenant_id,room_id) REFERENCES housing_rooms(tenant_id,id);
CREATE INDEX ON housing_beds(tenant_id,room_id);

ALTER TABLE housing_applications ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_applications(tenant_id,person_id);

ALTER TABLE housing_applications ADD FOREIGN KEY(tenant_id,cycle_id) REFERENCES housing_cycles(tenant_id,id);
CREATE INDEX ON housing_applications(tenant_id,cycle_id);

ALTER TABLE housing_preferences ADD FOREIGN KEY(tenant_id,application_id) REFERENCES housing_applications(tenant_id,id);
CREATE INDEX ON housing_preferences(tenant_id,application_id);

ALTER TABLE housing_eligibility_results ADD FOREIGN KEY(tenant_id,application_id) REFERENCES housing_applications(tenant_id,id);
CREATE INDEX ON housing_eligibility_results(tenant_id,application_id);

ALTER TABLE housing_eligibility_results ADD FOREIGN KEY(tenant_id,policy_version_id) REFERENCES policy_versions(tenant_id,id);
CREATE INDEX ON housing_eligibility_results(tenant_id,policy_version_id);

ALTER TABLE housing_placement_instructions ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_placement_instructions(tenant_id,person_id);

ALTER TABLE housing_placement_instructions ADD FOREIGN KEY(tenant_id,cycle_id) REFERENCES housing_cycles(tenant_id,id);
CREATE INDEX ON housing_placement_instructions(tenant_id,cycle_id);

ALTER TABLE roommate_groups ADD FOREIGN KEY(tenant_id,cycle_id) REFERENCES housing_cycles(tenant_id,id);
CREATE INDEX ON roommate_groups(tenant_id,cycle_id);

ALTER TABLE roommate_groups ADD FOREIGN KEY(tenant_id,owner_person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON roommate_groups(tenant_id,owner_person_id);

ALTER TABLE roommate_group_members ADD FOREIGN KEY(tenant_id,group_id) REFERENCES roommate_groups(tenant_id,id);
CREATE INDEX ON roommate_group_members(tenant_id,group_id);

ALTER TABLE roommate_group_members ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON roommate_group_members(tenant_id,person_id);

ALTER TABLE housing_selection_windows ADD FOREIGN KEY(tenant_id,cycle_id) REFERENCES housing_cycles(tenant_id,id);
CREATE INDEX ON housing_selection_windows(tenant_id,cycle_id);

ALTER TABLE housing_selection_windows ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_selection_windows(tenant_id,person_id);

ALTER TABLE housing_selection_windows ADD FOREIGN KEY(tenant_id,group_id) REFERENCES roommate_groups(tenant_id,id);
CREATE INDEX ON housing_selection_windows(tenant_id,group_id);

ALTER TABLE housing_allocations ADD FOREIGN KEY(tenant_id,cycle_id) REFERENCES housing_cycles(tenant_id,id);
CREATE INDEX ON housing_allocations(tenant_id,cycle_id);

ALTER TABLE housing_allocations ADD FOREIGN KEY(tenant_id,bed_id) REFERENCES housing_beds(tenant_id,id);
CREATE INDEX ON housing_allocations(tenant_id,bed_id);

ALTER TABLE housing_allocations ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_allocations(tenant_id,person_id);

ALTER TABLE housing_assignments ADD FOREIGN KEY(tenant_id,allocation_id) REFERENCES housing_allocations(tenant_id,id);
CREATE INDEX ON housing_assignments(tenant_id,allocation_id);

ALTER TABLE housing_assignments ADD FOREIGN KEY(tenant_id,application_id) REFERENCES housing_applications(tenant_id,id);
CREATE INDEX ON housing_assignments(tenant_id,application_id);

ALTER TABLE housing_assignments ADD FOREIGN KEY(tenant_id,assigned_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_assignments(tenant_id,assigned_by);

ALTER TABLE housing_contracts ADD FOREIGN KEY(tenant_id,assignment_id) REFERENCES housing_assignments(tenant_id,id);
CREATE INDEX ON housing_contracts(tenant_id,assignment_id);

ALTER TABLE housing_contracts ADD FOREIGN KEY(tenant_id,template_version_id) REFERENCES policy_versions(tenant_id,id);
CREATE INDEX ON housing_contracts(tenant_id,template_version_id);

ALTER TABLE housing_contracts ADD FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id);
CREATE INDEX ON housing_contracts(tenant_id,document_id);

ALTER TABLE housing_inspections ADD FOREIGN KEY(tenant_id,assignment_id) REFERENCES housing_assignments(tenant_id,id);
CREATE INDEX ON housing_inspections(tenant_id,assignment_id);

ALTER TABLE housing_inspections ADD FOREIGN KEY(tenant_id,inspector_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_inspections(tenant_id,inspector_id);

ALTER TABLE housing_inspection_items ADD FOREIGN KEY(tenant_id,inspection_id) REFERENCES housing_inspections(tenant_id,id);
CREATE INDEX ON housing_inspection_items(tenant_id,inspection_id);

ALTER TABLE housing_inspection_evidence ADD FOREIGN KEY(tenant_id,inspection_item_id) REFERENCES housing_inspection_items(tenant_id,id);
CREATE INDEX ON housing_inspection_evidence(tenant_id,inspection_item_id);

ALTER TABLE housing_inspection_evidence ADD FOREIGN KEY(tenant_id,document_id) REFERENCES documents(tenant_id,id);
CREATE INDEX ON housing_inspection_evidence(tenant_id,document_id);

ALTER TABLE housing_work_orders ADD FOREIGN KEY(tenant_id,room_id) REFERENCES housing_rooms(tenant_id,id);
CREATE INDEX ON housing_work_orders(tenant_id,room_id);

ALTER TABLE housing_work_orders ADD FOREIGN KEY(tenant_id,reported_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_work_orders(tenant_id,reported_by);

ALTER TABLE housing_extension_requests ADD FOREIGN KEY(tenant_id,assignment_id) REFERENCES housing_assignments(tenant_id,id);
CREATE INDEX ON housing_extension_requests(tenant_id,assignment_id);

ALTER TABLE housing_extension_requests ADD FOREIGN KEY(tenant_id,decided_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_extension_requests(tenant_id,decided_by);

ALTER TABLE housing_deadline_evaluations ADD FOREIGN KEY(tenant_id,assignment_id) REFERENCES housing_assignments(tenant_id,id);
CREATE INDEX ON housing_deadline_evaluations(tenant_id,assignment_id);

ALTER TABLE housing_deadline_evaluations ADD FOREIGN KEY(tenant_id,policy_version_id) REFERENCES policy_versions(tenant_id,id);
CREATE INDEX ON housing_deadline_evaluations(tenant_id,policy_version_id);

ALTER TABLE housing_deadline_evaluations ADD FOREIGN KEY(tenant_id,extension_request_id) REFERENCES housing_extension_requests(tenant_id,id);
CREATE INDEX ON housing_deadline_evaluations(tenant_id,extension_request_id);

ALTER TABLE housing_checkout_events ADD FOREIGN KEY(tenant_id,assignment_id) REFERENCES housing_assignments(tenant_id,id);
CREATE INDEX ON housing_checkout_events(tenant_id,assignment_id);

ALTER TABLE housing_assessments ADD FOREIGN KEY(tenant_id,assignment_id) REFERENCES housing_assignments(tenant_id,id);
CREATE INDEX ON housing_assessments(tenant_id,assignment_id);

ALTER TABLE housing_assessments ADD FOREIGN KEY(tenant_id,inspection_item_id) REFERENCES housing_inspection_items(tenant_id,id);
CREATE INDEX ON housing_assessments(tenant_id,inspection_item_id);

ALTER TABLE housing_assessments ADD FOREIGN KEY(tenant_id,billing_charge_id) REFERENCES billing_charges(tenant_id,id);
CREATE INDEX ON housing_assessments(tenant_id,billing_charge_id);

ALTER TABLE housing_assessment_appeals ADD FOREIGN KEY(tenant_id,assessment_id) REFERENCES housing_assessments(tenant_id,id);
CREATE INDEX ON housing_assessment_appeals(tenant_id,assessment_id);

ALTER TABLE housing_assessment_appeals ADD FOREIGN KEY(tenant_id,submitted_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_assessment_appeals(tenant_id,submitted_by);

ALTER TABLE housing_assessment_appeals ADD FOREIGN KEY(tenant_id,decided_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON housing_assessment_appeals(tenant_id,decided_by);

ALTER TABLE dining_plan_versions ADD FOREIGN KEY(tenant_id,term_id) REFERENCES academic_terms(tenant_id,id);
CREATE INDEX ON dining_plan_versions(tenant_id,term_id);

ALTER TABLE dining_plan_versions ADD FOREIGN KEY(tenant_id,rules_version_id) REFERENCES policy_versions(tenant_id,id);
CREATE INDEX ON dining_plan_versions(tenant_id,rules_version_id);

ALTER TABLE dining_eligibility_rules ADD FOREIGN KEY(tenant_id,plan_version_id) REFERENCES dining_plan_versions(tenant_id,id);
CREATE INDEX ON dining_eligibility_rules(tenant_id,plan_version_id);

ALTER TABLE dining_plan_enrollments ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON dining_plan_enrollments(tenant_id,person_id);

ALTER TABLE dining_plan_enrollments ADD FOREIGN KEY(tenant_id,plan_version_id) REFERENCES dining_plan_versions(tenant_id,id);
CREATE INDEX ON dining_plan_enrollments(tenant_id,plan_version_id);

ALTER TABLE dining_plan_enrollments ADD FOREIGN KEY(tenant_id,source_connection_id) REFERENCES integration_connections(tenant_id,id);
CREATE INDEX ON dining_plan_enrollments(tenant_id,source_connection_id);

ALTER TABLE dining_plan_change_requests ADD FOREIGN KEY(tenant_id,enrollment_id) REFERENCES dining_plan_enrollments(tenant_id,id);
CREATE INDEX ON dining_plan_change_requests(tenant_id,enrollment_id);

ALTER TABLE dining_plan_change_requests ADD FOREIGN KEY(tenant_id,requested_plan_version_id) REFERENCES dining_plan_versions(tenant_id,id);
CREATE INDEX ON dining_plan_change_requests(tenant_id,requested_plan_version_id);

ALTER TABLE dining_plan_change_requests ADD FOREIGN KEY(tenant_id,decided_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON dining_plan_change_requests(tenant_id,decided_by);

ALTER TABLE dining_plan_benefits ADD FOREIGN KEY(tenant_id,plan_version_id) REFERENCES dining_plan_versions(tenant_id,id);
CREATE INDEX ON dining_plan_benefits(tenant_id,plan_version_id);

ALTER TABLE dining_plan_benefits ADD FOREIGN KEY(tenant_id,entitlement_type_id) REFERENCES dining_entitlement_types(tenant_id,id);
CREATE INDEX ON dining_plan_benefits(tenant_id,entitlement_type_id);

ALTER TABLE dining_entitlement_periods ADD FOREIGN KEY(tenant_id,plan_enrollment_id) REFERENCES dining_plan_enrollments(tenant_id,id);
CREATE INDEX ON dining_entitlement_periods(tenant_id,plan_enrollment_id);

ALTER TABLE dining_entitlement_periods ADD FOREIGN KEY(tenant_id,entitlement_type_id) REFERENCES dining_entitlement_types(tenant_id,id);
CREATE INDEX ON dining_entitlement_periods(tenant_id,entitlement_type_id);

ALTER TABLE campus_wallets ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON campus_wallets(tenant_id,person_id);

ALTER TABLE campus_wallets ADD FOREIGN KEY(tenant_id,wallet_type_id) REFERENCES campus_wallet_types(tenant_id,id);
CREATE INDEX ON campus_wallets(tenant_id,wallet_type_id);

ALTER TABLE campus_wallets ADD FOREIGN KEY(tenant_id,authority_connection_id) REFERENCES integration_connections(tenant_id,id);
CREATE INDEX ON campus_wallets(tenant_id,authority_connection_id);

ALTER TABLE dining_locations ADD FOREIGN KEY(tenant_id,campus_id) REFERENCES campuses(tenant_id,id);
CREATE INDEX ON dining_locations(tenant_id,campus_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY(tenant_id,location_id) REFERENCES dining_locations(tenant_id,id);
CREATE INDEX ON dining_location_acceptance(tenant_id,location_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY(tenant_id,wallet_type_id) REFERENCES campus_wallet_types(tenant_id,id);
CREATE INDEX ON dining_location_acceptance(tenant_id,wallet_type_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY(tenant_id,entitlement_type_id) REFERENCES dining_entitlement_types(tenant_id,id);
CREATE INDEX ON dining_location_acceptance(tenant_id,entitlement_type_id);

ALTER TABLE dining_location_acceptance ADD FOREIGN KEY(tenant_id,policy_version_id) REFERENCES policy_versions(tenant_id,id);
CREATE INDEX ON dining_location_acceptance(tenant_id,policy_version_id);

ALTER TABLE dining_hours ADD FOREIGN KEY(tenant_id,location_id) REFERENCES dining_locations(tenant_id,id);
CREATE INDEX ON dining_hours(tenant_id,location_id);

ALTER TABLE menus ADD FOREIGN KEY(tenant_id,location_id) REFERENCES dining_locations(tenant_id,id);
CREATE INDEX ON menus(tenant_id,location_id);

ALTER TABLE menu_item_attributes ADD FOREIGN KEY(tenant_id,menu_item_id) REFERENCES menu_items(tenant_id,id);
CREATE INDEX ON menu_item_attributes(tenant_id,menu_item_id);

ALTER TABLE menu_entries ADD FOREIGN KEY(tenant_id,menu_id) REFERENCES menus(tenant_id,id);
CREATE INDEX ON menu_entries(tenant_id,menu_id);

ALTER TABLE menu_entries ADD FOREIGN KEY(tenant_id,menu_item_id) REFERENCES menu_items(tenant_id,id);
CREATE INDEX ON menu_entries(tenant_id,menu_item_id);

ALTER TABLE dining_transactions ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON dining_transactions(tenant_id,person_id);

ALTER TABLE dining_transactions ADD FOREIGN KEY(tenant_id,location_id) REFERENCES dining_locations(tenant_id,id);
CREATE INDEX ON dining_transactions(tenant_id,location_id);

ALTER TABLE dining_transactions ADD FOREIGN KEY(tenant_id,source_connection_id) REFERENCES integration_connections(tenant_id,id);
CREATE INDEX ON dining_transactions(tenant_id,source_connection_id);

ALTER TABLE dining_transaction_lines ADD FOREIGN KEY(tenant_id,transaction_id) REFERENCES dining_transactions(tenant_id,id);
CREATE INDEX ON dining_transaction_lines(tenant_id,transaction_id);

ALTER TABLE dining_transaction_lines ADD FOREIGN KEY(tenant_id,wallet_id) REFERENCES campus_wallets(tenant_id,id);
CREATE INDEX ON dining_transaction_lines(tenant_id,wallet_id);

ALTER TABLE dining_transaction_lines ADD FOREIGN KEY(tenant_id,entitlement_period_id) REFERENCES dining_entitlement_periods(tenant_id,id);
CREATE INDEX ON dining_transaction_lines(tenant_id,entitlement_period_id);

ALTER TABLE dining_disputes ADD FOREIGN KEY(tenant_id,transaction_id) REFERENCES dining_transactions(tenant_id,id);
CREATE INDEX ON dining_disputes(tenant_id,transaction_id);

ALTER TABLE dining_disputes ADD FOREIGN KEY(tenant_id,person_id) REFERENCES people(tenant_id,id);
CREATE INDEX ON dining_disputes(tenant_id,person_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY(tenant_id,wallet_id) REFERENCES campus_wallets(tenant_id,id);
CREATE INDEX ON dining_adjustment_requests(tenant_id,wallet_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY(tenant_id,entitlement_period_id) REFERENCES dining_entitlement_periods(tenant_id,id);
CREATE INDEX ON dining_adjustment_requests(tenant_id,entitlement_period_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY(tenant_id,dispute_id) REFERENCES dining_disputes(tenant_id,id);
CREATE INDEX ON dining_adjustment_requests(tenant_id,dispute_id);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY(tenant_id,requested_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON dining_adjustment_requests(tenant_id,requested_by);

ALTER TABLE dining_adjustment_requests ADD FOREIGN KEY(tenant_id,approved_by) REFERENCES people(tenant_id,id);
CREATE INDEX ON dining_adjustment_requests(tenant_id,approved_by);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY(tenant_id,period_id) REFERENCES dining_entitlement_periods(tenant_id,id);
CREATE INDEX ON dining_entitlement_entries(tenant_id,period_id);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY(tenant_id,transaction_line_id) REFERENCES dining_transaction_lines(tenant_id,id);
CREATE INDEX ON dining_entitlement_entries(tenant_id,transaction_line_id);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY(tenant_id,adjustment_request_id) REFERENCES dining_adjustment_requests(tenant_id,id);
CREATE INDEX ON dining_entitlement_entries(tenant_id,adjustment_request_id);

ALTER TABLE dining_entitlement_entries ADD FOREIGN KEY(tenant_id,reverses_entry_id) REFERENCES dining_entitlement_entries(tenant_id,id);
CREATE INDEX ON dining_entitlement_entries(tenant_id,reverses_entry_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY(tenant_id,wallet_id) REFERENCES campus_wallets(tenant_id,id);
CREATE INDEX ON campus_wallet_entries(tenant_id,wallet_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY(tenant_id,transaction_line_id) REFERENCES dining_transaction_lines(tenant_id,id);
CREATE INDEX ON campus_wallet_entries(tenant_id,transaction_line_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY(tenant_id,adjustment_request_id) REFERENCES dining_adjustment_requests(tenant_id,id);
CREATE INDEX ON campus_wallet_entries(tenant_id,adjustment_request_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY(tenant_id,payment_order_id) REFERENCES payment_orders(tenant_id,id);
CREATE INDEX ON campus_wallet_entries(tenant_id,payment_order_id);

ALTER TABLE campus_wallet_entries ADD FOREIGN KEY(tenant_id,reverses_entry_id) REFERENCES campus_wallet_entries(tenant_id,id);
CREATE INDEX ON campus_wallet_entries(tenant_id,reverses_entry_id);

ALTER TABLE dining_balance_snapshots ADD FOREIGN KEY(tenant_id,wallet_id) REFERENCES campus_wallets(tenant_id,id);
CREATE INDEX ON dining_balance_snapshots(tenant_id,wallet_id);

ALTER TABLE dining_balance_snapshots ADD FOREIGN KEY(tenant_id,entitlement_period_id) REFERENCES dining_entitlement_periods(tenant_id,id);
CREATE INDEX ON dining_balance_snapshots(tenant_id,entitlement_period_id);

ALTER TABLE dining_balance_snapshots ADD FOREIGN KEY(tenant_id,source_connection_id) REFERENCES integration_connections(tenant_id,id);
CREATE INDEX ON dining_balance_snapshots(tenant_id,source_connection_id);

ALTER TABLE housing_allocations ADD CONSTRAINT housing_bed_overlap EXCLUDE USING gist(tenant_id WITH =,bed_id WITH =,occupancy_range WITH &&) WHERE(state IN ('reserved','offered','contracted','occupied'));
ALTER TABLE housing_allocations ADD CONSTRAINT housing_person_overlap EXCLUDE USING gist(tenant_id WITH =,person_id WITH =,occupancy_range WITH &&) WHERE(state IN ('reserved','offered','contracted','occupied'));
CREATE INDEX ON housing_allocations(expires_at) WHERE state='reserved';
CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'Append-only record: %',TG_TABLE_NAME; END; $$;
CREATE FUNCTION maintain_record_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN NEW.updated_at:=clock_timestamp(); NEW.version:=OLD.version+1; RETURN NEW; END; $$;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE people FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON campuses FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE campuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE campuses FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON academic_terms FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON policy_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON integration_connections FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON billing_charges FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE billing_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_charges FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON payment_orders FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_cycles FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_cycles FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_buildings FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_buildings FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_rooms FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_rooms FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_beds FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_beds FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_applications FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_applications FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_preferences FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_preferences FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_eligibility_results FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_eligibility_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_eligibility_results FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_placement_instructions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_placement_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_placement_instructions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON roommate_groups FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE roommate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_groups FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON roommate_group_members FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE roommate_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommate_group_members FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_selection_windows FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_selection_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_selection_windows FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_allocations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_allocations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_assignments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_assignments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_contracts FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_contracts FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_inspections FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_inspections FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_inspection_items FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_inspection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_inspection_items FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_inspection_evidence FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_inspection_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_inspection_evidence FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_work_orders FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_work_orders FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_extension_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_extension_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON housing_deadline_evaluations FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE housing_deadline_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_deadline_evaluations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_checkout_events FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_checkout_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_checkout_events FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_assessments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_assessments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON housing_assessment_appeals FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE housing_assessment_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE housing_assessment_appeals FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_versions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_versions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_eligibility_rules FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_eligibility_rules FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_enrollments FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_enrollments FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_change_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_change_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_entitlement_types FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_entitlement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_entitlement_types FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_plan_benefits FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_plan_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_plan_benefits FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_entitlement_periods FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_entitlement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_entitlement_periods FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON campus_wallet_types FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE campus_wallet_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_wallet_types FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON campus_wallets FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE campus_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_wallets FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_locations FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_locations FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_location_acceptance FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_location_acceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_location_acceptance FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_hours FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_hours FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menu_item_attributes FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menu_item_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_attributes FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON menu_entries FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE menu_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_transactions FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_transactions FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_transaction_lines FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_transaction_lines FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_disputes FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_disputes FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_adjustment_requests FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_adjustment_requests FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON dining_entitlement_entries FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE dining_entitlement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_entitlement_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER reject_history_mutation BEFORE UPDATE OR DELETE ON campus_wallet_entries FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

ALTER TABLE campus_wallet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE campus_wallet_entries FORCE ROW LEVEL SECURITY;

CREATE TRIGGER maintain_record_version BEFORE UPDATE ON dining_balance_snapshots FOR EACH ROW EXECUTE FUNCTION maintain_record_version();

ALTER TABLE dining_balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_balance_snapshots FORCE ROW LEVEL SECURITY;

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA semester FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA semester FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA semester FROM PUBLIC;
COMMIT;