import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { IDC_MIGRATION } from '../lib/idcMigration';
import { holderGrantStatus, isStale, GrantState } from '../lib/idCardRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of IDC_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const NOTE = 'There is an update to your campus card or door access in Semester. Open ID card to see it.';

// Campus Identity and Card (S-76 E16). Holders see their own card and door access, request access and report a lost card.
// Card-office officers issue and replace cards, decide ordinary access and record the card and door systems'
// confirmations; security staff decide restricted-zone access. Semester never switches a door or card on or off: until
// a confirmation is recorded, access shows as requested, not done. Rules are enforced in lib/idcMigration.ts.
export default createEndpoint({
  description: 'Campus ID card: cards, door-access requests, approvals, controller confirmations, lost-card revocation and replacement',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), kind: z.enum(['officer', 'security', 'none']) }),
    z.object({ action: z.literal('zone'), name: z.string().min(2).max(80), restricted: z.boolean() }),
    z.object({ action: z.literal('issue'), requestKey: z.string().min(8).max(100), email: z.string().email().max(200), cardRef: z.string().min(3).max(32), affiliation: z.enum(['student', 'staff', 'faculty', 'visitor']), eligibilityNote: z.string().min(5).max(300), validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), replacesId: z.number().int().nullable().default(null) }),
    z.object({ action: z.literal('cardStep'), id: z.number().int(), step: z.enum(['revoke', 'confirm_revoke']), expectedVersion: z.number().int(), note: z.string().max(300).default(''), ref: z.string().max(60).default('') }),
    z.object({ action: z.literal('requestGrant'), cardId: z.number().int(), zoneId: z.number().int(), reason: z.string().min(5).max(300) }),
    z.object({ action: z.literal('grantStep'), id: z.number().int(), step: z.enum(['approve', 'deny', 'confirm', 'revoke']), expectedVersion: z.number().int(), ref: z.string().max(60).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const kind = (((await sql.query(`SELECT idc_kind($1,$2) AS k`, [T, me])) as { k: string | null }[])[0].k) as 'officer' | 'security' | null;
    const role = kind === 'officer' ? 'Card office' : kind === 'security' ? 'Security' : 'Card holder';
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const memberId = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid!;
    };
    const tell = (to: unknown) => (to && String(to) !== me ? zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(to)], isNotification: true } as never }).catch(() => undefined) : undefined);
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage card-office and security access.');
      const uid = await memberId(input.email);
      fail(await one(`SELECT idc_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.kind === 'none' ? null : input.kind]));
      await audit(a, `ID card access: ${input.kind}`, `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'zone') {
      const out = await one(`SELECT idc_zone($1,$2,$3,$4) AS r`, [T, me, input.name, input.restricted]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      await audit(a, 'Access zone created', `zone:${out!.slice(3)}`, `${input.name}${input.restricted ? ' (restricted)' : ''}`, role);
    }
    if (input.action === 'issue') {
      const holder = await memberId(input.email);
      const out = await one(`SELECT idc_issue($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, input.requestKey, me, holder, input.cardRef, input.affiliation, input.eligibilityNote, input.validTo, input.replacesId]);
      if (!out || !/^(ok|replay):\d+$/.test(out)) forbid(out ?? 'Failed.');
      const [k, id] = out!.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') { await audit(a, input.replacesId ? 'Replacement card issued' : 'Card issued', `card:${id}`, input.cardRef, role); await tell(holder); }
    }
    if (input.action === 'cardStep') {
      const before = ((await sql.query(`SELECT holder_id FROM idc_cards WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      fail(await one(`SELECT idc_card_step($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.id, input.step, input.expectedVersion, input.note, input.ref]));
      await audit(a, input.step === 'revoke' ? 'Card revocation requested' : 'Card revocation confirmed', `card:${input.id}`, input.step === 'revoke' ? input.note : input.ref, before && String(before.holder_id) === me ? 'Card holder' : role);
      if (before) await tell(before.holder_id);
    }
    if (input.action === 'requestGrant') {
      const out = await one(`SELECT idc_request_grant($1,$2,$3,$4,$5) AS r`, [T, me, input.cardId, input.zoneId, input.reason]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      result = { id: Number(out!.slice(3)) };
      await audit(a, 'Door access requested', `accessGrant:${out!.slice(3)}`, input.reason, role);
    }
    if (input.action === 'grantStep') {
      const before = ((await sql.query(`SELECT c.holder_id FROM idc_grants g JOIN idc_cards c ON c.id = g.card_id WHERE g.id = $1 AND g.tenant_id = $2`, [input.id, T])) as Row[])[0];
      fail(await one(`SELECT idc_grant_step($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.id, input.step, input.expectedVersion, input.ref]));
      await audit(a, `Door access: ${input.step}`, `accessGrant:${input.id}`, input.ref, role);
      if (before) await tell(before.holder_id);
    }

    // Read model, scoped by who is asking.
    const staff = kind !== null;
    const zones = (await sql.query(`SELECT * FROM idc_zones WHERE tenant_id = $1 ORDER BY name`, [T])) as Row[];
    const zoneById = Object.fromEntries(zones.map((z) => [String(z.id), z]));
    const cards = (await sql.query(`SELECT * FROM idc_cards WHERE tenant_id = $1 AND (holder_id = $2 OR $3) ORDER BY (state = 'revoked'), updated_at DESC LIMIT 2000`, [T, me, kind === 'officer'])) as Row[];
    const grants = (await sql.query(`SELECT g.*, c.holder_id FROM idc_grants g JOIN idc_cards c ON c.id = g.card_id
      WHERE g.tenant_id = $1 AND (c.holder_id = $2 OR $3) ORDER BY g.updated_at DESC LIMIT 4000`, [T, me, staff])) as Row[];
    const staffRows = isAdmin ? (await sql.query(`SELECT user_id, kind FROM idc_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...(staff ? [...cards.map((c) => c.holder_id), ...grants.map((g) => g.holder_id)] : []), ...staffRows.map((s) => s.user_id)].filter(Boolean).map(String))]);
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const cardRef = Object.fromEntries(cards.map((c) => [String(c.id), String(c.card_ref)]));
    const now = new Date();
    const grantOut = (g: Row) => {
      const z = zoneById[String(g.zone_id)];
      const st = String(g.state) as GrantState;
      const restricted = !!z?.restricted;
      const decide = st === 'requested' && g.requested_by !== me && (restricted ? kind === 'security' : staff);
      return {
        id: Number(g.id), cardId: Number(g.card_id), card: cardRef[String(g.card_id)] ?? null, holder: staff ? nm(g.holder_id) : null, mine: g.holder_id === me,
        zone: z ? String(z.name) : 'Zone', restricted, state: st, status: holderGrantStatus(st), version: Number(g.version), reason: String(g.reason),
        confirmationRef: staff ? String(g.confirmation_ref) : undefined, pendingSince: iso(g.pending_since),
        stale: (st === 'provision_requested' || st === 'revoke_requested') && isStale(new Date(String(g.pending_since)), now),
        steps: [...(decide ? ['approve', 'deny'] : []), ...(kind === 'officer' && (st === 'provision_requested' || st === 'revoke_requested') ? ['confirm'] : []), ...(staff && (st === 'active' || st === 'provision_requested') ? ['revoke'] : [])],
      };
    };
    const cardOut = (c: Row) => ({
      id: Number(c.id), mine: c.holder_id === me, holder: kind === 'officer' ? nm(c.holder_id) : null, ref: String(c.card_ref), affiliation: String(c.affiliation), state: String(c.state), version: Number(c.version),
      validTo: c.valid_to ? String(c.valid_to).slice(0, 10) : null, revokeReason: String(c.revoke_reason), revokeRequestedAt: iso(c.revoke_requested_at),
      stale: c.state === 'revoke_requested' && c.revoke_requested_at ? isStale(new Date(String(c.revoke_requested_at)), now) : false, replacesId: c.replaces_id ? Number(c.replaces_id) : null,
    });

    return {
      result, kind, isAdmin,
      zones: zones.map((z) => ({ id: Number(z.id), name: String(z.name), restricted: !!z.restricted })),
      myCards: cards.filter((c) => c.holder_id === me).map(cardOut),
      myGrants: grants.filter((g) => g.holder_id === me).map(grantOut),
      cards: kind === 'officer' ? cards.map(cardOut) : [],
      queue: staff ? grants.filter((g) => ['requested', 'provision_requested', 'revoke_requested'].includes(String(g.state))).map(grantOut) : [],
      staff: staffRows.map((s) => ({ name: nm(s.user_id), kind: String(s.kind) })),
    };
  },
});
