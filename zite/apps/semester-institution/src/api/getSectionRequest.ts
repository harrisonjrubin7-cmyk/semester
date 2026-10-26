import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getMemberships, ids } from '../server/access';

export default createEndpoint({
  description: 'Returns one section request with its audit trail and what the viewer may do next',
  authenticated: true,
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({
    request: z.object({
      id: z.string(), title: z.string(), stage: z.string(), department: z.string(), capacity: z.number(),
      meetingTimes: z.string(), room: z.string(), justification: z.string(), decisionNotes: z.string(),
      resourceCheckResult: z.string(), receipt: z.string(), version: z.number(), dueDate: z.string(),
      submittedAt: z.string(), courseCode: z.string(), courseTitle: z.string(), termLabel: z.string(),
      requestedBy: z.string(), instructor: z.string(), sectionLabel: z.string(), institutionId: z.string(),
    }),
    allowed: z.array(z.string()),
    history: z.array(z.object({ id: z.string(), action: z.string(), actor: z.string(), details: z.string(), occurredAt: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const r = await zite.sectionRequests.findOne({ id: input.id });
    if (!r) throw new ZiteError({ code: 'NOT_FOUND', message: 'not found', userFacingMessage: 'Request not found.' });
    const instId = ids(r.institution)[0];
    const caps = (await getMemberships(context.user.id)).get(instId);
    if (!caps?.has('view')) throw new ZiteError({ code: 'FORBIDDEN', message: 'no access', userFacingMessage: 'You do not have access to this request.' });

    const [course, term, section] = await Promise.all([
      ids(r.course)[0] ? zite.courses.findOne({ id: ids(r.course)[0] }) : undefined,
      ids(r.academicTerm)[0] ? zite.academicTerms.findOne({ id: ids(r.academicTerm)[0] }) : undefined,
      ids(r.createdSection)[0] ? zite.sections.findOne({ id: ids(r.createdSection)[0] }) : undefined,
    ]);
    const userIds = [...new Set([...ids(r.requestedBy), ...ids(r.proposedInstructor)])];
    const hist = await zite.sql({
      query: `SELECT a."id", a."action", a."actor", a."details", a."occurredAt" FROM "AuditEvents" a WHERE a."recordRef" = $1 ORDER BY a."occurredAt" ASC`,
      params: [`SectionRequest:${r.id}`],
    });
    const actorIds = hist.rows.flatMap((h) => (Array.isArray(h.actor) ? h.actor : h.actor ? [h.actor] : []).map(String));
    const allUsers = [...new Set([...userIds, ...actorIds])];
    const names = new Map<string, string>();
    if (allUsers.length) {
      const { rows } = await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [allUsers] });
      rows.forEach((u) => names.set(String(u.id), String(u.name || u.email)));
    }

    const stage = r.stage ?? '';
    const allowed: string[] = [];
    const isRequester = ids(r.requestedBy).includes(context.user.id);
    if (stage === 'Chair Review' && caps.has('chair')) allowed.push('approve', 'reject');
    if (stage === 'Scheduling Check' && caps.has('schedule')) allowed.push('approve', 'reject');
    if (stage === 'Registrar Authorization' && caps.has('registrar')) allowed.push('approve', 'reject');
    if (stage === 'Faculty Assignment' && (caps.has('chair') || caps.has('registrar'))) allowed.push('assign');
    if (stage === 'Reconciliation' && caps.has('registrar')) allowed.push('reconcile');
    if (isRequester && ['Chair Review', 'Scheduling Check', 'Registrar Authorization'].includes(stage)) allowed.push('withdraw');

    return {
      request: {
        id: r.id, title: r.requestTitle ?? '', stage, department: r.department ?? '', capacity: r.requestedCapacity ?? 0,
        meetingTimes: r.meetingTimes ?? '', room: r.room ?? '', justification: r.justification ?? '',
        decisionNotes: r.decisionNotes ?? '', resourceCheckResult: r.resourceCheckResult ?? '', receipt: r.receipt ?? '',
        version: r.recordVersion ?? 1, dueDate: r.dueDate ?? '', submittedAt: r.submittedAt ?? '',
        courseCode: course?.code ?? '', courseTitle: course?.title ?? '', termLabel: term?.label || term?.code || '',
        requestedBy: names.get(ids(r.requestedBy)[0]) ?? '', instructor: names.get(ids(r.proposedInstructor)[0]) ?? '',
        sectionLabel: section?.label ?? '', institutionId: instId,
      },
      allowed,
      history: hist.rows.map((h) => {
        const a = Array.isArray(h.actor) ? h.actor[0] : h.actor;
        return { id: String(h.id), action: String(h.action ?? ''), actor: names.get(String(a)) ?? 'System', details: String(h.details ?? ''), occurredAt: String(h.occurredAt ?? '') };
      }),
    };
  },
});
