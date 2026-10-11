import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAuditLog } from '../src/control/audit.ts';
import { systemClock } from '../src/store/clock.ts';
import { createFileStore } from '../src/store/store.ts';

/**
 * The committed demonstration is evidence, so it is checked like evidence:
 * its audit chain verifies and its continuation record agrees with its task
 * store. One row is allowed to differ: the task that wrote the record was
 * running when it wrote it and cannot record its own completion.
 */
const demo = resolve(import.meta.dirname, '../evidence/demo');

test('the committed demonstration state has an intact audit chain and agrees with its continuation record', () => {
  const store = createFileStore(resolve(demo, 'state'));
  const chain = createAuditLog(store, systemClock).verifyChain();
  assert.equal(chain.ok, true, `audit chain broken at ${chain.brokenAt}`);
  assert.ok(chain.events >= 60, `${chain.events} audit events`);

  const tasks = new Map(store.tasks().map((task) => [task.id, task]));
  const rows = readFileSync(resolve(demo, 'CONTINUATION.md'), 'utf8').split('\n')
    .map((line) => /^\| (task_\d+) \| (A\d+) \| ([\w.]+) \| (\w+) \|/.exec(line)).filter((match): match is RegExpExecArray => match !== null);
  assert.equal(rows.length, tasks.size, 'every task is in the record');
  for (const [, id, agent, type, status] of rows) {
    const task = tasks.get(id!);
    assert.ok(task, `${id} exists in the store`);
    assert.equal(task.agentId, agent);
    assert.equal(task.type, type);
    if (type === 'docs.continuation') { assert.equal(status, 'running', 'the writer records itself as running'); assert.equal(task.status, 'awaiting_verification'); }
    else assert.equal(task.status, status, `${id} status matches the record`);
  }
  const executions = store.executions();
  assert.equal(executions.length, tasks.size, 'one execution per task in this run');
  assert.ok(executions.every((record) => record.status !== 'running'), 'no execution is still running in a committed record');
});
