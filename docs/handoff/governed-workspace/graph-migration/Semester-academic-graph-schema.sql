-- Proposed Semester schema slice; NOT executed. Requires the shared workspace foundation.
-- Existing proposed nodes/facts/scopes/terms use composite keys (tenant_id,id).
-- Reconcile with actual repository definitions before implementing; do not create a parallel graph.
CREATE TABLE semester_workspace.courses (
 tenant_id uuid NOT NULL, node_id uuid NOT NULL, issuer_course_key text NOT NULL,
 catalog_version text NOT NULL, title_fact_id uuid NOT NULL,
 PRIMARY KEY(tenant_id,node_id), UNIQUE(tenant_id,issuer_course_key,catalog_version),
 FOREIGN KEY(tenant_id,node_id) REFERENCES semester_workspace.nodes(tenant_id,id),
 FOREIGN KEY(tenant_id,title_fact_id) REFERENCES semester_workspace.facts(tenant_id,id)
);
CREATE TABLE semester_workspace.sections (
 tenant_id uuid NOT NULL,node_id uuid NOT NULL,course_id uuid NOT NULL,term_id uuid NOT NULL,
 source_section_key text NOT NULL,PRIMARY KEY(tenant_id,node_id),
 FOREIGN KEY(tenant_id,node_id) REFERENCES semester_workspace.nodes(tenant_id,id),
 FOREIGN KEY(tenant_id,course_id) REFERENCES semester_workspace.courses(tenant_id,node_id),
 FOREIGN KEY(tenant_id,term_id) REFERENCES semester_workspace.terms(tenant_id,id)
);
CREATE TABLE semester_workspace.prerequisite_rules (
 tenant_id uuid NOT NULL,id uuid NOT NULL,target_course_id uuid NOT NULL,
 version text NOT NULL,source_fact_id uuid NOT NULL,catalog_version text NOT NULL,
 effective_from timestamptz NOT NULL,effective_until timestamptz,
 status text NOT NULL CHECK(status IN ('candidate','approved','superseded','revoked')),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,target_course_id,version),
 FOREIGN KEY(tenant_id,target_course_id) REFERENCES semester_workspace.courses(tenant_id,node_id),
 FOREIGN KEY(tenant_id,source_fact_id) REFERENCES semester_workspace.facts(tenant_id,id),
 CHECK(effective_until IS NULL OR effective_until>effective_from)
);
CREATE TABLE semester_workspace.prerequisite_expressions (
 tenant_id uuid NOT NULL,rule_id uuid NOT NULL,id uuid NOT NULL,parent_id uuid,
 position integer NOT NULL CHECK(position>=0),
 operator text NOT NULL CHECK(operator IN ('all','any','course_completed','placement_met','permission_granted','credits_met')),
 required_course_id uuid,timing text CHECK(timing IN ('before_start','concurrent_allowed')),
 grade_policy_id text,threshold_policy_id text,
 PRIMARY KEY(tenant_id,rule_id,id),
 FOREIGN KEY(tenant_id,rule_id) REFERENCES semester_workspace.prerequisite_rules(tenant_id,id),
 FOREIGN KEY(tenant_id,rule_id,parent_id) REFERENCES semester_workspace.prerequisite_expressions(tenant_id,rule_id,id),
 FOREIGN KEY(tenant_id,required_course_id) REFERENCES semester_workspace.courses(tenant_id,node_id),
 CHECK(parent_id IS NULL OR parent_id<>id),
 CHECK((operator='course_completed' AND required_course_id IS NOT NULL AND timing IS NOT NULL) OR (operator<>'course_completed' AND required_course_id IS NULL))
);
CREATE UNIQUE INDEX one_root_per_rule ON semester_workspace.prerequisite_expressions(tenant_id,rule_id) WHERE parent_id IS NULL;
CREATE TABLE semester_workspace.resources (
 tenant_id uuid NOT NULL,node_id uuid NOT NULL,kind text NOT NULL,
 content_locator text NOT NULL,source_fact_id uuid NOT NULL,rights_policy_id text NOT NULL,
 access_mode text NOT NULL CHECK(access_mode IN ('owned_copy','linked','licensed_reference')),
 PRIMARY KEY(tenant_id,node_id),
 FOREIGN KEY(tenant_id,node_id) REFERENCES semester_workspace.nodes(tenant_id,id),
 FOREIGN KEY(tenant_id,source_fact_id) REFERENCES semester_workspace.facts(tenant_id,id)
);
-- Apply ENABLE and FORCE RLS to every new table and revoke client privileges pending review.
-- No application policies, auth bindings or grants supplied: this is NOT executable in isolation.
-- Required semantic checks: tree root existence/acyclicity/arity; typed nodes/edges;
-- effective-version selection; grade policy normalization; source authority/freshness;
-- scope non-expansion; immutable history; per-table CI and service-role controls.
