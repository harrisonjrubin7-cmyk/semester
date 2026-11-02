-- Semester proposed PostgreSQL schema, design draft 2026-10-08.
-- Not an existing migration or deployment. Production policies, append-only controls,
-- semantic triggers, encryption, auth mapping and execution code require implementation/review.
-- RLS is enabled/forced without application policies: unprivileged access defaults to deny.
CREATE SCHEMA semester_workspace;
CREATE TABLE semester_workspace.tenants (
 id uuid PRIMARY KEY, tenant_kind text NOT NULL CHECK (tenant_kind IN ('personal','institution')),
 name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE semester_workspace.principals (
 id uuid PRIMARY KEY, principal_kind text NOT NULL CHECK (principal_kind IN ('person','application','service'))
);
CREATE TABLE semester_workspace.memberships (
 tenant_id uuid NOT NULL REFERENCES semester_workspace.tenants(id), principal_id uuid NOT NULL REFERENCES semester_workspace.principals(id),
 role_code text NOT NULL, policy_version text NOT NULL, expires_at timestamptz, revoked_at timestamptz,
 PRIMARY KEY (tenant_id,principal_id,role_code)
);
CREATE TABLE semester_workspace.access_scopes (
 tenant_id uuid NOT NULL REFERENCES semester_workspace.tenants(id), id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES semester_workspace.principals(id), scope_kind text NOT NULL CHECK(scope_kind IN ('private','course','institution','explicit_grant','public')),
 policy_id text NOT NULL, policy_version text NOT NULL, retention_policy_id text NOT NULL,
 PRIMARY KEY(tenant_id,id)
);
CREATE TABLE semester_workspace.nodes (
 tenant_id uuid NOT NULL, id uuid NOT NULL, kind text NOT NULL, scope_id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES semester_workspace.principals(id), created_at timestamptz NOT NULL DEFAULT now(), tombstoned_at timestamptz,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,scope_id) REFERENCES semester_workspace.access_scopes(tenant_id,id)
);
CREATE TABLE semester_workspace.source_bindings (
 tenant_id uuid NOT NULL, id uuid NOT NULL, source_system text NOT NULL, issuer_id text NOT NULL,
 authority_category text NOT NULL CHECK(authority_category IN ('official_institutional','instructor_published','student_owned','semester_derived','ai_generated','external','community','verified_credential','unknown')),
 permitted_entity_kinds jsonb NOT NULL, permitted_predicates jsonb NOT NULL,
 authorizing_principal_id uuid NOT NULL REFERENCES semester_workspace.principals(id),
 approval_reference text NOT NULL, policy_version text NOT NULL, approved_at timestamptz NOT NULL,
 expires_at timestamptz, revoked_at timestamptz, PRIMARY KEY(tenant_id,id)
);
CREATE TABLE semester_workspace.freshness_policies (
 tenant_id uuid NOT NULL, id uuid NOT NULL, domain text NOT NULL, predicate text NOT NULL,
 policy_version text NOT NULL, max_observation_age interval, max_source_age interval,
 requires_live_revalidation boolean NOT NULL DEFAULT false, approved_by uuid NOT NULL REFERENCES semester_workspace.principals(id),
 PRIMARY KEY(tenant_id,id), CHECK(max_observation_age IS NULL OR max_observation_age >= interval '0 seconds'),
 CHECK(max_source_age IS NULL OR max_source_age >= interval '0 seconds')
);
CREATE TABLE semester_workspace.facts (
 tenant_id uuid NOT NULL, id uuid NOT NULL, node_id uuid NOT NULL, predicate text NOT NULL, value jsonb NOT NULL,
 scope_id uuid NOT NULL, source_binding_id uuid NOT NULL, source_record_id text NOT NULL, source_version text NOT NULL,
 observed_at timestamptz NOT NULL, source_updated_at timestamptz, effective_at timestamptz,
 freshness_policy_id uuid NOT NULL, classification text NOT NULL CHECK(classification IN ('public','internal','student_private','institutional_confidential','restricted','unclassified')),
 verification_state text NOT NULL CHECK(verification_state IN ('unverified','source_authenticated','scope_verified','institution_verified','conflicting','revoked')),
 supersedes_fact_id uuid, content_digest text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,source_binding_id,source_record_id,source_version,node_id,predicate),
 FOREIGN KEY(tenant_id,node_id) REFERENCES semester_workspace.nodes(tenant_id,id),
 FOREIGN KEY(tenant_id,scope_id) REFERENCES semester_workspace.access_scopes(tenant_id,id),
 FOREIGN KEY(tenant_id,source_binding_id) REFERENCES semester_workspace.source_bindings(tenant_id,id),
 FOREIGN KEY(tenant_id,freshness_policy_id) REFERENCES semester_workspace.freshness_policies(tenant_id,id),
 FOREIGN KEY(tenant_id,supersedes_fact_id) REFERENCES semester_workspace.facts(tenant_id,id)
);
CREATE TABLE semester_workspace.edges (
 tenant_id uuid NOT NULL, id uuid NOT NULL, from_node_id uuid NOT NULL, to_node_id uuid NOT NULL,
 relation_type text NOT NULL, scope_id uuid NOT NULL, source_fact_id uuid NOT NULL, version text NOT NULL,
 valid_from timestamptz NOT NULL, valid_until timestamptz, PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,from_node_id) REFERENCES semester_workspace.nodes(tenant_id,id),
 FOREIGN KEY(tenant_id,to_node_id) REFERENCES semester_workspace.nodes(tenant_id,id),
 FOREIGN KEY(tenant_id,scope_id) REFERENCES semester_workspace.access_scopes(tenant_id,id),
 FOREIGN KEY(tenant_id,source_fact_id) REFERENCES semester_workspace.facts(tenant_id,id),
 CHECK(valid_until IS NULL OR valid_until > valid_from)
);
CREATE TABLE semester_workspace.fact_lineage (
 tenant_id uuid NOT NULL, derived_fact_id uuid NOT NULL, input_fact_id uuid NOT NULL, derivation_version text NOT NULL,
 PRIMARY KEY(tenant_id,derived_fact_id,input_fact_id),
 FOREIGN KEY(tenant_id,derived_fact_id) REFERENCES semester_workspace.facts(tenant_id,id),
 FOREIGN KEY(tenant_id,input_fact_id) REFERENCES semester_workspace.facts(tenant_id,id), CHECK(derived_fact_id <> input_fact_id)
);
CREATE TABLE semester_workspace.sharing_grants (
 tenant_id uuid NOT NULL, id uuid NOT NULL, scope_id uuid NOT NULL,
 grantor_id uuid NOT NULL REFERENCES semester_workspace.principals(id), recipient_id uuid NOT NULL REFERENCES semester_workspace.principals(id),
 purpose text NOT NULL, allowed_capabilities jsonb NOT NULL, policy_version text NOT NULL,
 issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 export_policy_id text NOT NULL, PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,scope_id) REFERENCES semester_workspace.access_scopes(tenant_id,id), CHECK(expires_at > issued_at)
);
CREATE TABLE semester_workspace.feed_events (
 tenant_id uuid NOT NULL, id uuid NOT NULL, fact_id uuid NOT NULL, event_kind text NOT NULL CHECK(event_kind IN ('observed','changed','stale','conflict','authority_revoked','access_revoked','deleted')),
 source_event_key text NOT NULL, cursor_sequence bigint NOT NULL, occurred_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,source_event_key), UNIQUE(tenant_id,cursor_sequence),
 FOREIGN KEY(tenant_id,fact_id) REFERENCES semester_workspace.facts(tenant_id,id)
);
CREATE TABLE semester_workspace.workspace_actions (
 tenant_id uuid NOT NULL, id uuid NOT NULL, owner_id uuid NOT NULL REFERENCES semester_workspace.principals(id), scope_id uuid NOT NULL,
 origin_key text NOT NULL, kind text NOT NULL, state text NOT NULL CHECK(state IN ('draft','ready','blocked','review_pending','executing','pending_receipt','completed','failed','cancelled')),
 source_fact_id uuid NOT NULL, due_at timestamptz, policy_version text NOT NULL, version bigint NOT NULL DEFAULT 1,
 authority_receipt_reference text, PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,owner_id,origin_key),
 FOREIGN KEY(tenant_id,scope_id) REFERENCES semester_workspace.access_scopes(tenant_id,id),
 FOREIGN KEY(tenant_id,source_fact_id) REFERENCES semester_workspace.facts(tenant_id,id)
);
CREATE TABLE semester_workspace.action_approvals (
 tenant_id uuid NOT NULL, id uuid NOT NULL, action_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES semester_workspace.principals(id), preview_digest text NOT NULL, target_digest text NOT NULL,
 action_version bigint NOT NULL, policy_version text NOT NULL, approved_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,action_id) REFERENCES semester_workspace.workspace_actions(tenant_id,id),
 CHECK(expires_at > approved_at)
);
CREATE TABLE semester_workspace.audit_events (
 tenant_id uuid NOT NULL, id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES semester_workspace.principals(id),
 event_type text NOT NULL, object_type text NOT NULL, object_id uuid NOT NULL, capability text NOT NULL,
 decision text NOT NULL, reason_code text NOT NULL, policy_version text NOT NULL, correlation_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL, sanitized_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(tenant_id,id)
);
CREATE INDEX facts_subject_lookup ON semester_workspace.facts(tenant_id,node_id,predicate,observed_at DESC);
CREATE INDEX graph_traversal_lookup ON semester_workspace.edges(tenant_id,from_node_id,relation_type);
CREATE INDEX active_grants_lookup ON semester_workspace.sharing_grants(tenant_id,recipient_id,expires_at);
CREATE INDEX action_center_lookup ON semester_workspace.workspace_actions(tenant_id,owner_id,state,due_at);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='semester_workspace' LOOP
  EXECUTE format('ALTER TABLE semester_workspace.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('ALTER TABLE semester_workspace.%I FORCE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON semester_workspace.%I FROM PUBLIC',t.tablename);
 END LOOP;
END $$;
-- This deliberately contains no permissive application policies. Privileged roles can
-- bypass RLS; explicit service-role boundaries and audited command functions are mandatory.
-- Scope non-expansion, type-valid edges, lineage cycle prevention, immutable history,
-- grant ownership, authenticated actor binding and atomic approvals require semantic controls.
