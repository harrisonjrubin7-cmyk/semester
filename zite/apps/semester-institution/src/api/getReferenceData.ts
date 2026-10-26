import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireCap, ids } from '../server/access';

export default createEndpoint({
  description: 'Returns courses, terms and faculty for an institution, used in request forms',
  authenticated: true,
  inputSchema: z.object({ institutionId: z.string() }),
  outputSchema: z.object({
    courses: z.array(z.object({ id: z.string(), code: z.string(), title: z.string() })),
    terms: z.array(z.object({ id: z.string(), label: z.string(), state: z.string() })),
    faculty: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  }),
  execute: async ({ input, context }) => {
    await requireCap(context.user.id, input.institutionId, 'view');
    const [courses, terms, members] = await Promise.all([
      zite.courses.findAll({ filters: { institution: input.institutionId }, limit: 2000 }),
      zite.academicTerms.findAll({ filters: { institution: input.institutionId }, limit: 200 }),
      zite.memberships.findAll({ filters: { institution: input.institutionId, status: 'Active' }, limit: 2000 }),
    ]);
    const facultyIds = [...new Set(members.records
      .filter((m) => (m.roles ?? []).includes('Faculty') || (m.roleTemplates ?? []).includes('Faculty/instructor'))
      .flatMap((m) => ids(m.member)))];
    let faculty: { id: string; name: string; email: string }[] = [];
    if (facultyIds.length) {
      const { rows } = await zite.sql({
        query: `SELECT "id", "name", "email" FROM "ziteUsers" WHERE "id" = ANY($1)`,
        params: [facultyIds],
      });
      faculty = rows.map((u) => ({ id: String(u.id), name: String(u.name || u.email), email: String(u.email ?? '') }));
    }
    return {
      courses: courses.records.map((c) => ({ id: c.id, code: c.code ?? '', title: c.title ?? '' })).sort((a, b) => a.code.localeCompare(b.code)),
      terms: terms.records.map((t) => ({ id: t.id, label: t.label || t.code || 'Term', state: t.state ?? '' })),
      faculty,
    };
  },
});
