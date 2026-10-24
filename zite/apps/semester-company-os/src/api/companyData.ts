import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const first = (v: unknown): string | null =>
  Array.isArray(v) ? (v[0] ?? null) : typeof v === 'string' && v ? v : null;

const Row = z.record(z.string(), z.any());

export default createEndpoint({
  description: 'Loads Company OS accounts, deals, contracts, projects, tickets and recent audit entries',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    accounts: z.array(Row),
    deals: z.array(Row),
    contracts: z.array(Row),
    projects: z.array(Row),
    tickets: z.array(Row),
    audit: z.array(Row),
    users: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  execute: async () => {
    const [a, d, c, p, t, audit, users] = await Promise.all([
      zite.customerAccounts.findAll({ limit: 2000 }),
      zite.deals.findAll({ limit: 2000 }),
      zite.contracts.findAll({ limit: 2000 }),
      zite.implementationProjects.findAll({ limit: 2000 }),
      zite.supportTickets.findAll({ limit: 2000 }),
      zite.sql({
        query: `SELECT l."id", l."action", l."targetTable", l."targetId", l."detail", l."occurredAt", u."name" AS "actorName"
                FROM "CompanyAuditLog" l LEFT JOIN "ziteUsers" u ON u."id" = (l."actor"->>0)
                ORDER BY l."occurredAt" DESC LIMIT 200`,
      }).catch(() => ({ rows: [] as Record<string, unknown>[] })),
      zite.auth.findAllUsers({ limit: 200 }),
    ]);
    const norm = (rows: Record<string, unknown>[], links: string[]) =>
      rows.map((r) => {
        const o: Record<string, unknown> = { ...r };
        for (const k of links) o[k] = first(r[k]);
        return o;
      });
    return {
      accounts: norm(a.records, ['owner']),
      deals: norm(d.records, ['account', 'owner', 'approvedBy']),
      contracts: norm(c.records, ['account', 'deal']),
      projects: norm(p.records, ['account', 'contract', 'owner']),
      tickets: norm(t.records, ['account', 'assignee']),
      audit: audit.rows,
      users: users.records.map((u) => ({ id: u.id, name: u.name || u.email })),
    };
  },
});
