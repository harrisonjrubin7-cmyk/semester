import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, first, forbid, audit, userNames } from '../lib/server';

// Balances are official: imported from the institution's finance system, read-only here.
// Semester never takes, refunds or moves money. Students may request a payment plan; Student Accounts staff decide.
type Entry = { id: string; type: string; label: string; amount: number; term: string; dueDate: string; source: string; at: string };
import { signed } from '../lib/billingRules';
const toEntry = (e: Awaited<ReturnType<typeof zite.accountLedgerEntries.findAll>>['records'][0]): Entry => ({
  id: e.id, type: e.entryType ?? 'Charge', label: e.label ?? '', amount: Number(e.amount ?? 0), term: e.term ?? '', dueDate: e.dueDate ?? '', source: e.source ?? 'Official', at: e.recordedAt ?? '',
});
const plan = (p: Awaited<ReturnType<typeof zite.paymentPlanRequests.findAll>>['records'][0], names: Record<string, string> = {}) => ({
  id: p.id, term: p.term ?? '', amount: Number(p.amount ?? 0), installments: Number(p.installments ?? 0), reason: p.reason ?? '', status: p.status ?? 'Requested',
  decisionNote: p.decisionNote ?? '', decidedBy: names[first(p.decidedBy) ?? ''] ?? '', student: names[first(p.student) ?? ''] ?? 'Student', studentId: first(p.student) ?? '', requestedAt: p.requestedAt ?? '',
});

export default createEndpoint({
  description: 'Student accounts: official balances (read-only) and payment plan requests decided by Student Accounts staff',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('requestPlan'), term: z.string(), installments: z.number(), reason: z.string() }),
    z.object({ action: z.literal('withdrawPlan'), planId: z.string() }),
    z.object({ action: z.literal('staff') }),
    z.object({ action: z.literal('decidePlan'), planId: z.string(), approve: z.boolean(), note: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;

    if (input.action === 'mine' || input.action === 'requestPlan' || input.action === 'withdrawPlan') {
      const a = await requireAccess(uid, ['Student']);
      const [led, plans] = await Promise.all([
        zite.accountLedgerEntries.findAll({ filters: { student: uid, institution: a.institutionId }, limit: 500 }),
        zite.paymentPlanRequests.findAll({ filters: { student: uid, institution: a.institutionId }, limit: 100 }),
      ]);
      const entries = led.records.map(toEntry);
      const byTerm = new Map<string, number>();
      for (const e of entries) byTerm.set(e.term, (byTerm.get(e.term) ?? 0) + signed(e.type, e.amount));

      if (input.action === 'requestPlan') {
        const term = (input.term ?? '').trim();
        const due = Math.round((byTerm.get(term) ?? 0) * 100) / 100;
        const n = Math.trunc(Number(input.installments));
        const reason = (input.reason ?? '').trim();
        if (due <= 0) forbid('There is no balance due for that term.');
        if (!(n >= 2 && n <= 6)) forbid('Choose between 2 and 6 installments.');
        if (reason.length < 10 || reason.length > 1000) forbid('Tell the office a little about why (at least 10 characters).');
        if (plans.records.some((p) => p.term === term && (p.status === 'Requested' || p.status === 'Approved'))) forbid('You already have a plan request for this term.');
        const p = await zite.paymentPlanRequests.create({ record: { label: `${term} plan`, student: uid, institution: a.institutionId, term, amount: due, installments: n, reason, status: 'Requested' } as never });
        await audit(a, 'Payment plan requested', `paymentPlan:${p.id}`, `${n} installments of ${term} balance`);
        return { ok: true };
      }
      if (input.action === 'withdrawPlan') {
        const p = plans.records.find((r) => r.id === input.planId);
        if (!p || p.status !== 'Requested') forbid('Only a pending request can be withdrawn.');
        await zite.paymentPlanRequests.update({ id: p!.id, record: { status: 'Withdrawn' } as never });
        await audit(a, 'Payment plan withdrawn', `paymentPlan:${p!.id}`);
        return { ok: true };
      }
      const terms = [...byTerm.entries()].map(([term, balance]) => ({ term, balance: Math.round(balance * 100) / 100, nextDue: entries.filter((e) => e.term === term && e.type === 'Charge' && e.dueDate).map((e) => e.dueDate).sort()[0] ?? '' }));
      return {
        institution: a.institutionName,
        balance: Math.round(terms.reduce((s, t) => s + t.balance, 0) * 100) / 100,
        terms,
        entries: entries.sort((x, y) => (y.dueDate || y.at).localeCompare(x.dueDate || x.at)),
        plans: plans.records.map((p) => plan(p)).sort((x, y) => y.requestedAt.localeCompare(x.requestedAt)),
      };
    }

    const a = await requireAction(uid, 'accounts.read');
    const plans = (await zite.paymentPlanRequests.findAll({ filters: { institution: a.institutionId }, limit: 500 })).records;

    if (input.action === 'decidePlan') {
      const p = plans.find((r) => r.id === input.planId);
      if (!p || p.status !== 'Requested') forbid('This request was already decided.');
      if (first(p!.student) === uid) forbid('This is your own request, so someone else has to decide it.');
      const note = (input.note ?? '').trim();
      if (note.length < 5) forbid('Add a short note the student will see.');
      await zite.paymentPlanRequests.update({ id: p!.id, record: { status: input.approve ? 'Approved' : 'Declined', decidedBy: uid, decisionNote: note.slice(0, 1000) } as never });
      await audit(a, input.approve ? 'Payment plan approved' : 'Payment plan declined', `paymentPlan:${p!.id}`, note, a.roles.join(', '));
      return { ok: true };
    }

    // Per-student balances for the institution, summed in SQL so totals stay correct at any size.
    const { rows } = await zite.sql({
      query: `SELECT e."student"::text AS student, SUM(CASE WHEN e."entryType" = 'Charge' THEN e."amount" ELSE -e."amount" END)::float AS balance, COUNT(*)::int AS n
              FROM "AccountLedgerEntries" e JOIN "AccountLedgerEntriesInstitutions" l ON l."accountLedgerEntriesId" = e.id
              WHERE l."institutionsId" = $1 GROUP BY e."student"`,
      params: [a.institutionId],
    });
    const studentOf = (v: unknown) => String(v ?? '').replace(/[[\]"{}]/g, '').split(',')[0]?.trim() ?? '';
    const balances = rows.map((r) => ({ studentId: studentOf(r.student), balance: Math.round(Number(r.balance) * 100) / 100, entries: Number(r.n) }));
    const names = await userNames([...balances.map((b) => b.studentId), ...plans.flatMap((p) => [first(p.student) ?? '', first(p.decidedBy) ?? ''])]);
    return {
      balances: balances.map((b) => ({ ...b, student: names[b.studentId] ?? 'Student' })).sort((x, y) => y.balance - x.balance),
      plans: plans.map((p) => plan(p, names)).sort((x, y) => (x.status === 'Requested' ? -1 : 0) - (y.status === 'Requested' ? -1 : 0) || y.requestedAt.localeCompare(x.requestedAt)),
    };
  },
});
