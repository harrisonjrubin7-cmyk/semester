import { describe, expect, it } from 'vitest';
import { attendanceOfferings, currentMarks, tally, type Mark } from './client';

const M = (o: Partial<Mark>): Mark => ({ id: 'x', sessionId: 's1', studentId: 'u1', heldOn: '2026-10-01', course: 'ECON 1020', version: 1, status: 'present', method: 'code', note: '', markedAt: '', ...o });

describe('which courses a person takes attendance for or checks in to', () => {
  const grants = [
    { capability: 'attendance:take', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' },
    { capability: 'attendance:attend', scopeKind: 'course', scopeId: 'vu/HIST 2100/2027SP' },
    { capability: 'attendance:attend', scopeKind: 'course', scopeId: 'vu/HIST 2100' },
    { capability: 'attendance:attend', scopeKind: 'course', scopeId: 'other/ECON 1020/2026FA' },
    { capability: 'assignments:submit', scopeKind: 'course', scopeId: 'vu/BUS 1600/2026FA' },
  ];
  it('reads exactly school/CODE/TERM and no other grant', () => {
    expect(attendanceOfferings(grants, 'vu')).toEqual({
      taking: [{ course: 'ECON 1020', term: '2026FA' }],
      attending: [{ course: 'HIST 2100', term: '2027SP' }],
    });
    expect(attendanceOfferings(grants, '')).toEqual({ taking: [], attending: [] });
  });
});

describe('the latest version is the mark', () => {
  const marks = [M({ id: 'a', version: 1, status: 'absent', method: 'close' }), M({ id: 'b', version: 2, status: 'excused', method: 'instructor' }), M({ id: 'c', sessionId: 's2', status: 'late' })];
  it('keeps the highest version per session and student', () => {
    expect(currentMarks(marks).map((m) => m.id).sort()).toEqual(['b', 'c']);
  });
  it('tallies the current marks, not every version', () => {
    expect(tally(marks)).toEqual({ present: 0, late: 1, absent: 0, excused: 1 });
  });
});
