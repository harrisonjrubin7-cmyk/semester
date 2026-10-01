import { describe, expect, it } from 'vitest';
import {
  clash, examConflicts, parsePattern, parseSections, patternWords, proposalConflicts, sectionKey, solveExams, solveTimetable,
  type Pattern, type RoomInput, type SectionInput,
} from './solver';

const MWF9: Pattern = { days: [1, 3, 5], start: 540, end: 590 };
const MWF10: Pattern = { days: [1, 3, 5], start: 600, end: 650 };
const TR9: Pattern = { days: [2, 4], start: 540, end: 615 };
const S = (course: string, section: string, enrolment: number, instructor: string, needs: string[], patterns: Pattern[]): SectionInput => ({ course, section, enrolment, instructor, needs, patterns });
const ROOMS: RoomInput[] = [
  { code: 'LAB-1', capacity: 24, features: [], bookable: true },
  { code: 'HALL-101', capacity: 45, features: ['projector'], bookable: true },
  { code: 'GREAT-HALL', capacity: 200, features: ['projector'], bookable: true },
  { code: 'STORE-1', capacity: 5, features: [], bookable: false },
];

describe('patterns overlap only on a shared day and time', () => {
  it('needs both', () => {
    expect(clash(MWF9, MWF9)).toBe(true);
    expect(clash(MWF9, MWF10)).toBe(false);
    expect(clash(MWF9, TR9)).toBe(false);
    expect(clash({ days: [1], start: 540, end: 600 }, { days: [1], start: 570, end: 630 })).toBe(true);
    expect(clash({ days: [1], start: 540, end: 600 }, { days: [1], start: 600, end: 660 })).toBe(false);
  });
});

describe('the timetable solver', () => {
  const sections = [
    S('ECON 1010', '01', 30, 'Dr Rao', [], [MWF9, MWF10]),
    S('ECON 1020', '01', 28, 'Dr Rao', ['projector'], [MWF9, MWF10]),
    S('HIST 2100', '01', 90, 'Dr Kim', [], [MWF9]),
    S('MATH 1010', '01', 20, 'Dr Lee', [], [MWF9]),
  ];
  const result = solveTimetable(sections, ROOMS);

  it('places every section it can, in the smallest room that fits', () => {
    expect(result.unplaced).toEqual([]);
    expect(result.assignments.find((a) => sectionKey(a) === 'MATH 1010 01')?.room).toBe('LAB-1');
    expect(result.assignments.find((a) => sectionKey(a) === 'HIST 2100 01')?.room).toBe('GREAT-HALL');
  });
  it('never puts one instructor or one room in two places', () => {
    expect(proposalConflicts(sections, ROOMS, result.assignments)).toEqual([]);
    const rao = result.assignments.filter((a) => a.course === 'ECON 1010' || a.course === 'ECON 1020');
    expect(clash(rao[0].meeting, rao[1].meeting)).toBe(false);
  });
  it('is deterministic for a seed', () => {
    expect(solveTimetable(sections, ROOMS, [], 7)).toEqual(solveTimetable(sections, ROOMS, [], 7));
    expect(proposalConflicts(sections, ROOMS, solveTimetable(sections, ROOMS, [], 99).assignments)).toEqual([]);
  });
  it('never uses a room that cannot be booked', () => {
    const tiny = solveTimetable([S('ART 1000', '01', 4, 'Dr Fox', [], [MWF9])], ROOMS);
    expect(tiny.assignments[0].room).not.toBe('STORE-1');
  });
  it('says why a section cannot be placed instead of forcing it', () => {
    const big = solveTimetable([S('BIG 9999', '01', 500, 'Dr X', [], [MWF9]), S('LAB 1000', '01', 10, 'Dr Y', ['fume-hood'], [MWF9])], ROOMS);
    expect(big.assignments).toEqual([]);
    expect(big.unplaced.map((u) => u.reason)).toEqual(['no bookable room holds 500 with no special need', 'no bookable room holds 10 with fume-hood']);
  });
  it('leaves a section unplaced when its one pattern is taken by the same instructor', () => {
    const r = solveTimetable([S('ECON 2000', '01', 10, 'Dr Same', [], [MWF9]), S('ECON 2001', '01', 10, 'Dr Same', [], [MWF9])], ROOMS);
    expect(r.assignments).toHaveLength(1);
    expect(r.unplaced).toHaveLength(1);
    expect(r.unplaced[0].reason).toContain('Dr Same teaches');
  });
  it('uses a second pattern so two sections can share one room', () => {
    const rooms: RoomInput[] = [{ code: 'ONLY', capacity: 40, features: [], bookable: true }];
    const two = [S('ECON 3000', '01', 30, 'A', [], [MWF9, MWF10]), S('ECON 3001', '01', 30, 'B', [], [MWF9])];
    const r = solveTimetable(two, rooms);
    expect(r.unplaced).toEqual([]);
    expect(proposalConflicts(two, rooms, r.assignments)).toEqual([]);
    expect(r.assignments.find((a) => a.course === 'ECON 3001')?.meeting).toEqual(MWF9);
  });
  it('keeps students who share two sections out of one hour where it can', () => {
    const two = [S('ECON 4000', '01', 20, 'A', [], [MWF9, MWF10]), S('ECON 4001', '01', 20, 'B', [], [MWF9, MWF10])];
    const r = solveTimetable(two, ROOMS, [{ a: 'ECON 4000 01', b: 'ECON 4001 01', count: 18 }]);
    expect(r.softClashes).toEqual([]);
    expect(clash(r.assignments[0].meeting, r.assignments[1].meeting)).toBe(false);
  });
});

describe('the verifier finds what the database finds', () => {
  const sections = [S('ECON 1010', '01', 50, 'Dr Rao', ['lab'], [MWF9]), S('ECON 1020', '01', 20, 'Dr Rao', [], [MWF9])];
  it('names each fault, and passes a clean proposal (a control)', () => {
    const bad = proposalConflicts(sections, ROOMS, [
      { course: 'ECON 1010', section: '01', room: 'LAB-1', meeting: MWF9 },
      { course: 'ECON 1020', section: '01', room: 'LAB-1', meeting: MWF9 },
      { course: 'ZZZ 9999', section: '01', room: 'LAB-1', meeting: TR9 },
      { course: 'ECON 1010', section: '01', room: 'STORE-1', meeting: { days: [9], start: 0, end: 5 } },
    ]);
    expect(bad.map((c) => c.kind).sort()).toEqual(['instructor_twice', 'missing_feature', 'pattern', 'room_twice', 'too_small', 'unknown_section']);
    expect(proposalConflicts(sections, ROOMS, [{ course: 'ECON 1020', section: '01', room: 'LAB-1', meeting: MWF9 }])).toEqual([]);
    expect(proposalConflicts(sections, ROOMS, [{ course: 'ECON 1020', section: '01', room: 'STORE-1', meeting: MWF9 }]).map((c) => c.kind)).toEqual(['room_unavailable']);
  });
});

describe('the exam schedule', () => {
  const exams = [
    { course: 'ECON 1010', section: '01', enrolment: 30, needs: [] },
    { course: 'ECON 1020', section: '01', enrolment: 28, needs: [] },
    { course: 'HIST 2100', section: '01', enrolment: 90, needs: [] },
  ];
  const slots = [{ id: 'd1am', label: 'Day 1 morning' }, { id: 'd1pm', label: 'Day 1 afternoon' }];
  it('never seats a shared student in two exams at once, and fills slots in order', () => {
    const shared = [{ a: 'ECON 1010 01', b: 'ECON 1020 01', count: 12 }];
    const r = solveExams(exams, slots, ROOMS, shared);
    expect(r.unplaced).toEqual([]);
    const a = r.assignments.find((x) => x.course === 'ECON 1010')!;
    const b = r.assignments.find((x) => x.course === 'ECON 1020')!;
    expect(a.slot).not.toBe(b.slot);
    expect(examConflicts(exams, ROOMS, r.assignments, shared)).toEqual([]);
  });
  it('says what it could not place, and the checker catches a hand-made clash (a control)', () => {
    const one = solveExams(exams, [slots[0]], [ROOMS[1]], [{ a: 'ECON 1010 01', b: 'ECON 1020 01', count: 5 }]);
    expect(one.unplaced.length).toBeGreaterThan(0);
    const clashing = examConflicts(exams, ROOMS, [
      { course: 'ECON 1010', section: '01', slot: 'd1am', room: 'HALL-101' }, { course: 'ECON 1020', section: '01', slot: 'd1am', room: 'HALL-101' },
    ], [{ a: 'ECON 1010 01', b: 'ECON 1020 01', count: 5 }]);
    expect(clashing.map((c) => c.kind).sort()).toEqual(['room_twice', 'student_twice']);
  });
});

describe('typing patterns and sections', () => {
  it('reads patterns and prints them back', () => {
    expect(parsePattern('MWF 09:00-09:50')).toEqual(MWF9);
    expect(parsePattern('TR 9:00-10:15')).toEqual(TR9);
    expect(patternWords(MWF9)).toBe('MWF 09:00-09:50');
    for (const bad of ['', 'XYZ 9:00-10:00', 'MWF 10:00-09:00', 'MWF 9:61-10:00', 'MWF 9-10']) expect(parsePattern(bad), bad).toBeNull();
  });
  it('reads a section line and says the first bad one by number', () => {
    expect(parseSections('ECON 1010 | 01 | 30 | Dr Rao | projector, Whiteboard | MWF 09:00-09:50, TR 09:00-10:15')).toEqual({
      sections: [{ course: 'ECON 1010', section: '01', enrolment: 30, instructor: 'Dr Rao', needs: ['projector', 'whiteboard'], patterns: [MWF9, TR9] }],
    });
    expect(parseSections('')).toEqual({ error: 'Add at least one section.' });
    expect(parseSections('ECON 1010 | 01 | 30')).toHaveProperty('error', expect.stringContaining('Line 1'));
    expect(parseSections('ECON 1010 | 01 | many | A | | MWF 09:00-09:50')).toEqual({ error: 'Line 1: enrolment is a whole number.' });
    expect(parseSections('ECON 1010 | 01 | 3 | A | | whenever')).toEqual({ error: 'Line 1: “whenever” is not a pattern like MWF 09:00-09:50.' });
    expect(parseSections('ECON 1010 | 01 | 3 | A | | MWF 09:00-09:50\nECON 1010 | 01 | 3 | B | | TR 09:00-10:15')).toEqual({ error: 'Each course and section appears once.' });
  });
});
