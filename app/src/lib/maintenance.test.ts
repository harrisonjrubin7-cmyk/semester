import { describe, expect, it } from 'vitest';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, pickPersisted, type State } from '../state/shape';
import { union } from './merge';
import { STRATEGY } from './merge';
import { UNDOABLE } from './undo';
import { isCalm } from './today-center';
import { todayActions } from './today-actions';
import {
  AFTER_VISIT,
  EMERGENCY_GUIDANCE,
  LIMITS,
  NEXT,
  STATUSES,
  SUGGESTED_CHECK_BACK,
  checkDraft,
  draftOk,
  followUpAt,
  fromLocalInput,
  likelyDuplicate,
  move,
  needsFollowUp,
  newMaintenance,
  ordered,
  readMaintenance,
  snoozeCheckBack,
  toLocalInput,
  type MaintenanceDraft,
  type MaintenanceRequest,
} from './maintenance';
import { maintenanceActions } from './maintenance-actions';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 12, 9, 0).getTime();

const draft = (patch: Partial<MaintenanceDraft> = {}): MaintenanceDraft => ({
  hall: 'Branscomb',
  room: '214',
  what: 'Sink drains slowly',
  where: 'Bathroom',
  urgency: 'routine',
  channel: 'portal',
  reference: 'WO-1001',
  reportedAt: NOW - HOUR,
  checkBackAt: NOW - HOUR + SUGGESTED_CHECK_BACK.routine,
  checkBackStated: false,
  ...patch,
});

const request = (patch: Partial<MaintenanceRequest> = {}): MaintenanceRequest => ({
  ...newMaintenance('mr1', '2026FA', draft(), NOW - HOUR),
  ...patch,
});

const state = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral() });

describe('checkDraft', () => {
  it('accepts a complete draft', () => {
    expect(draftOk(checkDraft(draft(), NOW))).toBe(true);
  });

  it('names every missing or bad field at once', () => {
    const errors = checkDraft(draft({ hall: ' ', what: '', reportedAt: NOW + DAY, checkBackAt: NaN }), NOW);
    expect(errors.hall).not.toBe('');
    expect(errors.what).not.toBe('');
    expect(errors.reportedAt).toMatch(/future/);
    expect(errors.checkBackAt).not.toBe('');
  });

  it('refuses a check-back before the report, and text over its limit', () => {
    const errors = checkDraft(
      draft({ checkBackAt: NOW - 2 * HOUR, what: 'x'.repeat(LIMITS.what + 1), reference: 'r'.repeat(LIMITS.reference + 1) }),
      NOW,
    );
    expect(errors.checkBackAt).toMatch(/after/);
    expect(errors.what).toMatch(String(LIMITS.what));
    expect(errors.reference).not.toBe('');
  });

  it('allows a few minutes of clock disagreement on "reported"', () => {
    expect(checkDraft(draft({ reportedAt: NOW + 60_000 }), NOW).reportedAt).toBe('');
  });
});

describe('move', () => {
  it('follows the allowed graph and refuses everything else', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const r = request({ status: from, scheduledFor: NOW });
        const result = move(r, { to, at: NOW, scheduledFor: NOW + DAY });
        expect(result.ok).toBe(NEXT[from].includes(to));
      }
    }
  });

  it('needs a visit time to schedule', () => {
    const result = move(request(), { to: 'scheduled', at: NOW });
    expect(result.ok).toBe(false);
  });

  it('records history, stamps updated past the last stamp, and clears the visit when re-reported', () => {
    const scheduled = move(request(), { to: 'scheduled', at: NOW, scheduledFor: NOW + DAY });
    if (!scheduled.ok) throw new Error('expected scheduled');
    expect(scheduled.request.history.map((h) => h.to)).toEqual(['reported', 'scheduled']);
    expect(scheduled.request.updated).toBeGreaterThan(request().updated);

    const again = move(scheduled.request, { to: 'reported', at: NOW + HOUR, reference: 'WO-2002' });
    if (!again.ok) throw new Error('expected reported');
    expect(again.request.scheduledFor).toBeNull();
    expect(again.request.reference).toBe('WO-2002');
    // Reopened: a fresh suggested check-back, and not housing's.
    expect(again.request.checkBackAt).toBe(NOW + HOUR + SUGGESTED_CHECK_BACK.routine);
    expect(again.request.checkBackStated).toBe(false);
  });

  it('keeps history bounded', () => {
    let r = request();
    for (let i = 0; i < 40; i++) {
      const to = r.status === 'fixed' ? 'not_fixed' : 'fixed';
      const next = move(r, { to, at: NOW + i });
      if (!next.ok) throw new Error(next.why);
      r = next.request;
    }
    expect(r.history.length).toBe(LIMITS.history);
  });
});

describe('follow-ups', () => {
  it('is due at the check-back, a day after a visit, and at once when still not fixed', () => {
    const waiting = request();
    expect(followUpAt(waiting)).toBe(waiting.checkBackAt);
    expect(needsFollowUp(waiting, waiting.checkBackAt - 1)).toBe(false);
    expect(needsFollowUp(waiting, waiting.checkBackAt)).toBe(true);

    const visit = request({ status: 'scheduled', scheduledFor: NOW });
    expect(followUpAt(visit)).toBe(NOW + AFTER_VISIT);

    const broken = request({ status: 'not_fixed', updated: NOW });
    expect(needsFollowUp(broken, NOW)).toBe(true);

    expect(followUpAt(request({ status: 'fixed' }))).toBe(Number.POSITIVE_INFINITY);
  });

  it('snoozing moves the check-back later and never earlier, and not on a closed request', () => {
    const r = request();
    expect(snoozeCheckBack(r, NOW - 1, NOW)).toBeNull();
    expect(snoozeCheckBack(request({ status: 'fixed' }), NOW + DAY, NOW)).toBeNull();
    expect(snoozeCheckBack(r, NOW + DAY, NOW)?.checkBackAt).toBe(NOW + DAY);
  });

  it('orders open requests by who to chase first, then closed ones', () => {
    const a = request({ id: 'a', checkBackAt: NOW + 2 * DAY });
    const b = request({ id: 'b', checkBackAt: NOW + DAY });
    const done = request({ id: 'c', status: 'fixed', updated: NOW });
    expect(ordered([done, a, b]).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('maintenanceActions', () => {
  it('proposes nothing before the check-back time', () => {
    const r = request();
    expect(maintenanceActions([r], r.checkBackAt - 1)).toEqual([]);
  });

  it('proposes one calm, sourced follow-up per due request', () => {
    const r = request({ urgency: 'urgent' });
    const [action] = maintenanceActions([r], r.checkBackAt + 1);
    expect(action.id).toBe(`maintenance:mr1:reported:${r.checkBackAt}`);
    expect(action.priority).toBe('high');
    expect(action.source.label).toBe('student_entered');
    expect(action.primary).toMatchObject({ kind: 'navigate', requiresConfirmation: false });
    expect(action.primary.target).toContain('housing');
    // It never claims to have contacted anyone, and never calls the student behind.
    expect(action.explanation.limitations.join(' ')).toMatch(/does not contact housing/);
    for (const text of [action.title, action.whyItMatters, action.explanation.trigger]) expect(isCalm(text)).toBe(true);
  });

  it('says whose time it was', () => {
    const mine = maintenanceActions([request()], NOW + 10 * DAY)[0];
    const theirs = maintenanceActions([request({ checkBackStated: true })], NOW + 10 * DAY)[0];
    expect(mine.explanation.trigger).toMatch(/you chose/);
    expect(theirs.explanation.trigger).toMatch(/housing gave/);
  });

  it('carries the emergency guidance on an emergency request', () => {
    const [action] = maintenanceActions([request({ urgency: 'emergency' })], NOW + 10 * DAY);
    expect(action.explanation.limitations).toContain(EMERGENCY_GUIDANCE);
  });

  it('gives a new id after the student changes the follow-up, so a dismissal does not hide the next one', () => {
    const r = request();
    const first = maintenanceActions([r], NOW + 10 * DAY)[0].id;
    const later = snoozeCheckBack(r, NOW + 5 * DAY, NOW)!;
    const second = maintenanceActions([later], NOW + 10 * DAY)[0].id;
    expect(second).not.toBe(first);
  });

  it('reaches the Action Center through todayActions only when given', () => {
    const base = { path: { state: 'moving', unresolved: 0, firstUnresolved: null, source: '' }, upcoming: [], done: {}, reviewDue: 0, catalogEmpty: false } as unknown as Parameters<typeof todayActions>[0];
    expect(todayActions(base).some((a) => a.type === 'housing')).toBe(false);
    const withRepairs = todayActions({ ...base, maintenance: { requests: [request()], now: NOW + 10 * DAY } });
    expect(withRepairs.filter((a) => a.type === 'housing')).toHaveLength(1);
  });
});

describe('likelyDuplicate', () => {
  it('matches the same reference, or the same words in the same room within a week', () => {
    const existing = request();
    expect(likelyDuplicate([existing], draft({ what: 'Different', reference: 'wo-1001 ' }))?.id).toBe('mr1');
    expect(likelyDuplicate([existing], draft({ reference: '' }))?.id).toBe('mr1');
    expect(likelyDuplicate([existing], draft({ reference: '', reportedAt: NOW + 9 * DAY }))).toBeNull();
    expect(likelyDuplicate([existing], draft({ reference: '', room: '215' }))).toBeNull();
  });

  it('ignores closed requests: the sink can break twice', () => {
    expect(likelyDuplicate([request({ status: 'fixed' })], draft())).toBeNull();
  });
});

describe('readMaintenance', () => {
  it('round-trips a real request', () => {
    const r = request();
    expect(readMaintenance(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it('drops rows without an id, a building or a description', () => {
    expect(readMaintenance(null)).toBeNull();
    expect(readMaintenance({ ...request(), id: '' })).toBeNull();
    expect(readMaintenance({ ...request(), hall: '  ' })).toBeNull();
    expect(readMaintenance({ ...request(), what: 7 })).toBeNull();
  });

  it('falls back on unknown enums and clips text', () => {
    const read = readMaintenance({ ...request(), urgency: 'apocalyptic', channel: 'owl', status: 'teleported', what: 'y'.repeat(900), history: [{ at: 'x' }] });
    expect(read).toMatchObject({ urgency: 'routine', channel: 'other', status: 'reported', history: [] });
    expect(read?.what.length).toBe(LIMITS.what);
  });

  it('demotes a "scheduled" row that lost its visit time', () => {
    expect(readMaintenance({ ...request(), status: 'scheduled', scheduledFor: null })?.status).toBe('reported');
  });
});

describe('datetime-local helpers', () => {
  it('round-trips a minute', () => {
    expect(fromLocalInput(toLocalInput(NOW))).toBe(NOW);
  });

  it('refuses a date that does not exist and an empty box', () => {
    expect(Number.isNaN(fromLocalInput('2026-02-31T10:00'))).toBe(true);
    expect(Number.isNaN(fromLocalInput(''))).toBe(true);
  });
});

describe('in the store', () => {
  it('adds once per id, so a double tap records one request', () => {
    const r = request();
    const once = reducer(state(), { type: 'addMaintenance', request: r });
    const twice = reducer(once, { type: 'addMaintenance', request: r });
    expect(twice.maintenance).toHaveLength(1);
    expect(twice).toBe(once);
  });

  it('applies an allowed move and ignores a refused one', () => {
    const s = reducer(state(), { type: 'addMaintenance', request: request() });
    const refused = reducer(s, { type: 'moveMaintenance', id: 'mr1', change: { to: 'not_fixed', at: NOW } });
    expect(refused).toBe(s);
    const fixed = reducer(s, { type: 'moveMaintenance', id: 'mr1', change: { to: 'fixed', at: NOW } });
    expect(fixed.maintenance[0].status).toBe('fixed');
  });

  it('removes with an undo that brings it back', () => {
    const s = reducer(state(), { type: 'addMaintenance', request: request() });
    const gone = reducer(s, { type: 'dropMaintenance', id: 'mr1' });
    expect(gone.maintenance).toEqual([]);
    expect(UNDOABLE.dropMaintenance).toBeDefined();
    expect(reducer(gone, { type: 'undo' }).maintenance).toHaveLength(1);
  });

  it('is persisted, synced newest-first and survives a reload', () => {
    const s = reducer(state(), { type: 'addMaintenance', request: request() });
    expect(pickPersisted(s).maintenance).toHaveLength(1);
    expect(STRATEGY.maintenance).toBe('union');

    const older = request({ updated: NOW });
    const newer = request({ status: 'fixed', updated: NOW + 1 });
    expect((union([newer], [older]) as MaintenanceRequest[])[0].status).toBe('fixed');
    expect((union([older], [newer]) as MaintenanceRequest[])[0].status).toBe('fixed');
  });
});
