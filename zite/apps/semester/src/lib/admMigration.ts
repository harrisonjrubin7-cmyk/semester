// Admissions connections C07–C09 (owner register S-85). An administrator assigns each submitted application to a reviewer;
// only that reviewer (or an administrator) sees it and drafts a decision. A draft carries an internal note the applicant
// never sees and a separate message for the applicant. Nothing reaches the applicant until the decision is released;
// release is version-checked and happens once. Every step is logged append-only.
export const ADM_DECISIONS = ['Admitted', 'Waitlisted', 'Declined'] as const;
export const ADM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS adm_reviews (application_id text PRIMARY KEY, tenant_id text NOT NULL, applicant_id text NOT NULL,
     reviewer_id text NOT NULL, assigned_by text NOT NULL, assigned_at timestamptz NOT NULL DEFAULT now(),
     decision text CHECK (decision IS NULL OR decision IN ('Admitted','Waitlisted','Declined')), internal_note text NOT NULL DEFAULT '',
     applicant_message text NOT NULL DEFAULT '', drafted_by text, version int NOT NULL DEFAULT 1,
     state text NOT NULL DEFAULT 'Assigned' CHECK (state IN ('Assigned','Drafted','Released')), released_by text, released_at timestamptz,
     CHECK (reviewer_id <> applicant_id), CHECK (released_by IS NULL OR released_by <> applicant_id))`,
  `CREATE TABLE IF NOT EXISTS adm_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, application_id text NOT NULL,
     actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION adm_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The admissions log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'adm_events_append_only') THEN
     CREATE TRIGGER adm_events_append_only BEFORE UPDATE OR DELETE ON adm_events FOR EACH ROW EXECUTE FUNCTION adm_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION adm_assign(p_actor text, p_tenant text, p_is_admin boolean, p_app text, p_applicant text, p_reviewer text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r adm_reviews%ROWTYPE;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an administrator assigns reviewers.'; END IF;
     IF p_reviewer = p_applicant OR p_actor = p_applicant THEN RETURN 'An applicant cannot review or assign their own application.'; END IF;
     SELECT * INTO r FROM adm_reviews WHERE application_id = p_app FOR UPDATE;
     IF FOUND AND r.tenant_id <> p_tenant THEN RETURN 'Application not found.'; END IF;
     IF FOUND AND r.state = 'Released' THEN RETURN 'The decision is already released.'; END IF;
     IF FOUND THEN
       UPDATE adm_reviews SET reviewer_id = p_reviewer, assigned_by = p_actor, assigned_at = now(), version = version + 1,
         state = 'Assigned', decision = NULL, internal_note = '', applicant_message = '', drafted_by = NULL WHERE application_id = p_app;
     ELSE
       INSERT INTO adm_reviews (application_id, tenant_id, applicant_id, reviewer_id, assigned_by) VALUES (p_app, p_tenant, p_applicant, p_reviewer, p_actor);
     END IF;
     INSERT INTO adm_events (tenant_id, application_id, actor_id, action, detail) VALUES (p_tenant, p_app, p_actor, 'assigned', p_reviewer);
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION adm_draft(p_actor text, p_tenant text, p_is_admin boolean, p_app text, p_decision text, p_internal text, p_message text, p_expected int)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r adm_reviews%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM adm_reviews WHERE application_id = p_app AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Assign a reviewer first.'; END IF;
     IF r.reviewer_id <> p_actor AND NOT p_is_admin THEN RETURN 'Only the assigned reviewer can decide this application.'; END IF;
     IF p_actor = r.applicant_id THEN RETURN 'You can’t decide your own application.'; END IF;
     IF r.state = 'Released' THEN RETURN 'The decision is already released.'; END IF;
     IF r.version <> p_expected THEN RETURN 'This application changed since you opened it. Reload and try again.'; END IF;
     IF p_decision NOT IN ('Admitted','Waitlisted','Declined') THEN RETURN 'Choose admit, waitlist or decline.'; END IF;
     IF length(trim(coalesce(p_message,''))) < 10 THEN RETURN 'Write the message the applicant will see (at least 10 characters).'; END IF;
     UPDATE adm_reviews SET decision = p_decision, internal_note = left(coalesce(p_internal,''), 4000), applicant_message = left(trim(p_message), 2000),
       drafted_by = p_actor, state = 'Drafted', version = version + 1 WHERE application_id = p_app;
     INSERT INTO adm_events (tenant_id, application_id, actor_id, action, detail) VALUES (p_tenant, p_app, p_actor, 'drafted', p_decision);
     RETURN 'ok:' || (r.version + 1);
   END $$`,
  // Returns 'ok:<decision>' the first time; the caller then updates the applicant-facing record. Re-release is refused.
  `CREATE OR REPLACE FUNCTION adm_release(p_actor text, p_tenant text, p_is_admin boolean, p_app text, p_expected int)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r adm_reviews%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM adm_reviews WHERE application_id = p_app AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Application not found.'; END IF;
     IF r.reviewer_id <> p_actor AND NOT p_is_admin THEN RETURN 'Only the assigned reviewer or an administrator can release the decision.'; END IF;
     IF p_actor = r.applicant_id THEN RETURN 'You can’t release your own decision.'; END IF;
     IF r.state = 'Released' THEN RETURN 'The decision is already released.'; END IF;
     IF r.state <> 'Drafted' THEN RETURN 'Draft a decision before releasing it.'; END IF;
     IF r.version <> p_expected THEN RETURN 'The draft changed since you reviewed it. Reload and check it again.'; END IF;
     UPDATE adm_reviews SET state = 'Released', released_by = p_actor, released_at = now(), version = version + 1 WHERE application_id = p_app;
     INSERT INTO adm_events (tenant_id, application_id, actor_id, action, detail) VALUES (p_tenant, p_app, p_actor, 'released', r.decision);
     RETURN 'ok:' || r.decision;
   END $$`,
];
