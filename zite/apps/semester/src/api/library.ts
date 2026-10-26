import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { LBY_MIGRATION } from '../lib/lbyMigration';
import { renewBlocker, nextRequest, ReqState, ReqStep } from '../lib/libraryRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of LBY_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const RSTEPS: ReqStep[] = ['review', 'approve', 'decline', 'publish', 'withdraw'];

// Library (S-76 E18). Members search the catalog, borrow, place holds, renew, return e-books and request resources.
// Patrons see only their own loans and holds. Staff (granted by an administrator) manage the catalog, record desk returns
// and decide requests. Returned loans and finished holds keep no borrower, and the audit trail records circulation
// without naming the reader, so no reading history exists to disclose. Every rule is enforced in lib/lbyMigration.ts.
export default createEndpoint({
  description: 'Library: catalog, loans, holds, renewals, returns and resource requests',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('item'), id: z.number().int().nullable(), title: z.string().min(2).max(300), author: z.string().max(200).default(''), kind: z.enum(['print', 'ebook']), copies: z.number().int().min(0).max(500), active: z.boolean(), sourceRef: z.string().max(300).default('') }),
    z.object({ action: z.literal('borrow'), requestKey: z.string().min(8).max(100), itemId: z.number().int() }),
    z.object({ action: z.literal('hold'), itemId: z.number().int() }),
    z.object({ action: z.literal('cancelHold'), holdId: z.number().int() }),
    z.object({ action: z.literal('renew'), loanId: z.number().int(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('return'), loanId: z.number().int(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('request'), requestKey: z.string().min(8).max(100), title: z.string().min(2).max(300), reason: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('rstep'), id: z.number().int(), step: z.enum(RSTEPS as [ReqStep, ...ReqStep[]]), expectedVersion: z.number().int(), note: z.string().max(2000).default(''), accessible: z.boolean().nullable().default(null), kind: z.enum(['print', 'ebook']).nullable().default(null), copies: z.number().int().min(1).max(500).nullable().default(null), author: z.string().max(200).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const staff = !!((await sql.query(`SELECT lby_is_staff($1,$2) AS s`, [T, me])) as { s: boolean }[])[0].s;
    const ok = (out: string) => { if (!/^(ok|replay):\d+$/.test(out)) forbid(out); const [k, id] = out.split(':'); return { id: Number(id), replayed: k === 'replay' }; };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage library access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT lby_set_staff($1,$2,$3,$4) AS e`, [me, T, uid, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Library access granted' : 'Library access removed', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'item') {
      result = ok(((await sql.query(`SELECT lby_item($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, me, input.id, input.title, input.author, input.kind, input.copies, input.active, input.sourceRef])) as { r: string }[])[0].r);
      await audit(a, input.id ? 'Library item edited' : 'Library item added', `libraryItem:${(result as { id: number }).id}`, `${input.title} · ${input.copies}`, 'Library staff');
    }
    // Circulation is deliberately not written to the audit log with the reader's name: the loan row is the only record,
    // and it forgets the borrower on return.
    if (input.action === 'borrow') result = ok(((await sql.query(`SELECT lby_borrow($1,$2,$3,$4) AS r`, [T, input.requestKey, me, input.itemId])) as { r: string }[])[0].r);
    if (input.action === 'hold') result = ok(((await sql.query(`SELECT lby_hold($1,$2,$3) AS r`, [T, me, input.itemId])) as { r: string }[])[0].r);
    if (input.action === 'cancelHold') fail(((await sql.query(`SELECT lby_cancel_hold($1,$2,$3) AS e`, [T, me, input.holdId])) as { e: string | null }[])[0].e);
    if (input.action === 'renew') fail(((await sql.query(`SELECT lby_renew($1,$2,$3,$4) AS e`, [T, me, input.loanId, input.expectedVersion])) as { e: string | null }[])[0].e);
    if (input.action === 'return') fail(((await sql.query(`SELECT lby_return($1,$2,$3,$4) AS e`, [T, me, input.loanId, input.expectedVersion])) as { e: string | null }[])[0].e);
    if (input.action === 'request') {
      result = ok(((await sql.query(`SELECT lby_request($1,$2,$3,$4,$5) AS r`, [T, input.requestKey, me, input.title, input.reason])) as { r: string }[])[0].r);
      if (!(result as { replayed: boolean }).replayed) await audit(a, 'Library resource requested', `libraryRequest:${(result as { id: number }).id}`, input.title, 'Member');
    }
    if (input.action === 'rstep') {
      const before = ((await sql.query(`SELECT requester_id FROM lby_requests WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Request not found.');
      fail(((await sql.query(`SELECT lby_rstep($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note, input.accessible, input.kind, input.copies, input.author])) as { e: string | null }[])[0].e);
      const self = String(before!.requester_id) === me;
      await audit(a, `Library request: ${input.step}`, `libraryRequest:${input.id}`, input.note.slice(0, 200), self ? 'Member' : 'Library staff');
      if (!self) await zite.messages.create({ record: { body: 'There is an update to your library request in Semester. Open Library to see it.', sender: me, recipients: [String(before!.requester_id)], isNotification: true } as never }).catch(() => undefined);
    }

    // Read model. Expired ready holds are settled first so availability is current.
    await sql.query(`SELECT lby_settle($1, item_id) FROM (SELECT DISTINCT item_id FROM lby_holds WHERE tenant_id = $1 AND state = 'ready' AND ready_until < now()) x`, [T]);
    const items = (await sql.query(`SELECT i.*,
        (SELECT count(*) FROM lby_loans l WHERE l.item_id = i.id AND l.state = 'active')::int AS loans,
        (SELECT count(*) FROM lby_holds h WHERE h.item_id = i.id AND h.state = 'ready')::int AS ready,
        (SELECT count(*) FROM lby_holds h WHERE h.item_id = i.id AND h.state = 'waiting')::int AS waiting
      FROM lby_items i WHERE i.tenant_id = $1 AND (i.active OR $2) ORDER BY i.title LIMIT 2000`, [T, staff])) as Row[];
    const itemById = Object.fromEntries(items.map((i) => [String(i.id), i]));
    const loans = (await sql.query(`SELECT * FROM lby_loans WHERE tenant_id = $1 AND state = 'active' AND (patron_id = $2 OR $3) ORDER BY due_at`, [T, me, staff])) as Row[];
    const holds = (await sql.query(`SELECT h.*, (SELECT count(*) FROM lby_holds o WHERE o.item_id = h.item_id AND o.state = 'waiting' AND (o.created_at, o.id) < (h.created_at, h.id))::int AS ahead
      FROM lby_holds h WHERE h.tenant_id = $1 AND h.patron_id = $2 AND h.state IN ('waiting','ready') ORDER BY h.created_at`, [T, me])) as Row[];
    const requests = (await sql.query(`SELECT * FROM lby_requests WHERE tenant_id = $1 AND (requester_id = $2 OR $3) ORDER BY (state IN ('declined','published','withdrawn')), updated_at DESC LIMIT 300`, [T, me, staff])) as Row[];
    const staffRows = isAdmin ? (await sql.query(`SELECT user_id FROM lby_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...(staff ? loans.map((l) => String(l.patron_id)) : []), ...requests.map((r) => String(r.requester_id)), ...staffRows.map((s) => String(s.user_id))])]);
    const myItemIds = new Set(loans.filter((l) => l.patron_id === me).map((l) => String(l.item_id)));
    const myHoldIds = new Set(holds.map((h) => String(h.item_id)));
    const now = Date.now();
    const title = (id: unknown) => itemById[String(id)] ? String(itemById[String(id)].title) : 'Item';

    return {
      result, staff, isAdmin,
      items: items.map((i) => ({
        id: Number(i.id), title: String(i.title), author: String(i.author), kind: String(i.kind), copies: Number(i.copies), active: !!i.active, sourceRef: String(i.source_ref),
        free: Math.max(0, Number(i.copies) - Number(i.loans) - Number(i.ready)), waiting: Number(i.waiting), onLoan: staff ? Number(i.loans) : undefined,
        mine: myItemIds.has(String(i.id)), held: myHoldIds.has(String(i.id)),
      })),
      myLoans: loans.filter((l) => l.patron_id === me).map((l) => {
        const it = itemById[String(l.item_id)];
        const overdue = new Date(String(l.due_at)).getTime() < now;
        return { id: Number(l.id), title: title(l.item_id), kind: it ? String(it.kind) : 'print', dueAt: iso(l.due_at), overdue, renewals: Number(l.renewals), version: Number(l.version),
          renewBlocked: renewBlocker(Number(l.renewals), it ? Number(it.waiting) + Number(it.ready) : 0, overdue) };
      }),
      desk: staff ? loans.map((l) => ({ id: Number(l.id), title: title(l.item_id), kind: itemById[String(l.item_id)] ? String(itemById[String(l.item_id)].kind) : 'print', patron: names[String(l.patron_id)] ?? 'Member', dueAt: iso(l.due_at), overdue: new Date(String(l.due_at)).getTime() < now, version: Number(l.version) })) : [],
      myHolds: holds.map((h) => ({ id: Number(h.id), title: title(h.item_id), state: String(h.state), readyUntil: iso(h.ready_until), ahead: Number(h.ahead), itemId: Number(h.item_id) })),
      requests: requests.map((r) => {
        const who = { staff, requester: r.requester_id === me };
        return { id: Number(r.id), mine: who.requester, requester: names[String(r.requester_id)] ?? 'Member', title: String(r.title), reason: String(r.reason), state: String(r.state), version: Number(r.version),
          licenseNote: String(r.license_note), accessible: r.accessible === null ? null : !!r.accessible, decisionNote: String(r.decision_note), itemId: r.item_id ? Number(r.item_id) : null, updatedAt: iso(r.updated_at),
          steps: r.state === 'withdrawn' ? [] : RSTEPS.filter((s) => nextRequest(String(r.state) as ReqState, s, who)) };
      }),
      staffList: staffRows.map((s) => names[String(s.user_id)] ?? 'Member'),
    };
  },
});
