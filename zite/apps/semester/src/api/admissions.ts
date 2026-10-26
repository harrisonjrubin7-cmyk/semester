import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, first, forbid, audit, userNames } from '../lib/server';

export default createEndpoint({
  description: 'Admissions queue: staff review applications to their institution and record decisions',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('decide'), id: z.string(), status: z.enum(['Under Review', 'Admitted', 'Waitlisted', 'Declined']), note: z.string().max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'admission.decide');
    if (input.action === 'decide') {
      const r = await zite.applications.findOne({ id: input.id });
      if (!r || first(r.institution) !== a.institutionId) forbid('That application isn’t for your institution.');
      if (first(r!.applicant) === a.userId) forbid('You can’t decide your own application.');
      if (['Draft', 'Withdrawn'].includes(r!.status ?? '')) forbid('Only submitted applications can be decided.');
      await audit(a, `Admissions decision: ${input.status}`, r!.id, input.note, 'Staff');
      await zite.applications.update({ id: r!.id, record: { status: input.status, decisionNote: input.note, decidedBy: a.userId } as never });
      if (input.status === 'Admitted') {
        const applicant = first(r!.applicant)!;
        const { records: mine } = await zite.memberships.findAll({ filters: { member: applicant }, limit: 50 });
        const here = mine.find((m) => first(m.institution) === a.institutionId);
        if (here) {
          const roles = Array.from(new Set([...((here.roles as string[] | undefined) ?? []), 'Student']));
          await zite.memberships.update({ id: here.id, record: { roles, status: 'Active' } as never });
        } else {
          await zite.memberships.create({ record: { label: `Admitted · ${r!.program ?? 'Student'}`, member: applicant, institution: a.institutionId, roles: ['Student'], status: 'Active' } as never });
        }
        await audit(a, 'Student membership created from admission', r!.id, r!.program ?? '', 'Staff');
      }
      return { ok: true, membershipCreated: input.status === 'Admitted' };
    }
    const { records } = await zite.applications.findAll({ filters: { institution: a.institutionId }, limit: 500 });
    const live = records.filter((r) => !['Draft'].includes(r.status ?? ''));
    const names = await userNames(live.map((r) => first(r.applicant) ?? ''));
    return {
      items: live.map((r) => ({ id: r.id, applicant: names[first(r.applicant) ?? ''] ?? 'Applicant', program: r.program ?? '', entryTerm: r.entryTerm ?? '', status: r.status ?? '', statement: r.statement ?? '', documents: ((r.documents as { url: string; filename: string }[] | undefined) ?? []).map((d) => ({ url: d.url, filename: d.filename })), submittedAt: r.submittedAt ?? null, note: r.decisionNote ?? '' }))
        .sort((x, y) => (y.submittedAt ?? '').localeCompare(x.submittedAt ?? '')),
    };
  },
});
