import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, audit } from '../lib/server';
import { PROFILES, profilesForRoles, composePrompt, manifest, statusOf, SPECIALISTS, EXTRA_MODES, TOOL_MAPPINGS, ACCEPTANCE, executiveBrief, workflowStatus } from '../lib/intelligence';
import { PACK_VERSION } from '../lib/agentPack';
import { UNDERGRAD_COMPANION_PROMPT } from '../lib/companionPrompts';
import { familyOf, FAMILIES, MODEL_TOOLS, APPROVAL_FAMILIES } from '../lib/agentRuntime';

// Semester Intelligence (owner blueprint 2026-10-24). Roles come from the caller's membership on the server, never from input.
// 'me': the person's companions and modes. 'brief': the Executive Assistant daily brief, computed from the person's own tasks with
// no model call. 'registry': the full 97-profile registry with prompts, manifests and acceptance evidence, for administrators.
// Nothing here creates an agent, grants a role, stores memory or enables production.
export default createEndpoint({
  description: 'Semester Intelligence: personal modes, deterministic executive brief, and the read-only role-agent registry',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('me') }),
    z.object({ action: z.literal('brief') }),
    z.object({ action: z.literal('registry') }),
    z.object({ action: z.literal('workflows') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const specialists = SPECIALISTS.map(({ key, label, question, output, enabled, engine, why }) => ({ key, label, question, output, enabled, engine, why }));
    if (input.action === 'brief') {
      const { records } = await zite.tasks.findAll({ filters: { owner: a.userId }, limit: 500 });
      const brief = executiveBrief(records.map((t) => ({ id: t.id, title: t.title ?? 'Untitled', due: t.dueAt ?? null, done: ['Done', 'Completed'].includes(String(t.status ?? '')), source: String(t.source ?? '') })), new Date());
      await audit(a, 'Executive brief prepared', `user:${a.userId}`, 'deterministic; no model call', 'Owner', true);
      const slim = (l: { id: string; title: string; due: string | null }[]) => l.map((t) => ({ id: t.id, title: t.title, due: t.due }));
      return { ...brief, priorities: { overdue: slim(brief.priorities.overdue), dueToday: slim(brief.priorities.dueToday), thisWeek: slim(brief.priorities.thisWeek) }, engine: 'deterministic' };
    }
    if (input.action === 'workflows') {
      // Scope: only cases the caller opened or is assigned to. Notes never leave the server.
      const [mine, assigned] = await Promise.all([
        zite.cases.findAll({ filters: { student: a.userId }, limit: 200 }),
        zite.cases.findAll({ filters: { assignedTo: a.userId }, limit: 200 }),
      ]);
      const seen = new Map<string, ReturnType<typeof workflowStatus>>();
      for (const [list, isMine] of [[mine.records, true], [assigned.records, false]] as const)
        for (const c of list) if (!seen.has(c.id)) seen.set(c.id, workflowStatus({ id: c.id, title: c.title ?? 'Untitled', category: String(c.category ?? ''), status: String(c.status ?? ''), reference: c.reference ?? '', assigned: !!(c.assignedTo && c.assignedTo.length), mine: isMine }));
      const items = [...seen.values()].sort((x, y) => Number(y.open) - Number(x.open));
      await audit(a, 'Workflow status prepared', `user:${a.userId}`, `deterministic; ${items.length} cases; no model call`, 'Owner', true);
      return { items, engine: 'deterministic', uncertainty: ['Only Help cases are covered; registrar and billing processes are not yet projected here.'] };
    }
    if (input.action === 'registry') {
      const isAdmin = a.roles.includes('Administrator');
      if (!isAdmin) return { allowed: false };
      return {
        allowed: true, version: PACK_VERSION, families: FAMILIES, approvalFamilies: APPROVAL_FAMILIES, modelTools: MODEL_TOOLS, undergradPrompt: UNDERGRAD_COMPANION_PROMPT, tools: TOOL_MAPPINGS, acceptance: ACCEPTANCE, extraModes: EXTRA_MODES, specialists,
        profiles: PROFILES.map((p) => ({ ...p, family: familyOf(p.id), status: statusOf(p), manifest: manifest(p), delegatePrompt: composePrompt(p, 'delegate'), companionPrompt: composePrompt(p, 'companion') })),
      };
    }
    const mine = profilesForRoles(a.roles);
    return {
      roles: a.roles, version: PACK_VERSION, specialists, extraModes: EXTRA_MODES.map((m) => m.label),
      companions: mine.map((p) => ({ id: p.id, persona: p.persona, mission: p.mission, deliverables: p.deliverables, boundary: p.boundary, status: statusOf(p) })),
      unmappedRoles: a.roles.filter((r) => profilesForRoles([r]).length === 0),
      memory: 'Off. Nothing you ask is remembered between sessions.',
    };
  },
});
