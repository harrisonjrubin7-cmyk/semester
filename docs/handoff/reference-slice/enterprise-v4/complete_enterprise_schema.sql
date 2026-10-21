-- Consolidated Semester reference v3. Fresh Supabase database; trusted migration owner.
-- This schema defines reference domains, NOT every possible university/company process.
-- No state transition/posting commands or provider adapters are installed by this DDL.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE SCHEMA sx;
CREATE SCHEMA sx_private;
CREATE SCHEMA sx_personal;
REVOKE ALL ON SCHEMA sx,sx_private,sx_personal FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA sx,sx_private,sx_personal TO authenticated;

CREATE TABLE sx.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, kind text NOT NULL CHECK(kind IN ('institution','company')), status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed'))
);

CREATE TABLE sx_private.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id), status text NOT NULL CHECK(status IN ('active','suspended','ended')), UNIQUE(tenant_id,user_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL, UNIQUE(tenant_id,code),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL UNIQUE
);

CREATE TABLE sx_private.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  role_id uuid NOT NULL, permission_id uuid NOT NULL REFERENCES sx_private.permissions(id), FOREIGN KEY(tenant_id,role_id) REFERENCES sx_private.roles(tenant_id,id), UNIQUE(role_id,permission_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, parent_id uuid, FOREIGN KEY(tenant_id,parent_id) REFERENCES sx.units(tenant_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, starts_on date NOT NULL, ends_on date NOT NULL, CHECK(ends_on>=starts_on),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL, title text NOT NULL, UNIQUE(tenant_id,code),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  course_id uuid NOT NULL, version_number integer NOT NULL CHECK(version_number>0), credits numeric(8,2) NOT NULL CHECK(credits>=0), UNIQUE(course_id,version_number),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,course_id) REFERENCES sx.courses(tenant_id,id)
);

CREATE TABLE sx.sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  course_version_id uuid NOT NULL, term_id uuid NOT NULL, title text NOT NULL, capacity integer CHECK(capacity>=0),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,course_version_id) REFERENCES sx.course_versions(tenant_id,id),
  FOREIGN KEY(tenant_id,term_id) REFERENCES sx.terms(tenant_id,id)
);

CREATE TABLE sx_private.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  membership_id uuid NOT NULL, role_id uuid NOT NULL, section_id uuid, expires_at timestamptz, FOREIGN KEY(tenant_id,membership_id) REFERENCES sx_private.memberships(tenant_id,id), FOREIGN KEY(tenant_id,role_id) REFERENCES sx_private.roles(tenant_id,id), FOREIGN KEY(tenant_id,section_id) REFERENCES sx.sections(tenant_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, student_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('active','ended')), FOREIGN KEY(tenant_id,student_id) REFERENCES sx_private.memberships(tenant_id,user_id), UNIQUE(section_id,student_id), UNIQUE(tenant_id,section_id,id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,section_id) REFERENCES sx.sections(tenant_id,id)
);

CREATE TABLE sx.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, title text NOT NULL, position integer NOT NULL, published boolean NOT NULL DEFAULT false,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,section_id) REFERENCES sx.sections(tenant_id,id)
);

CREATE TABLE sx.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, module_id uuid NOT NULL, title text NOT NULL, published boolean NOT NULL DEFAULT false, file_reference text, UNIQUE(tenant_id,section_id,id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,section_id) REFERENCES sx.sections(tenant_id,id)
);

CREATE TABLE sx.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, title text NOT NULL, instructions text NOT NULL, due_at timestamptz, published boolean NOT NULL DEFAULT false, UNIQUE(tenant_id,section_id,id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,section_id) REFERENCES sx.sections(tenant_id,id)
);

CREATE TABLE sx.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, assignment_id uuid NOT NULL, enrollment_id uuid NOT NULL, attempt integer NOT NULL CHECK(attempt>0), status text NOT NULL CHECK(status IN ('draft','submitted','returned')), submitted_at timestamptz, file_reference text, FOREIGN KEY(tenant_id,section_id,assignment_id) REFERENCES sx.assignments(tenant_id,section_id,id), FOREIGN KEY(tenant_id,section_id,enrollment_id) REFERENCES sx.enrollments(tenant_id,section_id,id), UNIQUE(assignment_id,enrollment_id,attempt), UNIQUE(tenant_id,section_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, enrollment_id uuid NOT NULL, submission_id uuid, score numeric(12,4), published boolean NOT NULL DEFAULT false, FOREIGN KEY(tenant_id,section_id,enrollment_id) REFERENCES sx.enrollments(tenant_id,section_id,id), FOREIGN KEY(tenant_id,section_id,submission_id) REFERENCES sx.submissions(tenant_id,section_id,id), UNIQUE(tenant_id,section_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.grade_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, grade_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id), prior_score numeric(12,4), new_score numeric(12,4), reason text NOT NULL, FOREIGN KEY(tenant_id,section_id,grade_id) REFERENCES sx.grades(tenant_id,section_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  section_id uuid NOT NULL, title text NOT NULL, body text NOT NULL, published boolean NOT NULL DEFAULT false,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,section_id) REFERENCES sx.sections(tenant_id,id)
);

CREATE TABLE sx_personal.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id), title text NOT NULL, body text NOT NULL
);

CREATE TABLE sx_personal.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id), title text NOT NULL, due_at timestamptz, status text NOT NULL CHECK(status IN ('open','done','canceled'))
);

CREATE TABLE sx_personal.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id), title text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at>starts_at)
);

CREATE TABLE sx.service_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, description text NOT NULL,
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.service_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  service_id uuid NOT NULL, requester_id uuid NOT NULL, assignee_id uuid, status text NOT NULL CHECK(status IN ('open','assigned','resolved','closed')), summary text NOT NULL, FOREIGN KEY(tenant_id,requester_id) REFERENCES sx_private.memberships(tenant_id,user_id), FOREIGN KEY(tenant_id,assignee_id) REFERENCES sx_private.memberships(tenant_id,user_id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,service_id) REFERENCES sx.service_definitions(tenant_id,id)
);

CREATE TABLE sx.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  case_id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, CHECK(ends_at>starts_at),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,case_id) REFERENCES sx.service_cases(tenant_id,id)
);

CREATE TABLE sx.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, status text NOT NULL CHECK(status IN ('prospect','customer','closed')),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid NOT NULL, name text NOT NULL, email text,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,account_id) REFERENCES sx.accounts(tenant_id,id)
);

CREATE TABLE sx.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid NOT NULL, title text NOT NULL, stage text NOT NULL CHECK(stage IN ('discovery','evaluation','proposal','won','lost')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,account_id) REFERENCES sx.accounts(tenant_id,id)
);

CREATE TABLE sx.implementation_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid NOT NULL, title text NOT NULL, status text NOT NULL CHECK(status IN ('planned','active','blocked','accepted','closed')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,account_id) REFERENCES sx.accounts(tenant_id,id)
);

CREATE TABLE sx.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  account_id uuid NOT NULL, subject text NOT NULL, status text NOT NULL CHECK(status IN ('open','assigned','resolved','closed')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,account_id) REFERENCES sx.accounts(tenant_id,id)
);

CREATE TABLE sx.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL, document_type text NOT NULL, classification text NOT NULL CHECK(classification IN ('business','restricted')), author_id uuid NOT NULL, FOREIGN KEY(tenant_id,author_id) REFERENCES sx_private.memberships(tenant_id,user_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.document_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, membership_id uuid NOT NULL, FOREIGN KEY(tenant_id,document_id) REFERENCES sx.documents(tenant_id,id), FOREIGN KEY(tenant_id,membership_id) REFERENCES sx_private.memberships(tenant_id,id), UNIQUE(document_id,membership_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, version_number integer NOT NULL CHECK(version_number>0), state text NOT NULL CHECK(state IN ('draft','in_review','changes_requested','approved','awaiting_signature','effective','rejected','superseded','archived')), content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'), file_reference text NOT NULL, requires_signature boolean NOT NULL DEFAULT false, UNIQUE(document_id,version_number),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES sx.documents(tenant_id,id)
);

CREATE TABLE sx.review_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  version_id uuid NOT NULL, reviewer_id uuid NOT NULL, decision text NOT NULL CHECK(decision IN ('pending','approved','changes_requested','rejected')), decided_at timestamptz, FOREIGN KEY(tenant_id,reviewer_id) REFERENCES sx_private.memberships(tenant_id,user_id), UNIQUE(version_id,reviewer_id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,version_id) REFERENCES sx.document_versions(tenant_id,id)
);

CREATE TABLE sx.signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  version_id uuid NOT NULL, signer_reference text NOT NULL, status text NOT NULL CHECK(status IN ('pending','signed','declined','expired')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,version_id) REFERENCES sx.document_versions(tenant_id,id)
);

CREATE TABLE sx.document_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  version_id uuid NOT NULL, from_state text NOT NULL, to_state text NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id), reason text NOT NULL,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,version_id) REFERENCES sx.document_versions(tenant_id,id)
);

CREATE TABLE sx.signature_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL, signed_hash text NOT NULL CHECK(signed_hash ~ '^[0-9a-f]{64}$'), provider_reference text NOT NULL, verified_at timestamptz NOT NULL, UNIQUE(request_id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,request_id) REFERENCES sx.signature_requests(tenant_id,id)
);

CREATE TABLE sx.legal_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  document_id uuid NOT NULL, reason text NOT NULL, released_at timestamptz,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,document_id) REFERENCES sx.documents(tenant_id,id)
);

CREATE TABLE sx.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL, name text NOT NULL, UNIQUE(tenant_id,code),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  product_id uuid NOT NULL, code text NOT NULL, UNIQUE(tenant_id,code),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,product_id) REFERENCES sx.products(tenant_id,id)
);

CREATE TABLE sx.price_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  plan_id uuid NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), unit_amount bigint NOT NULL CHECK(unit_amount>=0), interval_code text NOT NULL CHECK(interval_code IN ('month','year','one_time')), effective_from timestamptz NOT NULL, effective_until timestamptz, CHECK(effective_until IS NULL OR effective_until>effective_from),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,plan_id) REFERENCES sx.plans(tenant_id,id)
);

CREATE TABLE sx.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_account_id uuid NOT NULL, name text NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), status text NOT NULL CHECK(status IN ('active','closed')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,customer_account_id) REFERENCES sx.accounts(tenant_id,id)
);

CREATE TABLE sx.billing_account_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, licensed_tenant_id uuid NOT NULL REFERENCES sx.tenants(id), UNIQUE(billing_account_id,licensed_tenant_id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,billing_account_id) REFERENCES sx.billing_accounts(tenant_id,id)
);

CREATE TABLE sx_private.billing_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, membership_tenant_id uuid NOT NULL, membership_id uuid NOT NULL, expires_at timestamptz, FOREIGN KEY(tenant_id,billing_account_id) REFERENCES sx.billing_accounts(tenant_id,id), FOREIGN KEY(billing_account_id,membership_tenant_id) REFERENCES sx.billing_account_tenants(billing_account_id,licensed_tenant_id), FOREIGN KEY(membership_tenant_id,membership_id) REFERENCES sx_private.memberships(tenant_id,id), UNIQUE(billing_account_id,membership_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, agreement_version_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('draft','review','signed','effective','terminated')), UNIQUE(tenant_id,billing_account_id,id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,billing_account_id) REFERENCES sx.billing_accounts(tenant_id,id),
  FOREIGN KEY(tenant_id,agreement_version_id) REFERENCES sx.document_versions(tenant_id,id)
);

CREATE TABLE sx.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, contract_id uuid, licensed_tenant_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('draft','trialing','active','past_due','suspended','canceled','expired')), period_start timestamptz, period_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false, CHECK(period_end IS NULL OR (period_start IS NOT NULL AND period_end>period_start)), FOREIGN KEY(tenant_id,billing_account_id,contract_id) REFERENCES sx.contracts(tenant_id,billing_account_id,id), FOREIGN KEY(billing_account_id,licensed_tenant_id) REFERENCES sx.billing_account_tenants(billing_account_id,licensed_tenant_id), UNIQUE(tenant_id,billing_account_id,id), UNIQUE(tenant_id,billing_account_id,id,licensed_tenant_id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,billing_account_id) REFERENCES sx.billing_accounts(tenant_id,id)
);

CREATE TABLE sx.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, subscription_id uuid NOT NULL, price_version_id uuid NOT NULL, quantity bigint NOT NULL CHECK(quantity>0), FOREIGN KEY(tenant_id,billing_account_id,subscription_id) REFERENCES sx.subscriptions(tenant_id,billing_account_id,id),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,price_version_id) REFERENCES sx.price_versions(tenant_id,id)
);

CREATE TABLE sx.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, subscription_id uuid NOT NULL, licensed_tenant_id uuid NOT NULL, feature_code text NOT NULL, limit_value bigint CHECK(limit_value>=0), effective_from timestamptz NOT NULL, effective_until timestamptz, status text NOT NULL CHECK(status IN ('enabled','grace','disabled')), CHECK(effective_until IS NULL OR effective_until>effective_from), FOREIGN KEY(tenant_id,billing_account_id,subscription_id,licensed_tenant_id) REFERENCES sx.subscriptions(tenant_id,billing_account_id,id,licensed_tenant_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, subscription_id uuid, number text NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), status text NOT NULL CHECK(status IN ('draft','issued','partially_paid','paid','void','uncollectible')), subtotal bigint NOT NULL CHECK(subtotal>=0), tax bigint NOT NULL CHECK(tax>=0), discount bigint NOT NULL CHECK(discount>=0), total bigint NOT NULL CHECK(total>=0), due_at timestamptz, CHECK(total=subtotal+tax-discount), FOREIGN KEY(tenant_id,billing_account_id,subscription_id) REFERENCES sx.subscriptions(tenant_id,billing_account_id,id), UNIQUE(billing_account_id,number), UNIQUE(tenant_id,billing_account_id,id), UNIQUE(tenant_id,billing_account_id,id,currency),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,billing_account_id) REFERENCES sx.billing_accounts(tenant_id,id)
);

CREATE TABLE sx.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, invoice_id uuid NOT NULL, description text NOT NULL, quantity bigint NOT NULL CHECK(quantity>0), unit_amount bigint NOT NULL CHECK(unit_amount>=0), line_total bigint NOT NULL CHECK(line_total=quantity*unit_amount), FOREIGN KEY(tenant_id,billing_account_id,invoice_id) REFERENCES sx.invoices(tenant_id,billing_account_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, rail text NOT NULL, token_reference text NOT NULL, status text NOT NULL CHECK(status IN ('active','revoked')), FOREIGN KEY(tenant_id,billing_account_id) REFERENCES sx.billing_accounts(tenant_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, invoice_id uuid NOT NULL, currency text NOT NULL, amount bigint NOT NULL CHECK(amount>0), status text NOT NULL CHECK(status IN ('created','requires_action','processing','succeeded','failed','canceled')), idempotency_key uuid NOT NULL, FOREIGN KEY(tenant_id,billing_account_id,invoice_id,currency) REFERENCES sx.invoices(tenant_id,billing_account_id,id,currency), UNIQUE(billing_account_id,idempotency_key), UNIQUE(tenant_id,billing_account_id,id,currency),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, intent_id uuid NOT NULL, currency text NOT NULL, amount bigint NOT NULL CHECK(amount>0), status text NOT NULL CHECK(status IN ('pending','settled','failed')), rail text NOT NULL, rail_account text NOT NULL, external_reference text NOT NULL, settled_at timestamptz, FOREIGN KEY(tenant_id,billing_account_id,intent_id,currency) REFERENCES sx.payment_intents(tenant_id,billing_account_id,id,currency), UNIQUE(rail,rail_account,external_reference), UNIQUE(tenant_id,billing_account_id,id,currency),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, payment_id uuid NOT NULL, currency text NOT NULL, amount bigint NOT NULL CHECK(amount>0), FOREIGN KEY(tenant_id,billing_account_id,payment_id,currency) REFERENCES sx.payments(tenant_id,billing_account_id,id,currency), invoice_id uuid NOT NULL, FOREIGN KEY(tenant_id,billing_account_id,invoice_id,currency) REFERENCES sx.invoices(tenant_id,billing_account_id,id,currency),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, payment_id uuid NOT NULL, currency text NOT NULL, amount bigint NOT NULL CHECK(amount>0), FOREIGN KEY(tenant_id,billing_account_id,payment_id,currency) REFERENCES sx.payments(tenant_id,billing_account_id,id,currency), status text NOT NULL CHECK(status IN ('requested','approved','processing','succeeded','failed')), reason text NOT NULL, idempotency_key uuid NOT NULL, UNIQUE(billing_account_id,idempotency_key),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  billing_account_id uuid NOT NULL, invoice_id uuid NOT NULL, currency text NOT NULL, amount bigint NOT NULL CHECK(amount>0), reason text NOT NULL, status text NOT NULL CHECK(status IN ('draft','approved','applied','void')), FOREIGN KEY(tenant_id,billing_account_id,invoice_id,currency) REFERENCES sx.invoices(tenant_id,billing_account_id,id,currency),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('asset','liability','equity','income','expense')), UNIQUE(tenant_id,code),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK(status IN ('draft','posted','reversed')), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), source_reference text NOT NULL, posted_at timestamptz, UNIQUE(tenant_id,id,currency),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  entry_id uuid NOT NULL, ledger_account_id uuid NOT NULL, currency text NOT NULL, debit bigint NOT NULL CHECK(debit>=0), credit bigint NOT NULL CHECK(credit>=0), CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0)), FOREIGN KEY(tenant_id,entry_id,currency) REFERENCES sx.journal_entries(tenant_id,id,currency),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,ledger_account_id) REFERENCES sx.ledger_accounts(tenant_id,id)
);

CREATE TABLE sx.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id), display_name text NOT NULL, status text NOT NULL CHECK(status IN ('active','ended')),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.employment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  employee_id uuid NOT NULL, document_reference text NOT NULL,
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,employee_id) REFERENCES sx.employees(tenant_id,id)
);

CREATE TABLE sx.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, status text NOT NULL CHECK(status IN ('evaluation','approved','closed')),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  vendor_id uuid NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), amount bigint NOT NULL CHECK(amount>=0), status text NOT NULL CHECK(status IN ('draft','approved','ordered','closed')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,vendor_id) REFERENCES sx.vendors(tenant_id,id)
);

CREATE TABLE sx.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL, status text NOT NULL CHECK(status IN ('healthy','degraded','down')),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  service_id uuid NOT NULL, revision text NOT NULL, status text NOT NULL CHECK(status IN ('planned','running','succeeded','failed','rolled_back')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,service_id) REFERENCES sx.services(tenant_id,id)
);

CREATE TABLE sx.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  service_id uuid NOT NULL, title text NOT NULL, status text NOT NULL CHECK(status IN ('open','mitigated','resolved')),
  UNIQUE(tenant_id,id),
  FOREIGN KEY(tenant_id,service_id) REFERENCES sx.services(tenant_id,id)
);

CREATE TABLE sx.api_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL CHECK(method IN ('GET','POST','PATCH','DELETE')), path text NOT NULL, capability text NOT NULL, implementation_status text NOT NULL CHECK(implementation_status IN ('specified','implemented','tested','deployed')),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL, payload jsonb NOT NULL, delivered_at timestamptz,
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL, provider_account text NOT NULL, external_event_id text NOT NULL, verified_at timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('pending','processed','failed')), payload_reference text NOT NULL, UNIQUE(provider,provider_account,external_event_id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id), action text NOT NULL, resource_reference text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
  UNIQUE(tenant_id,id)
);

CREATE TABLE sx_private.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL, endpoint_reference text NOT NULL, attempt integer NOT NULL CHECK(attempt>=0), status text NOT NULL CHECK(status IN ('pending','retry_wait','delivered','dead_letter')), next_attempt_at timestamptz, diagnostic text, FOREIGN KEY(tenant_id,event_id) REFERENCES sx_private.outbox(tenant_id,id), UNIQUE(event_id,endpoint_reference),
  UNIQUE(tenant_id,id)
);

ALTER TABLE sx.modules ADD UNIQUE(tenant_id,section_id,id);
ALTER TABLE sx.content_items ADD FOREIGN KEY(tenant_id,section_id,module_id) REFERENCES sx.modules(tenant_id,section_id,id);
CREATE UNIQUE INDEX one_effective_document_version ON sx.document_versions(document_id) WHERE state='effective';
CREATE INDEX role_lookup ON sx_private.role_assignments(tenant_id,membership_id,section_id);
CREATE INDEX enrollment_lookup ON sx.enrollments(tenant_id,section_id,student_id,status);
CREATE INDEX invoice_queue ON sx.invoices(tenant_id,billing_account_id,status,due_at);
ALTER TABLE sx.submissions ADD UNIQUE(tenant_id,section_id,enrollment_id,id);
ALTER TABLE sx.grades ADD FOREIGN KEY(tenant_id,section_id,enrollment_id,submission_id)
  REFERENCES sx.submissions(tenant_id,section_id,enrollment_id,id);
COMMIT;
