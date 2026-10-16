import type { ModuleAgentContract } from '../../types.ts';
import type { EcosystemRegistry } from '../registry/coverage.ts';
import { COMMON_CONTRACT } from './contract.ts';

/**
 * Module agents, generated from the canonical ecosystem registry rather
 * than from a guess. One contract per confirmed pilot release scope in
 * platform-control's workspace roster: that roster is the confirmed list of
 * Semester operating systems and portals, each with an audience, a data
 * classification, a required operational loop and its gaps. A module agent
 * coordinates its module's completeness; it holds no specialist permission.
 */
export const MODULE_PROMPT = (name: string) => `You own implementation coherence for ${name}.

Maintain every confirmed screen, function, workflow, permission, and data contract assigned to this module.

Coordinate changes through the Semester task system.

Use platform identity, authorization, design, data, notification, file, and audit contracts rather than recreating incompatible alternatives.

Implement assigned changes in an isolated workspace. Verify module behavior and affected cross-module journeys. Do not change shared contracts unilaterally.

Report coverage gaps, dependencies, evidence, and unresolved requirements.`;

export function moduleAgents(registry: EcosystemRegistry): ModuleAgentContract[] {
  const roleKeys = registry.roles.map((role) => role.key);
  return registry.workspaces.map((workspace, index) => {
    // Capabilities name a workspace family ("student"); the roster names a scope ("student-os"). Both spellings are the registry's.
    const capabilities = registry.capabilities.filter((capability) => workspace.refs.capabilities.includes(capability.key) || capability.workspace === workspace.key || `${capability.workspace}-os` === workspace.key);
    const screens = registry.screens.filter((screen) => workspace.refs.routes.some((route) => (screen as { route?: string }).route === route) || (screen as { workspace?: string }).workspace === workspace.key).map((screen) => screen.key);
    return {
      id: `M${String(index + 1).padStart(2, '0')}`,
      key: `module-${workspace.key}`,
      name: `${workspace.name} module agent`,
      group: 'module',
      suite: 'product',
      purpose: `Implementation coherence for ${workspace.name} (${workspace.audience}).`,
      prompt: MODULE_PROMPT(workspace.name),
      taskTypes: ['module.coverage', 'module.plan'],
      requiredInputs: [`registry workspace ${workspace.key}`, 'the workflows and capabilities it references'],
      tools: ['read_file', 'list_files', 'search', 'registry_read', 'store_read'],
      allowedWrites: [],
      prohibited: ['Changing a shared contract', 'Holding any specialist permission', 'Marking a gap closed without evidence'],
      acceptance: ['Every referenced route, capability and workflow is accounted for', `Gaps listed match the registry: ${workspace.gaps.length} open`],
      verification: ['Coverage matrix row for the module agrees with the registry'],
      limits: { maxTurns: 15, maxToolCalls: 60, maxElapsedMs: 600000, maxRetries: 1, maxConcurrent: 1, costCeilingUsd: 1 },
      escalation: ['A shared contract change', 'A scope question with no source'],
      implementation: 'model',
      moduleKey: workspace.key,
      owningWorkspace: workspace.family,
      roles: roleKeys.filter((role) => capabilities.some((capability) => capability.roles[role] && capability.roles[role] !== 'none')),
      screens,
      workflows: workspace.refs.workflows,
      entities: capabilities.flatMap((capability) => capability.systems),
      permissions: capabilities.map((capability) => `${capability.key}: ${Object.entries(capability.roles).map(([role, grant]) => `${role}=${grant}`).join(', ')}`),
      integrations: registry.integrations.map((integration) => integration.key).filter((key) => capabilities.some((capability) => capability.systems.includes(`integrations.${key}`) || capability.systems.includes(key))),
      operationalDependencies: [workspace.required_loop.support, workspace.required_loop.revoke_or_rollback].filter(Boolean),
    } satisfies ModuleAgentContract;
  });
}

export function moduleSystemPrompt(contract: ModuleAgentContract): string {
  return `${COMMON_CONTRACT}\n\n---\n\n${contract.id} — ${contract.name}\n\n${contract.prompt}`;
}
