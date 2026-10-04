import { describe, expect, it } from 'vitest';
import { diffToday, domainSide, legacyDay, type Side } from './shadow';
import type { TodayView } from '../domains/today';

const side = (ranked: string[], day: string[] = []): Side => ({ ranked, day });
const view = (over: Partial<TodayView> = {}): TodayView => ({ on: '2026-10-08', schedule: [], conflicts: [], overdue: [], dueToday: [], mostImportant: null, next: [], unavailable: [], quiet: true, ...over });
const entry = (id: string, kind: 'appointment' | 'deadline' | 'class') => ({ id, title: id, kind, on: '2026-10-08', startMin: null, durationMin: 0, provenance: 'student_entered' as const, done: false });

describe('the shadow comparison', () => {
  it('finds nothing when the two agree', () => {
    const d = diffToday(side(['a', 'b', 'c'], ['task:1', 'course:9']), side(['a', 'b', 'c'], ['task:1', 'course:9']));
    expect(d.unexplained).toEqual([]);
    expect(d.explained).toEqual([]);
  });

  it('explains a missing source, and says which', () => {
    const d = diffToday(side(['a', 'b', 'c', 'd']), side(['regday:cart', 'office:7', 'a', 'b'], ['class:x']));
    expect(d.unexplained).toEqual([]);
    const said = d.explained.join('\n');
    for (const reason of [/registration-day/, /campus office/, /class meetings/]) expect(said).toMatch(reason);
    expect(d.explained).toHaveLength(3);
  });

  it('lets the domain’s tail show where the legacy list was cut by explained entries — and no further', () => {
    // Legacy list was [regday, a, b, c] (cut at four); domain [a, b, c, d]: d is the one the cut hid.
    expect(diffToday(side(['a', 'b', 'c', 'd']), side(['regday:x', 'a', 'b', 'c'])).unexplained).toEqual([]);
    // Two extras where only one entry was hidden: one of them is a real disagreement.
    expect(diffToday(side(['a', 'b', 'c', 'd', 'e']), side(['regday:x', 'a', 'b', 'c'])).unexplained).toEqual(['ranking, domain only: e']);
  });

  it('flags an item the domain ranks that the legacy ranker does not, and a reordering', () => {
    expect(diffToday(side(['a', 'z', 'c']), side(['a', 'b', 'c'])).unexplained.join('\n')).toMatch(/domain only: z/);
    const swapped = diffToday(side(['b', 'a', 'c']), side(['a', 'b', 'c']));
    expect(swapped.ranking.reordered).toBe(true);
    expect(swapped.unexplained.join('\n')).toMatch(/ranking order/);
  });

  it('flags a day row on one side only: a deadline legacy shows and domain lacks, and the other way', () => {
    expect(diffToday(side([], []), side([], ['course:5'])).unexplained).toEqual(['day, legacy only: course:5']);
    expect(diffToday(side([], ['task:2']), side([], [])).unexplained).toEqual(['day, domain only: task:2']);
  });

  it('puts both sides in one vocabulary: appointments lose their day, deadlines become course rows', () => {
    const v = view({
      schedule: [entry('appointment:lab@2026-10-08', 'appointment'), entry('deadline:e1', 'deadline')],
      dueToday: [{ id: 't1', title: 't', dueOn: '2026-10-08', done: false, rollsTo: null }],
    });
    expect(domainSide(v, []).day).toEqual(['appointment:lab', 'course:e1', 'task:t1']);
    expect(legacyDay([{ id: 'appointment:lab:2026-10-08' }, { id: 'course:e1' }, { id: 'task:t1' }])).toEqual(['appointment:lab', 'course:e1', 'task:t1']);
  });
});
