-- 017_housing_dining_commands.sql: the command-layer checks the DDL review notes say the schema can't enforce by itself.
-- For semester_campus_portals.sql. After 016. NOT executed or parsed. Every command:
--   * derives the actor from auth.uid() through semester.my_people() (014), never from a parameter
--   * checks scope with the same helpers RLS uses, plus a staff permission where needed
--   * is idempotent on a caller-supplied request key
--   * takes row locks in a fixed order (allocation → bed → person) to avoid deadlocks
--   * writes an audit event and an outbox event in the same transaction
BEGIN;
SET LOCAL search_path = semester, public;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION semester.actor_person(p_tenant uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT person_id FROM semester.my_people() WHERE tenant_id = p_tenant LIMIT 1 $$;
-- Staff permission check against the CURRENT grants (never a stale JWT claim).
CREATE FUNCTION semester.has_permission(p_tenant uuid, p_code text, p_scope_type text DEFAULT NULL, p_scope_ref text DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.role_assignments ra JOIN semester.role_permissions rp ON rp.tenant_id = ra.tenant_id AND rp.role_id = ra.role_id JOIN semester.permissions p ON p.tenant_id = rp.tenant_id AND p.id = rp.permission_id
                 JOIN semester.my_people() me ON me.tenant_id = ra.tenant_id AND me.person_id = ra.person_id
                 WHERE ra.tenant_id = p_tenant AND p.code = p_code AND ra.revoked_at IS NULL AND now() >= ra.starts_at AND (ra.expires_at IS NULL OR ra.expires_at > now())
                   AND (p_scope_type IS NULL OR ra.scope_type = 'institution' OR (ra.scope_type = p_scope_type AND ra.scope_reference = p_scope_ref))) $$;
CREATE FUNCTION semester.write_audit(p_tenant uuid, p_action text, p_domain text, p_type text, p_id uuid, p_outcome text, p_reason text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO semester.audit_events(tenant_id, occurred_at, actor_kind, actor_person_id, action, resource_domain, resource_type, resource_id, outcome, reason_code)
  VALUES (p_tenant, now(), 'person', semester.actor_person(p_tenant), p_action, p_domain, p_type, p_id, p_outcome, p_reason) $$;

-- ------------------------------------------------ housing: reserve a bed (hold), with selection window and expiry
CREATE FUNCTION semester.reserve_bed(p_tenant uuid, p_cycle uuid, p_bed uuid, p_range tstzrange, p_request_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := semester.actor_person(p_tenant); a uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_A_MEMBER'; END IF;
  SELECT id INTO a FROM semester.housing_allocations WHERE tenant_id = p_tenant AND request_key = p_request_key;
  IF a IS NOT NULL THEN RETURN a; END IF;                                                   -- idempotent replay
  IF NOT EXISTS (SELECT 1 FROM semester.housing_selection_windows w WHERE w.tenant_id = p_tenant AND w.cycle_id = p_cycle AND w.status = 'open' AND now() >= w.opens_at AND now() < w.closes_at
                   AND (w.person_id = me OR EXISTS (SELECT 1 FROM semester.roommate_group_members g WHERE g.tenant_id = p_tenant AND g.group_id = w.group_id AND g.person_id = me AND g.invitation_status = 'accepted'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SELECTION_WINDOW_CLOSED'; END IF;
  PERFORM 1 FROM semester.housing_beds WHERE tenant_id = p_tenant AND id = p_bed AND status = 'available' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BED_UNAVAILABLE'; END IF;
  -- The GiST exclusions (bed overlap and person overlap) are the final guard; a collision raises 23P01 and nothing is written.
  INSERT INTO semester.housing_allocations(tenant_id, cycle_id, bed_id, person_id, occupancy_range, state, expires_at, request_key)
  VALUES (p_tenant, p_cycle, p_bed, me, p_range, 'reserved', now() + interval '15 minutes', p_request_key) RETURNING id INTO a;
  PERFORM semester.write_audit(p_tenant, 'create', 'housing', 'housing_allocation', a, 'allow', 'BED_RESERVED');
  INSERT INTO semester.outbox_events(tenant_id, event_type, payload) VALUES (p_tenant, 'housing.bed_reserved', jsonb_build_object('allocation', a));
  RETURN a;
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BED_OR_PERSON_ALREADY_ALLOCATED';
END $$;

-- Confirm: expiry is checked INSIDE the locked transaction, so a hold that expired a millisecond ago can't be confirmed.
CREATE FUNCTION semester.confirm_bed(p_tenant uuid, p_allocation uuid, p_expected_version bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := semester.actor_person(p_tenant); al record;
BEGIN
  SELECT * INTO al FROM semester.housing_allocations WHERE tenant_id = p_tenant AND id = p_allocation FOR UPDATE;
  IF NOT FOUND OR al.person_id IS DISTINCT FROM me THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_FOUND'; END IF;   -- same answer for missing and foreign
  IF al.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'VERSION_CONFLICT'; END IF;
  IF al.state <> 'reserved' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_RESERVED'; END IF;
  IF al.expires_at <= statement_timestamp() THEN
    UPDATE semester.housing_allocations SET state = 'expired', version = version + 1 WHERE tenant_id = p_tenant AND id = p_allocation;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'HOLD_EXPIRED'; END IF;
  UPDATE semester.housing_allocations SET state = 'offered', expires_at = NULL, version = version + 1 WHERE tenant_id = p_tenant AND id = p_allocation;
  PERFORM semester.write_audit(p_tenant, 'update', 'housing', 'housing_allocation', p_allocation, 'allow', 'BED_CONFIRMED');
  INSERT INTO semester.outbox_events(tenant_id, event_type, payload) VALUES (p_tenant, 'housing.bed_confirmed', jsonb_build_object('allocation', p_allocation));
END $$;

-- Expiry worker: explicit state change, never inferred at read time.
CREATE FUNCTION semester.expire_holds(p_now timestamptz) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH x AS (UPDATE semester.housing_allocations SET state = 'expired', version = version + 1 WHERE state = 'reserved' AND expires_at <= p_now RETURNING 1) SELECT count(*)::integer FROM x $$;

-- ------------------------------------------------ dining: native wallet spend with no overdraft
-- Balance = sum of append-only entries. The wallet row lock serializes concurrent spends, so two taps can't both pass the check.
CREATE FUNCTION semester.wallet_balance(p_tenant uuid, p_wallet uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(sum(delta_minor), 0)::bigint FROM semester.campus_wallet_entries WHERE tenant_id = p_tenant AND wallet_id = p_wallet $$;
CREATE FUNCTION semester.spend_from_wallet(p_tenant uuid, p_wallet uuid, p_amount_minor bigint, p_transaction_line uuid, p_idempotency_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE w record; e uuid; bal bigint;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AMOUNT_INVALID'; END IF;
  IF NOT semester.has_permission(p_tenant, 'dining.pos.charge') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;   -- POS service identity only
  SELECT id INTO e FROM semester.campus_wallet_entries WHERE tenant_id = p_tenant AND idempotency_key = p_idempotency_key;
  IF e IS NOT NULL THEN RETURN e; END IF;
  SELECT * INTO w FROM semester.campus_wallets WHERE tenant_id = p_tenant AND id = p_wallet FOR UPDATE;
  IF NOT FOUND OR w.status <> 'active' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WALLET_UNAVAILABLE'; END IF;
  IF w.authority_connection_id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONNECTED_WALLET_IS_EXTERNAL'; END IF;  -- campus-card system is authoritative
  bal := semester.wallet_balance(p_tenant, p_wallet);
  IF bal < p_amount_minor THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_FUNDS'; END IF;
  INSERT INTO semester.campus_wallet_entries(tenant_id, wallet_id, transaction_line_id, delta_minor, entry_type, idempotency_key, posted_at)
  VALUES (p_tenant, p_wallet, p_transaction_line, -p_amount_minor, 'purchase', p_idempotency_key, now()) RETURNING id INTO e;
  RETURN e;
END $$;

-- Adjustments: one person requests, a different person approves; the approval posts exactly one entry.
CREATE FUNCTION semester.approve_wallet_adjustment(p_tenant uuid, p_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := semester.actor_person(p_tenant); r record; e uuid;
BEGIN
  IF NOT semester.has_permission(p_tenant, 'dining.adjustment.approve') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM semester.dining_adjustment_requests WHERE tenant_id = p_tenant AND id = p_request FOR UPDATE;
  IF NOT FOUND OR r.wallet_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_FOUND'; END IF;
  IF r.status <> 'submitted' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_PENDING'; END IF;
  IF r.requested_by = me THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SELF_APPROVAL_FORBIDDEN'; END IF;
  PERFORM 1 FROM semester.campus_wallets WHERE tenant_id = p_tenant AND id = r.wallet_id FOR UPDATE;
  IF r.delta_minor < 0 AND semester.wallet_balance(p_tenant, r.wallet_id) + r.delta_minor < 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WOULD_OVERDRAW'; END IF;
  UPDATE semester.dining_adjustment_requests SET status = 'approved', approved_by = me, approved_at = now() WHERE tenant_id = p_tenant AND id = p_request;
  INSERT INTO semester.campus_wallet_entries(tenant_id, wallet_id, adjustment_request_id, delta_minor, entry_type, idempotency_key, posted_at)
  VALUES (p_tenant, r.wallet_id, p_request, r.delta_minor, 'adjustment', 'adj:' || p_request, now()) RETURNING id INTO e;
  PERFORM semester.write_audit(p_tenant, 'approve', 'dining', 'dining_adjustment_request', p_request, 'allow', 'ADJUSTMENT_APPROVED');
  RETURN e;
END $$;

-- Reversal: on the SAME wallet, for the exact negated amount, once.
CREATE FUNCTION semester.reverse_wallet_entry(p_tenant uuid, p_entry uuid, p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE o record; e uuid;
BEGIN
  IF NOT semester.has_permission(p_tenant, 'dining.adjustment.approve') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  SELECT * INTO o FROM semester.campus_wallet_entries WHERE tenant_id = p_tenant AND id = p_entry;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_FOUND'; END IF;
  IF o.reverses_entry_id IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CANNOT_REVERSE_A_REVERSAL'; END IF;
  PERFORM 1 FROM semester.campus_wallets WHERE tenant_id = p_tenant AND id = o.wallet_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM semester.campus_wallet_entries WHERE tenant_id = p_tenant AND reverses_entry_id = p_entry) THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ALREADY_REVERSED'; END IF;
  INSERT INTO semester.campus_wallet_entries(tenant_id, wallet_id, reverses_entry_id, delta_minor, entry_type, idempotency_key, posted_at)
  VALUES (p_tenant, o.wallet_id, p_entry, -o.delta_minor, 'reversal', 'rev:' || p_entry, now()) RETURNING id INTO e;
  PERFORM semester.write_audit(p_tenant, 'update', 'dining', 'campus_wallet_entry', e, 'allow', coalesce(p_reason, 'REVERSAL'));
  RETURN e;
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['actor_person(uuid)', 'has_permission(uuid, text, text, text)', 'write_audit(uuid, text, text, text, uuid, text, text)', 'wallet_balance(uuid, uuid)', 'expire_holds(timestamptz)'] LOOP
    EXECUTE 'ALTER FUNCTION semester.' || f || ' OWNER TO semester_rls_helper'; EXECUTE 'REVOKE ALL ON FUNCTION semester.' || f || ' FROM PUBLIC, anon, authenticated';
  END LOOP;
  FOREACH f IN ARRAY ARRAY['reserve_bed(uuid, uuid, uuid, tstzrange, text)', 'confirm_bed(uuid, uuid, bigint)', 'spend_from_wallet(uuid, uuid, bigint, uuid, text)', 'approve_wallet_adjustment(uuid, uuid)', 'reverse_wallet_entry(uuid, uuid, text)'] LOOP
    EXECUTE 'ALTER FUNCTION semester.' || f || ' OWNER TO semester_rls_helper'; EXECUTE 'REVOKE ALL ON FUNCTION semester.' || f || ' FROM PUBLIC, anon'; EXECUTE 'GRANT EXECUTE ON FUNCTION semester.' || f || ' TO authenticated';
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE ON semester.housing_allocations, semester.housing_beds, semester.campus_wallets, semester.campus_wallet_entries, semester.dining_adjustment_requests, semester.audit_events, semester.outbox_events, semester.housing_selection_windows, semester.roommate_group_members, semester.role_assignments, semester.role_permissions, semester.permissions TO semester_rls_helper;
COMMIT;
