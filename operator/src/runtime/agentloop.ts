import type { HandoffProposal, ToolName, WorkerOutcome, WorkerReport } from '../../types.ts';
import { systemPrompt } from '../agents/contract.ts';
import { agent as findAgent } from '../agents/roster.ts';
import { sha256 } from '../store/hash.ts';
import { redactString } from '../store/redact.ts';
import { ToolDenied, literalPattern } from '../tools/adapters.ts';
import type { Handler, HandlerContext } from './handlers.ts';
import type { ModelMessage } from './model.ts';
import { ModelUnavailable } from './model.ts';

/**
 * The model loop: the one execution path every model-backed task type takes.
 *
 * The model never holds a tool. It replies with one JSON object per turn:
 * a tool request, which the loop executes through the same policy-gated
 * toolbox a deterministic handler uses, or a final report in the shape every
 * contract requires. Everything the model is told is redacted first;
 * everything it returns is validated here and redacted again by the runtime.
 * The loop spends the task's turn budget on every model call and stops, as
 * blocked rather than as success, when a limit is reached, when policy denies
 * three requests, or when the model cannot produce the protocol twice.
 */
const LOOP_TOOLS = ['read_file', 'list_files', 'search', 'write_file', 'run_check', 'git_diff'] as const satisfies readonly ToolName[];
const MAX_DENIALS = 3;
const MAX_RESULT_CHARS = 24_000;
const VERIFIER_OUTCOMES: readonly WorkerOutcome[] = ['accepted', 'rejected', 'insufficient_evidence'];
const WORKER_OUTCOMES: readonly WorkerOutcome[] = ['completed', 'blocked', 'failed', 'needs_approval'];

type LoopTool = (typeof LOOP_TOOLS)[number];
type ModelAction =
  | { action: 'tool'; tool: LoopTool; args: Record<string, unknown> }
  | { action: 'report'; report: Record<string, unknown> };

const PROTOCOL = `TOOL PROTOCOL

Reply with exactly one JSON object and nothing else: no prose, no code fence.

To use a tool:
  {"action":"tool","tool":"read_file","args":{"path":"relative/path"}}
  {"action":"tool","tool":"list_files","args":{"dir":"relative/dir"}}
  {"action":"tool","tool":"search","args":{"dir":"relative/dir","pattern":"literal text to find (not a regular expression)"}}
  {"action":"tool","tool":"write_file","args":{"path":"relative/path","content":"whole file content"}}
  {"action":"tool","tool":"run_check","args":{"key":"allowlisted command key"}}
  {"action":"tool","tool":"git_diff","args":{}}
Each result comes back as {"tool":..., "ok":true, "result":...} or {"tool":..., "ok":false, "code":..., "reason":...}. A denial is final for that target: do not retry it.

To finish:
  {"action":"report","report":{"outcome":"completed","status":"one line","evidenceInspected":[],"changes":[],"verification":[{"name":"","passed":true,"detail":""}],"risks":[],"approvalsRequired":[],"artifacts":[],"nextStep":"","handoffs":[]}}
A handoff is {"agentId":"Axx","type":"task.type","title":"","acceptance":[],"spec":{}}; it is queued only along an allowed route.`;

function parseAction(text: string): ModelAction | undefined {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); } catch { return undefined; }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const value = parsed as Record<string, unknown>;
  const isLoopTool = (tool: unknown): tool is LoopTool => typeof tool === 'string' && (LOOP_TOOLS as readonly string[]).includes(tool);
  if (value.action === 'tool' && isLoopTool(value.tool)) {
    return { action: 'tool', tool: value.tool, args: value.args && typeof value.args === 'object' ? (value.args as Record<string, unknown>) : {} };
  }
  if (value.action === 'report' && value.report && typeof value.report === 'object') return { action: 'report', report: value.report as Record<string, unknown> };
  return undefined;
}

const str = (value: unknown, name: string): string => { if (typeof value !== 'string' || value === '') throw new Error(`args.${name} must be a non-empty string.`); return value; };
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

function runTool(context: HandlerContext, action: Extract<ModelAction, { action: 'tool' }>): unknown {
  const { tools } = context;
  switch (action.tool) {
    case 'read_file': return tools.readFile(str(action.args.path, 'path'));
    case 'list_files': return tools.listFiles(str(action.args.dir, 'dir'));
    case 'search': return tools.search(str(action.args.dir, 'dir'), literalPattern(str(action.args.pattern, 'pattern')), 100);
    case 'write_file': { if (typeof action.args.content !== 'string') throw new Error('args.content must be a string (it may be empty).'); const item = tools.writeFile(str(action.args.path, 'path'), action.args.content); return item.kind === 'file' ? { path: item.path, sha256: item.sha256, bytes: item.bytes } : item; }
    case 'run_check': { const item = tools.runCheck(str(action.args.key, 'key')); return { command: item.command, cwd: item.cwd, exitCode: item.exitCode, tail: item.tail }; }
    case 'git_diff': { const item = tools.gitDiff(); return { sha256: item.sha256, files: item.files, bytes: item.bytes, text: item.text }; }
    default: { const never: never = action.tool; throw new Error(`Unhandled tool ${String(never)}.`); }
  }
}

function toHandoffs(value: unknown): HandoffProposal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.agentId !== 'string' || typeof record.type !== 'string' || typeof record.title !== 'string') return [];
    return [{ agentId: record.agentId, type: record.type, title: record.title, acceptance: Array.isArray(record.acceptance) ? (record.acceptance as HandoffProposal['acceptance']) : [], spec: record.spec && typeof record.spec === 'object' ? (record.spec as Record<string, unknown>) : {}, registryKeys: Array.isArray(record.registryKeys) ? strings(record.registryKeys) : undefined }];
  });
}

function toReport(context: HandlerContext, raw: Record<string, unknown>): WorkerReport | { error: string } {
  const allowed = context.task.type === 'verify' ? VERIFIER_OUTCOMES : WORKER_OUTCOMES;
  const outcome = raw.outcome;
  if (typeof outcome !== 'string' || !allowed.includes(outcome as WorkerOutcome)) return { error: `outcome ${JSON.stringify(outcome)} is not one of ${allowed.join(', ')} for task type ${context.task.type}` };
  const verification = Array.isArray(raw.verification)
    ? raw.verification.flatMap((item) => (item && typeof item === 'object' && typeof (item as Record<string, unknown>).name === 'string' ? [{ name: String((item as Record<string, unknown>).name), passed: (item as Record<string, unknown>).passed === true, detail: String((item as Record<string, unknown>).detail ?? '') }] : []))
    : [];
  return {
    taskId: context.task.id, agentId: context.task.agentId, outcome: outcome as WorkerOutcome,
    status: typeof raw.status === 'string' && raw.status ? raw.status : 'model report',
    evidenceInspected: strings(raw.evidenceInspected), changes: strings(raw.changes), verification, risks: strings(raw.risks),
    approvalsRequired: strings(raw.approvalsRequired), artifacts: strings(raw.artifacts), nextStep: typeof raw.nextStep === 'string' ? raw.nextStep : '',
    handoffs: toHandoffs(raw.handoffs),
  };
}

const stop = (context: HandlerContext, outcome: 'blocked' | 'failed', status: string, risk: string, nextStep: string): WorkerReport => ({
  taskId: context.task.id, agentId: context.task.agentId, outcome, status, evidenceInspected: [], changes: [], verification: [], risks: [risk], approvalsRequired: [], artifacts: [], nextStep, handoffs: [],
});

/** Every task type without a deterministic handler runs here. */
export const modelDriven: Handler = async (context) => {
  const contract = findAgent(context.task.agentId);
  if (!contract) throw new Error(`Unknown agent ${context.task.agentId}.`);
  const grantedTools = LOOP_TOOLS.filter((tool) => contract.tools.includes(tool));
  const system = [
    systemPrompt(contract), '', '---', '', PROTOCOL, '',
    `Tools granted to you on this task: ${grantedTools.join(', ') || 'none'}. Any other tool request is denied.`,
    `Allowed writes: ${contract.allowedWrites.join(', ') || 'none'}. Prohibited: ${contract.prohibited.join('; ')}.`,
    `Outcomes you may return: ${(context.task.type === 'verify' ? VERIFIER_OUTCOMES : WORKER_OUTCOMES).join(', ')}.`,
  ].join('\n');
  const { task } = context;
  const opening = {
    taskId: task.id, type: task.type, title: task.title, mode: task.mode, environment: task.environment, spec: task.spec, acceptance: task.acceptance,
    registryKeys: task.registryKeys, limits: { maxTurns: task.limits.maxTurns, maxToolCalls: task.limits.maxToolCalls }, workspace: context.workspaceRoot ? 'isolated worktree' : 'none (read-only task)',
  };
  const messages: ModelMessage[] = [{ role: 'user', content: redactString(JSON.stringify(opening)) }];
  let denials = 0;
  let malformed = 0;
  let turn = 0;

  for (;;) {
    const spent = context.limiter.consume('turn');
    if (!spent.ok) return stop(context, 'blocked', spent.code, `Stopped at the model turn limit: ${spent.reason}`, 'Split the task, or raise the agent limit by a coordinator decision; a worker cannot.');
    turn += 1;
    let text: string;
    try {
      const response = await context.model.respond({ system, messages });
      text = response.text;
      const costNote = response.costUsd === undefined ? 'cost unmetered' : `$${response.costUsd.toFixed(4)}`;
      context.execution.evidence.push({ kind: 'note', label: 'model.turn', detail: `turn ${turn} ${context.model.name}: in ${response.inputTokens ?? '?'} out ${response.outputTokens ?? '?'} tokens, ${costNote}, reply sha256=${sha256(text).slice(0, 12)}` });
      if (response.costUsd !== undefined) {
        const cost = context.limiter.addCost(response.costUsd);
        if (!cost.ok) return stop(context, 'blocked', cost.code, `Stopped at the cost ceiling: ${cost.reason}`, 'A coordinator decides whether the task is worth a higher ceiling.');
      }
    } catch (error) {
      if (error instanceof ModelUnavailable) return { ...stop(context, 'blocked', 'model_unavailable', error.message, 'Supply a model port, or give this task a deterministic spec.'), approvalsRequired: ['Model dependency and credential approval (docs/AGENT-TOOLING.md supply-chain workflow)'] };
      throw error;
    }
    messages.push({ role: 'assistant', content: text });

    const action = parseAction(text);
    if (!action) {
      malformed += 1;
      if (malformed >= 2) return stop(context, 'failed', 'malformed_model_output', 'The model did not return the JSON protocol in two consecutive turns; nothing was assumed from its prose.', 'Inspect the recorded turns; retry once with the same spec, then escalate.');
      messages.push({ role: 'user', content: 'Your reply was not a single JSON object in the protocol. Reply again with one JSON object only.' });
      continue;
    }

    if (action.action === 'report') {
      const report = toReport(context, action.report);
      if ('error' in report) return stop(context, 'failed', 'disallowed_outcome', `The model's report was refused: ${report.error}.`, 'Only the independent verifier returns a verdict; a worker returns completed, blocked, failed or needs_approval.');
      return report;
    }

    let result: Record<string, unknown>;
    try {
      const value = runTool(context, action);
      const serialised = JSON.stringify(value);
      result = { tool: action.tool, ok: true, result: serialised.length > MAX_RESULT_CHARS ? `${serialised.slice(0, MAX_RESULT_CHARS)}… [truncated ${serialised.length - MAX_RESULT_CHARS} chars]` : value };
    } catch (error) {
      if (error instanceof ToolDenied) {
        if (['tool_limit', 'time_limit', 'cost_limit', 'retry_limit', 'turn_limit'].includes(error.code) || error.code.startsWith('aggregate_')) return stop(context, 'blocked', error.code, `Stopped at a limit: ${error.message}`, 'Split the task; a worker cannot raise a limit.');
        denials += 1;
        if (denials >= MAX_DENIALS) return stop(context, 'blocked', 'policy_denied_repeatedly', `Policy denied ${denials} tool requests; the last was ${error.tool} ${error.target} (${error.code}).`, 'Narrow the task to the agent\'s allowed writes and granted tools, or obtain the applicable approval.');
        result = { tool: action.tool, ok: false, code: error.code, reason: redactString(error.message) };
      } else {
        result = { tool: action.tool, ok: false, code: 'tool_error', reason: redactString(error instanceof Error ? error.message : String(error)) };
      }
    }
    // The one redaction boundary for tool results: nothing reaches the model that the audit would not hold.
    messages.push({ role: 'user', content: redactString(JSON.stringify(result)) });
  }
};
