import { describe, expect, it } from 'vitest';
import { workflowDefinitionProblems, transition } from './workflow.ts';
import {
  OFFICE_HANDOFF,
  classifyRetry,
  decideBlockerRoute,
  decideHandoffAction,
  routeFingerprint,
  targetKey,
  type HandoffActor,
  type OfficeOwnership,
  type RoutableReadiness,
} from './office-handoff.ts';

const readiness: RoutableReadiness = {
  subjectId: 'student-1',
  version: 4,
  blockers: [{ code: 'advising_hold', label: 'Advising required', sourceRefIds: ['sis-1'] }],
  holds: [
    { id: 'hold-fin', state: 'blocking', label: 'Balance due', sourceRefIds: ['bursar-1'] },
    { id: 'hold-clear', state: 'clear', label: 'Immunization on file', sourceRefIds: ['health-1'] },
  ],
};

const ownership: OfficeOwnership = {
  'blocker:advising_hold': 'advising',
  'hold:hold-fin': 'bursar',
  'hold:hold-clear': 'health',
};

const student: HandoffActor = { kind: 'student', subjectId: 'student-1' };

function route(overrides: Partial<Parameters<typeof decideBlockerRoute>[0]> = {}) {
  return decideBlockerRoute({
    actor: student,
    readiness,
    target: { kind: 'blocker', code: 'advising_hold' },
    readinessVersion: 4,
    ownership,
    ...overrides,
  });
}

describe('OFFICE_HANDOFF workflow', () => {
  it('is a well-formed machine', () => {
    expect(workflowDefinitionProblems(OFFICE_HANDOFF)).toEqual([]);
  });

  it('moves routed → acknowledged → resolved in order', () => {
    expect(transition(OFFICE_HANDOFF, 'routed', 'acknowledged')).toMatchObject({ ok: true, state: 'acknowledged' });
    expect(transition(OFFICE_HANDOFF, 'acknowledged', 'resolved')).toMatchObject({ ok: true, state: 'resolved' });
  });

  it('refuses to resolve a handoff nobody has acknowledged', () => {
    expect(transition(OFFICE_HANDOFF, 'routed', 'resolved').ok).toBe(false);
  });

  it('treats resolved and withdrawn as final', () => {
    expect(transition(OFFICE_HANDOFF, 'resolved', 'routed').ok).toBe(false);
    expect(transition(OFFICE_HANDOFF, 'withdrawn', 'routed').ok).toBe(false);
  });
});

describe('decideBlockerRoute', () => {
  it('lets the student route an open blocker to its owning office', () => {
    expect(route()).toEqual({
      ok: true,
      subjectId: 'student-1',
      target: 'blocker:advising_hold',
      officeId: 'advising',
      readinessVersion: 4,
    });
  });

  it("refuses a student who routes another student's item", () => {
    expect(route({ actor: { kind: 'student', subjectId: 'student-2' } })).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('lets an advisor route only for assigned students', () => {
    expect(route({ actor: { kind: 'advisor', assignedSubjectIds: ['student-1'] } }).ok).toBe(true);
    expect(route({ actor: { kind: 'advisor', assignedSubjectIds: ['student-9'] } })).toEqual({
      ok: false,
      reason: 'not_authorized',
    });
  });

  it('never lets an office start a handoff', () => {
    expect(route({ actor: { kind: 'office', officeId: 'advising' } })).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('refuses a request built on an older readiness version', () => {
    expect(route({ readinessVersion: 3 })).toEqual({ ok: false, reason: 'stale_readiness' });
  });

  it('fails closed for an item that is not in the readiness projection, even with an owner configured', () => {
    expect(
      route({
        target: { kind: 'blocker', code: 'housing_hold' },
        ownership: { ...ownership, 'blocker:housing_hold': 'housing' },
      }),
    ).toEqual({ ok: false, reason: 'target_not_in_readiness' });
  });

  it('refuses a hold that is already clear', () => {
    expect(route({ target: { kind: 'hold', id: 'hold-clear' } })).toEqual({ ok: false, reason: 'target_not_open' });
  });

  it('refuses an open item that has no owning office', () => {
    expect(route({ target: { kind: 'hold', id: 'hold-fin' }, ownership: {} })).toEqual({
      ok: false,
      reason: 'no_owning_office',
    });
  });

  it('checks authorization before it looks at the target', () => {
    expect(
      route({ actor: { kind: 'student', subjectId: 'student-2' }, target: { kind: 'hold', id: 'missing' } }),
    ).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('keys blockers and holds apart, so a code and an id cannot collide', () => {
    expect(targetKey({ kind: 'blocker', code: 'x' })).not.toBe(targetKey({ kind: 'hold', id: 'x' }));
  });
});

describe('decideHandoffAction', () => {
  const routed = { state: 'routed' as const, subjectId: 'student-1', officeId: 'bursar' };

  it('lets the owning office acknowledge a routed handoff', () => {
    expect(decideHandoffAction({ kind: 'office', officeId: 'bursar' }, routed, 'acknowledge')).toEqual({
      ok: true,
      state: 'acknowledged',
    });
  });

  it('refuses another office acting on a handoff it does not own', () => {
    expect(decideHandoffAction({ kind: 'office', officeId: 'advising' }, routed, 'acknowledge')).toEqual({
      ok: false,
      reason: 'not_authorized',
    });
    expect(
      decideHandoffAction({ kind: 'office', officeId: 'advising' }, { ...routed, state: 'acknowledged' }, 'resolve'),
    ).toEqual({ ok: false, reason: 'not_authorized' });
  });

  it('refuses a student resolving their own handoff', () => {
    expect(decideHandoffAction(student, { ...routed, state: 'acknowledged' }, 'resolve')).toEqual({
      ok: false,
      reason: 'not_authorized',
    });
  });

  it('lets the student withdraw their own handoff and refuses anyone else doing so', () => {
    expect(decideHandoffAction(student, routed, 'withdraw')).toEqual({ ok: true, state: 'withdrawn' });
    expect(decideHandoffAction({ kind: 'student', subjectId: 'student-2' }, routed, 'withdraw')).toEqual({
      ok: false,
      reason: 'not_authorized',
    });
  });

  it('refuses to resolve straight from routed', () => {
    expect(decideHandoffAction({ kind: 'office', officeId: 'bursar' }, routed, 'resolve')).toEqual({
      ok: false,
      reason: 'illegal_transition',
    });
  });
});

describe('routeFingerprint and classifyRetry', () => {
  const accepted = route();
  if (!accepted.ok) throw new Error('fixture must route');

  it('replays an identical retry', () => {
    expect(classifyRetry(routeFingerprint(accepted), routeFingerprint(accepted))).toBe('replay');
  });

  it('treats a retry against a newer readiness version as a conflict, not a replay', () => {
    const changed = { ...accepted, readinessVersion: 5 };
    expect(classifyRetry(routeFingerprint(accepted), routeFingerprint(changed))).toBe('conflict');
  });

  it('treats a reused key with a different office as a conflict', () => {
    const otherOffice = { ...accepted, officeId: 'bursar' };
    expect(classifyRetry(routeFingerprint(accepted), routeFingerprint(otherOffice))).toBe('conflict');
  });

  it('reports a first request as new', () => {
    expect(classifyRetry(undefined, routeFingerprint(accepted))).toBe('new');
  });
});
