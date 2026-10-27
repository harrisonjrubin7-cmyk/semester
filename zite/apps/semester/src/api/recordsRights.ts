import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, audit, userNames, requireTenantMember } from '../lib/server';
import { pg } from '../lib/pg';
import { PRV_MIGRATION } from '../lib/prvMigration';

let ready: Promise<void> | null = null;
const ensurePrv = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of PRV_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
const KINDS = ['inspect', 'amend', 'directory_optout', 'restrict_disclosure'] as const;
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Records rights and access reviews (APP-013; lib/prvMigration.ts). The tenant and every role come from the caller's
// membership on the server: members see their own requests; the records-privacy office sees its institution's queue;
// administrators run access reviews and manage the office. Nothing here edits or deletes an academic record.
// S-76 E31 extension: records routed to their owners, decided per record, approved by a second office member, opened by
// the student for 14 days; records holds; amendment hearings decided by someone other than the person who denied.
export default createEndpoint({
  description: 'Records-rights requests (inspect, amend, directory opt-out, restrict disclosure) and periodic membership access reviews',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('submit'), id: z.string().min(8).max(80), kind: z.enum(KINDS), detail: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('withdraw'), id: z.string() }),
    z.object({ action: z.literal('handle'), id: z.string(), version: z.number().int(), decision: z.enum(['acknowledge', 'fulfill', 'deny']), note: z.string().max(2000) }),
    z.object({ action: z.literal('setOffice'), userId: z.string(), on: z.boolean() }),
    z.object({ action: z.literal('openReview'), id: z.string().min(8).max(80) }),
    z.object({ action: z.literal('decideLine'), reviewId: z.string(), membershipId: z.string(), decision: z.enum(['keep', 'remove']), note: z.string().max(500) }),
    z.object({ action: z.literal('closeReview'), reviewId: z.string() }),
    // S-76 E31 extension: routing, per-record decisions, approval, expiring delivery, holds, hearings.
    z.object({ action: z.literal('route'), id: z.string(), source: z.string().min(2).max(120), description: z.string().min(5).max(1000), ownerId: z.string() }),
    z.object({ action: z.literal('collect'), itemId: z.number().int(), note: z.string().min(5).max(1000), thirdParty: z.boolean() }),
    z.object({ action: z.literal('decideItem'), itemId: z.number().int(), decision: z.enum(['release', 'redact', 'withhold']), reason: z.string().max(1000).default(''), redaction: z.string().max(2000).default('') }),
    z.object({ action: z.literal('prepare'), id: z.string() }),
    z.object({ action: z.literal('approve'), id: z.string() }),
    z.object({ action: z.literal('view'), id: z.string() }),
    z.object({ action: z.literal('hold'), subjectId: z.string(), reason: z.string().min(10).max(500) }),
    z.object({ action: z.literal('release'), holdId: z.number().int(), reason: z.string().min(10).max(500) }),
    z.object({ action: z.literal('hearingRequest'), id: z.string(), reason: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('hearingDecide'), id: z.string(), outcome: z.enum(['upheld', 'amended']), note: z.string().min(10).max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensurePrv();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const isAdmin = a.roles.includes('Administrator');
    const office = ((await sql.query(`SELECT prv_is_staff($1,$2) AS ok`, [T, uid])) as { ok: boolean }[])[0].ok;
    const call = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    const adminOnly = () => { if (!isAdmin) fail('Only institution administrators can do this.'); };

    if (input.action === 'submit') {
      await call(`SELECT prv_submit($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.kind, input.detail]);
      await audit(a, 'Records-rights request submitted', `recordsRights:${input.id}`, input.kind, 'Owner');
    }
    if (input.action === 'withdraw') {
      await call(`SELECT prv_withdraw($1,$2,$3) AS e`, [uid, T, input.id]);
      await audit(a, 'Records-rights request withdrawn', `recordsRights:${input.id}`, '', 'Owner');
    }
    if (input.action === 'handle') {
      await call(`SELECT prv_handle($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.version, input.decision, input.note]);
      await audit(a, `Records-rights request ${input.decision}`, `recordsRights:${input.id}`, '', 'Records-privacy office');
      if (input.decision !== 'acknowledge') {
        const r = ((await sql.query(`SELECT requester_id FROM prv_requests WHERE id = $1`, [input.id])) as Row[])[0];
        if (r) await zite.messages.create({ record: { body: 'Your records request has an answer. Open You → Privacy & data to read it.', sender: uid, recipients: [String(r.requester_id)], isNotification: true } as never }).catch(() => undefined);
      }
    }
    if (input.action === 'setOffice') {
      adminOnly();
      if (input.on) await requireTenantMember(T, input.userId);
      await call(`SELECT prv_set_staff($1,$2,$3,$4) AS e`, [uid, T, input.userId, input.on]);
      await audit(a, input.on ? 'Records-privacy office granted' : 'Records-privacy office revoked', `user:${input.userId}`, '', 'Administrator');
    }
    if (input.action === 'openReview') {
      adminOnly();
      const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 500 });
      const names = await userNames(mems.records.map((m) => first(m.member) ?? ''));
      const lines = mems.records.filter((m) => first(m.member)).map((m) => ({ membershipId: m.id, subjectId: first(m.member), name: names[first(m.member) ?? ''] ?? m.label ?? '', roles: m.roles ?? [], status: m.status ?? '' }));
      await call(`SELECT arv_open($1,$2,$3,$4::jsonb) AS e`, [uid, T, input.id, JSON.stringify(lines)]);
      await audit(a, 'Access review opened', `accessReview:${input.id}`, `${lines.length} memberships`, 'Administrator');
    }
    if (input.action === 'decideLine') {
      adminOnly();
      await call(`SELECT arv_decide($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.reviewId, input.membershipId, input.decision, input.note]);
      await audit(a, `Access certified: ${input.decision}`, `membership:${input.membershipId}`, input.note, 'Administrator');
    }
    if (input.action === 'closeReview') {
      adminOnly();
      await call(`SELECT arv_close($1,$2,$3) AS e`, [uid, T, input.reviewId]);
      await audit(a, 'Access review closed', `accessReview:${input.reviewId}`, '', 'Administrator');
    }

    const officeOnly = () => { if (!office) fail('Only the records-privacy office can do this.'); };
    const notify = async (to: unknown, body: string) => { if (to && String(to) !== uid) await zite.messages.create({ record: { body, sender: uid, recipients: [String(to)], isNotification: true } as never }).catch(() => undefined); };
    let result: unknown = null;
    if (input.action === 'route') {
      officeOnly(); await requireTenantMember(T, input.ownerId);
      const out = ((await sql.query(`SELECT prv_route($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.source, input.description, input.ownerId])) as { e: string }[])[0].e;
      if (!out?.startsWith('ok:')) fail(out ?? 'Failed.');
      await audit(a, 'Record routed to its owner', `recordsRights:${input.id}`, input.source, 'Records-privacy office');
      await notify(input.ownerId, 'A records request needs a record you keep. Open You → Privacy & data.');
    }
    if (input.action === 'collect') { await call(`SELECT prv_collect($1,$2,$3,$4,$5) AS e`, [uid, T, input.itemId, input.note, input.thirdParty]); await audit(a, 'Record collected', `recordsItem:${input.itemId}`, input.thirdParty ? 'mentions others' : '', office ? 'Records-privacy office' : 'Record owner'); }
    if (input.action === 'decideItem') { await call(`SELECT prv_decide_item($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.itemId, input.decision, input.reason, input.redaction]); await audit(a, `Record decision: ${input.decision}`, `recordsItem:${input.itemId}`, input.reason.slice(0, 200), 'Records-privacy office'); }
    if (input.action === 'prepare') { await call(`SELECT prv_prepare($1,$2,$3) AS e`, [uid, T, input.id]); await audit(a, 'Response prepared', `recordsRights:${input.id}`, '', 'Records-privacy office'); }
    if (input.action === 'approve') { await call(`SELECT prv_approve($1,$2,$3) AS e`, [uid, T, input.id]); await audit(a, 'Response approved', `recordsRights:${input.id}`, '', 'Records-privacy office'); }
    if (input.action === 'view') {
      await call(`SELECT prv_view($1,$2,$3) AS e`, [uid, T, input.id]);
      const items = (await sql.query(`SELECT * FROM prv_items WHERE request_id = $1 ORDER BY id`, [input.id])) as Row[];
      result = { records: items.filter((i) => i.decision !== 'withhold').map((i) => ({ source: String(i.source), content: i.decision === 'redact' ? String(i.redaction) : String(i.description), redacted: i.decision === 'redact' })),
        withheld: items.filter((i) => i.decision === 'withhold').map((i) => ({ source: String(i.source), reason: String(i.reason) })) };
      await audit(a, 'Records response opened', `recordsRights:${input.id}`, '', 'Owner');
    }
    if (input.action === 'hold') {
      officeOnly(); await requireTenantMember(T, input.subjectId);
      const out = ((await sql.query(`SELECT prv_hold($1,$2,$3,$4) AS e`, [uid, T, input.subjectId, input.reason])) as { e: string }[])[0].e;
      if (!out?.startsWith('ok:')) fail(out ?? 'Failed.');
      await audit(a, 'Records hold placed', `recordsHold:${out!.slice(3)}`, input.reason.slice(0, 200), 'Records-privacy office');
    }
    if (input.action === 'release') { await call(`SELECT prv_release($1,$2,$3,$4) AS e`, [uid, T, input.holdId, input.reason]); await audit(a, 'Records hold released', `recordsHold:${input.holdId}`, input.reason.slice(0, 200), 'Records-privacy office'); }
    if (input.action === 'hearingRequest') { await call(`SELECT prv_hearing_request($1,$2,$3,$4) AS e`, [uid, T, input.id, input.reason]); await audit(a, 'Hearing requested', `recordsRights:${input.id}`, '', 'Owner'); }
    if (input.action === 'hearingDecide') {
      await call(`SELECT prv_hearing_decide($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.outcome, input.note]);
      await audit(a, `Hearing decided: ${input.outcome}`, `recordsRights:${input.id}`, input.note.slice(0, 200), 'Records-privacy office');
      const r = ((await sql.query(`SELECT requester_id FROM prv_requests WHERE id = $1`, [input.id])) as Row[])[0];
      if (r) await notify(r.requester_id, 'Your records hearing has a decision. Open You → Privacy & data.');
    }

    const responses = Object.fromEntries(((await sql.query(`SELECT x.* FROM prv_responses x JOIN prv_requests r ON r.id = x.request_id WHERE r.tenant_id = $1 AND (r.requester_id = $2 OR $3)`, [T, uid, office])) as Row[]).map((x) => [String(x.request_id), x]));
    const hearings = Object.fromEntries(((await sql.query(`SELECT h.* FROM prv_hearings h JOIN prv_requests r ON r.id = h.request_id WHERE r.tenant_id = $1 AND (r.requester_id = $2 OR $3)`, [T, uid, office])) as Row[]).map((h) => [String(h.request_id), h]));
    const now = Date.now();
    const respOut = (id: string) => { const x = responses[id]; return x ? { preparedByMe: x.prepared_by === uid, approved: !!x.approved_by, approvedByMe: x.approved_by === uid, delivered: !!x.delivered_at,
      open: !!x.delivered_at && now - new Date(String(x.delivered_at)).getTime() <= 14 * 86_400_000, expired: !!x.delivered_at && now - new Date(String(x.delivered_at)).getTime() > 14 * 86_400_000, views: Number(x.views) } : null; };
    const hearOut = (id: string) => { const h = hearings[id]; return h ? { reason: String(h.reason), outcome: (h.outcome as string) ?? null, note: String(h.note), requestedAt: iso(h.requested_at), deniedByMe: h.denied_by === uid } : null; };
    const map = (r: Row) => ({ id: String(r.id), number: Number(r.number), kind: String(r.kind), detail: String(r.detail), state: String(r.state), version: Number(r.version),
      dueAt: iso(r.due_at), createdAt: iso(r.created_at), handledAt: iso(r.handled_at), outcome: (r.outcome_note as string) ?? '', overdue: !!r.overdue });
    const mine = (await sql.query(`SELECT *, (state IN ('submitted','acknowledged') AND due_at < now()) AS overdue FROM prv_requests WHERE tenant_id = $1 AND requester_id = $2 ORDER BY number DESC LIMIT 50`, [T, uid])) as Row[];
    const out: Record<string, unknown> = { result, isAdmin, office, mine: mine.map((r) => ({ ...map(r), response: respOut(String(r.id)), hearing: hearOut(String(r.id)),
      canRequestHearing: r.kind === 'amend' && r.state === 'denied' && !hearings[String(r.id)] && !!r.handled_at && now - new Date(String(r.handled_at)).getTime() <= 30 * 86_400_000 })) };
    const tasks = (await sql.query(`SELECT i.*, r.requester_id, r.number FROM prv_items i JOIN prv_requests r ON r.id = i.request_id WHERE i.tenant_id = $1 AND i.owner_id = $2 AND NOT i.collected AND r.state IN ('submitted','acknowledged')`, [T, uid])) as Row[];
    if (tasks.length) { const tn = await userNames(tasks.map((t) => String(t.requester_id))); out.ownerTasks = tasks.map((t) => ({ itemId: Number(t.id), number: Number(t.number), student: tn[String(t.requester_id)] ?? 'Student', source: String(t.source), description: String(t.description) })); } else out.ownerTasks = [];
    if (office) {
      const q = (await sql.query(`SELECT *, (state IN ('submitted','acknowledged') AND due_at < now()) AS overdue FROM prv_requests WHERE tenant_id = $1 ORDER BY (state IN ('submitted','acknowledged')) DESC, due_at ASC LIMIT 200`, [T])) as Row[];
      const names = await userNames(q.map((r) => String(r.requester_id)));
      const items = q.length ? (await sql.query(`SELECT * FROM prv_items WHERE tenant_id = $1 AND request_id = ANY($2::text[]) ORDER BY id`, [T, q.map((r) => String(r.id))])) as Row[] : [];
      const holds = (await sql.query(`SELECT * FROM prv_holds WHERE tenant_id = $1 AND released_at IS NULL ORDER BY placed_at DESC`, [T])) as Row[];
      const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 500 });
      const memberIds = mems.records.map((m) => first(m.member)).filter((x): x is string => !!x);
      const more = await userNames([...items.map((i) => String(i.owner_id)), ...holds.flatMap((h) => [String(h.subject_id), String(h.placed_by)]), ...memberIds]);
      const heldSet = new Set(holds.map((h) => String(h.subject_id)));
      out.queue = q.map((r) => ({ ...map(r), requester: names[String(r.requester_id)] ?? 'Member', own: r.requester_id === uid, held: heldSet.has(String(r.requester_id)),
        response: respOut(String(r.id)), hearing: hearOut(String(r.id)),
        items: items.filter((i) => i.request_id === r.id).map((i) => ({ id: Number(i.id), source: String(i.source), description: String(i.description), owner: more[String(i.owner_id)] ?? 'Member',
          collected: !!i.collected, collectedNote: String(i.collected_note), thirdParty: !!i.third_party, decision: (i.decision as string) ?? null, reason: String(i.reason), redaction: String(i.redaction) })) }));
      out.holds = holds.map((h) => ({ id: Number(h.id), student: more[String(h.subject_id)] ?? 'Member', reason: String(h.reason), placedBy: more[String(h.placed_by)] ?? 'Office', placedByMe: h.placed_by === uid, placedAt: iso(h.placed_at) }));
      out.people = memberIds.filter((id) => id !== uid).map((id) => ({ id, name: more[id] ?? 'Member' }));
    }
    if (isAdmin) {
      const [staff, reviews] = await Promise.all([
        sql.query(`SELECT user_id FROM prv_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T]) as Promise<Row[]>,
        sql.query(`SELECT * FROM arv_reviews WHERE tenant_id = $1 ORDER BY number DESC LIMIT 10`, [T]) as Promise<Row[]>,
      ]);
      const open = reviews.find((r) => r.state === 'open');
      const lines = open ? ((await sql.query(`SELECT * FROM arv_lines WHERE review_id = $1 ORDER BY subject_name`, [open.id])) as Row[]) : [];
      const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 500 });
      const staffIds = staff.map((s) => String(s.user_id));
      const names = await userNames([...staffIds, ...mems.records.map((m) => first(m.member) ?? ''), ...lines.map((l) => String(l.decided_by ?? ''))]);
      out.officeStaff = staffIds.map((id) => ({ id, name: names[id] ?? 'Member' }));
      out.members = mems.records.map((m) => first(m.member)).filter((id): id is string => !!id && id !== uid && !staffIds.includes(id)).map((id) => ({ id, name: names[id] ?? 'Member' }));
      out.reviews = reviews.map((r) => ({ id: String(r.id), number: Number(r.number), state: String(r.state), openedAt: iso(r.opened_at), closedAt: iso(r.closed_at) }));
      out.openReview = open ? { id: String(open.id), number: Number(open.number), lines: lines.map((l) => ({ membershipId: String(l.membership_id), name: String(l.subject_name), roles: l.roles as string[],
        status: String(l.status), decision: (l.decision as string) ?? null, decidedBy: l.decided_by ? names[String(l.decided_by)] ?? 'Administrator' : '', note: (l.note as string) ?? '',
        self: l.subject_id === uid, currentStatus: mems.records.find((m) => m.id === l.membership_id)?.status ?? 'Removed' })) } : null;
    }
    return out;
  },
});
