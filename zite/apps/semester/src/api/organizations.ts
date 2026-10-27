import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { ORG_MIGRATION } from '../lib/orgMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of ORG_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);

// Student organizations: charter, recognition, officer roles, channels, RSVPs, dues records, budgets and spending, elections,
// handover, suspension and archive. Built on the existing Zite Groups (kind Club) and Events; membership is the Zite group's
// member list, read here on the server and passed to the database rules. No money moves: dues and spending are records.
export default createEndpoint({
  description: 'Student organizations: charters and recognition, officers, channels, RSVPs, dues, budgets and expenses, elections, handover and archive',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), groupId: z.string().nullable().default(null) }),
    z.object({ action: z.literal('setAdmin'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('charter'), groupId: z.string(), purpose: z.string().min(10).max(1000), constitution: z.string().min(50).max(20000) }),
    z.object({ action: z.literal('decide'), groupId: z.string(), step: z.enum(['recognize', 'return', 'suspend', 'archive', 'reinstate']), hash: z.string().default(''), until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('role'), groupId: z.string(), email: z.string().email().max(200), role: z.enum(['president', 'treasurer', 'officer']), on: z.boolean(), termEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null) }),
    z.object({ action: z.literal('removeMember'), groupId: z.string(), userName: z.string().max(200), userId: z.string(), reason: z.string().min(5).max(500) }),
    z.object({ action: z.literal('channel'), groupId: z.string(), name: z.string().min(2).max(60), officersOnly: z.boolean() }),
    z.object({ action: z.literal('post'), channelId: z.number().int(), body: z.string().min(1).max(4000) }),
    z.object({ action: z.literal('eventRules'), groupId: z.string(), eventId: z.string(), capacity: z.number().int().positive().nullable(), membersOnly: z.boolean() }),
    z.object({ action: z.literal('rsvp'), eventId: z.string(), status: z.enum(['going', 'maybe', 'no']) }),
    z.object({ action: z.literal('dues'), groupId: z.string(), memberId: z.string(), term: z.string().min(3).max(40), amount: z.number().int().min(0), state: z.enum(['due', 'recorded_paid', 'waived']), reference: z.string().max(100).default('') }),
    z.object({ action: z.literal('budget'), groupId: z.string(), term: z.string().min(3).max(40), category: z.string().min(2).max(60), amount: z.number().int().min(0) }),
    z.object({ action: z.literal('expense'), lineId: z.number().int(), amount: z.number().int().positive(), description: z.string().min(5).max(500) }),
    z.object({ action: z.literal('decideExpense'), expenseId: z.number().int(), approve: z.boolean(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('election'), groupId: z.string(), office: z.enum(['president', 'treasurer']), closesAt: z.string().datetime() }),
    z.object({ action: z.literal('candidate'), electionId: z.number().int(), statement: z.string().max(1000).default('') }),
    z.object({ action: z.literal('vote'), electionId: z.number().int(), candidateId: z.string() }),
    z.object({ action: z.literal('certify'), electionId: z.number().int(), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('handover'), groupId: z.string(), role: z.enum(['president', 'treasurer', 'officer']), toId: z.string(), notes: z.string().min(10).max(4000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const orgAdmin = !!((await sql.query(`SELECT org_is_admin($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.'); return Number(out!.slice(3)); };
    const allGroups = (await zite.groups.findAll({ limit: 500 })).records.filter((g) => g.kind === 'Club' && (!first(g.institution) || ids(g.institution).includes(T)));
    const group = (gid: string) => { const g = allGroups.find((x) => x.id === gid); if (!g) forbid('Organization not found.'); return g!; };
    const isMember = (gid: string, uid = me) => ids(allGroups.find((x) => x.id === gid)?.members).includes(uid);
    const byEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid;
    };
    const groupOfChannel = async (id: number) => String(((await sql.query(`SELECT group_id FROM org_channels WHERE id = $1`, [id])) as Row[])[0]?.group_id ?? '');
    const groupOfElection = async (id: number) => String(((await sql.query(`SELECT group_id FROM org_elections WHERE id = $1`, [id])) as Row[])[0]?.group_id ?? '');
    let result: unknown = null;

    switch (input.action) {
      case 'setAdmin': {
        if (!isAdmin) forbid('Only administrators manage organization admins.');
        const uid = await byEmail(input.email);
        fail(await one(`SELECT org_set_admin($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
        await audit(a, `Organization admin ${input.on ? 'granted' : 'revoked'}`, `org_admin:${uid}`, '', 'Administrator');
        break;
      }
      case 'charter': group(input.groupId); fail(await one(`SELECT org_submit_charter($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.groupId, input.purpose, input.constitution, isMember(input.groupId)])); break;
      case 'decide': group(input.groupId); fail(await one(`SELECT org_charter_decide($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.groupId, input.step, input.hash, input.until, input.note, input.expectedVersion])); break;
      case 'role': {
        group(input.groupId);
        const uid = await byEmail(input.email);
        fail(await one(`SELECT org_set_role($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.groupId, uid, input.role, input.on, input.termEnd, isMember(input.groupId, uid)]));
        break;
      }
      case 'removeMember': {
        const g = group(input.groupId);
        const officer = !!((await sql.query(`SELECT org_is_officer($1,$2) AS r`, [input.groupId, me])) as { r: boolean }[])[0].r;
        if (!officer && !orgAdmin) forbid('Officers or an organization admin manage members.');
        if (input.userId === me) forbid('Leave the organization from Campus instead.');
        await zite.groups.update({ id: g.id, record: { members: ids(g.members).filter((m) => m !== input.userId) } as never });
        await sql.query(`INSERT INTO org_events (tenant_id, group_id, step, actor_id, note) VALUES ($1,$2,'member_remove',$3,$4)`, [T, input.groupId, me, `${input.userId}: ${input.reason}`]);
        await zite.messages.create({ record: { body: `You were removed from ${g.name}: ${input.reason}`, sender: me, recipients: [input.userId], isNotification: true } as never }).catch(() => undefined);
        break;
      }
      case 'channel': group(input.groupId); fail(await one(`SELECT org_channel($1,$2,$3,$4,$5) AS r`, [me, T, input.groupId, input.name, input.officersOnly])); break;
      case 'post': { const gid = await groupOfChannel(input.channelId); group(gid); fail(await one(`SELECT org_post($1,$2,$3,$4) AS r`, [me, input.channelId, input.body, isMember(gid)])); break; }
      case 'eventRules': group(input.groupId); fail(await one(`SELECT org_event_rules($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.groupId, input.eventId, input.capacity, input.membersOnly])); break;
      case 'rsvp': {
        const ev = await zite.events.findOne({ id: input.eventId });
        const gid = first(ev?.group) ?? '';
        if (!ev || !allGroups.some((g) => g.id === gid)) forbid('Event not found.');
        fail(await one(`SELECT org_rsvp($1,$2,$3,$4,$5) AS r`, [me, input.eventId, gid, input.status, isMember(gid)]));
        const att = ids(ev!.attendees);
        await zite.events.update({ id: ev!.id, record: { attendees: input.status === 'going' ? [...new Set([...att, me])] : att.filter((x) => x !== me) } as never });
        break;
      }
      case 'dues': group(input.groupId); fail(await one(`SELECT org_dues($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.groupId, input.memberId, input.term, input.amount, input.state, input.reference])); break;
      case 'budget': group(input.groupId); fail(await one(`SELECT org_budget($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.groupId, input.term, input.category, input.amount])); break;
      case 'expense': result = { expenseId: ok(await one(`SELECT org_expense($1,$2,$3,$4,$5) AS r`, [me, T, input.lineId, input.amount, input.description])) }; break;
      case 'decideExpense': fail(await one(`SELECT org_expense_decide($1,$2,$3,$4,$5) AS r`, [me, T, input.expenseId, input.approve, input.note])); break;
      case 'election': group(input.groupId); result = { electionId: ok(await one(`SELECT org_election_open($1,$2,$3,$4,$5) AS r`, [me, T, input.groupId, input.office, input.closesAt])) }; break;
      case 'candidate': { const gid = await groupOfElection(input.electionId); group(gid); fail(await one(`SELECT org_candidate($1,$2,$3,$4) AS r`, [me, input.electionId, input.statement, isMember(gid)])); break; }
      case 'vote': { const gid = await groupOfElection(input.electionId); group(gid); fail(await one(`SELECT org_vote($1,$2,$3,$4) AS r`, [me, input.electionId, input.candidateId, isMember(gid)])); break; }
      case 'certify': fail(await one(`SELECT org_certify($1,$2,$3,$4) AS r`, [me, T, input.electionId, input.note])); break;
      case 'handover': group(input.groupId); fail(await one(`SELECT org_handover($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.groupId, input.role, input.toId, input.notes])); break;
      default: break;
    }

    // Reads: every club in the tenant with its status; full detail for the selected club, shaped by role.
    const gids = allGroups.map((g) => g.id);
    const charters = gids.length ? (await sql.query(`SELECT * FROM org_charters WHERE group_id = ANY($1::text[])`, [gids])) as Row[] : [];
    const sel = input.action === 'get' ? input.groupId : ('groupId' in input ? (input as { groupId: string }).groupId : null);
    let detail: unknown = null;
    if (sel && allGroups.some((g) => g.id === sel)) {
      const g = allGroups.find((x) => x.id === sel)!;
      const member = isMember(sel);
      const roles = (await sql.query(`SELECT * FROM org_roles WHERE group_id = $1 AND ended_at IS NULL`, [sel])) as Row[];
      const officer = roles.some((r) => r.user_id === me);
      const treasurer = roles.some((r) => r.user_id === me && r.role === 'treasurer');
      const president = roles.some((r) => r.user_id === me && r.role === 'president');
      const channels = (await sql.query(`SELECT * FROM org_channels WHERE group_id = $1 AND archived_at IS NULL ORDER BY id`, [sel])) as Row[];
      const visibleCh = channels.filter((c) => (member || orgAdmin) && (!c.officers_only || officer || orgAdmin));
      const posts = visibleCh.length ? (await sql.query(`SELECT * FROM org_posts WHERE channel_id = ANY($1::bigint[]) AND removed_by IS NULL ORDER BY at DESC LIMIT 200`, [visibleCh.map((c) => Number(c.id))])) as Row[] : [];
      const events = (await zite.events.findAll({ limit: 200 })).records.filter((e) => first(e.group) === sel);
      const caps = events.length ? (await sql.query(`SELECT * FROM org_event_caps WHERE event_id = ANY($1::text[])`, [events.map((e) => e.id)])) as Row[] : [];
      const rsvps = events.length ? (await sql.query(`SELECT event_id, status, count(*)::int AS n, bool_or(user_id = $2) AS mine_any, max(CASE WHEN user_id = $2 THEN status END) AS mine FROM org_rsvps WHERE event_id = ANY($1::text[]) GROUP BY event_id, status`, [events.map((e) => e.id), me])) as Row[] : [];
      const dues = (await sql.query(`SELECT * FROM org_dues WHERE group_id = $1 AND (member_id = $2 OR $3) ORDER BY term DESC`, [sel, me, treasurer || orgAdmin])) as Row[];
      const lines = (officer || orgAdmin) ? (await sql.query(`SELECT l.*, (SELECT coalesce(sum(amount),0) FROM org_expenses x WHERE x.line_id = l.id AND x.state = 'approved')::int AS spent FROM org_budget_lines l WHERE group_id = $1 ORDER BY term DESC, category`, [sel])) as Row[] : [];
      const expenses = lines.length ? (await sql.query(`SELECT * FROM org_expenses WHERE line_id = ANY($1::bigint[]) ORDER BY at DESC`, [lines.map((l) => Number(l.id))])) as Row[] : [];
      const elections = (await sql.query(`SELECT e.*, (SELECT count(*)::int FROM org_voted v WHERE v.election_id = e.id) AS turnout, EXISTS (SELECT 1 FROM org_voted v WHERE v.election_id = e.id AND v.voter_id = $2) AS voted FROM org_elections e WHERE group_id = $1 ORDER BY id DESC`, [sel, me])) as Row[];
      const cands = elections.length ? (await sql.query(`SELECT * FROM org_candidates WHERE election_id = ANY($1::bigint[])`, [elections.map((e) => Number(e.id))])) as Row[] : [];
      const tallies = elections.length ? (await sql.query(`SELECT election_id, candidate_id, count(*)::int AS n FROM org_ballots WHERE election_id = ANY($1::bigint[]) GROUP BY 1, 2`, [elections.filter((e) => e.state === 'certified' || (orgAdmin && new Date(String(e.closes_at)) <= new Date())).map((e) => Number(e.id))])) as Row[] : [];
      const handovers = (officer || orgAdmin) ? (await sql.query(`SELECT * FROM org_handovers WHERE group_id = $1 ORDER BY at DESC LIMIT 50`, [sel])) as Row[] : [];
      const names = await userNames([...ids(g.members), ...roles.map((r) => String(r.user_id)), ...posts.map((p) => String(p.author_id)), ...cands.map((c) => String(c.user_id)), ...dues.map((d) => String(d.member_id)), ...handovers.flatMap((h) => [h.from_id, h.to_id]).filter(Boolean).map(String)]);
      const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
      detail = {
        id: g.id, name: g.name ?? 'Organization', member, officer, treasurer, president,
        members: (officer || orgAdmin) ? ids(g.members).map((m) => ({ id: m, name: nm(m) })) : [],
        memberCount: ids(g.members).length,
        roles: roles.map((r) => ({ userId: String(r.user_id), name: nm(r.user_id), role: String(r.role), termEnd: day(r.term_end) })),
        channels: visibleCh.map((c) => ({ id: Number(c.id), name: String(c.name), officersOnly: !!c.officers_only,
          posts: posts.filter((p) => String(p.channel_id) === String(c.id)).map((p) => ({ author: nm(p.author_id), body: String(p.body), at: iso(p.at) })) })),
        events: events.map((e) => { const c = caps.find((x) => x.event_id === e.id); const rs = rsvps.filter((x) => x.event_id === e.id);
          return { id: e.id, title: e.title ?? '', startsAt: e.startsAt ?? null, location: e.location ?? '', capacity: c?.capacity == null ? null : Number(c.capacity), membersOnly: !!c?.members_only,
            going: Number(rs.find((x) => x.status === 'going')?.n ?? 0), mine: String(rs.find((x) => x.mine)?.mine ?? '') }; }),
        dues: dues.map((d) => ({ id: Number(d.id), member: nm(d.member_id), memberId: String(d.member_id), term: String(d.term), amount: Number(d.amount), state: String(d.state), reference: String(d.reference) })),
        budget: lines.map((l) => ({ id: Number(l.id), term: String(l.term), category: String(l.category), amount: Number(l.amount), spent: Number(l.spent),
          expenses: expenses.filter((x) => String(x.line_id) === String(l.id)).map((x) => ({ id: Number(x.id), amount: Number(x.amount), description: String(x.description), state: String(x.state), mine: x.requested_by === me, note: String(x.note) })) })),
        elections: elections.map((e) => ({ id: Number(e.id), office: String(e.office), closesAt: iso(e.closes_at), state: String(e.state), turnout: Number(e.turnout), voted: !!e.voted, winner: nm(e.winner_id),
          open: e.state === 'open' && new Date(String(e.closes_at)) > new Date(),
          candidates: cands.filter((c) => String(c.election_id) === String(e.id)).map((c) => ({ id: String(c.user_id), name: nm(c.user_id), statement: String(c.statement),
            votes: tallies.find((t) => String(t.election_id) === String(e.id) && t.candidate_id === c.user_id)?.n ?? null })) })),
        handovers: handovers.map((h) => ({ role: String(h.role), from: nm(h.from_id), to: nm(h.to_id), notes: String(h.notes), at: iso(h.at) })),
      };
    }
    return {
      result, orgAdmin, isAdmin, today: new Date().toISOString().slice(0, 10),
      organizations: allGroups.map((g) => { const c = charters.find((x) => x.group_id === g.id);
        return { id: g.id, name: g.name ?? 'Organization', members: ids(g.members).length, member: ids(g.members).includes(me),
          charter: c ? { state: String(c.state), rev: Number(c.rev), purpose: String(c.purpose), constitution: String(c.constitution), sha256: String(c.sha256), until: day(c.recognized_until), note: String(c.state_note), version: Number(c.version), submittedByMe: c.submitted_by === me } : null }; }),
      detail,
      admins: isAdmin ? (await userNames(((await sql.query(`SELECT user_id FROM org_admins WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((r) => String(r.user_id)))) : {},
    };
  },
});
