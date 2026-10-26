// Migration idc-001: campus identity cards and door-access entitlements (S-76 E16; mirrors lib/idCardRules.ts).
// Semester never actuates a card system or door controller. Enforced here: officers and security approvers are granted by an
// administrator, never themselves; card_ref is an office label (CHECK: no run of 8+ digits) so no raw card number or secret
// is stored; one live card per person; restricted-zone grants are approved by security staff other than the requester;
// approval only requests provisioning — a grant becomes active, and a revocation becomes revoked, only when an officer
// records the controller's confirmation reference; revoking a card requests revocation of all its grants; a replacement
// is issued only after the old card and all its grants are confirmed revoked; expected-version everywhere; append-only history.
export const IDC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS idc_staff (tenant_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('officer','security')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION idc_kind(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT kind FROM idc_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL $$`,
  `CREATE TABLE IF NOT EXISTS idc_zones (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
     restricted boolean NOT NULL DEFAULT false, UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS idc_cards (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, holder_id text NOT NULL,
     card_ref text NOT NULL CHECK (card_ref ~ '^[A-Za-z0-9-]{3,32}$' AND card_ref !~ '[0-9]{8,}'),
     affiliation text NOT NULL CHECK (affiliation IN ('student','staff','faculty','visitor')), eligibility_note text NOT NULL CHECK (length(eligibility_note) BETWEEN 5 AND 300),
     state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','revoke_requested','revoked')), version int NOT NULL DEFAULT 1, issued_by text NOT NULL,
     replaces_id bigint REFERENCES idc_cards(id), valid_to date, revoke_reason text NOT NULL DEFAULT '', revoke_requested_at timestamptz, confirmation_ref text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, request_key), UNIQUE (tenant_id, card_ref), CHECK (issued_by <> holder_id), CHECK (state <> 'revoked' OR length(confirmation_ref) >= 3))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idc_cards_one_live ON idc_cards (tenant_id, holder_id) WHERE state IN ('active','revoke_requested')`,
  `CREATE TABLE IF NOT EXISTS idc_grants (id bigserial PRIMARY KEY, tenant_id text NOT NULL, card_id bigint NOT NULL REFERENCES idc_cards(id), zone_id bigint NOT NULL REFERENCES idc_zones(id),
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','provision_requested','active','revoke_requested','revoked','denied')), version int NOT NULL DEFAULT 1,
     reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 300), requested_by text NOT NULL, approved_by text, confirmed_by text, confirmation_ref text NOT NULL DEFAULT '',
     pending_since timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approved_by IS NULL OR approved_by <> requested_by),
     CHECK (state NOT IN ('provision_requested','active') OR approved_by IS NOT NULL),
     CHECK (state NOT IN ('active','revoked') OR (confirmed_by IS NOT NULL AND length(confirmation_ref) >= 3)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idc_grants_one_live ON idc_grants (card_id, zone_id) WHERE state IN ('requested','provision_requested','active','revoke_requested')`,
  `CREATE TABLE IF NOT EXISTS idc_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('card','grant','zone','staff')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL DEFAULT '', actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION idc_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'idc_events_append_only') THEN
       CREATE TRIGGER idc_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON idc_events FOR EACH STATEMENT EXECUTE FUNCTION idc_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION idc_set_staff(p_admin text, p_tenant text, p_user text, p_kind text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own card-office access.'; END IF;
     IF p_kind IS NULL THEN UPDATE idc_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     ELSIF p_kind NOT IN ('officer','security') THEN RETURN 'Unknown role.';
     ELSE INSERT INTO idc_staff (tenant_id, user_id, kind, granted_by) VALUES (p_tenant, p_user, p_kind, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET kind = EXCLUDED.kind, revoked_at = NULL, granted_by = p_admin, granted_at = now(); END IF;
     INSERT INTO idc_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'staff', 0, 'set_staff', coalesce(p_kind, 'revoked'), p_admin, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idc_zone(p_tenant text, p_actor text, p_name text, p_restricted boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF idc_kind(p_tenant, p_actor) IS NULL THEN RETURN 'Only card-office or security staff define access zones.'; END IF;
     IF p_restricted AND idc_kind(p_tenant, p_actor) <> 'security' THEN RETURN 'Only security staff mark a zone restricted.'; END IF;
     INSERT INTO idc_zones (tenant_id, name, restricted) VALUES (p_tenant, trim(p_name), p_restricted) ON CONFLICT (tenant_id, name) DO NOTHING RETURNING id INTO v_id;
     IF v_id IS NULL THEN RETURN 'A zone with that name already exists.'; END IF;
     INSERT INTO idc_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'zone', v_id, 'create', CASE WHEN p_restricted THEN 'restricted' ELSE 'open' END, p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION idc_issue(p_tenant text, p_key text, p_actor text, p_holder text, p_ref text, p_affiliation text, p_note text, p_valid_to date, p_replaces bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c idc_cards; o idc_cards; v_id bigint;
   BEGIN
     IF idc_kind(p_tenant, p_actor) IS DISTINCT FROM 'officer' THEN RETURN 'Only card-office officers issue cards.'; END IF;
     SELECT * INTO c FROM idc_cards WHERE tenant_id = p_tenant AND request_key = p_key;
     IF FOUND THEN RETURN CASE WHEN c.holder_id = p_holder AND c.card_ref = trim(p_ref) THEN 'replay:' || c.id ELSE 'That issue was already recorded with different details.' END; END IF;
     IF p_actor = p_holder THEN RETURN 'Another officer issues your own card.'; END IF;
     IF trim(p_ref) !~ '^[A-Za-z0-9-]{3,32}$' OR trim(p_ref) ~ '[0-9]{8,}' THEN RETURN 'Use the card office reference (3–32 letters, digits, dashes), never the card number.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record how eligibility was checked.'; END IF;
     IF p_replaces IS NOT NULL THEN
       SELECT * INTO o FROM idc_cards WHERE id = p_replaces AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND OR o.holder_id <> p_holder THEN RETURN 'The card being replaced belongs to someone else.'; END IF;
       IF o.state <> 'revoked' THEN RETURN 'Confirm the old card is revoked before issuing a replacement.'; END IF;
       IF EXISTS (SELECT 1 FROM idc_grants WHERE card_id = o.id AND state IN ('requested','provision_requested','active','revoke_requested')) THEN RETURN 'Some door access on the old card is not yet confirmed removed.'; END IF;
     ELSIF EXISTS (SELECT 1 FROM idc_cards WHERE tenant_id = p_tenant AND holder_id = p_holder AND state IN ('active','revoke_requested')) THEN RETURN 'This person already has a card.'; END IF;
     INSERT INTO idc_cards (tenant_id, request_key, holder_id, card_ref, affiliation, eligibility_note, issued_by, replaces_id, valid_to)
       VALUES (p_tenant, p_key, p_holder, trim(p_ref), p_affiliation, trim(p_note), p_actor, p_replaces, p_valid_to) RETURNING id INTO v_id;
     INSERT INTO idc_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'card', v_id, CASE WHEN p_replaces IS NULL THEN 'issue' ELSE 'replace' END, 'active', p_actor, coalesce('replaces ' || p_replaces, ''));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION idc_card_step(p_tenant text, p_actor text, p_card bigint, p_step text, p_expected int, p_note text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c idc_cards; k text := idc_kind(p_tenant, p_actor); n text := trim(coalesce(p_note, '')); v_to text;
   BEGIN
     SELECT * INTO c FROM idc_cards WHERE id = p_card AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR (c.holder_id <> p_actor AND k IS NULL) THEN RETURN 'Card not found.'; END IF;
     IF c.version <> p_expected THEN RETURN 'This card changed since you opened it. Refresh and try again.'; END IF;
     IF p_step = 'revoke' THEN
       IF c.state <> 'active' THEN RETURN 'Only an active card can be revoked.'; END IF;
       IF c.holder_id <> p_actor AND k <> 'officer' THEN RETURN 'Only the card office revokes a card.'; END IF;
       IF length(n) < 4 THEN RETURN 'Say why (lost, stolen, left the institution…).'; END IF;
       UPDATE idc_cards SET state = 'revoke_requested', revoke_reason = n, revoke_requested_at = now(), version = version + 1, updated_at = now() WHERE id = p_card;
       UPDATE idc_grants SET state = 'revoke_requested', pending_since = now(), version = version + 1, updated_at = now() WHERE card_id = p_card AND state IN ('active','provision_requested');
       UPDATE idc_grants SET state = 'denied', version = version + 1, updated_at = now() WHERE card_id = p_card AND state = 'requested';
       v_to := 'revoke_requested';
     ELSIF p_step = 'confirm_revoke' THEN
       IF k IS DISTINCT FROM 'officer' THEN RETURN 'Only the card office records a confirmation.'; END IF;
       IF c.state <> 'revoke_requested' THEN RETURN 'There is no revocation waiting for confirmation.'; END IF;
       IF length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Enter the card system''s confirmation reference.'; END IF;
       UPDATE idc_cards SET state = 'revoked', confirmation_ref = trim(p_ref), version = version + 1, updated_at = now() WHERE id = p_card;
       v_to := 'revoked';
     ELSE RETURN 'Unknown step.'; END IF;
     INSERT INTO idc_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'card', p_card, p_step, v_to, p_actor, left(coalesce(nullif(n, ''), p_ref, ''), 300));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION idc_request_grant(p_tenant text, p_actor text, p_card bigint, p_zone bigint, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c idc_cards; v_id bigint;
   BEGIN
     SELECT * INTO c FROM idc_cards WHERE id = p_card AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR (c.holder_id <> p_actor AND idc_kind(p_tenant, p_actor) IS NULL) THEN RETURN 'Card not found.'; END IF;
     IF c.state <> 'active' THEN RETURN 'Access can only be requested on an active card.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM idc_zones WHERE id = p_zone AND tenant_id = p_tenant) THEN RETURN 'Zone not found.'; END IF;
     IF EXISTS (SELECT 1 FROM idc_grants WHERE card_id = p_card AND zone_id = p_zone AND state IN ('requested','provision_requested','active','revoke_requested')) THEN RETURN 'This card already has or is waiting for access to that zone.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 5 THEN RETURN 'Say why access is needed.'; END IF;
     INSERT INTO idc_grants (tenant_id, card_id, zone_id, reason, requested_by) VALUES (p_tenant, p_card, p_zone, trim(p_reason), p_actor) RETURNING id INTO v_id;
     INSERT INTO idc_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'grant', v_id, 'request', 'requested', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION idc_grant_step(p_tenant text, p_actor text, p_grant bigint, p_step text, p_expected int, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g idc_grants; k text := idc_kind(p_tenant, p_actor); restr boolean; v_to text;
   BEGIN
     SELECT * INTO g FROM idc_grants WHERE id = p_grant AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR k IS NULL THEN RETURN 'Access request not found.'; END IF;
     IF g.version <> p_expected THEN RETURN 'This access request changed since you opened it. Refresh and try again.'; END IF;
     SELECT restricted INTO restr FROM idc_zones WHERE id = g.zone_id;
     IF p_step IN ('approve','deny') THEN
       IF g.state <> 'requested' THEN RETURN 'This request has already been decided.'; END IF;
       IF g.requested_by = p_actor THEN RETURN 'Someone other than the requester decides access.'; END IF;
       IF restr AND k <> 'security' THEN RETURN 'Restricted zones are approved by security staff.'; END IF;
       v_to := CASE WHEN p_step = 'approve' THEN 'provision_requested' ELSE 'denied' END;
       UPDATE idc_grants SET state = v_to, approved_by = CASE WHEN p_step = 'approve' THEN p_actor END, pending_since = now(), version = version + 1, updated_at = now() WHERE id = p_grant;
     ELSIF p_step = 'confirm' THEN
       IF k <> 'officer' THEN RETURN 'Only the card office records a controller confirmation.'; END IF;
       IF g.state NOT IN ('provision_requested','revoke_requested') THEN RETURN 'Nothing is waiting for the door system to confirm.'; END IF;
       IF length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Enter the door system''s confirmation reference.'; END IF;
       v_to := CASE WHEN g.state = 'provision_requested' THEN 'active' ELSE 'revoked' END;
       UPDATE idc_grants SET state = v_to, confirmed_by = p_actor, confirmation_ref = trim(p_ref), version = version + 1, updated_at = now() WHERE id = p_grant;
     ELSIF p_step = 'revoke' THEN
       IF g.state NOT IN ('active','provision_requested') THEN RETURN 'Only granted access can be revoked.'; END IF;
       v_to := 'revoke_requested';
       UPDATE idc_grants SET state = v_to, pending_since = now(), version = version + 1, updated_at = now() WHERE id = p_grant;
     ELSE RETURN 'Unknown step.'; END IF;
     INSERT INTO idc_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'grant', p_grant, p_step, v_to, p_actor, left(coalesce(p_ref, ''), 100));
     RETURN NULL;
   END $$`,
];
