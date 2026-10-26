// Migration lby-001: library circulation and resource requests (S-76 E18; mirrors lib/libraryRules.ts).
// Enforced here: library staff are granted by an administrator, never themselves; the item row is locked while counting so
// two people can never take the last copy or seat; a hold kept ready for one patron is not lendable to another; renewals
// stop at 2 or when someone waits; a returned loan and a finished hold drop the patron (no reading history is kept, and the
// history log never names a patron for circulation); requests are decided by staff other than the requester, and approval
// needs a licence note and an accessibility answer. No fines: money movement stays disabled.
export const LBY_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS lby_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION lby_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM lby_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE TABLE IF NOT EXISTS lby_items (id bigserial PRIMARY KEY, tenant_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 300),
     author text NOT NULL DEFAULT '' CHECK (length(author) <= 200), kind text NOT NULL CHECK (kind IN ('print','ebook')), copies int NOT NULL CHECK (copies BETWEEN 0 AND 500),
     active boolean NOT NULL DEFAULT true, source_ref text NOT NULL DEFAULT '' CHECK (length(source_ref) <= 300), created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS lby_loans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, item_id bigint NOT NULL REFERENCES lby_items(id),
     patron_id text, state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','returned')), due_at timestamptz NOT NULL,
     renewals int NOT NULL DEFAULT 0 CHECK (renewals BETWEEN 0 AND 2), version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), returned_at timestamptz,
     UNIQUE (tenant_id, request_key), CHECK ((state = 'active') = (patron_id IS NOT NULL)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lby_loans_one_active ON lby_loans (tenant_id, item_id, patron_id) WHERE state = 'active'`,
  `CREATE TABLE IF NOT EXISTS lby_holds (id bigserial PRIMARY KEY, tenant_id text NOT NULL, item_id bigint NOT NULL REFERENCES lby_items(id), patron_id text,
     state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting','ready','fulfilled','cancelled','expired')), ready_until timestamptz,
     created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK ((state IN ('waiting','ready')) = (patron_id IS NOT NULL)), CHECK (state <> 'ready' OR ready_until IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lby_holds_one_live ON lby_holds (tenant_id, item_id, patron_id) WHERE state IN ('waiting','ready')`,
  `CREATE TABLE IF NOT EXISTS lby_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, requester_id text NOT NULL,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 300), reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 2000),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','license_review','approved','declined','published','withdrawn')), version int NOT NULL DEFAULT 1,
     license_note text NOT NULL DEFAULT '', accessible boolean, decision_note text NOT NULL DEFAULT '', decided_by text, item_id bigint REFERENCES lby_items(id),
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, requester_id, request_key),
     CHECK (decided_by IS NULL OR decided_by <> requester_id),
     CHECK (state NOT IN ('approved','published') OR (length(license_note) >= 10 AND accessible IS NOT NULL AND decided_by IS NOT NULL)),
     CHECK (state <> 'published' OR item_id IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS lby_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('item','loan','hold','request','staff')),
     subject_id bigint NOT NULL, step text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION lby_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'lby_events_append_only') THEN
       CREATE TRIGGER lby_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON lby_events FOR EACH STATEMENT EXECUTE FUNCTION lby_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own library access.'; END IF;
     IF p_on THEN
       INSERT INTO lby_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE lby_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'staff', 0, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_counts(p_item bigint, p_patron text, OUT loans int, OUT ready_others int) LANGUAGE sql STABLE AS $$
     SELECT (SELECT count(*)::int FROM lby_loans WHERE item_id = p_item AND state = 'active'),
            (SELECT count(*)::int FROM lby_holds WHERE item_id = p_item AND state = 'ready' AND patron_id IS DISTINCT FROM p_patron) $$`,
  `CREATE OR REPLACE FUNCTION lby_settle(p_tenant text, p_item bigint) RETURNS void LANGUAGE plpgsql AS $$
   DECLARE i lby_items; free int; h bigint;
   BEGIN
     SELECT * INTO i FROM lby_items WHERE id = p_item AND tenant_id = p_tenant;
     UPDATE lby_holds SET state = 'expired', patron_id = NULL WHERE item_id = p_item AND state = 'ready' AND ready_until < now();
     LOOP
       free := i.copies - (SELECT count(*) FROM lby_loans WHERE item_id = p_item AND state = 'active') - (SELECT count(*) FROM lby_holds WHERE item_id = p_item AND state = 'ready');
       EXIT WHEN free <= 0 OR NOT i.active;
       SELECT id INTO h FROM lby_holds WHERE item_id = p_item AND state = 'waiting' ORDER BY created_at, id LIMIT 1;
       EXIT WHEN h IS NULL;
       UPDATE lby_holds SET state = 'ready', ready_until = now() + interval '3 days' WHERE id = h;
       INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'hold', h, 'ready', 'system');
       h := NULL;
     END LOOP;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_item(p_tenant text, p_actor text, p_id bigint, p_title text, p_author text, p_kind text, p_copies int, p_active boolean, p_source text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; held int;
   BEGIN
     IF NOT lby_is_staff(p_tenant, p_actor) THEN RETURN 'Only library staff manage the catalog.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO lby_items (tenant_id, title, author, kind, copies, active, source_ref) VALUES (p_tenant, trim(p_title), trim(p_author), p_kind, p_copies, p_active, trim(p_source)) RETURNING id INTO v_id;
     ELSE
       PERFORM 1 FROM lby_items WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Item not found.'; END IF;
       SELECT count(*) INTO held FROM lby_loans WHERE item_id = p_id AND state = 'active';
       IF p_copies < held THEN RETURN held || ' copies are out on loan; copies cannot go below that.'; END IF;
       UPDATE lby_items SET title = trim(p_title), author = trim(p_author), copies = p_copies, active = p_active, source_ref = trim(p_source) WHERE id = p_id RETURNING id INTO v_id;
       PERFORM lby_settle(p_tenant, v_id);
     END IF;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'item', v_id, CASE WHEN p_id IS NULL THEN 'add' ELSE 'edit' END, p_actor, p_copies || ' copies');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_borrow(p_tenant text, p_key text, p_patron text, p_item bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i lby_items; l lby_loans; c record; mine_ready bigint; v_id bigint;
   BEGIN
     SELECT * INTO l FROM lby_loans WHERE tenant_id = p_tenant AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN l.patron_id = p_patron AND l.item_id = p_item THEN 'replay:' || l.id ELSE 'That request was already used. Refresh and try again.' END; END IF;
     SELECT * INTO i FROM lby_items WHERE id = p_item AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR NOT i.active THEN RETURN 'This item is not available in the catalog.'; END IF;
     PERFORM lby_settle(p_tenant, p_item);
     IF EXISTS (SELECT 1 FROM lby_loans WHERE item_id = p_item AND patron_id = p_patron AND state = 'active') THEN RETURN 'You already have this item.'; END IF;
     SELECT * INTO c FROM lby_counts(p_item, p_patron);
     SELECT id INTO mine_ready FROM lby_holds WHERE item_id = p_item AND patron_id = p_patron AND state = 'ready';
     IF mine_ready IS NULL AND i.copies - c.loans - c.ready_others <= 0 THEN RETURN 'No copy is free. Place a hold and you will be next in line.'; END IF;
     IF mine_ready IS NOT NULL AND i.copies - c.loans <= 0 THEN RETURN 'Your hold is ready but no copy is free yet; the library has been told.'; END IF;
     INSERT INTO lby_loans (tenant_id, request_key, item_id, patron_id, due_at) VALUES (p_tenant, p_key, p_item, p_patron, now() + CASE WHEN i.kind = 'ebook' THEN interval '14 days' ELSE interval '21 days' END) RETURNING id INTO v_id;
     UPDATE lby_holds SET state = 'fulfilled', patron_id = NULL WHERE item_id = p_item AND patron_id = p_patron AND state IN ('waiting','ready');
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'loan', v_id, 'borrow', 'patron');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_hold(p_tenant text, p_patron text, p_item bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i lby_items; c record; v_id bigint;
   BEGIN
     SELECT * INTO i FROM lby_items WHERE id = p_item AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR NOT i.active THEN RETURN 'This item is not available in the catalog.'; END IF;
     PERFORM lby_settle(p_tenant, p_item);
     IF EXISTS (SELECT 1 FROM lby_loans WHERE item_id = p_item AND patron_id = p_patron AND state = 'active') THEN RETURN 'You already have this item.'; END IF;
     IF EXISTS (SELECT 1 FROM lby_holds WHERE item_id = p_item AND patron_id = p_patron AND state IN ('waiting','ready')) THEN RETURN 'You already have a hold on this item.'; END IF;
     SELECT * INTO c FROM lby_counts(p_item, p_patron);
     IF i.copies - c.loans - c.ready_others > 0 AND NOT EXISTS (SELECT 1 FROM lby_holds WHERE item_id = p_item AND state = 'waiting') THEN RETURN 'A copy is free now — borrow it instead.'; END IF;
     INSERT INTO lby_holds (tenant_id, item_id, patron_id) VALUES (p_tenant, p_item, p_patron) RETURNING id INTO v_id;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'hold', v_id, 'place', 'patron');
     PERFORM lby_settle(p_tenant, p_item);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_cancel_hold(p_tenant text, p_patron text, p_hold bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE h lby_holds;
   BEGIN
     SELECT * INTO h FROM lby_holds WHERE id = p_hold AND tenant_id = p_tenant AND patron_id = p_patron AND state IN ('waiting','ready') FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Hold not found.'; END IF;
     PERFORM 1 FROM lby_items WHERE id = h.item_id FOR UPDATE;
     UPDATE lby_holds SET state = 'cancelled', patron_id = NULL WHERE id = p_hold;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'hold', p_hold, 'cancel', 'patron');
     PERFORM lby_settle(p_tenant, h.item_id);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_renew(p_tenant text, p_patron text, p_loan bigint, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l lby_loans; i lby_items;
   BEGIN
     SELECT * INTO l FROM lby_loans WHERE id = p_loan AND tenant_id = p_tenant AND patron_id = p_patron AND state = 'active' FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Loan not found.'; END IF;
     IF l.version <> p_expected THEN RETURN 'This loan changed since you opened it. Refresh and try again.'; END IF;
     IF l.renewals >= 2 THEN RETURN 'Already renewed 2 times. Please return it.'; END IF;
     IF EXISTS (SELECT 1 FROM lby_holds WHERE item_id = l.item_id AND state IN ('waiting','ready')) THEN RETURN 'Someone else is waiting for this item, so it cannot be renewed.'; END IF;
     IF l.due_at < now() THEN RETURN 'Overdue items cannot be renewed online. Return it or ask the library.'; END IF;
     SELECT * INTO i FROM lby_items WHERE id = l.item_id;
     UPDATE lby_loans SET renewals = renewals + 1, version = version + 1, due_at = now() + CASE WHEN i.kind = 'ebook' THEN interval '14 days' ELSE interval '21 days' END WHERE id = p_loan;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'loan', p_loan, 'renew', 'patron');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_return(p_tenant text, p_actor text, p_loan bigint, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l lby_loans; staff boolean := lby_is_staff(p_tenant, p_actor);
   BEGIN
     SELECT * INTO l FROM lby_loans WHERE id = p_loan AND tenant_id = p_tenant AND state = 'active' FOR UPDATE;
     IF NOT FOUND OR (l.patron_id <> p_actor AND NOT staff) THEN RETURN 'Loan not found.'; END IF;
     IF l.version <> p_expected THEN RETURN 'This loan changed since you opened it. Refresh and try again.'; END IF;
     IF l.patron_id = p_actor AND NOT staff AND (SELECT kind FROM lby_items WHERE id = l.item_id) = 'print' THEN RETURN 'Bring printed items to the library desk; staff record the return.'; END IF;
     PERFORM 1 FROM lby_items WHERE id = l.item_id FOR UPDATE;
     UPDATE lby_loans SET state = 'returned', patron_id = NULL, returned_at = now(), version = version + 1 WHERE id = p_loan;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'loan', p_loan, 'return', CASE WHEN l.patron_id = p_actor THEN 'patron' ELSE p_actor END);
     PERFORM lby_settle(p_tenant, l.item_id);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_request(p_tenant text, p_key text, p_actor text, p_title text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r lby_requests; v_id bigint;
   BEGIN
     SELECT * INTO r FROM lby_requests WHERE tenant_id = p_tenant AND requester_id = p_actor AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN r.title = trim(p_title) AND r.reason = trim(p_reason) THEN 'replay:' || r.id ELSE 'That request was already sent with different details.' END; END IF;
     INSERT INTO lby_requests (tenant_id, request_key, requester_id, title, reason) VALUES (p_tenant, p_key, p_actor, trim(p_title), trim(p_reason)) RETURNING id INTO v_id;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id) VALUES (p_tenant, 'request', v_id, 'submit', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION lby_rstep(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_accessible boolean, p_kind text, p_copies int, p_author text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r lby_requests; staff boolean := lby_is_staff(p_tenant, p_actor); v_to text; n text := trim(coalesce(p_note, '')); v_item bigint;
   BEGIN
     SELECT * INTO r FROM lby_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR (r.requester_id <> p_actor AND NOT staff) THEN RETURN 'Request not found.'; END IF;
     IF r.version <> p_expected THEN RETURN 'This request changed since you opened it. Refresh and try again.'; END IF;
     IF p_step <> 'withdraw' AND r.requester_id = p_actor THEN RETURN 'Another member of library staff decides your own request.'; END IF;
     v_to := CASE
       WHEN p_step = 'withdraw' AND r.requester_id = p_actor AND r.state IN ('submitted','license_review') THEN 'withdrawn'
       WHEN p_step = 'review' AND staff AND r.state = 'submitted' THEN 'license_review'
       WHEN p_step = 'approve' AND staff AND r.state = 'license_review' THEN 'approved'
       WHEN p_step = 'decline' AND staff AND r.state IN ('submitted','license_review') THEN 'declined'
       WHEN p_step = 'publish' AND staff AND r.state = 'approved' THEN 'published' END;
     IF v_to IS NULL THEN RETURN 'That step is not open for this request now.'; END IF;
     IF p_step = 'approve' AND length(n) < 10 THEN RETURN 'Record the licence terms (at least 10 characters).'; END IF;
     IF p_step = 'approve' AND p_accessible IS NULL THEN RETURN 'Record whether the resource meets accessibility needs.'; END IF;
     IF p_step = 'decline' AND length(n) < 5 THEN RETURN 'Give a reason.'; END IF;
     IF p_step = 'publish' THEN
       IF p_kind NOT IN ('print','ebook') OR coalesce(p_copies, 0) < 1 THEN RETURN 'Say whether it is print or e-book and how many copies or seats.'; END IF;
       INSERT INTO lby_items (tenant_id, title, author, kind, copies, source_ref) VALUES (p_tenant, r.title, trim(coalesce(p_author, '')), p_kind, p_copies, 'request #' || r.id) RETURNING id INTO v_item;
     END IF;
     UPDATE lby_requests SET state = v_to, version = version + 1, updated_at = now(),
       license_note = CASE WHEN p_step = 'approve' THEN n ELSE license_note END,
       accessible = CASE WHEN p_step = 'approve' THEN p_accessible ELSE accessible END,
       decision_note = CASE WHEN p_step = 'decline' THEN n ELSE decision_note END,
       decided_by = CASE WHEN p_step IN ('approve','decline') THEN p_actor ELSE decided_by END,
       item_id = coalesce(v_item, item_id) WHERE id = p_id;
     INSERT INTO lby_events (tenant_id, subject, subject_id, step, actor_id, note) VALUES (p_tenant, 'request', p_id, p_step, p_actor, left(n, 300));
     RETURN NULL;
   END $$`,
];
