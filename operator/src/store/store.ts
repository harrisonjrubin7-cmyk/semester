import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Approval, AuditEvent, ExecutionRecord, Goal, KillSwitchState, ScheduleEntry, Task } from '../../types.ts';

/**
 * Persistence for goals, tasks, dependencies, execution records, approvals,
 * schedules, the kill switch and the audit journal.
 *
 * The file store is the only implementation today. It writes each collection
 * as one JSON document through a temporary file and a rename, so a crash
 * leaves the previous document intact, and appends audit events to a JSONL
 * journal that is never rewritten. A database-backed store would implement
 * the same interface; nothing above this file knows which one it has.
 */
export interface OperatorStore {
  readonly root: string;
  goals(): Goal[];
  saveGoal(goal: Goal): void;
  tasks(): Task[];
  task(id: string): Task | undefined;
  saveTask(task: Task): void;
  executions(): ExecutionRecord[];
  saveExecution(record: ExecutionRecord): void;
  approvals(): Approval[];
  saveApproval(approval: Approval): void;
  schedules(): ScheduleEntry[];
  saveSchedule(entry: ScheduleEntry): void;
  killSwitch(): KillSwitchState;
  saveKillSwitch(state: KillSwitchState): void;
  appendAudit(event: AuditEvent): void;
  audit(): AuditEvent[];
}

const COLLECTIONS = {
  goals: 'goals.json', tasks: 'tasks.json', executions: 'executions.json', approvals: 'approvals.json', schedules: 'schedules.json',
} as const;

export function createFileStore(root: string): OperatorStore {
  mkdirSync(root, { recursive: true });

  function readCollection<T extends { id?: string; key?: string }>(name: keyof typeof COLLECTIONS): T[] {
    const path = join(root, COLLECTIONS[name]);
    if (!existsSync(path)) return [];
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`${path} is not a JSON array; refusing to guess at its contents.`);
    return parsed as T[];
  }

  function writeAtomic(name: string, value: unknown): void {
    const path = join(root, name);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, path);
  }

  function upsert<T extends Record<string, unknown>>(name: keyof typeof COLLECTIONS, record: T, idKey: 'id' | 'key'): void {
    const items = readCollection<T>(name);
    const index = items.findIndex((item) => item[idKey] === record[idKey]);
    if (index === -1) items.push(record);
    else items[index] = record;
    writeAtomic(COLLECTIONS[name], items);
  }

  const auditPath = join(root, 'audit.jsonl');
  const killPath = join(root, 'kill-switch.json');

  return {
    root,
    goals: () => readCollection<Goal>('goals'),
    saveGoal: (goal) => upsert('goals', goal as unknown as Record<string, unknown>, 'id'),
    tasks: () => readCollection<Task>('tasks'),
    task: (id) => readCollection<Task>('tasks').find((task) => task.id === id),
    saveTask: (task) => upsert('tasks', task as unknown as Record<string, unknown>, 'id'),
    executions: () => readCollection<ExecutionRecord>('executions'),
    saveExecution: (record) => upsert('executions', record as unknown as Record<string, unknown>, 'id'),
    approvals: () => readCollection<Approval>('approvals'),
    saveApproval: (approval) => upsert('approvals', approval as unknown as Record<string, unknown>, 'id'),
    schedules: () => readCollection<ScheduleEntry>('schedules'),
    saveSchedule: (entry) => upsert('schedules', entry as unknown as Record<string, unknown>, 'key'),
    killSwitch: () => (existsSync(killPath) ? JSON.parse(readFileSync(killPath, 'utf8')) as KillSwitchState : { engaged: false }),
    saveKillSwitch: (state) => writeAtomic('kill-switch.json', state),
    appendAudit: (event) => appendFileSync(auditPath, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 }),
    audit: () => (existsSync(auditPath) ? readFileSync(auditPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as AuditEvent) : []),
  };
}
