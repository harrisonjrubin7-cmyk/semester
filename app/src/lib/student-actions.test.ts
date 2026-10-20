import { describe, expect, it } from 'vitest';
import type { Choice } from './actions';
import { fromHash } from './route';
import { UNCALM } from './today-center';
import { readStudentAction, readStudentActions, studentActionToAction, withServerState, type StudentAction } from './student-actions';

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'grade_released',
  item_id: '22222222-2222-4222-8222-222222222222',
  grade_entry_id: '33333333-3333-4333-8333-333333333333',
  course_code: 'ECON 1020',
  term: '2026FA',
  item_title: 'Problem set 1',
  state: 'open',
  version: 1,
  released_at: '2026-10-20T15:00:00Z',
  updated_at: '2026-10-20T15:00:00Z',
};

const choice = (status: Choice['status']): Choice => ({ status, snoozedUntil: null, history: [] });

describe('reading a released-feedback row', () => {
  it('reads a complete row', () => {
    expect(readStudentAction(ROW)).toEqual({
      id: ROW.id, itemId: ROW.item_id, gradeEntryId: ROW.grade_entry_id, courseCode: 'ECON 1020', term: '2026FA',
      itemTitle: 'Problem set 1', state: 'open', version: 1, releasedAt: Date.parse(ROW.released_at),
    });
  });

  it('refuses a row missing anything the student is owed, or in a state the feed never sends', () => {
    // The control is the row above being read; each of these differs from it in one field.
    for (const bad of [
      { kind: 'office' }, { id: '' }, { item_id: null }, { grade_entry_id: '' }, { course_code: '' }, { item_title: '  ' },
      { state: 'done' }, { state: 'deleted' }, { version: 0 }, { version: 1.5 }, { version: '1' }, { released_at: 'soon' },
    ]) {
      expect(readStudentAction({ ...ROW, ...bad }), JSON.stringify(bad)).toBeNull();
    }
    expect(readStudentActions([ROW, { ...ROW, state: 'done' }, null, 'x'])).toHaveLength(1);
    expect(readStudentActions(null)).toEqual([]);
  });
});

describe('a released grade as an Action Center action', () => {
  const a = readStudentAction(ROW)!;
  const action = studentActionToAction(a);

  it('has a stable id per row and opens the gradebook in the app', () => {
    expect(action.id).toBe(`feedback:${ROW.id}`);
    expect(studentActionToAction(a).id).toBe(action.id);
    expect(action.primary.kind).toBe('navigate');
    expect(fromHash(action.primary.target)?.screen).toBe('gradebook');
  });

  it('says what was released and by whom, institution verified, calmly', () => {
    expect(action.title).toBe('Feedback released: Problem set 1');
    expect(action.source.label).toBe('institution_verified');
    expect(action.source.at).toBe(a.releasedAt);
    expect(UNCALM.test(`${action.title} ${action.whyItMatters} ${action.explanation.limitations.join(' ')}`)).toBe(false);
    expect(action.dueAt).toBeNull();
  });
});

describe("the server's state over the device's choices", () => {
  const open: StudentAction = readStudentAction(ROW)!;
  const dismissed: StudentAction = { ...open, id: 'd', state: 'dismissed' };

  it('reads a dismissed row as dismissed on a device that never dismissed it', () => {
    expect(withServerState({}, [dismissed])['feedback:d']?.status).toBe('dismissed');
  });

  it('does not let an old local done or dismissal hide a row the server holds open', () => {
    const local = { [`feedback:${open.id}`]: choice('dismissed') };
    expect(withServerState(local, [open])[`feedback:${open.id}`]).toBeUndefined();
    expect(withServerState({ [`feedback:${open.id}`]: choice('completed') }, [open])[`feedback:${open.id}`]).toBeUndefined();
  });

  it("keeps a snooze on an open row, and every other action's choice, untouched", () => {
    const local = { [`feedback:${open.id}`]: choice('snoozed'), 'office:1': choice('dismissed') };
    expect(withServerState(local, [open])).toEqual(local);
    expect(withServerState(local, null)).toBe(local);
  });
});
