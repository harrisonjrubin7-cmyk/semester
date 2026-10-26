import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireCap, audit, ids } from '../server/access';

export default createEndpoint({
  description: 'Submits a department request for a new course section',
  authenticated: true,
  inputSchema: z.object({
    institutionId: z.string(),
    courseId: z.string(),
    termId: z.string(),
    department: z.string().min(1),
    capacity: z.number().int().positive(),
    meetingTimes: z.string().min(1),
    room: z.string().min(1),
    justification: z.string().min(10),
    dueDate: z.string().optional(),
    requestKey: z.string().min(8),
  }),
  outputSchema: z.object({ id: z.string(), duplicateOf: z.string().optional() }),
  execute: async ({ input, context }) => {
    await requireCap(context.user.id, input.institutionId, 'request');

    // Idempotency: same client key returns the original request.
    const existing = await zite.sectionRequests.findOne({ filters: { requestKey: input.requestKey } });
    if (existing) return { id: existing.id };

    const course = await zite.courses.findOne({ id: input.courseId });
    const term = await zite.academicTerms.findOne({ id: input.termId });
    if (!course || !ids(course.institution).includes(input.institutionId) || !term || !ids(term.institution).includes(input.institutionId)) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: 'Course/term not in institution', userFacingMessage: 'That course or term does not belong to this institution.' });
    }

    // Duplicate business request: same course, term and meeting time still in flight.
    const { records: open } = await zite.sectionRequests.findAll({ filters: { course: input.courseId, academicTerm: input.termId }, limit: 500 });
    const dup = open.find((r) => !['Rejected', 'Withdrawn'].includes(r.stage ?? '') && (r.meetingTimes ?? '').trim().toLowerCase() === input.meetingTimes.trim().toLowerCase());
    if (dup) {
      throw new ZiteError({ code: 'CONFLICT', message: `Duplicate of ${dup.id}`, userFacingMessage: `A request for ${course.code} at that time already exists ("${dup.requestTitle}").` });
    }

    const rec = await zite.sectionRequests.create({
      record: {
        requestTitle: `${course.code} new section — ${term.label || term.code}`,
        institution: input.institutionId,
        course: input.courseId,
        academicTerm: input.termId,
        department: input.department,
        requestedBy: context.user.id,
        requestedCapacity: input.capacity,
        meetingTimes: input.meetingTimes,
        room: input.room,
        justification: input.justification,
        stage: 'Chair Review',
        requestKey: input.requestKey,
        recordVersion: 1,
        dueDate: input.dueDate ?? null,
      },
    });
    await audit({ userId: context.user.id, institutionId: input.institutionId, action: 'Section request submitted', recordRef: `SectionRequest:${rec.id}`, authority: 'request', details: input.justification });
    return { id: rec.id };
  },
});
