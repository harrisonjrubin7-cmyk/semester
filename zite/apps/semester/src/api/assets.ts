import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { AST_MIGRATION } from '../lib/astMigration';
import { nextAsset, AssetState, AssetStep } from '../lib/assetRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of AST_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const ASTEPS: AssetStep[] = ['repair', 'restore', 'request_disposal', 'approve_disposal', 'reject_disposal'];

// Assets and Inventory (S-76 E14). Members request stock and see assets in their custody. Inventory clerks receive,
// issue, transfer, inspect and count; controllers also add locations and items and approve disposals and adjustments
// requested by someone else. Roles are granted by an administrator. Finance decides accounting treatment outside
// Semester. Every rule is enforced in lib/astMigration.ts.
export default createEndpoint({
  description: 'Assets and inventory: tracked assets with custody history, stock, reservations, issues, returns, counts and adjustments',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), kind: z.enum(['clerk', 'controller', 'none']) }),
    z.object({ action: z.literal('location'), name: z.string().min(1).max(80) }),
    z.object({ action: z.literal('receiveAsset'), requestKey: z.string().min(8).max(100), tag: z.string().min(2).max(40), name: z.string().min(2).max(160), category: z.string().max(60).default(''), locationId: z.number().int().nullable() }),
    z.object({ action: z.literal('transfer'), id: z.number().int(), expectedVersion: z.number().int(), toEmail: z.string().max(200).default(''), locationId: z.number().int().nullable(), note: z.string().max(300).default('') }),
    z.object({ action: z.literal('inspect'), id: z.number().int(), expectedVersion: z.number().int(), result: z.enum(['ok', 'needs_repair']), note: z.string().max(300).default('') }),
    z.object({ action: z.literal('astep'), id: z.number().int(), step: z.enum(ASTEPS as [AssetStep, ...AssetStep[]]), expectedVersion: z.number().int(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('item'), sku: z.string().min(2).max(40), name: z.string().min(2).max(160), unit: z.string().max(20).default('each') }),
    z.object({ action: z.literal('receiveStock'), requestKey: z.string().min(8).max(100), itemId: z.number().int(), locationId: z.number().int(), qty: z.number().int().min(1).max(100000) }),
    z.object({ action: z.literal('reserve'), requestKey: z.string().min(8).max(100), itemId: z.number().int(), locationId: z.number().int(), qty: z.number().int().min(1).max(10000), purpose: z.string().max(300).default('') }),
    z.object({ action: z.literal('rstep'), id: z.number().int(), step: z.enum(['issue', 'cancel', 'return']), expectedVersion: z.number().int(), qty: z.number().int().min(1).max(10000).nullable().default(null) }),
    z.object({ action: z.literal('count'), itemId: z.number().int(), locationId: z.number().int(), counted: z.number().int().min(0).max(1000000), note: z.string().max(300).default('') }),
    z.object({ action: z.literal('adjust'), id: z.number().int(), approve: z.boolean(), note: z.string().max(300).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const kind = (((await sql.query(`SELECT ast_kind($1,$2) AS k`, [T, me])) as { k: string | null }[])[0].k) as 'clerk' | 'controller' | null;
    const role = kind === 'controller' ? 'Inventory controller' : kind === 'clerk' ? 'Inventory clerk' : 'Member';
    const memberId = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid!;
    };
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const ok = (out: string | null) => { if (!out || !/^(ok|replay):\d+$/.test(out)) forbid(out ?? 'Failed.'); const [k, id] = out!.split(':'); return { id: Number(id), replayed: k === 'replay' }; };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage inventory access.');
      const uid = await memberId(input.email);
      fail(await one(`SELECT ast_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.kind === 'none' ? null : input.kind]));
      await audit(a, `Inventory access: ${input.kind}`, `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'location') { result = ok(await one(`SELECT ast_location($1,$2,$3) AS r`, [T, me, input.name])); await audit(a, 'Inventory location added', `location:${(result as any).id}`, input.name, role); }
    if (input.action === 'receiveAsset') {
      result = ok(await one(`SELECT ast_receive_asset($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.requestKey, input.tag, input.name, input.category, input.locationId]));
      if (!(result as any).replayed) await audit(a, 'Asset received', `asset:${(result as any).id}`, `${input.tag} ${input.name}`, role);
    }
    if (input.action === 'transfer') {
      const to = input.toEmail.trim() ? await memberId(input.toEmail) : null;
      const prev = ((await sql.query(`SELECT custodian_id FROM ast_assets WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      fail(await one(`SELECT ast_transfer($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.id, input.expectedVersion, to, input.locationId, input.note]));
      await audit(a, 'Asset custody changed', `asset:${input.id}`, input.note, role);
      const tell = [to, prev?.custodian_id ? String(prev.custodian_id) : null].filter((x): x is string => !!x && x !== me);
      if (tell.length) await zite.messages.create({ record: { body: 'An asset in your care changed in Semester. Open Inventory to see it.', sender: me, recipients: [...new Set(tell)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'inspect') { fail(await one(`SELECT ast_inspect($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.id, input.expectedVersion, input.result, input.note])); await audit(a, `Asset inspected: ${input.result}`, `asset:${input.id}`, input.note, role); }
    if (input.action === 'astep') { fail(await one(`SELECT ast_astep($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.id, input.step, input.expectedVersion, input.note])); await audit(a, `Asset: ${input.step.replace('_', ' ')}`, `asset:${input.id}`, input.note, role); }
    if (input.action === 'item') { result = ok(await one(`SELECT ast_item($1,$2,$3,$4,$5) AS r`, [T, me, input.sku, input.name, input.unit])); await audit(a, 'Stock item added', `stockItem:${(result as any).id}`, input.name, role); }
    if (input.action === 'receiveStock') {
      result = ok(await one(`SELECT ast_receive_stock($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.requestKey, input.itemId, input.locationId, input.qty]));
      if (!(result as any).replayed) await audit(a, 'Stock received', `stockItem:${input.itemId}`, `+${input.qty}`, role);
    }
    if (input.action === 'reserve') {
      result = ok(await one(`SELECT ast_reserve($1,$2,$3,$4,$5,$6,$7) AS r`, [T, input.requestKey, me, input.itemId, input.locationId, input.qty, input.purpose]));
      if (!(result as any).replayed) await audit(a, 'Stock requested', `stockRequest:${(result as any).id}`, `${input.qty}`, 'Member');
    }
    if (input.action === 'rstep') {
      const before = ((await sql.query(`SELECT requester_id FROM ast_reservations WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Request not found.');
      fail(await one(`SELECT ast_rstep($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.id, input.step, input.expectedVersion, input.qty]));
      await audit(a, `Stock request: ${input.step}`, `stockRequest:${input.id}`, input.qty ? String(input.qty) : '', String(before!.requester_id) === me ? 'Member' : role);
      if (String(before!.requester_id) !== me) await zite.messages.create({ record: { body: 'There is an update to your stock request in Semester. Open Inventory to see it.', sender: me, recipients: [String(before!.requester_id)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'count') {
      const out = await one(`SELECT ast_count($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.itemId, input.locationId, input.counted, input.note]);
      result = out === 'match' ? { match: true } : ok(out);
      await audit(a, out === 'match' ? 'Stock count matched' : 'Stock count differs — adjustment pending', `stockItem:${input.itemId}`, `counted ${input.counted}`, role);
    }
    if (input.action === 'adjust') { fail(await one(`SELECT ast_adjust($1,$2,$3,$4,$5) AS r`, [T, me, input.id, input.approve, input.note])); await audit(a, input.approve ? 'Stock adjustment approved' : 'Stock adjustment rejected', `adjustment:${input.id}`, input.note, role); }

    // Read model, scoped by who is asking.
    const staff = kind !== null;
    const locations = (await sql.query(`SELECT * FROM ast_locations WHERE tenant_id = $1 ORDER BY name`, [T])) as Row[];
    const locName = Object.fromEntries(locations.map((l) => [String(l.id), String(l.name)]));
    const assets = (await sql.query(`SELECT * FROM ast_assets WHERE tenant_id = $1 AND (custodian_id = $2 OR $3) ORDER BY (state = 'disposed'), tag LIMIT 2000`, [T, me, staff])) as Row[];
    const custody = staff && assets.length ? (await sql.query(`SELECT * FROM ast_custody WHERE tenant_id = $1 AND asset_id = ANY($2::bigint[]) ORDER BY id DESC LIMIT 4000`, [T, assets.map((x) => Number(x.id))])) as Row[] : [];
    const inspections = staff && assets.length ? (await sql.query(`SELECT * FROM ast_inspections WHERE tenant_id = $1 AND asset_id = ANY($2::bigint[]) ORDER BY id DESC LIMIT 2000`, [T, assets.map((x) => Number(x.id))])) as Row[] : [];
    const items = (await sql.query(`SELECT * FROM ast_items WHERE tenant_id = $1 ORDER BY name`, [T])) as Row[];
    const itemName = Object.fromEntries(items.map((i) => [String(i.id), `${i.name}`]));
    const stock = (await sql.query(`SELECT * FROM ast_stock WHERE tenant_id = $1`, [T])) as Row[];
    const reservations = (await sql.query(`SELECT * FROM ast_reservations WHERE tenant_id = $1 AND (requester_id = $2 OR $3) ORDER BY (state IN ('returned','cancelled')), created_at DESC LIMIT 1000`, [T, me, staff])) as Row[];
    const adjustments = staff ? (await sql.query(`SELECT * FROM ast_adjustments WHERE tenant_id = $1 ORDER BY (state <> 'pending'), created_at DESC LIMIT 300`, [T])) as Row[] : [];
    const staffRows = isAdmin ? (await sql.query(`SELECT user_id, kind FROM ast_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const ids = [...assets.map((x) => x.custodian_id), ...custody.flatMap((c) => [c.from_user, c.to_user, c.by_user]), ...inspections.map((i) => i.by_user), ...reservations.map((r) => r.requester_id), ...adjustments.flatMap((j) => [j.counted_by, j.decided_by]), ...staffRows.map((s) => s.user_id)];
    const names = await userNames([...new Set(ids.filter(Boolean).map(String))]);
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);

    return {
      result, kind, isAdmin,
      locations: locations.map((l) => ({ id: Number(l.id), name: String(l.name) })),
      assets: assets.map((x) => ({
        id: Number(x.id), tag: String(x.tag), name: String(x.name), category: String(x.category), state: String(x.state), version: Number(x.version),
        location: x.location_id ? locName[String(x.location_id)] ?? null : null, locationId: x.location_id ? Number(x.location_id) : null, custodian: nm(x.custodian_id), mine: x.custodian_id === me,
        disposalReason: String(x.disposal_reason), disposalRequestedBy: nm(x.disposal_requested_by),
        steps: ASTEPS.filter((s) => nextAsset(String(x.state) as AssetState, s, kind, x.disposal_requested_by === me)),
        history: custody.filter((c) => String(c.asset_id) === String(x.id)).slice(0, 10).map((c) => ({ from: nm(c.from_user) ?? 'Store', to: nm(c.to_user) ?? 'Store', location: c.location_id ? locName[String(c.location_id)] ?? null : null, by: nm(c.by_user), note: String(c.note), at: iso(c.at) })),
        inspections: inspections.filter((i) => String(i.asset_id) === String(x.id)).slice(0, 5).map((i) => ({ result: String(i.result), note: String(i.note), by: nm(i.by_user), at: iso(i.at) })),
      })),
      items: items.map((i) => ({ id: Number(i.id), sku: String(i.sku), name: String(i.name), unit: String(i.unit),
        stock: stock.filter((s) => String(s.item_id) === String(i.id)).map((s) => ({ locationId: Number(s.location_id), location: locName[String(s.location_id)] ?? 'Location', free: Number(s.on_hand) - Number(s.reserved), onHand: staff ? Number(s.on_hand) : undefined, reserved: staff ? Number(s.reserved) : undefined })) })),
      reservations: reservations.map((r) => ({ id: Number(r.id), mine: r.requester_id === me, requester: nm(r.requester_id), item: itemName[String(r.item_id)] ?? 'Item', location: locName[String(r.location_id)] ?? 'Location',
        qty: Number(r.qty), returnedQty: Number(r.returned_qty), state: String(r.state), purpose: String(r.purpose), version: Number(r.version), createdAt: iso(r.created_at) })),
      adjustments: adjustments.map((j) => ({ id: Number(j.id), item: itemName[String(j.item_id)] ?? 'Item', location: locName[String(j.location_id)] ?? 'Location', onHandAtCount: Number(j.on_hand_at_count), counted: Number(j.counted),
        delta: Number(j.delta), note: String(j.note), countedBy: nm(j.counted_by), mine: j.counted_by === me, state: String(j.state), decidedBy: nm(j.decided_by), decisionNote: String(j.decision_note), at: iso(j.created_at) })),
      staff: staffRows.map((s) => ({ name: nm(s.user_id), kind: String(s.kind) })),
    };
  },
});
