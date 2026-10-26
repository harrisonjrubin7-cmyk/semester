import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const ids = (v: string | string[] | undefined | null): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);
const first = (v: string | string[] | undefined | null) => ids(v)[0];
const no = (m: string): never => { throw new ZiteError(m); };
const CHECK = ['Personal statement', 'Transcript uploaded', 'Program chosen'];

export default createEndpoint({
  description: 'Applicant portal: start, edit, submit and withdraw your own applications',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), id: z.string().optional(), institutionId: z.string(), program: z.string().max(120), entryTerm: z.string().max(40), statement: z.string().max(8000), documents: z.array(z.object({ url: z.string(), filename: z.string() })) }),
    z.object({ action: z.literal('submit'), id: z.string() }),
    z.object({ action: z.literal('withdraw'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    const own = async (id: string) => { const r = await zite.applications.findOne({ id }); if (!r || first(r.applicant) !== uid) no('That application isn’t yours.'); return r!; };
    const log = (action: string, inst: string | undefined, ref: string) => zite.auditEvents.create({ record: { action, actor: uid, institution: inst ? [inst] : undefined, recordRef: ref, authority: 'Applicant' } as never });

    if (input.action === 'save') {
      const inst = await zite.institutions.findOne({ id: input.institutionId });
      if (!inst || inst.tenantType === 'Personal') no('Pick an institution that accepts applications.');
      if (input.id) { const r = await own(input.id); if (r.status !== 'Draft') no('Submitted applications can’t be edited. Withdraw and start again, or contact admissions.'); }
      const record = { label: `${inst!.name} · ${input.program || 'Undecided'}`, applicant: uid, institution: [inst!.id], program: input.program, entryTerm: input.entryTerm, statement: input.statement, documents: input.documents, status: 'Draft' };
      const saved = input.id ? await zite.applications.update({ id: input.id, record: record as never }) : await zite.applications.create({ record: record as never });
      return { ok: true, id: saved.id };
    }
    if (input.action === 'submit') {
      const r = await own(input.id);
      if (r.status !== 'Draft') no('This was already submitted.');
      const missing = [!r.statement || r.statement.length < 200 ? 'a statement of at least 200 characters' : '', !(r.documents as unknown[] | undefined)?.length ? 'a transcript' : '', !r.program ? 'a program' : ''].filter(Boolean);
      if (missing.length) no(`Add ${missing.join(', ')} before submitting.`);
      await zite.applications.update({ id: r.id, record: { status: 'Submitted', submittedAt: new Date().toISOString() } as never });
      await log('Application submitted', first(r.institution), r.id);
      return { ok: true };
    }
    if (input.action === 'withdraw') {
      const r = await own(input.id);
      if (['Admitted', 'Declined', 'Withdrawn'].includes(r.status ?? '')) no('This application is already closed.');
      await zite.applications.update({ id: r.id, record: { status: 'Withdrawn' } as never });
      await log('Application withdrawn', first(r.institution), r.id);
      return { ok: true };
    }
    const [{ records: apps }, { records: insts }] = await Promise.all([
      zite.applications.findAll({ filters: { applicant: uid }, limit: 100 }),
      zite.institutions.findAll({ limit: 200 }),
    ]);
    const open = insts.filter((i) => i.tenantType !== 'Personal');
    return {
      institutions: open.map((i) => ({ id: i.id, name: i.name ?? '', sample: !!i.isSample })),
      applications: apps.map((a) => {
        const docs = (a.documents as { url: string; filename: string }[] | undefined) ?? [];
        return {
          id: a.id, institutionId: first(a.institution) ?? '', institution: open.find((i) => i.id === first(a.institution))?.name ?? 'Institution',
          program: a.program ?? '', entryTerm: a.entryTerm ?? '', statement: a.statement ?? '', status: a.status ?? 'Draft',
          documents: docs.map((d) => ({ url: d.url, filename: d.filename })), submittedAt: a.submittedAt ?? null, decisionNote: a.decisionNote ?? '',
          checklist: [(a.statement ?? '').length >= 200, docs.length > 0, !!a.program].map((done, i) => ({ label: CHECK[i], done })),
        };
      }),
    };
  },
});
