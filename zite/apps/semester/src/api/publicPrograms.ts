import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAction, forbid, audit } from '../lib/server';
import { pg } from '../lib/pg';
import { SPG_MIGRATION } from '../lib/spgMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of SPG_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

export default createEndpoint({
  description: 'Public programs: catalog managers write program listings and explicitly publish or withdraw them on the public site',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), id: z.number().int().nullable(), name: z.string().max(120), summary: z.string().max(1000), entryTerms: z.string().max(200), accepting: z.boolean(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('publish'), id: z.number().int(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('withdraw'), id: z.number().int(), expectedVersion: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'catalog.manage');
    await ensure();
    const T = a.institutionId;
    const call = async (q: string, p: unknown[]) => { const r = String(((await pg().query(q, p)) as Row[])[0].r); if (!r.startsWith('ok')) forbid(r); return r; };
    if (input.action === 'save') {
      const r = await call(`SELECT spg_save($1,$2,true,$3,$4,$5,$6,$7,$8) AS r`, [a.userId, T, input.id, input.name, input.summary, input.entryTerms, input.accepting, input.expectedVersion]);
      await audit(a, 'Public program saved', `program:${r.split(':')[1]}`, input.name, a.roles.join(', '));
      return { ok: true, id: Number(r.split(':')[1]) };
    }
    if (input.action === 'publish' || input.action === 'withdraw') {
      await call(`SELECT spg_set($1,$2,true,$3,$4,$5) AS r`, [a.userId, T, input.id, input.action === 'publish' ? 'Published' : 'Withdrawn', input.expectedVersion]);
      await audit(a, `Public program ${input.action === 'publish' ? 'published' : 'withdrawn'}`, `program:${input.id}`, '', a.roles.join(', '));
      return { ok: true };
    }
    const rows = (await pg().query(`SELECT id, name, summary, entry_terms, accepting, state, version, published_at FROM spg_programs WHERE tenant_id = $1 ORDER BY name`, [T])) as Row[];
    return { programs: rows.map((r) => ({ id: Number(r.id), name: String(r.name), summary: String(r.summary), entryTerms: String(r.entry_terms), accepting: !!r.accepting, state: String(r.state), version: Number(r.version), publishedAt: r.published_at ? new Date(String(r.published_at)).toISOString() : null })) };
  },
});
