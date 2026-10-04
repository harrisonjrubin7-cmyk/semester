import { describe, expect, it } from 'vitest';
import { fixedClock } from '../kernel';
import type { Can } from '../policy';
import { memoryTaskRepository } from './memory';
import { TASK_MACHINE, TITLE_LIMIT, createTaskService, isDueOn, isOverdue, type Task } from './index';
import { complete, reopen, reschedule } from './model';

const allowed: Can = () => ({ allow: true, obligations: [] });
const denied: Can = () => ({ allow: false, reason: 'role_not_served', message: 'Not for you.' });
const clock = fixedClock('2026-09-09', 600, 1_000);

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1', title: 'Read chapter 3', state: 'open', dueOn: '2026-09-10', courseId: null, time: '', repeats: false, ...over,
});

const make = (seed: Task[] = [task()], can: Can = allowed) => {
  const repo = memoryTaskRepository(seed);
  return { repo, service: createTaskService({ repo, clock, can }) };
};

describe('the task rules', () => {
  it('completes and reopens, and refuses to do either twice', () => {
    const done = complete(task());
    expect(done.ok && done.value.state).toBe('done');
    const again = done.ok ? complete(done.value) : done;
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('invalid_transition');
    const back = done.ok ? reopen(done.value) : done;
    expect(back.ok && back.value.state).toBe('open');
    expect(reopen(task()).ok).toBe(false);
  });

  it('describes the legal moves as a two-state machine', () => {
    expect([...TASK_MACHINE.states].sort()).toEqual(['done', 'open']);
    expect([...TASK_MACHINE.events].sort()).toEqual(['complete', 'reopen']);
  });

  it('refuses to write a repeating task, because the older list owns repetition', () => {
    for (const op of [complete, reopen, (t: Task) => reschedule(t, '2026-09-12')]) {
      const r = op(task({ repeats: true }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('unsupported');
    }
  });

  it('sets a time when given one, and keeps the task’s own when not', () => {
    expect(reschedule(task({ time: '9 AM' }), '2026-09-20', '4:00 PM')).toMatchObject({ ok: true, value: { dueOn: '2026-09-20', time: '4:00 PM' } });
    expect(reschedule(task({ time: '9 AM' }), '2026-09-20')).toMatchObject({ ok: true, value: { dueOn: '2026-09-20', time: '9 AM' } });
    expect(reschedule(task({ time: '9 AM' }), '2026-09-20', '')).toMatchObject({ ok: true, value: { time: '' } });
  });

  it('reschedules to a real day or to someday, and refuses anything else', () => {
    expect(reschedule(task(), '2026-09-20')).toMatchObject({ ok: true, value: { dueOn: '2026-09-20' } });
    expect(reschedule(task(), null)).toMatchObject({ ok: true, value: { dueOn: null } });
    for (const bad of ['2026-02-30', 'tomorrow', '']) {
      const r = reschedule(task(), bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('validation');
    }
  });

  it('is overdue only while open and dated before today; today is never overdue', () => {
    expect(isOverdue(task({ dueOn: '2026-09-08' }), '2026-09-09')).toBe(true);
    expect(isOverdue(task({ dueOn: '2026-09-09' }), '2026-09-09')).toBe(false);
    expect(isOverdue(task({ dueOn: '2026-09-08', state: 'done' }), '2026-09-09')).toBe(false);
    expect(isOverdue(task({ dueOn: null }), '2026-09-09')).toBe(false);
    expect(isDueOn(task({ dueOn: '2026-09-09' }), '2026-09-09')).toBe(true);
    expect(isDueOn(task({ dueOn: '2026-09-09', state: 'done' }), '2026-09-09')).toBe(false);
  });
});

describe('the task service', () => {
  it('stores a completion, says what happened, and stamps it with the injected clock', async () => {
    const { service, repo } = make();
    const r = await service.complete('t1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.value.state).toBe('done');
      expect(r.value.events).toEqual([{ type: 'task.completed', at: 1_000, subject: 't1' }]);
      expect(r.value.obligations).toEqual([]);
    }
    expect(repo.snapshot()[0].state).toBe('done');
  });

  it('writes nothing for a person who may not write, whatever else is wrong', async () => {
    const { service, repo } = make([task()], denied);
    const before = repo.snapshot();
    for (const result of [
      await service.complete('t1'),
      await service.reopen('t1'),
      await service.reschedule('t1', '2026-09-20'),
      await service.add({ title: 'New' }),
      await service.complete('missing'),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('forbidden');
    }
    expect(repo.snapshot()).toEqual(before);
  });

  it('says not_found for a task that is gone, and invalid_transition for a move that cannot be made', async () => {
    const { service, repo } = make();
    const gone = await service.complete('missing');
    expect(!gone.ok && gone.error.code).toBe('not_found');
    const bad = await service.reopen('t1');
    expect(!bad.ok && bad.error.code).toBe('invalid_transition');
    expect(repo.snapshot()[0].state).toBe('open');
  });

  it('adds a task only when it is valid, trimming the title', async () => {
    const { service, repo } = make([]);
    const added = await service.add({ title: '  Email Dr. Rao  ', dueOn: '2026-09-11' });
    expect(added.ok && added.value.value).toMatchObject({ title: 'Email Dr. Rao', dueOn: '2026-09-11', state: 'open' });
    for (const input of [{ title: '   ' }, { title: 'x'.repeat(TITLE_LIMIT + 1) }, { title: 'ok', dueOn: '2026-02-30' }]) {
      const r = await service.add(input);
      expect(!r.ok && r.error.code).toBe('validation');
    }
    expect(repo.snapshot()).toHaveLength(1);
  });

  it('carries the policy’s obligations out to the caller', async () => {
    const keepLocal: Can = () => ({ allow: true, obligations: ['keep_on_device'] });
    const { service } = make([task()], keepLocal);
    const r = await service.complete('t1');
    expect(r.ok && r.value.obligations).toEqual(['keep_on_device']);
  });

  it('removes a task, says so, and removes nothing for a person who may not write', async () => {
    const { service, repo } = make([task(), task({ id: 't2', title: 'Other' })]);
    const r = await service.remove('t1');
    expect(r.ok && r.value.events).toEqual([{ type: 'task.removed', at: 1_000, subject: 't1' }]);
    expect(repo.snapshot().map((t) => t.id)).toEqual(['t2']);

    const locked = make([task()], denied);
    const refused = await locked.service.remove('t1');
    expect(!refused.ok && refused.error.code).toBe('forbidden');
    expect(locked.repo.snapshot()).toHaveLength(1);
  });

  it('says not_found for removing a task that is gone', async () => {
    const { service } = make([]);
    const r = await service.remove('missing');
    expect(!r.ok && r.error.code).toBe('not_found');
  });

  it('moves a task to a day and an hour through the service, keeping an omitted time', async () => {
    const { service, repo } = make([task({ time: '9 AM' })]);
    await service.reschedule('t1', '2026-09-12', '4:00 PM');
    expect(repo.snapshot()[0]).toMatchObject({ dueOn: '2026-09-12', time: '4:00 PM' });
    await service.reschedule('t1', '2026-09-13');
    expect(repo.snapshot()[0]).toMatchObject({ dueOn: '2026-09-13', time: '4:00 PM' });
  });
});
