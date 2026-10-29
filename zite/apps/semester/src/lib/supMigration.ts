// E09 Supplier Portal: procurement names suppliers in free text (prc_requisitions.supplier, keyed by
// prc_key). A buyer links a supplier name to a partner organization (E30, pta_orgs); members of that
// organization then see the purchase orders addressed to that name at institutions where their
// agreement's view_orders scope is live (pta_live), and can acknowledge an order or report it shipped.
// Links and acknowledgements never move money and never change the order itself.
export const SUP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS prc_supplier_links (tenant_id text NOT NULL, supplier_key text NOT NULL, org_id bigint NOT NULL REFERENCES pta_orgs(id),
     linked_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, supplier_key))`,
  `CREATE TABLE IF NOT EXISTS prc_po_acks (id bigserial PRIMARY KEY, tenant_id text NOT NULL, po_id bigint NOT NULL REFERENCES prc_pos(id),
     org_id bigint NOT NULL REFERENCES pta_orgs(id), actor_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('acknowledged','shipped')),
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 300), created_at timestamptz NOT NULL DEFAULT now())`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prc_po_acks_append_only') THEN
       CREATE TRIGGER prc_po_acks_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prc_po_acks FOR EACH STATEMENT EXECUTE FUNCTION prc_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION sup_link(p_actor text, p_tenant text, p_supplier_key text, p_org bigint) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'buyer') THEN RETURN 'Only a buyer can link a supplier to a partner organization.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM pta_relationships WHERE tenant_id = p_tenant AND org_id = p_org) THEN RETURN 'That organization has no relationship with this institution.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM prc_requisitions WHERE tenant_id = p_tenant AND supplier_key = p_supplier_key) THEN RETURN 'No purchases use that supplier name here.'; END IF;
     INSERT INTO prc_supplier_links (tenant_id, supplier_key, org_id, linked_by) VALUES (p_tenant, p_supplier_key, p_org, p_actor)
       ON CONFLICT (tenant_id, supplier_key) DO UPDATE SET org_id = EXCLUDED.org_id, linked_by = EXCLUDED.linked_by, created_at = now();
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'supplier', NULL, 'supplier.link', p_actor, p_supplier_key || ' -> org ' || p_org);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sup_unlink(p_actor text, p_tenant text, p_supplier_key text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'buyer') THEN RETURN 'Only a buyer can unlink a supplier.'; END IF;
     DELETE FROM prc_supplier_links WHERE tenant_id = p_tenant AND supplier_key = p_supplier_key;
     IF NOT FOUND THEN RETURN 'That supplier is not linked.'; END IF;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'supplier', NULL, 'supplier.unlink', p_actor, p_supplier_key);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sup_orders(p_tenant text, p_org bigint) RETURNS TABLE (po_id bigint, supplier text, description text, amount int, po_state text, received bigint, invoiced bigint, ack_kind text, ack_at timestamptz) LANGUAGE sql STABLE AS $$
     SELECT p.id, p.supplier, r.description, p.amount, p.state,
       coalesce((SELECT sum(amount) FROM prc_receipts WHERE po_id = p.id), 0),
       coalesce((SELECT sum(amount) FROM prc_invoices WHERE po_id = p.id), 0),
       (SELECT kind FROM prc_po_acks WHERE po_id = p.id ORDER BY id DESC LIMIT 1),
       (SELECT created_at FROM prc_po_acks WHERE po_id = p.id ORDER BY id DESC LIMIT 1)
     FROM prc_pos p
     JOIN prc_requisitions r ON r.id = p.req_id
     JOIN prc_supplier_links l ON l.tenant_id = p.tenant_id AND l.supplier_key = r.supplier_key AND l.org_id = p_org
     WHERE p.tenant_id = p_tenant AND pta_live(p_tenant, p_org, 'view_orders')
     ORDER BY p.id DESC $$`,
  `CREATE OR REPLACE FUNCTION sup_ack(p_actor text, p_tenant text, p_org bigint, p_po bigint, p_kind text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text; skey text;
   BEGIN
     IF pta_role(p_org, p_actor) IS NULL THEN RETURN 'Only a member of the organization can act for it.'; END IF;
     IF NOT pta_live(p_tenant, p_org, 'view_orders') THEN RETURN 'This institution has not given your organization live access to view orders.'; END IF;
     IF p_kind NOT IN ('acknowledged','shipped') THEN RETURN 'Unknown update kind.'; END IF;
     SELECT p.state, r.supplier_key INTO st, skey FROM prc_pos p JOIN prc_requisitions r ON r.id = p.req_id WHERE p.id = p_po AND p.tenant_id = p_tenant;
     IF NOT FOUND THEN RETURN 'Order not found.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM prc_supplier_links WHERE tenant_id = p_tenant AND supplier_key = skey AND org_id = p_org) THEN RETURN 'That order is not addressed to your organization.'; END IF;
     IF st <> 'issued' THEN RETURN 'That order is ' || st || '; it takes no supplier updates.'; END IF;
     INSERT INTO prc_po_acks (tenant_id, po_id, org_id, actor_id, kind, note) VALUES (p_tenant, p_po, p_org, p_actor, p_kind, left(coalesce(p_note, ''), 300));
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'po', p_po, 'supplier.' || p_kind, p_actor, left(coalesce(p_note, ''), 300));
     RETURN NULL;
   END $$`,
];
