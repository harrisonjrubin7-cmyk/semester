import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { first } from '../lib/server';

export default createEndpoint({
  description: 'Returns the signed-in member’s workspaces and roles',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const { records } = await zite.memberships.findAll({ filters: { member: context.user.id }, limit: 20 });
    const out: { id: string; status: string; roles: string[]; institutionId: string; institutionName: string; tenantType: string; isSample: boolean; aiPolicy: string }[] = [];
    for (const m of records) {
      const inst = first(m.institution) ? await zite.institutions.findOne({ id: first(m.institution)! }) : undefined;
      out.push({
        id: m.id, status: m.status ?? 'Pending', roles: m.roles ?? [],
        institutionId: inst?.id ?? '', institutionName: inst?.name ?? 'Workspace',
        tenantType: inst?.tenantType ?? 'Personal', isSample: !!inst?.isSample, aiPolicy: inst?.aiPolicy ?? '',
      });
    }
    return {
      memberships: out as {
        id: string; status: string; roles: string[]; institutionId: string; institutionName: string;
        tenantType: string; isSample: boolean; aiPolicy: string;
      }[],
      firstName: context.user.firstName ?? '',
    };
  },
});
