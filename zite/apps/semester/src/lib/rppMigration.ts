// Migration rpp-001: research partner protocols (role app "Research Partner": protocol requests, governance review, data-use
// agreements, approved datasets, secure analysis, output review). Builds on rsd-001 (approved datasets and their snapshots) and
// dgv-001 (dgv_is: data stewards of the institution).
// - A partner (signed in through the Developers app) submits a protocol to one institution naming approved dataset versions of
//   that institution, an ethics/IRB reference and a retention period. Idempotent per partner and key.
// - A data steward of that institution, never the partner, approves or rejects the exact protocol (hash).
// - Data access needs a data-use agreement: the steward issues the terms (hash) for at most the retention period; only the partner
//   accepts them. An agreement is active only between acceptance and expiry and until revoked (a steward, with a reason).
// - Secure analysis: while an agreement is active the partner may read the stored, already-suppressed snapshots of exactly the
//   dataset versions in the approved protocol (rpp_read_ok). There is no person-level data anywhere in this path, and no export.
// - Output review: anything the partner wants to publish is submitted citing readable snapshots; a steward who is not the
//   partner approves, returns or rejects it. An output whose text contains a number from 1 to 9 needs the reviewer to confirm it
//   is not a count about people before it can be approved. Approval marks it releasable; nothing is published from here.
// - History is append-only.
export const RPP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rpp_protocols (id bigserial PRIMARY KEY, tenant_id text NOT NULL, partner_id text NOT NULL, request_key text NOT NULL,
     organization text NOT NULL CHECK (length(trim(organization)) BETWEEN 2 AND 160), title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 200),
     aims text NOT NULL CHECK (length(trim(aims)) BETWEEN 40 AND 4000), ethics_ref text NOT NULL CHECK (length(trim(ethics_ref)) BETWEEN 3 AND 300),
     datasets bigint[] NOT NULL CHECK (cardinality(datasets) BETWEEN 1 AND 10), retention_days int NOT NULL CHECK (retention_days BETWEEN 30 AND 1095),
     protocol_hash text NOT NULL, state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'approved', 'rejected', 'withdrawn', 'closed')),
     reviewer_id text, review_note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
     UNIQUE (partner_id, request_key), CHECK (reviewer_id IS NULL OR reviewer_id <> partner_id), CHECK (state NOT IN ('approved', 'rejected') OR reviewer_id IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS rpp_agreements (id bigserial PRIMARY KEY, protocol_id bigint NOT NULL REFERENCES rpp_protocols(id), tenant_id text NOT NULL, partner_id text NOT NULL,
     terms text NOT NULL CHECK (length(trim(terms)) >= 200), terms_hash text NOT NULL, issued_by text NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(), days int NOT NULL CHECK (days BETWEEN 1 AND 1095),
     accepted_at timestamptz, expires_at timestamptz, revoked_at timestamptz, revoked_by text, revoked_reason text,
     CHECK (issued_by <> partner_id), CHECK (revoked_by IS NULL OR revoked_by <> partner_id), CHECK ((accepted_at IS NULL) = (expires_at IS NULL)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rpp_one_live_agreement ON rpp_agreements (protocol_id) WHERE revoked_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS rpp_outputs (id bigserial PRIMARY KEY, protocol_id bigint NOT NULL REFERENCES rpp_protocols(id), tenant_id text NOT NULL, partner_id text NOT NULL,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 200), body text NOT NULL CHECK (length(trim(body)) BETWEEN 20 AND 20000), cites bigint[] NOT NULL CHECK (cardinality(cites) BETWEEN 1 AND 20),
     small_numbers boolean NOT NULL, state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'approved', 'returned', 'rejected')),
     reviewer_id text, review_note text NOT NULL DEFAULT '', small_ack boolean NOT NULL DEFAULT false, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
     CHECK (reviewer_id IS NULL OR reviewer_id <> partner_id), CHECK (state <> 'approved' OR NOT small_numbers OR small_ack))`,
  `CREATE TABLE IF NOT EXISTS rpp_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, protocol_id bigint, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION rpp_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rpp_events_append_only') THEN
       CREATE TRIGGER rpp_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rpp_events FOR EACH STATEMENT EXECUTE FUNCTION rpp_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_hash(p rpp_protocols) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT md5(concat_ws('|', p.tenant_id, p.organization, p.title, p.aims, p.ethics_ref, array_to_string(p.datasets, ','), p.retention_days)) $$`,
  `CREATE OR REPLACE FUNCTION rpp_active_agreement(p_protocol bigint) RETURNS bigint LANGUAGE sql STABLE AS $$
     SELECT id FROM rpp_agreements WHERE protocol_id = p_protocol AND revoked_at IS NULL AND accepted_at IS NOT NULL AND expires_at > now() LIMIT 1 $$`,

  `CREATE OR REPLACE FUNCTION rpp_submit(p_partner text, p_key text, p_tenant text, p_org text, p_title text, p_aims text, p_ethics text, p_datasets bigint[], p_days int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rpp_protocols; v_id bigint; bad int;
   BEGIN
     SELECT * INTO r FROM rpp_protocols WHERE partner_id = p_partner AND request_key = p_key;
     IF FOUND THEN
       IF r.tenant_id = p_tenant AND r.title = trim(p_title) AND r.aims = trim(p_aims) AND r.datasets = p_datasets THEN RETURN 'replay:' || r.id; END IF;
       RETURN 'That request key was already used with different details.';
     END IF;
     IF length(coalesce(p_key, '')) < 8 THEN RETURN 'Missing request key.'; END IF;
     IF p_datasets IS NULL OR cardinality(p_datasets) = 0 THEN RETURN 'Name at least one approved dataset.'; END IF;
     SELECT count(*) INTO bad FROM unnest(p_datasets) d WHERE NOT EXISTS (SELECT 1 FROM rsd_defs x WHERE x.id = d AND x.tenant_id = p_tenant AND x.kind = 'dataset' AND x.state = 'approved');
     IF bad > 0 THEN RETURN 'Only that institution''s approved datasets can be requested.'; END IF;
     IF length(trim(coalesce(p_org, ''))) < 2 OR length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Give your organization and a title.'; END IF;
     IF length(trim(coalesce(p_aims, ''))) < 40 THEN RETURN 'Describe the research aims (40+ characters).'; END IF;
     IF length(trim(coalesce(p_ethics, ''))) < 3 THEN RETURN 'Give the ethics or IRB reference (or why it is exempt).'; END IF;
     IF coalesce(p_days, 0) NOT BETWEEN 30 AND 1095 THEN RETURN 'Retention must be 30 to 1095 days.'; END IF;
     INSERT INTO rpp_protocols (tenant_id, partner_id, request_key, organization, title, aims, ethics_ref, datasets, retention_days, protocol_hash)
       VALUES (p_tenant, p_partner, p_key, trim(p_org), trim(p_title), trim(p_aims), trim(p_ethics), p_datasets, p_days, '') RETURNING id INTO v_id;
     UPDATE rpp_protocols SET protocol_hash = rpp_hash(rpp_protocols) WHERE id = v_id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action) VALUES (p_tenant, v_id, p_partner, 'submitted');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_review(p_actor text, p_tenant text, p_id bigint, p_approve boolean, p_seen text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rpp_protocols;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only a data steward reviews research protocols.'; END IF;
     SELECT * INTO r FROM rpp_protocols WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Protocol not found.'; END IF;
     IF r.partner_id = p_actor THEN RETURN 'You submitted this protocol, so another steward reviews it.'; END IF;
     IF r.state <> 'submitted' THEN RETURN 'This protocol is not waiting for review.'; END IF;
     IF p_seen IS DISTINCT FROM r.protocol_hash THEN RETURN 'The protocol changed since you opened it. Reload and review again.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record the governance decision and why (10+ characters).'; END IF;
     UPDATE rpp_protocols SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, reviewer_id = p_actor, review_note = trim(p_note), decided_at = now(), version = version + 1 WHERE id = r.id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, trim(p_note));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_withdraw(p_partner text, p_id bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rpp_protocols;
   BEGIN
     SELECT * INTO r FROM rpp_protocols WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.partner_id <> p_partner THEN RETURN 'Protocol not found.'; END IF;
     IF r.state NOT IN ('submitted', 'approved') THEN RETURN 'This protocol is already closed.'; END IF;
     UPDATE rpp_protocols SET state = CASE WHEN r.state = 'approved' THEN 'closed' ELSE 'withdrawn' END, version = version + 1 WHERE id = r.id;
     UPDATE rpp_agreements SET revoked_at = now(), revoked_by = NULL, revoked_reason = 'Protocol closed by the partner: ' || left(coalesce(p_reason, ''), 300) WHERE protocol_id = r.id AND revoked_at IS NULL;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (r.tenant_id, r.id, p_partner, 'closed', coalesce(p_reason, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_issue(p_actor text, p_tenant text, p_protocol bigint, p_terms text, p_days int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rpp_protocols; v_id bigint;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only a data steward issues data-use agreements.'; END IF;
     SELECT * INTO r FROM rpp_protocols WHERE id = p_protocol FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Protocol not found.'; END IF;
     IF r.state <> 'approved' THEN RETURN 'Agreements are issued only for an approved protocol.'; END IF;
     IF r.partner_id = p_actor THEN RETURN 'You are the partner on this protocol.'; END IF;
     IF EXISTS (SELECT 1 FROM rpp_agreements WHERE protocol_id = r.id AND revoked_at IS NULL) THEN RETURN 'This protocol already has a live agreement. Revoke it first.'; END IF;
     IF length(trim(coalesce(p_terms, ''))) < 200 THEN RETURN 'Write the full terms (200+ characters).'; END IF;
     IF coalesce(p_days, 0) < 1 OR p_days > r.retention_days THEN RETURN 'The agreement cannot run longer than the protocol''s retention period.'; END IF;
     INSERT INTO rpp_agreements (protocol_id, tenant_id, partner_id, terms, terms_hash, issued_by, days) VALUES (r.id, p_tenant, r.partner_id, trim(p_terms), md5(trim(p_terms)), p_actor, p_days) RETURNING id INTO v_id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, 'agreement_issued', 'agreement ' || v_id);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_accept(p_partner text, p_id bigint, p_seen text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g rpp_agreements;
   BEGIN
     SELECT * INTO g FROM rpp_agreements WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR g.partner_id <> p_partner THEN RETURN 'Agreement not found.'; END IF;
     IF g.revoked_at IS NOT NULL THEN RETURN 'This agreement was revoked.'; END IF;
     IF g.accepted_at IS NOT NULL THEN RETURN 'You already accepted this agreement.'; END IF;
     IF p_seen IS DISTINCT FROM g.terms_hash THEN RETURN 'The terms changed since you opened them. Reload and read them again.'; END IF;
     UPDATE rpp_agreements SET accepted_at = now(), expires_at = now() + make_interval(days => g.days) WHERE id = g.id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (g.tenant_id, g.protocol_id, p_partner, 'agreement_accepted', 'agreement ' || g.id);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_revoke(p_actor text, p_tenant text, p_id bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g rpp_agreements;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only a data steward revokes an agreement.'; END IF;
     SELECT * INTO g FROM rpp_agreements WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR g.tenant_id <> p_tenant THEN RETURN 'Agreement not found.'; END IF;
     IF g.revoked_at IS NOT NULL THEN RETURN 'Already revoked.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Say why (10+ characters). The partner sees this.'; END IF;
     UPDATE rpp_agreements SET revoked_at = now(), revoked_by = p_actor, revoked_reason = trim(p_reason) WHERE id = g.id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (p_tenant, g.protocol_id, p_actor, 'agreement_revoked', trim(p_reason));
     RETURN NULL;
   END $$`,
  // Secure analysis gate: may this partner read this stored snapshot now?
  `CREATE OR REPLACE FUNCTION rpp_read_ok(p_partner text, p_snapshot bigint) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM rsd_snapshots s JOIN rpp_protocols p ON p.tenant_id = s.tenant_id AND s.def_id = ANY(p.datasets)
       WHERE s.id = p_snapshot AND p.partner_id = p_partner AND p.state = 'approved' AND rpp_active_agreement(p.id) IS NOT NULL) $$`,
  `CREATE OR REPLACE FUNCTION rpp_output_submit(p_partner text, p_protocol bigint, p_title text, p_body text, p_cites bigint[]) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rpp_protocols; v_id bigint; bad int;
   BEGIN
     SELECT * INTO r FROM rpp_protocols WHERE id = p_protocol;
     IF NOT FOUND OR r.partner_id <> p_partner THEN RETURN 'Protocol not found.'; END IF;
     IF r.state <> 'approved' OR rpp_active_agreement(r.id) IS NULL THEN RETURN 'Outputs need an approved protocol with an active agreement.'; END IF;
     IF p_cites IS NULL OR cardinality(p_cites) = 0 THEN RETURN 'Cite the snapshots the output comes from.'; END IF;
     SELECT count(*) INTO bad FROM unnest(p_cites) c WHERE NOT rpp_read_ok(p_partner, c);
     IF bad > 0 THEN RETURN 'An output can only cite snapshots you are allowed to read.'; END IF;
     IF length(trim(coalesce(p_title, ''))) < 5 OR length(trim(coalesce(p_body, ''))) < 20 THEN RETURN 'Give a title and the text to release (20+ characters).'; END IF;
     INSERT INTO rpp_outputs (protocol_id, tenant_id, partner_id, title, body, cites, small_numbers)
       VALUES (r.id, r.tenant_id, p_partner, trim(p_title), trim(p_body), p_cites, trim(p_body) ~ '(^|[^0-9.,])[1-9]([^0-9.,]|$)') RETURNING id INTO v_id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (r.tenant_id, r.id, p_partner, 'output_submitted', 'output ' || v_id);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rpp_output_review(p_actor text, p_tenant text, p_id bigint, p_step text, p_ack boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o rpp_outputs;
   BEGIN
     IF NOT dgv_is(p_tenant, p_actor) THEN RETURN 'Only a data steward reviews research outputs.'; END IF;
     SELECT * INTO o FROM rpp_outputs WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR o.tenant_id <> p_tenant THEN RETURN 'Output not found.'; END IF;
     IF o.partner_id = p_actor THEN RETURN 'You wrote this output, so another steward reviews it.'; END IF;
     IF o.state <> 'submitted' THEN RETURN 'This output is not waiting for review.'; END IF;
     IF p_step NOT IN ('approve', 'return', 'reject') THEN RETURN 'Unknown step.'; END IF;
     IF p_step = 'approve' AND o.small_numbers AND NOT coalesce(p_ack, false) THEN RETURN 'The text contains a number under 10. Confirm it is not a count of people before approving.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record what you checked (10+ characters).'; END IF;
     UPDATE rpp_outputs SET state = CASE p_step WHEN 'approve' THEN 'approved' WHEN 'return' THEN 'returned' ELSE 'rejected' END, reviewer_id = p_actor, review_note = trim(p_note),
       small_ack = coalesce(p_ack, false), decided_at = now(), version = version + 1 WHERE id = o.id;
     INSERT INTO rpp_events (tenant_id, protocol_id, actor_id, action, detail) VALUES (p_tenant, o.protocol_id, p_actor, 'output_' || p_step, trim(p_note));
     RETURN NULL;
   END $$`,
];
