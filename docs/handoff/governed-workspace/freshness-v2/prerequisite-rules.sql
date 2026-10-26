-- Proposed schema extension to the shared governed workspace; NOT executed.
-- Requires existing reviewed courses(tenant_id,node_id), facts(tenant_id,id).
CREATE TABLE semester_workspace.prerequisite_rules (
 tenant_id uuid NOT NULL, id uuid NOT NULL, target_course_id uuid NOT NULL,
 rule_version text NOT NULL, catalog_version text NOT NULL, source_fact_id uuid NOT NULL,
 effective_from timestamptz NOT NULL, effective_until timestamptz,
 approval_state text NOT NULL CHECK(approval_state IN ('candidate','approved','superseded','revoked')),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,target_course_id,rule_version),
 FOREIGN KEY(tenant_id,target_course_id) REFERENCES semester_workspace.courses(tenant_id,node_id),
 FOREIGN KEY(tenant_id,source_fact_id) REFERENCES semester_workspace.facts(tenant_id,id),
 CHECK(effective_until IS NULL OR effective_until > effective_from)
);
CREATE TABLE semester_workspace.prerequisite_expressions (
 tenant_id uuid NOT NULL, rule_id uuid NOT NULL,id uuid NOT NULL,parent_id uuid,
 ordinal integer NOT NULL CHECK(ordinal>=0),
 operator text NOT NULL CHECK(operator IN ('all','any','course_completed','placement_met','permission_granted','credits_met')),
 course_id uuid, timing text CHECK(timing IN ('before_start','concurrent_allowed')),
 grade_policy_id text,threshold_policy_id text,
 PRIMARY KEY(tenant_id,rule_id,id),
 FOREIGN KEY(tenant_id,rule_id) REFERENCES semester_workspace.prerequisite_rules(tenant_id,id),
 FOREIGN KEY(tenant_id,rule_id,parent_id) REFERENCES semester_workspace.prerequisite_expressions(tenant_id,rule_id,id),
 FOREIGN KEY(tenant_id,course_id) REFERENCES semester_workspace.courses(tenant_id,node_id),
 CHECK(parent_id IS NULL OR parent_id<>id),
 CHECK((operator='course_completed' AND course_id IS NOT NULL AND timing IS NOT NULL) OR (operator<>'course_completed' AND course_id IS NULL))
);
CREATE UNIQUE INDEX prerequisite_root_unique ON semester_workspace.prerequisite_expressions(tenant_id,rule_id) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX prerequisite_sibling_position ON semester_workspace.prerequisite_expressions(tenant_id,rule_id,parent_id,ordinal) WHERE parent_id IS NOT NULL;
ALTER TABLE semester_workspace.prerequisite_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_workspace.prerequisite_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE semester_workspace.prerequisite_expressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_workspace.prerequisite_expressions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON semester_workspace.prerequisite_rules, semester_workspace.prerequisite_expressions FROM PUBLIC;
-- No application policies supplied. RLS does not constrain BYPASSRLS/service credentials.
-- Before approval, verify exactly one root, connected acyclic tree, >=2 children for group
-- nodes (or explicitly allow unary groups), zero children for leaves, required threshold/grade
-- policies, catalog/effective-version applicability and authoritative source approval.
-- At most one root is enforced above; root existence/long cycles require semantic checks.
-- Keep evidence/evaluations private and versioned; never transmit education records to AI.
