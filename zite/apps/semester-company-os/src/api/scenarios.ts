import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { parseInputs, parseStack, nameBlocker, KINDS } from '../lib/scenario';

const bad = (m: string) => { throw new ZiteError({ code: 'BAD_REQUEST', message: m, userFacingMessage: m }); };

export default createEndpoint({
  description: 'Simulator: list, save and delete planning scenarios (synthetic planning data only; no credentials, no customer records)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), id: z.string().optional(), name: z.string(), kind: z.enum(KINDS), inputs: z.unknown(), stack: z.unknown().optional() }),
    z.object({ action: z.literal('delete'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    if (input.action === 'list') {
      const { records } = await zite.simulatorScenarios.findAll({ limit: 200 });
      return {
        items: records.map((r) => {
          const p = parseInputs(r.inputs ?? '');
          return { id: r.id, name: r.name ?? '', kind: r.kind ?? 'Lean pilot', inputs: p.ok ? p.inputs : null, error: p.ok ? null : p.error, stack: parseStack(r.stack ?? ''), updatedAt: r.updatedAt ?? null };
        }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
      };
    }
    if (input.action === 'delete') {
      const r = await zite.simulatorScenarios.findOne({ id: input.id });
      if (!r) bad('That scenario no longer exists.');
      await zite.simulatorScenarios.delete({ id: input.id });
      return { ok: true };
    }
    const nb = nameBlocker(input.name ?? '');
    if (nb) bad(nb);
    if (!(KINDS as readonly string[]).includes(input.kind)) bad('Choose a scenario type.');
    const p = parseInputs(input.inputs);
    if (!p.ok) bad(p.error);
    const record = { name: input.name.trim(), kind: input.kind, inputs: JSON.stringify(p.ok ? p.inputs : {}), stack: JSON.stringify(parseStack(input.stack)), savedBy: context.user?.id ?? null } as never;
    if (input.id) {
      const r = await zite.simulatorScenarios.findOne({ id: input.id });
      if (!r) bad('That scenario no longer exists.');
      await zite.simulatorScenarios.update({ id: input.id, record });
      return { ok: true, id: input.id };
    }
    const c = await zite.simulatorScenarios.create({ record });
    return { ok: true, id: c.id };
  },
});
