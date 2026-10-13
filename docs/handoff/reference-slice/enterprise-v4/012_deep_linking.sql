-- 012_deep_linking.sql: Deep Linking selections are PENDING until the platform shows it created them (LTI audit PDF, 6 Oct).
-- After 011. NOT executed or parsed.
-- Returning an ltiResourceLink with a lineItem doesn't mean the platform kept it: the instructor may cancel, and only
-- accept_lineitem = true promises a column. So Semester records the selection as pending, waits for a launch from the new
-- resource link (or an authorized discovery), then binds the platform-created column. It never POSTs a second column meanwhile.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE sx_private.deep_link_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES sx_private.lti_contexts(id),
  activity_key text NOT NULL,
  placement text NOT NULL,                                    -- e.g. Canvas assignment_selection, course_assignments_menu, module_index_menu_modal
  accept_lineitem boolean,                                    -- NULL = absent: don't assume line-item support
  auto_create boolean,                                        -- false or NULL: don't assume persistence without a cancel option
  request_data_hash bytea,                                    -- the opaque `data` we must echo back unchanged
  response_jti text NOT NULL UNIQUE,                          -- one signed response per selection
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'persisted', 'abandoned')),
  persisted_resource_link_id uuid REFERENCES sx_private.lti_resource_links(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'persisted') = (persisted_resource_link_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_pending_selection ON sx_private.deep_link_selections(context_id, activity_key) WHERE status = 'pending';

-- Called on the first resource-link launch carrying our activity_key in custom params: confirm persistence and stop.
CREATE FUNCTION sx_private.confirm_deep_link(p_context uuid, p_activity_key text, p_resource_link uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s uuid;
BEGIN
  UPDATE sx_private.deep_link_selections SET status = 'persisted', persisted_resource_link_id = p_resource_link
   WHERE context_id = p_context AND activity_key = p_activity_key AND status = 'pending' RETURNING id INTO s;
  RETURN s;   -- caller then discovers the line item by resourceId = activity_key and binds it (bind_lineitem, bound_by = 'deep_link')
END $$;
-- Swept daily: selections never launched within 14 days are abandoned (the instructor likely cancelled). Nothing is created.
CREATE FUNCTION sx_private.abandon_stale_deep_links(p_now timestamptz) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH d AS (UPDATE sx_private.deep_link_selections SET status = 'abandoned' WHERE status = 'pending' AND created_at < p_now - interval '14 days' RETURNING 1) SELECT count(*)::integer FROM d $$;
-- While a selection is pending for an activity, direct AGS creation is refused: discover and reconcile first.
CREATE FUNCTION sx_private.assert_no_pending_deep_link(p_context uuid, p_activity_key text) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM sx_private.deep_link_selections WHERE context_id = p_context AND activity_key = p_activity_key AND status = 'pending') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'DEEP_LINK_PENDING'; END IF;
END $$;
ALTER TABLE sx_private.deep_link_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.deep_link_selections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sx_private.confirm_deep_link(uuid, text, uuid), sx_private.abandon_stale_deep_links(timestamptz), sx_private.assert_no_pending_deep_link(uuid, text) FROM PUBLIC, anon, authenticated;
COMMIT;
