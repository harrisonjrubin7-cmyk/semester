import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensurePlt, currentEpoch, processOutbox } from '../lib/platform';
import { appsForRoles, roleAppByKey } from '../lib/roleApps';

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
// Offices a referral can go to: role apps hosted in this app that serve students directly.
const REFERRABLE = ['tutor', 'learning-center-staff', 'career-coach', 'career-center-staff', 'academic-advisor', 'disability-services-staff', 'university-staff', 'student-accounts-officer'];
const STAFF_ROLES = ['Advisor', 'Faculty', 'Staff', 'Tutor', 'Administrator'];

// Cross-app referrals (backlog C5) on the command/receipt/outbox and permission-epoch slices (C3, C4): lib/pltMigration.ts.
// Who is in the receiving office is resolved here from server membership; the client sends only ids, text and its epoch.
export default createEndpoint({
  description: 'Referrals between Semester apps: staff propose, the student approves what is shared, the receiving office accepts and resolves',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('propose'), key: z.string().min(8).max(80), epoch: z.number().int(), id: z.string().min(8).max(80), studentId: z.string(), fromApp: z.string(), toApp: z.string(), purpose: z.string().min(10).max(300), summary: z.string().min(10).max(1000) }),
    z.object({ action: z.literal('command'), key: z.string().min(8).max(80), epoch: z.number().int(), id: z.string(), version: z.number().int(), cmd: z.enum(['consent', 'refuse', 'withdraw', 'accept', 'decline', 'resolve']), text: z.string().max(1000).nullable() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensurePlt();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const myApps = appsForRoles(a.roles).map((x) => x.key);
    const mems = (await zite.memberships.findAll({ filters: { institution: T }, limit: 500 })).records.filter((m) => m.status === 'Active');
    const officeOf = (app: string) => mems.filter((m) => appsForRoles(m.roles ?? []).some((x) => x.key === app)).map((m) => first(m.member)).filter(Boolean) as string[];
    const fail = (e: string) => { throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    const notify = (to: string[], body: string) => to.length ? zite.messages.create({ record: { body, sender: uid, recipients: to, isNotification: true } as never }).catch(() => undefined) : undefined;
    let receipt: string | null = null;

    const exec = async (args: unknown[]) => {
      const r = String(((await sql.query(`SELECT plt_handoff_cmd($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) AS r`, args)) as { r: string }[])[0].r);
      if (r.startsWith('OK:') || r.startsWith('DUP:')) return r.split(':')[1];
      fail(r); return '';
    };
    if (input.action === 'propose') {
      if (!a.roles.some((r) => STAFF_ROLES.includes(r))) fail('Only staff can refer a student.');
      if (!myApps.includes(input.fromApp)) fail('Refer from an app your role opens.');
      if (!REFERRABLE.includes(input.toApp)) fail('That office does not take referrals yet.');
      const isStudent = mems.some((m) => first(m.member) === input.studentId && (m.roles ?? []).includes('Student'));
      if (!isStudent) fail('That student is not active at your institution.');
      receipt = await exec([T, uid, input.epoch, input.key, 'propose', input.id, 0, input.studentId, input.fromApp, input.toApp, input.purpose, input.summary, [], null]);
      await notify([input.studentId], `A referral to ${roleAppByKey(input.toApp)?.role ?? 'another office'} needs your OK before anything is shared.`);
      await audit(a, 'Referral proposed', `handoff:${input.id}`, `${input.fromApp} → ${input.toApp}`, 'Staff');
    }
    if (input.action === 'command') {
      const h = ((await sql.query(`SELECT * FROM plt_handoffs WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!h) fail('Referral not found.');
      const office = officeOf(String(h.to_app));
      receipt = await exec([T, uid, input.epoch, input.key, input.cmd, input.id, input.version, null, null, null, null, null, office, input.text]);
      const after = ((await sql.query(`SELECT state FROM plt_handoffs WHERE id = $1`, [input.id])) as Row[])[0];
      const label = roleAppByKey(String(h.to_app))?.role ?? 'the office';
      if (input.cmd === 'consent') await notify(office.filter((x) => x !== h.sender_id), `New referral for ${label}.`);
      if (['accept', 'decline', 'resolve'].includes(input.cmd)) await notify([String(h.student_id), String(h.sender_id)], `Your referral to ${label} is now ${after?.state}.`);
      if (input.cmd === 'refuse') await notify([String(h.sender_id)], `The student chose not to share the referral to ${label}.`);
      await audit(a, `Referral ${input.cmd}`, `handoff:${input.id}`, String(after?.state ?? ''), input.cmd === 'consent' || input.cmd === 'refuse' ? 'Owner' : 'Staff');
    }

    // Consumer runs inline after a command; failures stay queued for the Integration Admin console.
    if (receipt) await processOutbox(T).catch(() => undefined);
    const epoch = await currentEpoch(T, uid);
    const inOffices = myApps.filter((k) => REFERRABLE.includes(k));
    const [mine, sent, queue] = await Promise.all([
      sql.query(`SELECT * FROM plt_handoffs WHERE tenant_id = $1 AND student_id = $2 ORDER BY number DESC LIMIT 50`, [T, uid]) as Promise<Row[]>,
      sql.query(`SELECT * FROM plt_handoffs WHERE tenant_id = $1 AND sender_id = $2 ORDER BY number DESC LIMIT 50`, [T, uid]) as Promise<Row[]>,
      inOffices.length ? sql.query(`SELECT * FROM plt_handoffs WHERE tenant_id = $1 AND to_app = ANY($2) AND (state = 'queued' OR recipient_id = $3) AND sender_id <> $3 AND student_id <> $3 ORDER BY number DESC LIMIT 100`, [T, inOffices, uid]) as Promise<Row[]> : Promise.resolve([] as Row[]),
    ]);
    const names = await userNames([...mine, ...sent, ...queue].flatMap((h) => [String(h.student_id), String(h.sender_id), String(h.recipient_id ?? '')]));
    const view = (h: Row, withSummary: boolean) => ({ id: String(h.id), number: Number(h.number), state: String(h.state), version: Number(h.version), from: roleAppByKey(String(h.from_app))?.role ?? String(h.from_app),
      to: roleAppByKey(String(h.to_app))?.role ?? String(h.to_app), purpose: String(h.purpose), summary: withSummary ? String(h.summary) : null, outcome: (h.outcome as string) ?? null,
      student: names[String(h.student_id)] ?? 'Student', sender: names[String(h.sender_id)] ?? 'Staff', recipient: h.recipient_id ? names[String(h.recipient_id)] ?? 'Staff' : null,
      mineToResolve: h.recipient_id === uid, createdAt: iso(h.created_at), expiresAt: iso(h.expires_at) });
    const students = a.roles.some((r) => STAFF_ROLES.includes(r)) ? mems.filter((m) => (m.roles ?? []).includes('Student') && first(m.member) !== uid).map((m) => first(m.member)!) : [];
    const sn = await userNames(students);
    return {
      epoch, receipt, fromApps: myApps.map((k) => ({ key: k, label: roleAppByKey(k)?.role ?? k })), toApps: REFERRABLE.map((k) => ({ key: k, label: roleAppByKey(k)?.role ?? k })),
      students: students.map((id) => ({ id, name: sn[id] ?? 'Student' })),
      mine: mine.map((h) => view(h, true)),
      sent: sent.map((h) => view(h, true)),
      // The office sees the summary only after the student approved sharing (queued or later).
      queue: queue.map((h) => view(h, h.state !== 'awaiting_consent')),
    };
  },
});
