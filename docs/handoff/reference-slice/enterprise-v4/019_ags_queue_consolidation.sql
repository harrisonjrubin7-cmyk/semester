-- 019_ags_queue_consolidation.sql: one grade-sync queue. Adopts the lane/fence design from your Canvas AGS service package and retires
-- 007's ags_score_events + ags_deliveries. After 018. NOT executed or parsed.
-- A lane = (deployment line item, platform user). Jobs in a lane run strictly by revision; a lease + fence stops a worker whose lease
-- expired from completing over a newer one. Line items, result snapshots and LTI registrations stay from 007–009.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS sx_private.enqueue_score(uuid, text, uuid, numeric, numeric, text, timestamptz);
DROP TABLE IF EXISTS sx_private.ags_deliveries;
DROP TABLE IF EXISTS sx_private.ags_score_events;

CREATE TABLE sx_private.ags_lanes (
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  lane_key text NOT NULL,                       -- lineitem_id || ':' || platform_sub
  lineitem_id uuid NOT NULL REFERENCES sx_private.ags_lineitems(id),
  platform_sub text NOT NULL,
  owner uuid,                                    -- worker id holding the lease
  lease_until timestamptz,
  fence bigint NOT NULL DEFAULT 0,               -- incremented on every claim
  blocked_reason text,                           -- set on action_required; a human clears it
  PRIMARY KEY (tenant_id, lane_key),
  UNIQUE (lineitem_id, platform_sub)
);
CREATE TABLE sx_private.ags_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lane_key text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),            -- grade revision number; strictly increasing in a lane
  grade_revision_id uuid NOT NULL,
  event_key text NOT NULL,                                  -- idempotency: one job per published revision
  payload jsonb NOT NULL,                                   -- the exact approved AGS score body
  payload_hash text NOT NULL,
  event_timestamp timestamptz NOT NULL,                     -- preserved across retries
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'delivering', 'retry_scheduled', 'outcome_unknown', 'delivered', 'delivered_unverified', 'verified', 'conflict', 'action_required', 'superseded')),
  attempts integer NOT NULL DEFAULT 0,
  due_at timestamptz NOT NULL DEFAULT now(),
  completed_fence bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_key),
  UNIQUE (tenant_id, lane_key, revision),
  FOREIGN KEY (tenant_id, lane_key) REFERENCES sx_private.ags_lanes(tenant_id, lane_key),
  CHECK ((payload ? 'scoreMaximum') OR NOT (payload ? 'scoreGiven')),          -- Canvas returns 422 without a denominator
  CHECK (payload ? 'userId' AND payload ? 'timestamp' AND payload ? 'activityProgress' AND payload ? 'gradingProgress')
);
CREATE INDEX ags_jobs_due ON sx_private.ags_jobs(due_at) WHERE state IN ('queued', 'retry_scheduled', 'outcome_unknown');
CREATE TABLE sx_private.ags_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES sx_private.ags_jobs(id),
  event_type text NOT NULL,
  reason_code text,
  http_status integer,
  fence bigint,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER ags_audit_append_only BEFORE UPDATE OR DELETE ON sx_private.ags_audit FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();

-- Enqueue inside the grade-publication transaction. Older unsent jobs in the lane are superseded so a stale grade can't overtake.
CREATE FUNCTION sx_private.enqueue_score(p_tenant uuid, p_lineitem uuid, p_sub text, p_revision bigint, p_grade_revision uuid, p_payload jsonb, p_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k text := p_lineitem::text || ':' || p_sub; j uuid;
BEGIN
  INSERT INTO sx_private.ags_lanes(tenant_id, lane_key, lineitem_id, platform_sub) VALUES (p_tenant, k, p_lineitem, p_sub) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM sx_private.ags_lanes WHERE tenant_id = p_tenant AND lane_key = k FOR UPDATE;
  UPDATE sx_private.ags_jobs SET state = 'superseded' WHERE tenant_id = p_tenant AND lane_key = k AND revision < p_revision AND state IN ('queued', 'retry_scheduled');
  INSERT INTO sx_private.ags_jobs(tenant_id, lane_key, revision, grade_revision_id, event_key, payload, payload_hash, event_timestamp)
  VALUES (p_tenant, k, p_revision, p_grade_revision, 'grade:' || p_grade_revision, p_payload, encode(extensions.digest(p_payload::text, 'sha256'), 'hex'), p_at)
  ON CONFLICT (tenant_id, event_key) DO UPDATE SET state = sx_private.ags_jobs.state
  RETURNING id INTO j;
  RETURN j;
END $$;

-- Claim: the oldest due job whose lane is free (no live lease, not blocked, no earlier unfinished revision). SKIP LOCKED for parallel workers.
CREATE FUNCTION sx_private.claim_ags_job(p_worker uuid, p_lease interval DEFAULT interval '60 seconds') RETURNS TABLE(job_id uuid, lane_key text, fence bigint, payload jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j record; f bigint;
BEGIN
  SELECT jb.* INTO j FROM sx_private.ags_jobs jb JOIN sx_private.ags_lanes l ON l.tenant_id = jb.tenant_id AND l.lane_key = jb.lane_key
   WHERE jb.state IN ('queued', 'retry_scheduled', 'outcome_unknown') AND jb.due_at <= now() AND l.blocked_reason IS NULL AND (l.lease_until IS NULL OR l.lease_until < now())
     AND NOT EXISTS (SELECT 1 FROM sx_private.ags_jobs e WHERE e.tenant_id = jb.tenant_id AND e.lane_key = jb.lane_key AND e.revision < jb.revision AND e.state IN ('queued', 'delivering', 'retry_scheduled', 'outcome_unknown'))
   ORDER BY jb.due_at FOR UPDATE OF jb, l SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE sx_private.ags_lanes SET owner = p_worker, lease_until = now() + p_lease, fence = fence + 1 WHERE tenant_id = j.tenant_id AND lane_key = j.lane_key RETURNING sx_private.ags_lanes.fence INTO f;
  UPDATE sx_private.ags_jobs SET state = CASE WHEN j.state = 'outcome_unknown' THEN 'outcome_unknown' ELSE 'delivering' END, attempts = attempts + 1 WHERE id = j.id;
  INSERT INTO sx_private.ags_audit(tenant_id, job_id, event_type, fence) VALUES (j.tenant_id, j.id, 'claimed', f);
  RETURN QUERY SELECT j.id, j.lane_key, f, j.payload;
END $$;

-- Complete: only the current fence holder can record an outcome. A stale worker gets FENCE_LOST and changes nothing.
CREATE FUNCTION sx_private.complete_ags_job(p_job uuid, p_fence bigint, p_state text, p_http integer, p_reason text, p_retry_after interval DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE j record; l record;
BEGIN
  IF p_state NOT IN ('delivered', 'delivered_unverified', 'verified', 'conflict', 'action_required', 'retry_scheduled', 'outcome_unknown') THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'BAD_STATE'; END IF;
  SELECT * INTO j FROM sx_private.ags_jobs WHERE id = p_job FOR UPDATE;
  SELECT * INTO l FROM sx_private.ags_lanes WHERE tenant_id = j.tenant_id AND lane_key = j.lane_key FOR UPDATE;
  IF l.fence <> p_fence THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'FENCE_LOST'; END IF;
  UPDATE sx_private.ags_jobs SET state = p_state, completed_fence = p_fence,
         due_at = CASE WHEN p_state IN ('retry_scheduled', 'outcome_unknown') THEN now() + coalesce(p_retry_after, least(interval '1 hour', make_interval(secs => 15 * power(2, least(j.attempts, 8))::int))) ELSE due_at END
   WHERE id = p_job;
  UPDATE sx_private.ags_lanes SET owner = NULL, lease_until = NULL, blocked_reason = CASE WHEN p_state = 'action_required' THEN coalesce(p_reason, 'ACTION_REQUIRED') ELSE blocked_reason END
   WHERE tenant_id = j.tenant_id AND lane_key = j.lane_key;
  INSERT INTO sx_private.ags_audit(tenant_id, job_id, event_type, reason_code, http_status, fence) VALUES (j.tenant_id, p_job, p_state, p_reason, p_http, p_fence);
  -- After 8 attempts a retryable job becomes action_required; it never silently disappears.
  IF p_state = 'retry_scheduled' AND j.attempts >= 8 THEN
    UPDATE sx_private.ags_jobs SET state = 'action_required' WHERE id = p_job;
    UPDATE sx_private.ags_lanes SET blocked_reason = 'RETRY_BUDGET_EXHAUSTED' WHERE tenant_id = j.tenant_id AND lane_key = j.lane_key;
  END IF;
END $$;

ALTER TABLE sx_private.ags_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.ags_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.ags_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.ags_lanes, sx_private.ags_jobs, sx_private.ags_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sx_private.enqueue_score(uuid, uuid, text, bigint, uuid, jsonb, timestamptz), sx_private.claim_ags_job(uuid, interval), sx_private.complete_ags_job(uuid, bigint, text, integer, text, interval) FROM PUBLIC, anon, authenticated;

-- Faculty read model now reads lanes and jobs (replaces 007's version).
CREATE OR REPLACE FUNCTION sx_private.grade_sync_status(p_section uuid) RETURNS TABLE(assignment_id uuid, platform_sub_masked text, state text, attempts integer, updated timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT li.assignment_id, left(l.platform_sub, 4) || '…', j.state, j.attempts, j.due_at
  FROM sx_private.ags_jobs j JOIN sx_private.ags_lanes l ON l.tenant_id = j.tenant_id AND l.lane_key = j.lane_key
  JOIN sx_private.ags_lineitems li ON li.id = l.lineitem_id JOIN sx_private.lti_contexts c ON c.id = li.context_id
  WHERE c.section_id = p_section AND j.state <> 'superseded'
    AND EXISTS (SELECT 1 FROM sx_private.role_assignments ra JOIN sx_private.role_permissions rp ON rp.role_id = ra.role_id JOIN sx_private.permissions p ON p.id = rp.permission_id
                JOIN sx_private.memberships m ON m.id = ra.membership_id
                WHERE m.user_id = auth.uid() AND m.status = 'active' AND p.code = 'course.manage' AND ra.section_id = p_section AND (ra.expires_at IS NULL OR ra.expires_at > now())) $$;
COMMIT;
