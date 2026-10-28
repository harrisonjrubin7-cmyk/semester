import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityReader, requireSecurityLead } from '../lib/access';
import { pg } from '../../../semester/src/lib/pg';
import { ensureRel, logRel } from '../../../semester/src/lib/relServer';
import { assuranceRelease, assuranceProblems } from '../../../semester/src/lib/releaseRules';

const no = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
type Row = Record<string, unknown>;

export default createEndpoint({
  description: 'Security lead releases sanitised capability coverage to Company OS and institutions, or withdraws it',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['list', 'release', 'withdraw']), capabilityId: z.string().optional() }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (input.action === 'list') await requireSecurityReader(me); else await requireSecurityLead(me);
    await ensureRel();
    if (input.action !== 'list') {
      const cap = input.capabilityId ? await zite.capabilityRegister.findOne({ id: input.capabilityId }) : null;
      if (!cap) no('Capability not found.');
      if (input.action === 'release') {
        const ev = (await zite.capabilityEvidence.findAll({ filters: { capability: cap!.id }, limit: 500 })).records;
        if (!ev.length) no('There is no evidence to release for this capability.');
        const probs = assuranceProblems(ev);
        if (probs.length) no(probs[0]);
        const snap = assuranceRelease({ id: cap!.id, capability: cap!.capability ?? '', domain: cap!.domain ?? '' }, ev);
        await pg().query(`INSERT INTO rel_assurance (capability_id, snapshot, released_by) VALUES ($1,$2,$3) ON CONFLICT (capability_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, released_by = EXCLUDED.released_by, released_at = now(), withdrawn_at = NULL`, [cap!.id, JSON.stringify(snap), me]);
        await logRel('assurance', cap!.id, me, 'released');
      } else {
        const r = (await pg().query(`UPDATE rel_assurance SET withdrawn_at = now() WHERE capability_id = $1 AND withdrawn_at IS NULL RETURNING capability_id`, [cap!.id])) as Row[];
        if (!r.length) no('This capability is not released.');
        await logRel('assurance', cap!.id, me, 'withdrawn');
      }
    }
    const [caps, rel] = await Promise.all([zite.capabilityRegister.findAll({ limit: 2000 }), pg().query(`SELECT capability_id, released_at, withdrawn_at FROM rel_assurance`) as unknown as Promise<Row[]>]);
    return { capabilities: caps.records.map((c) => { const r = rel.find((x) => x.capability_id === c.id); return { id: c.id, capability: c.capability ?? '', domain: c.domain ?? '', released: !!r && !r.withdrawn_at, releasedAt: r && !r.withdrawn_at ? new Date(String(r.released_at)).toISOString() : null }; }) };
  },
});
