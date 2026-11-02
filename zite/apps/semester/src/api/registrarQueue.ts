import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, first, userNames } from '../lib/server';

const item = z.object({
  id: z.string(), requestKey: z.string(), student: z.string(), self: z.boolean(),
  section: z.string(), action: z.string(), state: z.string(), resultCode: z.string(),
  explanation: z.string(), submittedAt: z.string(),
  sectionVersion: z.number(), capacity: z.number().nullable(), enrolled: z.number(),
});

export default createEndpoint({
  description: 'Lists registration requests for the registrar in the caller’s institution',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({ pending: z.array(item), decided: z.array(item) }),
  execute: async ({ context }) => {
    const a = await requireAction(context.user.id, 'registrar.read');
    const { rows } = await zite.sql({
      query: `SELECT r.id FROM "RegistrationRequests" r
              JOIN "RegistrationRequestsInstitutions" l ON l."registrationRequestsId" = r.id
              WHERE l."institutionsId" = $1 ORDER BY r."submittedAt" DESC LIMIT 200`,
      params: [a.institutionId],
    }).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const idSet = new Set(rows.map((r) => String(r.id)));
    const { records } = await zite.registrationRequests.findAll({ limit: 2000 });
    const reqs = records.filter((r) => idSet.size ? idSet.has(r.id) : first(r.institution) === a.institutionId);

    const sectionIds = [...new Set(reqs.map((r) => first(r.section)).filter(Boolean))] as string[];
    const sections = await Promise.all(sectionIds.map((id) => zite.sections.findOne({ id })));
    const counts = sectionIds.length ? (await zite.sql({
      query: `SELECT l."sectionsId" AS s, COUNT(*)::int AS n FROM "Enrollments" e JOIN "EnrollmentsSections" l ON l."enrollmentsId" = e.id
              WHERE l."sectionsId" = ANY($1) AND e."status" = 'Enrolled' GROUP BY l."sectionsId"`,
      params: [sectionIds],
    })).rows : [];
    const secMap = new Map(sections.filter(Boolean).map((s) => [s!.id, s!]));
    const cnt = new Map(counts.map((c) => [String(c.s), Number(c.n)]));
    const names = await userNames(reqs.map((r) => first(r.student) ?? ''));

    const out = reqs.map((r) => {
      const sid = first(r.section) ?? '';
      const sec = secMap.get(sid) as { label?: string; recordVersion?: number; capacity?: number } | undefined;
      const stu = first(r.student) ?? '';
      return {
        id: r.id, requestKey: r.requestKey ?? '', student: names[stu] ?? 'Student', self: stu === a.userId,
        section: sec?.label ?? 'Section', action: r.action ?? 'Add', state: r.state ?? 'Submitted',
        resultCode: r.resultCode ?? '', explanation: r.safeExplanation ?? '', submittedAt: r.submittedAt ?? '',
        sectionVersion: sec?.recordVersion ?? 1, capacity: sec?.capacity ?? null, enrolled: cnt.get(sid) ?? 0,
      };
    });
    const done = (s: string) => s === 'Committed' || s === 'Rejected';
    return { pending: out.filter((r) => !done(r.state)), decided: out.filter((r) => done(r.state)).slice(0, 30) };
  },
});
