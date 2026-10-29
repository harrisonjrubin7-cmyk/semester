// Migration dpl-001: degree plans (role apps "Student": planning, term plans; "Academic Advisor": plans).
// One plan per student per institution: an ordered list of future terms with planned courses (content jsonb, checked by
// lib/planRules.ts). The student edits and submits; an advisor the student has shared with (never the student) approves or
// asks for changes with a note. Approval freezes a copy (approved_content) that later edits never touch; editing an
// approved plan starts a new draft while the last approved copy stays readable. A plan is advice: it registers nobody.
// History is append-only.
export const DPL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dpl_plans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL,
     content jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(content) = 'array' AND jsonb_array_length(content) <= 12),
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'submitted', 'changes_requested', 'approved')),
     review_note text NOT NULL DEFAULT '', reviewed_by text, approved_content jsonb, approved_by text, approved_at timestamptz,
     version int NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, student_id),
     CHECK (reviewed_by IS NULL OR reviewed_by <> student_id), CHECK (approved_by IS NULL OR approved_by <> student_id),
     CHECK (state <> 'approved' OR (approved_by IS NOT NULL AND approved_content IS NOT NULL AND approved_content = content)),
     CHECK (state <> 'changes_requested' OR length(trim(review_note)) >= 10))`,
  `CREATE TABLE IF NOT EXISTS dpl_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, plan_id bigint NOT NULL REFERENCES dpl_plans(id),
     actor_id text NOT NULL, step text NOT NULL, note text NOT NULL DEFAULT '', snapshot jsonb, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dpl_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS dpl_events_append_only ON dpl_events`,
  `CREATE TRIGGER dpl_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dpl_events FOR EACH STATEMENT EXECUTE FUNCTION dpl_refuse_change()`,
  /** Student saves the whole plan. p_version 0 creates it. Editing a submitted plan is refused; recall it first. */
  `CREATE OR REPLACE FUNCTION dpl_save(p_tenant text, p_student text, p_content jsonb, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r dpl_plans%ROWTYPE; BEGIN
     IF jsonb_typeof(p_content) <> 'array' OR jsonb_array_length(p_content) > 12 THEN RETURN 'A plan holds at most 12 terms.'; END IF;
     SELECT * INTO r FROM dpl_plans WHERE tenant_id = p_tenant AND student_id = p_student FOR UPDATE;
     IF NOT FOUND THEN
       IF p_version <> 0 THEN RETURN 'Your plan changed since you opened it. Reload and try again.'; END IF;
       INSERT INTO dpl_plans (tenant_id, student_id, content) VALUES (p_tenant, p_student, p_content) RETURNING * INTO r;
     ELSE
       IF p_version IS DISTINCT FROM r.version THEN RETURN 'Your plan changed since you opened it. Reload and try again.'; END IF;
       IF r.state = 'submitted' THEN RETURN 'Your plan is with your advisor. Recall it to edit.'; END IF;
       UPDATE dpl_plans SET content = p_content, state = 'draft', version = version + 1, updated_at = now() WHERE id = r.id RETURNING * INTO r;
     END IF;
     INSERT INTO dpl_events (tenant_id, plan_id, actor_id, step) VALUES (p_tenant, r.id, p_student, 'save');
     RETURN 'ok:' || r.id;
   END $$`,
  /** submit / recall by the student; approve / changes by an advisor the student has shared with. */
  `CREATE OR REPLACE FUNCTION dpl_step(p_tenant text, p_actor text, p_is_advisor_for boolean, p_step text, p_id bigint, p_version int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r dpl_plans%ROWTYPE; BEGIN
     SELECT * INTO r FROM dpl_plans WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Plan not found.'; END IF;
     IF p_version IS DISTINCT FROM r.version THEN RETURN 'This plan changed since you opened it. Reload and try again.'; END IF;
     IF p_step = 'submit' THEN
       IF p_actor <> r.student_id THEN RETURN 'Only the student submits their plan.'; END IF;
       IF r.state NOT IN ('draft', 'changes_requested') THEN RETURN 'There is nothing new to submit.'; END IF;
       IF jsonb_array_length(r.content) = 0 THEN RETURN 'Add at least one term first.'; END IF;
       UPDATE dpl_plans SET state = 'submitted', version = version + 1, updated_at = now() WHERE id = r.id;
     ELSIF p_step = 'recall' THEN
       IF p_actor <> r.student_id THEN RETURN 'Only the student recalls their plan.'; END IF;
       IF r.state <> 'submitted' THEN RETURN 'Your plan is not with an advisor.'; END IF;
       UPDATE dpl_plans SET state = 'draft', version = version + 1, updated_at = now() WHERE id = r.id;
     ELSIF p_step IN ('approve', 'changes') THEN
       IF p_actor = r.student_id THEN RETURN 'You cannot review your own plan.'; END IF;
       IF NOT p_is_advisor_for THEN RETURN 'Only an advisor this student shared their plan with can review it.'; END IF;
       IF r.state <> 'submitted' THEN RETURN 'This plan is not waiting for review.'; END IF;
       IF p_step = 'changes' THEN
         IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say what should change (10+ characters).'; END IF;
         UPDATE dpl_plans SET state = 'changes_requested', review_note = trim(p_note), reviewed_by = p_actor, version = version + 1, updated_at = now() WHERE id = r.id;
       ELSE
         UPDATE dpl_plans SET state = 'approved', review_note = trim(coalesce(p_note, '')), reviewed_by = p_actor, approved_by = p_actor, approved_at = now(),
           approved_content = r.content, version = version + 1, updated_at = now() WHERE id = r.id;
       END IF;
     ELSE RETURN 'Unknown step.'; END IF;
     INSERT INTO dpl_events (tenant_id, plan_id, actor_id, step, note, snapshot) VALUES (p_tenant, r.id, p_actor, p_step, coalesce(p_note, ''), CASE WHEN p_step = 'approve' THEN r.content END);
     RETURN 'ok:' || r.id;
   END $$`,
];
