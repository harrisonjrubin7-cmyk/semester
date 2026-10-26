import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireCap } from '../server/access';

const num = (v: unknown) => Number(v ?? 0);

export default createEndpoint({
  description: 'Returns institution-wide metrics, workflow load and recent audit activity',
  authenticated: true,
  inputSchema: z.object({ institutionId: z.string() }),
  outputSchema: z.object({
    metrics: z.object({
      courses: z.number(), sections: z.number(), openSections: z.number(), enrollments: z.number(),
      activeHolds: z.number(), integrationErrors: z.number(), integrations: z.number(), members: z.number(),
    }),
    stages: z.array(z.object({ stage: z.string(), count: z.number() })),
    recentAudit: z.array(z.object({ id: z.string(), action: z.string(), recordRef: z.string(), authority: z.string(), occurredAt: z.string() })),
  }),
  execute: async ({ input, context }) => {
    await requireCap(context.user.id, input.institutionId, 'view');
    const p = [input.institutionId];
    const { rows } = await zite.sql({
      query: `SELECT
        (SELECT COUNT(*) FROM "CoursesInstitutions" ci WHERE ci."institutionsId" = $1) AS courses,
        (SELECT COUNT(DISTINCT cs."sectionsId") FROM "CoursesSections" cs JOIN "CoursesInstitutions" ci ON ci."coursesId" = cs."coursesId" WHERE ci."institutionsId" = $1) AS sections,
        (SELECT COUNT(DISTINCT s."id") FROM "Sections" s JOIN "CoursesSections" cs ON cs."sectionsId" = s."id" JOIN "CoursesInstitutions" ci ON ci."coursesId" = cs."coursesId" WHERE ci."institutionsId" = $1 AND s."sectionState" = 'Open') AS "openSections",
        (SELECT COUNT(DISTINCT es."enrollmentsId") FROM "EnrollmentsSections" es JOIN "CoursesSections" cs ON cs."sectionsId" = es."sectionsId" JOIN "CoursesInstitutions" ci ON ci."coursesId" = cs."coursesId" WHERE ci."institutionsId" = $1) AS enrollments,
        (SELECT COUNT(*) FROM "StudentHolds" h JOIN "InstitutionsStudentHolds" ih ON ih."studentHoldsId" = h."id" WHERE ih."institutionsId" = $1 AND h."status" = 'Active') AS "activeHolds",
        (SELECT COUNT(*) FROM "Integrations" i JOIN "InstitutionsIntegrations" ii ON ii."integrationsId" = i."id" WHERE ii."institutionsId" = $1 AND i."syncStatus" IN ('Sync Error','Retrying')) AS "integrationErrors",
        (SELECT COUNT(*) FROM "InstitutionsIntegrations" ii WHERE ii."institutionsId" = $1) AS integrations,
        (SELECT COUNT(*) FROM "InstitutionsMemberships" im WHERE im."institutionsId" = $1) AS members`,
      params: p,
    });
    const r = rows[0] ?? {};
    const { records: reqs } = await zite.sectionRequests.findAll({ filters: { institution: input.institutionId }, limit: 2000 });
    const counts = new Map<string, number>();
    reqs.forEach((q) => counts.set(q.stage ?? 'Unknown', (counts.get(q.stage ?? 'Unknown') ?? 0) + 1));
    const audit = await zite.sql({
      query: `SELECT a."id", a."action", a."recordRef", a."authority", a."occurredAt" FROM "AuditEvents" a
        JOIN "AuditEventsInstitutions" ai ON ai."auditEventsId" = a."id" WHERE ai."institutionsId" = $1
        ORDER BY a."occurredAt" DESC LIMIT 8`,
      params: p,
    });
    return {
      metrics: {
        courses: num(r.courses), sections: num(r.sections), openSections: num(r.openSections), enrollments: num(r.enrollments),
        activeHolds: num(r.activeHolds), integrationErrors: num(r.integrationErrors), integrations: num(r.integrations), members: num(r.members),
      },
      stages: [...counts.entries()].map(([stage, count]) => ({ stage, count })),
      recentAudit: audit.rows.map((a) => ({
        id: String(a.id), action: String(a.action ?? ''), recordRef: String(a.recordRef ?? ''),
        authority: String(a.authority ?? ''), occurredAt: String(a.occurredAt ?? ''),
      })),
    };
  },
});
