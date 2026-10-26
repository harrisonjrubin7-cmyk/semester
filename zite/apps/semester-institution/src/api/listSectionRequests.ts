import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireCap, ids } from '../server/access';

const requestSchema = z.object({
  id: z.string(),
  title: z.string(),
  courseCode: z.string(),
  termLabel: z.string(),
  department: z.string(),
  stage: z.string(),
  capacity: z.number(),
  meetingTimes: z.string(),
  room: z.string(),
  dueDate: z.string(),
  submittedAt: z.string(),
  version: z.number(),
  requestedById: z.string(),
});

export default createEndpoint({
  description: 'Lists new-section requests for an institution',
  authenticated: true,
  inputSchema: z.object({ institutionId: z.string() }),
  outputSchema: z.object({ requests: z.array(requestSchema) }),
  execute: async ({ input, context }) => {
    await requireCap(context.user.id, input.institutionId, 'view');
    const { records } = await zite.sectionRequests.findAll({ filters: { institution: input.institutionId }, limit: 2000 });
    const courseIds = [...new Set(records.flatMap((r) => ids(r.course)))];
    const termIds = [...new Set(records.flatMap((r) => ids(r.academicTerm)))];
    const [courses, terms] = await Promise.all([
      courseIds.length ? zite.courses.findAll({ filters: { id: { in: courseIds } }, limit: 2000 }) : { records: [] },
      termIds.length ? zite.academicTerms.findAll({ filters: { id: { in: termIds } }, limit: 200 }) : { records: [] },
    ]);
    const cMap = new Map<string, string>(courses.records.map((c: { id: string; code?: string }) => [c.id, c.code ?? ''] as [string, string]));
    const tMap = new Map<string, string>(terms.records.map((t: { id: string; label?: string; code?: string }) => [t.id, t.label || t.code || ''] as [string, string]));
    const requests = records.map((r) => ({
      id: r.id,
      title: r.requestTitle ?? '',
      courseCode: cMap.get(ids(r.course)[0]) ?? '',
      termLabel: tMap.get(ids(r.academicTerm)[0]) ?? '',
      department: r.department ?? '',
      stage: r.stage ?? '',
      capacity: r.requestedCapacity ?? 0,
      meetingTimes: r.meetingTimes ?? '',
      room: r.room ?? '',
      dueDate: r.dueDate ?? '',
      submittedAt: r.submittedAt ?? '',
      version: r.recordVersion ?? 1,
      requestedById: ids(r.requestedBy)[0] ?? '',
    }));
    requests.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { requests };
  },
});
