import { isAbsolute, relative, resolve, sep } from 'node:path';
import { READ_ONLY_TOOLS, RISK_LEVELS, type PolicyContext, type PolicyDecision, type PolicySet, type ToolAction } from '../../types.ts';
import type { ApprovalService } from './approvals.ts';
import { matchesAny } from './glob.ts';

/**
 * C01 — Policy controller.
 *
 * Every tool action passes through `evaluate` before it runs. The decision is
 * deterministic, ordered, and fails closed: a missing policy, an engaged kill
 * switch, a tool the agent was not granted, a path outside the workspace, a
 * protected path, a command off the allowlist, or a consequential action with
 * no live approval each deny. The policy object is frozen at construction;
 * there is no method that changes it, so a worker holding the controller
 * cannot widen its own authority.
 */
export interface PolicyController {
  readonly policy: Readonly<PolicySet>;
  evaluate(action: ToolAction, context: PolicyContext): PolicyDecision;
}

export interface PolicyDependencies {
  killSwitchEngaged(): boolean;
  approvals: ApprovalService;
}

function deny(code: string, reason: string, requiresApproval = false): PolicyDecision { return { allowed: false, code, reason, requiresApproval }; }

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}

export function validatePolicy(policy: unknown): string[] {
  const problems: string[] = [];
  const candidate = policy as Partial<PolicySet> | null;
  if (!candidate || typeof candidate !== 'object') return ['policy is not an object'];
  if (typeof candidate.version !== 'number') problems.push('version must be a number');
  for (const key of ['protectedPaths', 'protectedReads', 'approvalEnvironments'] as const) {
    if (!Array.isArray(candidate[key])) problems.push(`${key} must be an array`);
  }
  if (!candidate.commands || typeof candidate.commands !== 'object') problems.push('commands must be an object');
  else for (const [key, command] of Object.entries(candidate.commands)) {
    if (!Array.isArray(command.argv) || command.argv.length === 0) problems.push(`commands.${key}.argv must be a non-empty array`);
    if (typeof command.cwd !== 'string') problems.push(`commands.${key}.cwd must be a string`);
    if (typeof command.timeoutMs !== 'number' || command.timeoutMs <= 0) problems.push(`commands.${key}.timeoutMs must be positive`);
  }
  if (!RISK_LEVELS.includes(candidate.approvalRequiredFrom as never)) problems.push('approvalRequiredFrom must be a risk level');
  return problems;
}

/** Path relative to the repository, POSIX separators, or undefined when the path escapes it. */
export function repositoryPath(repositoryRoot: string, target: string): string | undefined {
  const absolute = isAbsolute(target) ? resolve(target) : resolve(repositoryRoot, target);
  const rel = relative(resolve(repositoryRoot), absolute);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return rel === '' ? '.' : undefined;
  return rel.split(sep).join('/');
}

export function createPolicyController(policyInput: PolicySet, deps: PolicyDependencies): PolicyController {
  const problems = validatePolicy(policyInput);
  if (problems.length) throw new Error(`Policy is invalid; refusing to start: ${problems.join('; ')}`);
  const policy = deepFreeze(structuredClone(policyInput));
  const riskRank = (risk: string) => RISK_LEVELS.indexOf(risk as never);

  return {
    policy,
    evaluate(action, context) {
      if (deps.killSwitchEngaged()) return deny('kill_switch', 'The kill switch is engaged; no new work runs.');
      if (!context.agentTools.includes(action.tool)) return deny('tool_not_granted', `${context.agentId} was not granted ${action.tool}.`);
      const readOnly = READ_ONLY_TOOLS.includes(action.tool);

      if (action.tool === 'read_file' || action.tool === 'list_files' || action.tool === 'search') {
        const inRepository = repositoryPath(context.repositoryRoot, action.target);
        const inWorkspace = context.workspaceRoot ? repositoryPath(context.workspaceRoot, action.target) : undefined;
        const rel = inWorkspace ?? inRepository;
        if (rel === undefined) return deny('outside_repository', `${action.target} is outside the repository and the workspace.`);
        if (matchesAny(rel, policy.protectedReads)) return deny('protected_read', `${rel} may not be read by a worker.`);
      }

      if (action.tool === 'write_file') {
        if (context.mode === 'observe') return deny('observe_mode', 'The task runs in observe mode; it may not write.');
        if (!context.workspaceRoot) return deny('no_workspace', 'A write needs an isolated workspace and this task has none.');
        const rel = repositoryPath(context.workspaceRoot, action.target);
        if (rel === undefined) return deny('outside_workspace', `${action.target} is outside the task workspace ${context.workspaceRoot}.`);
        if (matchesAny(rel, policy.protectedPaths)) return deny('protected_path', `${rel} is protected; workers never modify policy, approvals, workflows or secrets.`);
        if (!matchesAny(rel, context.allowedWrites)) return deny('write_not_allowed', `${rel} is not within ${context.agentId}'s allowed writes.`);
      }

      if (action.tool === 'run_check') {
        if (context.mode === 'observe') return deny('observe_mode', 'The task runs in observe mode; it may not run commands.');
        if (!(action.target in policy.commands)) return deny('command_not_allowed', `${action.target} is not an allowlisted check.`);
      }

      if (action.tool === 'release_adapter' || action.tool === 'external_send') {
        if (context.mode !== 'operate') return deny('operate_mode_required', `${action.tool} needs operate mode; the task runs in ${context.mode}.`);
      }

      const consequential = !readOnly && (
        action.external === true
        || riskRank(action.risk) >= riskRank(policy.approvalRequiredFrom)
        || policy.approvalEnvironments.includes(context.environment)
        || action.tool === 'release_adapter' || action.tool === 'external_send'
      );
      if (consequential) {
        if (!action.payloadHash) return deny('payload_hash_required', 'A consequential action must carry the hash of its exact payload.', true);
        const result = deps.approvals.consume({ tool: action.tool, target: action.target, payloadHash: action.payloadHash, taskId: context.taskId, actor: context.agentId });
        if (!result.ok) return deny(result.code, result.reason, true);
        return { allowed: true, code: 'approved', reason: `Approval ${result.approval.id} consumed.`, requiresApproval: true };
      }
      return { allowed: true, code: 'allowed', reason: 'Within task scope.', requiresApproval: false };
    },
  };
}
