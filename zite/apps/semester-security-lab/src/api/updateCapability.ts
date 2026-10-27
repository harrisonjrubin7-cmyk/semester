import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityLead } from '../lib/access';

const STATUSES = ['Designed', 'Implemented-unverified', 'Tested', 'Institution-approved', 'Production-enabled'] as const;

export default createEndpoint({
  description: 'Updates a capability status, blockers and evidence',
  authenticated: true,
  inputSchema: z.object({ id: z.string(), status: z.enum(STATUSES), blockers: z.string(), evidence: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireSecurityLead(context.user.id);
    // Anything beyond "Implemented-unverified" must cite evidence; a page existing is not proof.
    if (STATUSES.indexOf(input.status) >= 2 && input.evidence.trim().length < 10)
      throw new ZiteError('Tested, approved or production status needs evidence (a run ID, test report or approval record).');
    await zite.capabilityRegister.update({ id: input.id, record: { status: input.status, blockers: input.blockers, evidence: input.evidence } });
    return { ok: true };
  },
});
