-- 025_business_os.sql: campus Business OS (budgets, budget lines, resource allocations, variance alerts). Schema semester, after 024.
-- NOT executed or parsed. Money in integer minor units; aggregates only, never student-level finance.
BEGIN;
SET LOCAL search_path = semester, public;
CREATE TABLE budgets (tenant_id uuid NOT NULL REFERENCES institutions(id), id uuid NOT NULL DEFAULT gen_random_uuid(), org_reference text NOT NULL, fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
  version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'closed')), currency text NOT NULL DEFAULT 'USD',
  submitted_by uuid, approved_by uuid, approved_at timestamptz, PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, org_reference, fiscal_year, version),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_by IS DISTINCT FROM submitted_by)));
CREATE TABLE budget_lines (tenant_id uuid NOT NULL, budget_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), category text NOT NULL, subcategory text,
  planned_minor bigint NOT NULL CHECK (planned_minor >= 0), actual_minor bigint NOT NULL DEFAULT 0, variance_threshold_pct numeric(5,2) NOT NULL DEFAULT 10,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, budget_id) REFERENCES budgets(tenant_id, id));
CREATE TABLE resource_allocations (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), budget_line_id uuid NOT NULL,
  allocation_type text NOT NULL CHECK (allocation_type IN ('staffing', 'teaching_assistants', 'technology', 'facilities', 'scholarship', 'programming')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0), justification text NOT NULL, requested_by uuid NOT NULL, approved_by uuid, status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected')),
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, budget_line_id) REFERENCES budget_lines(tenant_id, id), CHECK (approved_by IS NULL OR approved_by <> requested_by));
-- Variance alert: when actual drifts past the line's threshold, write one outbox event (finance.variance.alert) for a business-officer task.
CREATE FUNCTION semester.check_budget_variance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.planned_minor > 0 AND abs(NEW.actual_minor - NEW.planned_minor) * 100.0 / NEW.planned_minor > NEW.variance_threshold_pct
     AND (OLD IS NULL OR abs(OLD.actual_minor - OLD.planned_minor) * 100.0 / NULLIF(OLD.planned_minor, 0) <= OLD.variance_threshold_pct) THEN
    INSERT INTO semester.outbox_events(tenant_id, event_type, payload) VALUES (NEW.tenant_id, 'finance.variance.alert', jsonb_build_object('budget_line', NEW.id, 'planned', NEW.planned_minor, 'actual', NEW.actual_minor));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER budget_variance AFTER INSERT OR UPDATE OF actual_minor ON budget_lines FOR EACH ROW EXECUTE FUNCTION semester.check_budget_variance();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['budgets', 'budget_lines', 'resource_allocations'] LOOP
    EXECUTE format('ALTER TABLE semester.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE semester.%I FORCE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON semester.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;
GRANT SELECT ON semester.budgets, semester.budget_lines TO authenticated;
CREATE POLICY org_scope ON semester.budgets FOR SELECT TO authenticated USING (semester.has_permission(tenant_id, 'budget.view_org', 'organization', org_reference));
CREATE POLICY org_scope ON semester.budget_lines FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.budgets b WHERE b.tenant_id = budget_lines.tenant_id AND b.id = budget_lines.budget_id AND semester.has_permission(b.tenant_id, 'budget.view_org', 'organization', b.org_reference)));
COMMIT;
