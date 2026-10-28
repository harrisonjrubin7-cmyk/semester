// Faculty → student verified portfolio evidence (C16, owner register S-85). The student asks an instructor of a section
// they took to verify one of their own portfolio items; the instructor confirms with a short bounded statement or
// declines. The claim belongs to the student: it travels only with the item, only when the student shares that item,
// and the student can withdraw it. Every step logged append-only.
export const VFY_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS vfy_claims (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, item_id text NOT NULL,
     section_id text NOT NULL, instructor_id text NOT NULL, state text NOT NULL DEFAULT 'Requested' CHECK (state IN ('Requested','Verified','Declined','Withdrawn')),
     statement text NOT NULL DEFAULT '' CHECK (length(statement) <= 300), requested_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
     CHECK (student_id <> instructor_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vfy_one_open ON vfy_claims (item_id, instructor_id) WHERE state IN ('Requested','Verified')`,
  `CREATE TABLE IF NOT EXISTS vfy_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, claim_id bigint NOT NULL, actor_id text NOT NULL,
     action text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION vfy_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The verification log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'vfy_events_append_only') THEN
     CREATE TRIGGER vfy_events_append_only BEFORE UPDATE OR DELETE ON vfy_events FOR EACH ROW EXECUTE FUNCTION vfy_refuse_change(); END IF; END $$`,
  // p_owns and p_taught are checked by the server: the item is the student's, and the instructor teaches a section the student took.
  `CREATE OR REPLACE FUNCTION vfy_request(p_student text, p_tenant text, p_item text, p_owns boolean, p_section text, p_instructor text, p_taught boolean)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v bigint;
   BEGIN
     IF NOT p_owns THEN RETURN 'You can only ask about your own portfolio items.'; END IF;
     IF NOT p_taught THEN RETURN 'Ask an instructor of a section you took.'; END IF;
     IF p_student = p_instructor THEN RETURN 'You cannot verify your own work.'; END IF;
     BEGIN
       INSERT INTO vfy_claims (tenant_id, student_id, item_id, section_id, instructor_id) VALUES (p_tenant, p_student, p_item, p_section, p_instructor) RETURNING id INTO v;
     EXCEPTION WHEN unique_violation THEN RETURN 'You already asked this instructor about this item.'; END;
     INSERT INTO vfy_events (tenant_id, claim_id, actor_id, action) VALUES (p_tenant, v, p_student, 'requested');
     RETURN 'ok:' || v;
   END $$`,
  `CREATE OR REPLACE FUNCTION vfy_decide(p_actor text, p_tenant text, p_id bigint, p_verify boolean, p_statement text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r vfy_claims%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM vfy_claims WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF r.instructor_id <> p_actor THEN RETURN 'Only the instructor asked can answer this.'; END IF;
     IF r.state <> 'Requested' THEN RETURN 'This request was already answered or withdrawn.'; END IF;
     IF p_verify AND length(trim(coalesce(p_statement,''))) < 10 THEN RETURN 'Write what you can verify (10 to 300 characters).'; END IF;
     UPDATE vfy_claims SET state = CASE WHEN p_verify THEN 'Verified' ELSE 'Declined' END, statement = CASE WHEN p_verify THEN left(trim(p_statement), 300) ELSE '' END,
       decided_at = now() WHERE id = p_id;
     INSERT INTO vfy_events (tenant_id, claim_id, actor_id, action) VALUES (p_tenant, p_id, p_actor, CASE WHEN p_verify THEN 'verified' ELSE 'declined' END);
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION vfy_withdraw(p_student text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r vfy_claims%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM vfy_claims WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR r.student_id <> p_student THEN RETURN 'Request not found.'; END IF;
     IF r.state NOT IN ('Requested','Verified') THEN RETURN 'Nothing to withdraw.'; END IF;
     UPDATE vfy_claims SET state = 'Withdrawn' WHERE id = p_id;
     INSERT INTO vfy_events (tenant_id, claim_id, actor_id, action) VALUES (p_tenant, p_id, p_student, 'withdrawn');
     RETURN 'ok';
   END $$`,
];
