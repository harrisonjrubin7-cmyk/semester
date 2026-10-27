import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAccess, forbid } from '../lib/server';
import { pg } from '../lib/pg';
import { TLK_MIGRATION } from '../lib/tlkMigration';

// Toolkit documents (case analysis, research studio, data studio, assignment workspace, rubric self-check). Private to the owner.
type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of TLK_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const KIND = z.enum(['case', 'research', 'data', 'assignment', 'rubric']);

export default createEndpoint({
  description: 'Toolkit documents: case analysis, research studio, data studio, assignment workspace and rubric self-check (private to you)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list'), kind: KIND.nullable().default(null) }),
    z.object({ action: z.literal('save'), id: z.number().int().nullable().default(null), kind: KIND, title: z.string().min(1).max(120), data: z.record(z.any()), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('delete'), id: z.number().int(), kind: KIND }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const T = (await requireAccess(me)).institutionId; // tenant from the server-resolved membership, never from the client
    let result: { id: number; version: number } | null = null;
    if (input.action === 'save') {
      const r = String(((await sql.query(`SELECT tlk_save($1,$2,$3,$4,$5,$6::jsonb,$7) AS r`, [me, T, input.id, input.kind, input.title, JSON.stringify(input.data), input.expectedVersion])) as Row[])[0].r ?? '');
      if (!r.startsWith('ok:')) forbid(r);
      const [, id, v] = r.split(':');
      result = { id: Number(id), version: Number(v) };
    }
    if (input.action === 'delete') {
      const r = ((await sql.query(`SELECT tlk_delete($1,$2,$3) AS r`, [me, T, input.id])) as Row[])[0].r;
      if (r) forbid(String(r));
    }
    const docs = (await sql.query(`SELECT id, kind, title, data, version, updated_at FROM tlk_docs WHERE tenant_id = $1 AND owner_id = $2 AND ($3::text IS NULL OR kind = $3) ORDER BY updated_at DESC LIMIT 200`, [T, me, input.kind])) as Row[];
    return { result, docs: docs.map((d) => ({ id: Number(d.id), kind: String(d.kind), title: String(d.title), data: d.data, version: Number(d.version), updatedAt: new Date(String(d.updated_at)).toISOString() })) };
  },
});
