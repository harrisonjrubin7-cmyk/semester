import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityLead, requireSecurityReader } from '../lib/access';
import { recordEvidence } from '../lib/recordEvidence';
import { PROPOSALS } from '../lib/evidenceProposals';

// Proposed evidence (lib/evidenceProposals.ts) waits here until a security lead accepts it. Accepting records it under the
// lead's own name through the same rules as manual entry. A proposal already matched by recorded evidence is not shown again.
export default createEndpoint({
  description: 'Lists proposed capability evidence and lets a security lead accept it as their own signed evidence',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('accept'), keys: z.array(z.string()).min(1).max(100), confirm: z.literal('I checked each reference') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await requireSecurityReader(context.user.id);
    const recorded = async () => {
      const { records } = await zite.capabilityEvidence.findAll({ limit: 5000 });
      return new Set((records as { capability?: string | string[]; stage?: string; evidenceReference?: string }[]).flatMap((r) =>
        (Array.isArray(r.capability) ? r.capability : [r.capability]).map((c) => `${c}:${r.stage}:${r.evidenceReference}`)));
    };
    const outcomes: { key: string; ok: boolean; message?: string }[] = [];
    if (input.action === 'accept') {
      await requireSecurityLead(context.user.id);
      const done = await recorded();
      for (const key of input.keys) {
        const p = PROPOSALS.find((x) => x.key === key);
        if (!p) { outcomes.push({ key, ok: false, message: 'No such proposal.' }); continue; }
        if (done.has(`${p.capabilityId}:${p.stage}:${p.reference}`)) { outcomes.push({ key, ok: false, message: 'Already recorded.' }); continue; }
        try { await recordEvidence(context.user.id, p); outcomes.push({ key, ok: true }); }
        catch (e) { outcomes.push({ key, ok: false, message: e instanceof ZiteError ? (e.userFacingMessage ?? e.message) : 'Could not record it.' }); }
      }
    }
    const done = await recorded();
    return {
      outcomes,
      pending: PROPOSALS.filter((p) => !done.has(`${p.capabilityId}:${p.stage}:${p.reference}`))
        .map((p) => ({ key: p.key, capability: p.capability, stage: p.stage, environment: p.environment, reference: p.reference, scope: p.scope })),
    };
  },
});
