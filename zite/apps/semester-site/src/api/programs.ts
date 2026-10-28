import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/pg';

// Public read: only program listings an institution explicitly published, and only their public fields. Nothing about
// applicants or applications is read here. The Applicants address is the one company staff set in the app directory.
export default createEndpoint({
  description: 'Lists published program listings and the address where applications start',
  inputSchema: z.object({}),
  outputSchema: z.object({
    applyUrl: z.string().nullable(),
    programs: z.array(z.object({ id: z.number(), institutionId: z.string(), institution: z.string(), name: z.string(), summary: z.string(), entryTerms: z.string(), accepting: z.boolean() })),
  }),
  execute: async () => {
    const sql = pg();
    const has = ((await sql.query(`SELECT to_regclass('spg_programs') IS NOT NULL AS a, to_regclass('os_app_urls') IS NOT NULL AS b`)) as { a: boolean; b: boolean }[])[0];
    const rows = has.a ? (await sql.query(`SELECT id, tenant_id, name, summary, entry_terms, accepting FROM spg_programs WHERE state = 'Published' ORDER BY name LIMIT 500`)) as Record<string, unknown>[] : [];
    const url = has.b ? ((await sql.query(`SELECT url FROM os_app_urls WHERE app_key = 'applicants'`)) as { url: string }[])[0]?.url ?? null : null;
    const insts = rows.length ? (await zite.institutions.findAll({ limit: 500, fields: ['name'] })).records : [];
    const name = (id: string) => insts.find((i) => i.id === id)?.name ?? 'Institution';
    return {
      applyUrl: url && /^https:\/\//.test(url) ? url : null,
      programs: rows.map((r) => ({ id: Number(r.id), institutionId: String(r.tenant_id), institution: name(String(r.tenant_id)), name: String(r.name), summary: String(r.summary), entryTerms: String(r.entry_terms), accepting: !!r.accepting })),
    };
  },
});
