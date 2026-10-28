// Career connections C13–C15 (owner register S-85). An employer reaches an institution's students only after that
// institution's staff approve the partnership; approval is per institution and can be revoked. A student's application
// shares only the portfolio items the student picks (and contact details only if they choose); the employer sees nothing
// else. Partnerships are versioned; every step is logged append-only.
export const CRR_DECISIONS = ['Approved', 'Declined', 'Revoked'] as const;
export const CRR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS crr_partners (tenant_id text NOT NULL, employer_id text NOT NULL, employer_name text NOT NULL,
     status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Declined','Revoked')), version int NOT NULL DEFAULT 1,
     requested_at timestamptz NOT NULL DEFAULT now(), decided_by text, decided_at timestamptz, note text NOT NULL DEFAULT '',
     PRIMARY KEY (tenant_id, employer_id), CHECK (decided_by IS NULL OR decided_by <> employer_id))`,
  `CREATE TABLE IF NOT EXISTS crr_shares (posting_ref text NOT NULL, applicant_id text NOT NULL, tenant_id text NOT NULL,
     employer_id text NOT NULL, item_ids text[] NOT NULL DEFAULT '{}', share_contact boolean NOT NULL DEFAULT false,
     shared_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (posting_ref, applicant_id))`,
  `CREATE TABLE IF NOT EXISTS crr_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, employer_id text NOT NULL,
     actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION crr_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The career log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'crr_events_append_only') THEN
     CREATE TRIGGER crr_events_append_only BEFORE UPDATE OR DELETE ON crr_events FOR EACH ROW EXECUTE FUNCTION crr_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION crr_request(p_employer text, p_tenant text, p_name text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r crr_partners%ROWTYPE;
   BEGIN
     IF length(trim(coalesce(p_name,''))) < 2 THEN RETURN 'Give the organization name.'; END IF;
     SELECT * INTO r FROM crr_partners WHERE tenant_id = p_tenant AND employer_id = p_employer FOR UPDATE;
     IF NOT FOUND THEN
       INSERT INTO crr_partners (tenant_id, employer_id, employer_name) VALUES (p_tenant, p_employer, trim(p_name));
     ELSIF r.status = 'Approved' THEN RETURN 'This institution has already approved you.';
     ELSIF r.status = 'Pending' THEN RETURN 'ok:pending';
     ELSE UPDATE crr_partners SET status = 'Pending', employer_name = trim(p_name), version = version + 1, requested_at = now(),
            decided_by = NULL, decided_at = NULL, note = '' WHERE tenant_id = p_tenant AND employer_id = p_employer;
     END IF;
     INSERT INTO crr_events (tenant_id, employer_id, actor_id, action, detail) VALUES (p_tenant, p_employer, p_employer, 'requested', trim(p_name));
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION crr_decide(p_actor text, p_tenant text, p_is_staff boolean, p_employer text, p_decision text, p_expected int, p_note text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r crr_partners%ROWTYPE;
   BEGIN
     IF NOT p_is_staff THEN RETURN 'Only institution staff decide employer partnerships.'; END IF;
     IF p_actor = p_employer THEN RETURN 'You cannot approve your own organization.'; END IF;
     SELECT * INTO r FROM crr_partners WHERE tenant_id = p_tenant AND employer_id = p_employer FOR UPDATE;
     IF NOT FOUND THEN RETURN 'No request from this employer.'; END IF;
     IF r.version <> p_expected THEN RETURN 'This request changed since you opened it. Reload and decide again.'; END IF;
     IF p_decision IN ('Approved','Declined') AND r.status <> 'Pending' THEN RETURN 'Only a pending request can be approved or declined.'; END IF;
     IF p_decision = 'Revoked' AND r.status <> 'Approved' THEN RETURN 'Only an approved partnership can be revoked.'; END IF;
     IF p_decision NOT IN ('Approved','Declined','Revoked') THEN RETURN 'Unknown decision.'; END IF;
     UPDATE crr_partners SET status = p_decision, version = version + 1, decided_by = p_actor, decided_at = now(), note = left(coalesce(p_note,''), 500)
       WHERE tenant_id = p_tenant AND employer_id = p_employer;
     INSERT INTO crr_events (tenant_id, employer_id, actor_id, action, detail) VALUES (p_tenant, p_employer, p_actor, lower(p_decision), left(coalesce(p_note,''), 500));
     RETURN 'ok:' || (r.version + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION crr_approved(p_tenant text, p_employer text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM crr_partners WHERE tenant_id = p_tenant AND employer_id = p_employer AND status = 'Approved') $$`,
  // p_items are already checked by the server to be the applicant's own portfolio items.
  `CREATE OR REPLACE FUNCTION crr_share(p_tenant text, p_posting text, p_employer text, p_applicant text, p_items text[], p_contact boolean)
     RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_applicant = p_employer THEN RETURN 'You can’t apply to an opportunity you posted.'; END IF;
     IF NOT crr_approved(p_tenant, p_employer) THEN RETURN 'This employer is not approved by your institution.'; END IF;
     IF coalesce(array_length(p_items, 1), 0) > 10 THEN RETURN 'Share at most 10 items.'; END IF;
     INSERT INTO crr_shares (posting_ref, applicant_id, tenant_id, employer_id, item_ids, share_contact)
       VALUES (p_posting, p_applicant, p_tenant, p_employer, coalesce(p_items, '{}'), p_contact)
       ON CONFLICT (posting_ref, applicant_id) DO UPDATE SET item_ids = EXCLUDED.item_ids, share_contact = EXCLUDED.share_contact, shared_at = now();
     INSERT INTO crr_events (tenant_id, employer_id, actor_id, action, detail) VALUES (p_tenant, p_employer, p_applicant, 'shared', p_posting);
     RETURN 'ok';
   END $$`,
];
