import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityLead } from '../lib/access';

export default createEndpoint({
  authenticated: true,
  description: 'Changes the remediation status of an audit finding',
  inputSchema: z.object({ id: z.string(), remediation: z.enum(['open', 'accepted exception', 'fixed']) }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireSecurityLead(context.user.id);
    await zite.auditFindings.update({ id: input.id, record: { remediation: input.remediation } });
    return { ok: true };
  },
});
