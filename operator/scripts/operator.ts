import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modelFromEnvironment } from '../src/runtime/model.ts';
import { createRuntime } from '../src/runtime/operator.ts';
import { payloadHash } from '../src/store/hash.ts';
import type { EnqueueInput } from '../src/control/scheduler.ts';
import type { Environment, ToolName } from '../types.ts';
import { defaultStateRoot, repositoryRoot } from './paths.ts';

/**
 * The operator interface. Every subcommand is an owner's action on the
 * runtime: it reads state, grants or revokes an approval, runs a ready
 * task, cancels, recovers, or throws the kill switch. Nothing here is
 * reachable by a worker.
 *
 *   node --experimental-strip-types scripts/operator.ts <command> [options]
 */
const [, , command = 'help', ...rest] = process.argv;
const flags = new Map<string, string>();
const positional: string[] = [];
for (let i = 0; i < rest.length; i += 1) {
  const arg = rest[i]!;
  if (arg.startsWith('--')) { const next = rest[i + 1]; if (next !== undefined && !next.startsWith('--')) { flags.set(arg.slice(2), next); i += 1; } else flags.set(arg.slice(2), 'true'); }
  else positional.push(arg);
}
const need = (name: string): string => { const value = flags.get(name); if (!value) { console.error(`--${name} is required`); process.exit(2); } return value; };
const by = () => flags.get('by') ?? process.env.USER ?? 'operator';

const runtime = createRuntime({ repositoryRoot, stateRoot: flags.get('state') ?? defaultStateRoot, environment: (flags.get('environment') as Environment | undefined) ?? 'development', allowHandoffs: flags.get('allow-handoffs') === 'true', model: modelFromEnvironment() });
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));

const commands: Record<string, () => Promise<void> | void> = {
  help() {
    console.log(`Semester Operator
  status                              counts, ready/running/blocked tasks, approvals, audit chain, usage
  agents                              the roster, one line each
  tasks [--goal id]                   tasks with status
  task <id>                           one task and its executions
  audit [--verify]                    audit events; --verify checks the hash chain only
  goal --title t --source s [--by who]
  plan --goal id --file plan.json     enqueue tasks from a JSON array of EnqueueInput (without goalId)
  run <taskId>                        run one ready task
  run-ready [--max n]                 run ready tasks in order
  approve --tool t --target x --payload-file f --approver who --ttl-minutes n [--uses n] [--task id] [--artifact hash]
  revoke <approvalId> [--by who]
  cancel <taskId> --reason r [--by who]
  requeue <taskId> [--by who]
  recover [--by who]                  after a restart: mark stale running work interrupted (never re-queued on its own)
  tick                                create this period's scheduled tasks
  kill --reason r [--by who]          engage the kill switch; release-kill lifts it
  release-kill [--by who]
Options: --state <dir> (default operator/.state or $SEMESTER_OPERATOR_STATE), --environment development|staging|production, --allow-handoffs
Model: off unless SEMESTER_OPERATOR_MODEL_KEY is set; SEMESTER_OPERATOR_MODEL (default claude-sonnet-5-5), SEMESTER_OPERATOR_MODEL_URL, SEMESTER_OPERATOR_MODEL_PRICE="in,out" USD per million tokens`);
  },
  status: () => print(runtime.status()),
  agents: () => { for (const agent of runtime.agents) console.log(`${agent.id}  ${agent.key.padEnd(26)} ${agent.suite.padEnd(13)} ${agent.implementation.padEnd(13)} ${agent.taskTypes.join(',')}`); },
  tasks: () => { for (const task of runtime.store.tasks().filter((task) => !flags.get('goal') || task.goalId === flags.get('goal'))) console.log(`${task.id}  ${task.status.padEnd(21)} ${task.agentId}  ${task.type.padEnd(20)} ${task.title}${task.blockedReason ? `  [${task.blockedReason}]` : ''}`); },
  task: () => { const id = positional[0]!; print({ task: runtime.store.task(id), executions: runtime.store.executions().filter((record) => record.taskId === id) }); },
  audit: () => { if (flags.get('verify') === 'true') print(runtime.audit.verifyChain()); else for (const event of runtime.audit.events()) console.log(`${event.seq}  ${event.at}  ${event.actor.padEnd(10)} ${event.kind.padEnd(22)} ${event.taskId ?? ''}  ${JSON.stringify(event.detail)}`); },
  goal: () => print(runtime.addGoal({ title: need('title'), source: need('source'), requestedBy: by() })),
  plan: () => { const inputs = JSON.parse(readFileSync(resolve(need('file')), 'utf8')) as Array<Omit<EnqueueInput, 'goalId'>>; print(runtime.plan(need('goal'), inputs).map((task) => ({ id: task.id, title: task.title, agentId: task.agentId, dependsOn: task.dependsOn }))); },
  async run() { const result = await runtime.run(positional[0]!); print({ status: result.task.status, outcome: result.execution.report?.outcome, report: result.execution.report, evidence: result.execution.evidence.length }); },
  async 'run-ready'() { const results = await runtime.runReady(Number(flags.get('max') ?? 10)); print(results.map((result) => ({ id: result.task.id, status: result.task.status, outcome: result.execution.report?.outcome }))); },
  approve: () => {
    const payload: unknown = JSON.parse(readFileSync(resolve(need('payload-file')), 'utf8'));
    print(runtime.approvals.grant({ tool: need('tool') as ToolName, target: need('target'), payloadHash: payloadHash(payload), approver: need('approver'), ttlMs: Number(need('ttl-minutes')) * 60_000, usesAllowed: Number(flags.get('uses') ?? 1), taskId: flags.get('task'), artifactHash: flags.get('artifact') }));
  },
  revoke: () => print(runtime.approvals.revoke(positional[0]!, by())),
  cancel: () => print(runtime.scheduler.cancel(positional[0]!, by(), need('reason'))),
  requeue: () => print(runtime.scheduler.requeue(positional[0]!, by())),
  recover: () => print(runtime.scheduler.recover(by())),
  tick: () => print(runtime.scheduler.tick().map((task) => task.id)),
  kill: () => print(runtime.killSwitch.engage(need('reason'), by())),
  'release-kill': () => { runtime.killSwitch.release(by()); print(runtime.killSwitch.state()); },
};

const handler = Object.hasOwn(commands, command) ? commands[command] : undefined;
if (!handler) { console.error(`Unknown command ${command}`); commands.help!(); process.exit(2); }
await handler();
