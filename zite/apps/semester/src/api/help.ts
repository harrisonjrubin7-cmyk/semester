import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { holdsFor } from '../lib/holdServer';
import { requireAccess, ids, first, forbid, audit, userNames, tenantScope, inSet } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureApt } from '../lib/aptServer';
import { STANDINGS, OUTCOMES, reviewNote, reviewBlocker, closeBlocker, studentSummary, countReviews } from '../lib/caseRules';

const STAFF = ['Advisor', 'Staff', 'Administrator', 'Tutor'];

export default createEndpoint({
  description: 'Advising, tutoring and support: booking slots, support requests, caseload and referrals',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('book'), id: z.string() }),
    z.object({ action: z.literal('cancel'), id: z.string() }),
    z.object({ action: z.literal('request'), title: z.string().min(3), notes: z.string() }),
    z.object({ action: z.literal('updateCase'), id: z.string(), status: z.enum(['Received']).optional() }),
    z.object({ action: z.literal('termReview'), id: z.string(), term: z.string().max(40), standing: z.enum(STANDINGS), steps: z.array(z.string().max(200)).max(12), shareWithStudent: z.boolean() }),
    z.object({ action: z.literal('close'), id: z.string(), outcome: z.enum(OUTCOMES), summary: z.string().max(2000) }),
    z.object({ action: z.literal('claim'), id: z.string() }),
    z.object({ action: z.literal('refer'), id: z.string(), toUserId: z.string(), note: z.string().min(20) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const uid = a.userId;
    const isStaff = a.roles.some((r) => STAFF.includes(r));
    if (input.action === 'book') {
      const s = await zite.appointments.findOne({ id: input.id });
      if (!s || s.status !== 'Open Slot') forbid('That slot was just taken. Pick another.');
      if (!inSet(s!.host, (await tenantScope(a.institutionId)).members)) forbid('That slot is not offered at your institution.');
      if (!s!.startsAt || Date.parse(s!.startsAt) <= Date.now()) forbid('That slot has already started.');
      if (ids(s!.host).includes(uid)) forbid('You cannot book your own slot.');
      // Atomic claim (apt-001): the first insert wins, so two students can never both book one slot.
      await ensureApt();
      const won = ((await pg().query(`INSERT INTO apt_claims (appointment_id, tenant_id, student_id) VALUES ($1,$2,$3) ON CONFLICT (appointment_id) DO NOTHING RETURNING appointment_id`, [s!.id, a.institutionId, uid])) as unknown[]).length;
      if (!won) forbid('That slot was just taken. Pick another.');
      try { await zite.appointments.update({ id: s!.id, record: { status: 'Booked', attendee: uid } as never }); }
      catch (e) { await pg().query(`DELETE FROM apt_claims WHERE appointment_id = $1 AND student_id = $2`, [s!.id, uid]); throw e; }
      await audit(a, 'Appointment booked', `appointment:${s!.id}`, s!.label ?? '', 'Student');
      return { ok: true };
    }
    if (input.action === 'cancel') {
      const s = await zite.appointments.findOne({ id: input.id });
      if (!s || !ids(s.attendee).includes(uid) || s.status !== 'Booked') forbid();
      if (s!.startsAt && Date.parse(s!.startsAt) <= Date.now()) forbid('It has already started. Ask your host instead.');
      await zite.appointments.update({ id: s!.id, record: { status: 'Open Slot', attendee: null } as never });
      await ensureApt();
      await pg().query(`DELETE FROM apt_claims WHERE appointment_id = $1`, [s!.id]);
      await audit(a, 'Appointment cancelled', `appointment:${s!.id}`, s!.label ?? '', 'Student');
      return { ok: true };
    }
    if (input.action === 'request') {
      const ref = 'SUP-' + Math.floor(1000 + Math.random() * 9000);
      await zite.cases.create({ record: { title: input.title, student: uid, category: 'Service Request', status: 'Sent', reference: ref, notes: input.notes } as never });
      return { ok: true, reference: ref };
    }
    const colleagues = async () => {
      const { records } = await zite.memberships.findAll({ filters: { institution: a.institutionId }, limit: 500 });
      const ms = records.filter((m) => m.status === 'Active' && (m.roles ?? []).some((r) => STAFF.includes(r)));
      const names = await userNames(ms.map((m) => first(m.member) ?? ''));
      return ms.map((m) => ({ id: first(m.member) ?? '', name: names[first(m.member) ?? ''] ?? 'Member', roles: (m.roles ?? []).filter((r) => STAFF.includes(r)) }))
        .filter((x) => x.id && x.id !== uid);
    };
    // Assigned rule: staff act only on cases assigned to them, or unassigned cases they claim.
    const loadOwned = async (id: string, allowUnassigned = false) => {
      if (!isStaff) forbid('Only advisors and staff can work cases.');
      const c = await zite.cases.findOne({ id });
      if (!c || !inSet(c.student, (await tenantScope(a.institutionId)).members)) forbid();
      const owner = first(c!.assignedTo);
      if (ids(c!.student).includes(uid)) forbid('You cannot work your own case.');
      if (owner ? owner !== uid : !allowUnassigned) forbid('This case is assigned to someone else.');
      return c!;
    };
    if (input.action === 'claim') {
      const c = await loadOwned(input.id, true);
      await zite.cases.update({ id: c.id, record: { assignedTo: uid, status: c.status === 'Sent' ? 'Received' : c.status } as never });
      await audit(a, 'Case claimed', `case:${c.id}`, '', a.roles.join(', '));
      return { ok: true };
    }
    if (input.action === 'updateCase') {
      const c = await loadOwned(input.id);
      await zite.cases.update({ id: c.id, record: { status: input.status } as never });
      await audit(a, `Case ${input.status}`, `case:${c.id}`, '', a.roles.join(', '));
      return { ok: true };
    }
    if (input.action === 'termReview') {
      const c = await loadOwned(input.id);
      const block = reviewBlocker(input.term, input.steps); if (block) forbid(block);
      const steps = input.steps.map((x) => x.trim()).filter((x) => x.length >= 3);
      const day = new Date().toISOString().slice(0, 10);
      await zite.cases.update({ id: c.id, record: { notes: `${c.notes ?? ''}\n${reviewNote(day, input.term, input.standing, steps)}`.trim() } as never });
      // Note visibility is explicit: staff notes stay staff-only; the student gets only standing + next steps, and only if shared.
      if (input.shareWithStudent) {
        const student = first(c.student);
        if (student) await zite.messages.create({ record: { body: studentSummary(input.term, input.standing, steps), sender: uid, recipients: [student], isNotification: true } as never });
      }
      await audit(a, 'Term review recorded', `case:${c.id}`, `${input.term} · ${input.standing}${input.shareWithStudent ? ' · shared with student' : ''}`, a.roles.join(', '));
      return { ok: true };
    }
    if (input.action === 'close') {
      const c = await loadOwned(input.id);
      const block = closeBlocker(input.outcome, input.summary, c.notes); if (block) forbid(block);
      const day = new Date().toISOString().slice(0, 10);
      await zite.cases.update({ id: c.id, record: { status: 'Resolved', notes: `${c.notes ?? ''}\n${day} · Closed (${input.outcome.replace(/_/g, ' ')}): ${input.summary.trim()}`.trim() } as never });
      await audit(a, 'Case closed', `case:${c.id}`, input.outcome, a.roles.join(', '));
      return { ok: true };
    }
    if (input.action === 'refer') {
      const c = await loadOwned(input.id);
      const to = (await colleagues()).find((x) => x.id === input.toUserId);
      if (!to) forbid('You can only refer to an active advisor or staff member in your institution.');
      const day = new Date().toISOString().slice(0, 10);
      await zite.cases.update({ id: c.id, record: { assignedTo: to!.id, category: 'Referral', status: 'Sent', notes: `${c.notes ?? ''}\n${day} · Referred to ${to!.name}: ${input.note}`.trim() } as never });
      await zite.messages.create({ record: { body: `Case ${c.reference ?? ''} was referred to you: ${input.note}`, sender: uid, recipients: [to!.id], isNotification: true } as never });
      await audit(a, 'Case referred', `case:${c.id}`, `to ${to!.name}`, a.roles.join(', '));
      return { ok: true };
    }
    const [slots, mine, myCases, holds] = await Promise.all([
      zite.appointments.findAll({ filters: { status: 'Open Slot' }, limit: 100 }),
      zite.appointments.findAll({ filters: { attendee: uid }, limit: 100 }),
      zite.cases.findAll({ filters: { student: uid }, limit: 100 }),
      holdsFor(uid),
    ]);
    const now = new Date().toISOString();
    const tenant = await tenantScope(a.institutionId);
    slots.records = slots.records.filter((s) => inSet(s.host, tenant.members));
    let caseload: unknown[] = [];
    let team: { id: string; name: string; roles: string[] }[] = [];
    if (isStaff) {
      const all = await zite.cases.findAll({ limit: 2000 });
      const open = all.records.filter((c) => inSet(c.student, tenant.members) && c.status !== 'Resolved' && !ids(c.student).includes(uid) && (!first(c.assignedTo) || first(c.assignedTo) === uid));
      const names = await userNames(open.map((c) => first(c.student) ?? ''));
      caseload = open.map((c) => ({ id: c.id, title: c.title ?? '', category: c.category ?? '', status: c.status ?? '', reference: c.reference ?? '', student: names[first(c.student) ?? ''] ?? 'Member', notes: first(c.assignedTo) === uid ? c.notes ?? '' : '', reviews: countReviews(c.notes), mine: first(c.assignedTo) === uid }));
      team = await colleagues();
    }
    const caseRow = (c: (typeof myCases.records)[0]) => ({ id: c.id, title: c.title ?? '', category: c.category ?? '', status: c.status ?? '', reference: c.reference ?? '' });
    return {
      slots: slots.records.filter((s) => (s.startsAt ?? '') > now).map((s) => ({ id: s.id, label: s.label ?? '', kind: s.kind ?? '', startsAt: s.startsAt ?? null }))
        .sort((x, y) => (x.startsAt ?? '').localeCompare(y.startsAt ?? '')),
      booked: mine.records.filter((s) => s.status === 'Booked').map((s) => ({ id: s.id, label: s.label ?? '', startsAt: s.startsAt ?? null })),
      cases: myCases.records.map(caseRow),
      holds: holds.map((h) => ({ id: h.id, title: h.title, office: h.office })),
      isStaff, roles: a.roles, caseload, team,
    };
  },
});
