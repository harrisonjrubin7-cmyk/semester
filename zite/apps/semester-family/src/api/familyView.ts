import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { holdsFor } from '../../../semester/src/lib/holdServer';
import { termBalances } from '../../../semester/src/lib/billingRules';
import { pg } from '../../../semester/src/lib/pg';
import { ensureFam } from '../../../semester/src/lib/famServer';

const ids = (v: string | string[] | undefined | null): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);
const first = (v: string | string[] | undefined | null) => ids(v)[0];

export default createEndpoint({
  description: 'Shows a guardian only what each student has actively shared with them, and logs every view',
  authenticated: true,
  inputSchema: z.object({ studentId: z.string().optional(), note: z.string().min(1).max(1000).optional(), history: z.boolean().optional(),
    invitations: z.boolean().optional(), respond: z.object({ id: z.number().int(), accept: z.boolean() }).optional(), leave: z.number().int().optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    await ensureFam();
    const today = new Date().toISOString().slice(0, 10);
    // The signed-in account's own email, read on the server: only that account can answer an invitation sent to it.
    const myEmail = String(((await zite.sql({ query: `SELECT "email" FROM "ziteUsers" WHERE "id" = $1`, params: [uid] })).rows[0] as { email?: string } | undefined)?.email ?? '').toLowerCase();
    const one = async (q: string, p: unknown[]) => String(((await pg().query(q, p)) as { r: string }[])[0].r);
    const no = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
    if (input.respond) {
      const r = await one(`SELECT fam_respond($1,$2,$3,$4,$5::date) AS r`, [uid, myEmail, input.respond.id, input.respond.accept, today]);
      if (r !== 'ok') no(r);
      await zite.auditEvents.create({ record: { action: input.respond.accept ? 'Family invitation accepted' : 'Family invitation declined', actor: uid, recordRef: `family-invite:${input.respond.id}`, authority: 'Invited recipient', details: '', viaAssistant: false, institution: null } as never });
      return { ok: true };
    }
    if (input.leave != null) {
      // Only the family member leaves here; a student ends sharing from Semester → Privacy, which also closes their consent record.
      const mineAsRecipient = (await pg().query(`SELECT 1 FROM fam_invites WHERE id = $1 AND recipient_id = $2`, [input.leave, uid])) as unknown[];
      if (!mineAsRecipient.length) no('Sharing not found.');
      const r = await one(`SELECT fam_end($1,$2) AS r`, [uid, input.leave]);
      if (r !== 'ok') no(r);
      await zite.auditEvents.create({ record: { action: 'Family sharing left', actor: uid, recordRef: `family-invite:${input.leave}`, authority: 'Recipient', details: '', viaAssistant: false, institution: null } as never });
      return { ok: true };
    }
    if (input.invitations) {
      const rows = (await pg().query(`SELECT id, student_id, categories, expires_on, invited_at FROM fam_invites WHERE recipient_email = $1 AND state = 'Pending' AND expires_on >= $2::date AND student_id <> $3 ORDER BY invited_at DESC`, [myEmail, today, uid])) as Record<string, unknown>[];
      const sids = [...new Set(rows.map((r) => String(r.student_id)))];
      const { rows: us } = sids.length ? await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [sids] }) : { rows: [] as Record<string, unknown>[] };
      return { invitations: rows.map((r) => { const u = us.find((x) => x.id === r.student_id); return { id: Number(r.id), student: String(u?.name || u?.email || 'A student'), categories: r.categories as string[], expiresOn: String(r.expires_on).slice(0, 10), invitedAt: new Date(String(r.invited_at)).toISOString() }; }) };
    }
    // The recipient's own view history (the student sees the same events from their side).
    if (input.history) {
      const ev = (await zite.auditEvents.findAll({ filters: { actor: uid, action: 'Family view' }, limit: 50 })).records;
      const sids = [...new Set(ev.map((e) => String(e.recordRef ?? '').replace('user:', '')).filter(Boolean))];
      const { rows: us } = sids.length ? await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [sids] }) : { rows: [] as Record<string, unknown>[] };
      return { history: ev.map((e) => { const sid = String(e.recordRef ?? '').replace('user:', ''); const u = us.find((r) => r.id === sid); return { at: String(e.occurredAt ?? ''), student: String(u?.name || u?.email || 'Student'), categories: String(e.details ?? '') }; })
        .sort((a, b) => b.at.localeCompare(a.at)) };
    }
    // Only accepted, unexpired invitations bound to this account (fam_live); a student's direct consent record alone is not access.
    const live = (await pg().query(`SELECT invite_id, student_id, categories, expires_on FROM fam_live($1,$2::date)`, [uid, today])) as { invite_id: number; student_id: string; categories: string[]; expires_on: string }[];
    const studentIds = [...new Set(live.map((c) => c.student_id))];
    const { rows } = studentIds.length ? await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [studentIds] }) : { rows: [] as Record<string, unknown>[] };
    const name = (id: string) => String(rows.find((r) => r.id === id)?.name || rows.find((r) => r.id === id)?.email || 'Student');
    const students = studentIds.map((s) => {
      const cs = live.filter((c) => c.student_id === s);
      const cats = [...new Set(cs.flatMap((c) => c.categories))];
      const expires = cs.map((c) => String(c.expires_on).slice(0, 10)).sort().reverse()[0] ?? null;
      return { id: s, name: name(s), categories: cats, expiresOn: expires, inviteIds: cs.map((c) => Number(c.invite_id)) };
    });
    const sel = students.find((s) => s.id === input.studentId) ?? students[0];
    if (!sel) return { students, view: null };

    if (input.note) {
      if (input.studentId !== sel.id) return { students, view: null, sent: false };
      await zite.messages.create({ record: { body: `From your family contact: ${input.note}`, sender: uid, recipients: [sel.id], isNotification: true, read: false } as never });
      await zite.auditEvents.create({ record: { action: 'Family note sent', actor: uid, recordRef: `user:${sel.id}`, authority: 'Student share', details: '', viaAssistant: false, institution: null } as never });
      return { students, view: null, sent: true };
    }
    const can = (c: string) => sel.categories.includes(c);
    const [enr, holds, tasks, secs, courses] = await Promise.all([
      can('Grades') ? zite.enrollments.findAll({ filters: { student: sel.id }, limit: 300 }) : null,
      can('Holds') ? holdsFor(sel.id) : null,
      can('Calendar') ? zite.tasks.findAll({ filters: { owner: sel.id, type: 'Assignment' }, limit: 300 }) : null,
      can('Grades') ? zite.sections.findAll({ limit: 1000, fields: ['label', 'course', 'term'] }) : null,
      can('Grades') ? zite.courses.findAll({ limit: 1000, fields: ['code', 'title'] }) : null,
    ]);
    // Billing share: per-term balance and next due date only. No line items, payment methods or aid detail.
    const ledger = can('Billing') ? await zite.accountLedgerEntries.findAll({ filters: { student: sel.id }, limit: 500 }) : null;
    const billing = ledger ? termBalances(ledger.records.map((e) => ({ type: e.entryType ?? 'Charge', amount: Number(e.amount ?? 0), term: e.term ?? '', dueDate: e.dueDate ?? '' }))) : null;
    const sById = Object.fromEntries((secs?.records ?? []).map((s) => [s.id, s]));
    const cById = Object.fromEntries((courses?.records ?? []).map((c) => [c.id, c]));
    await zite.auditEvents.create({ record: { action: 'Family view', actor: uid, recordRef: `user:${sel.id}`, authority: 'Student share', details: sel.categories.join(', '), viaAssistant: false, institution: null } as never });
    const now = new Date().toISOString();
    return {
      students,
      view: {
        ...sel,
        grades: enr ? enr.records.filter((e) => e.gradeReleased).map((e) => { const s = sById[first(e.section) ?? '']; const c = cById[first(s?.course) ?? '']; return { id: e.id, code: c?.code ?? '', title: c?.title ?? '', term: s?.term ?? '', grade: e.finalGrade ?? '', source: e.source ?? 'Official' }; }) : null,
        billing,
        holds: holds ? holds.map((h) => ({ id: h.id, title: h.title, office: h.office, source: 'Official' })) : null,
        upcoming: tasks ? tasks.records.filter((t) => (t.dueAt ?? '') >= now).sort((x, y) => (x.dueAt ?? '').localeCompare(y.dueAt ?? '')).slice(0, 15).map((t) => ({ id: t.id, title: t.title ?? '', dueAt: t.dueAt ?? null, done: t.status === 'Done', source: t.source ?? 'Official' })) : null,
      },
    };
  },
});
