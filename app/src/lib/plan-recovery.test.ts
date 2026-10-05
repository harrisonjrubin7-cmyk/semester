import { describe, expect, it } from 'vitest';
import {
  EVENT_TYPES,
  MAX_OPTIONS,
  OPTIONS_FOR,
  applyEdit,
  choose,
  confirm,
  differences,
  keepCurrent,
  markConfirmed,
  openRecovery,
  type Plan,
  type PlanItem,
  type RecoveryEvent,
} from './plan-recovery';

const NOW = new Date(2026, 9, 1, 9, 0);
const DAY = 86_400_000;
// Words that would blame the student or raise the temperature.
const HARSH = /at risk|fail|behind|overdue|late\b|missed|panic|urgent|emergency|your fault|mistake|should have|warning|danger|critical|careless|forgot/i;

const item = (id: string, over: Partial<PlanItem> = {}): PlanItem => ({
  id,
  kind: 'class',
  title: id,
  day: '2026-10-05',
  startMin: 600,
  endMin: 660,
  source: 'imported',
  sourceAt: NOW.getTime() - 2 * DAY,
  ...over,
});

const plan = (): Plan => ({
  items: [
    item('Chem 101 section B', { kind: 'class' }),
    item('Chem lab', { kind: 'lab', day: '2026-10-06', startMin: 840, endMin: 1020 }),
    item('Café shift', { kind: 'shift', day: '2026-10-08', startMin: 780, endMin: 1020, source: 'student_entered' }),
    item('Chem midterm', { kind: 'exam', day: '2026-10-08', startMin: 840, endMin: 960, source: 'institution_verified' }),
    item('Essay 2', { kind: 'deadline', day: '2026-10-12', startMin: null, endMin: null }),
    item('Advisor check-in', { kind: 'advisor', day: '2026-10-07' }),
    item('Intro to Chem (copy)', { kind: 'calendar' }),
  ],
});

const EVENTS: Record<string, RecoveryEvent> = {
  section_cancelled: { type: 'section_cancelled', itemId: 'Chem 101 section B' },
  lab_time_changed: { type: 'lab_time_changed', itemId: 'Chem lab', newDay: '2026-10-07', newStartMin: 900, newEndMin: 1080 },
  shift_overlaps_exam: { type: 'shift_overlaps_exam', itemId: 'Café shift', otherId: 'Chem midterm' },
  advisor_cancelled: { type: 'advisor_cancelled', itemId: 'Advisor check-in' },
  deadline_moved: { type: 'deadline_moved', itemId: 'Essay 2', newDay: '2026-10-09' },
  deadline_missed: { type: 'deadline_missed', itemId: 'Essay 2' },
  stale_source: { type: 'stale_source', itemId: 'Chem 101 section B' },
  duplicate_calendar: { type: 'duplicate_calendar', itemId: 'Chem 101 section B', otherId: 'Intro to Chem (copy)' },
  course_full: { type: 'course_full', itemId: 'Chem 101 section B' },
};

/** Every string a student could read in a recovery. */
function copyOf(r: ReturnType<typeof openRecovery>): string[] {
  const s = r.steps;
  return [s.acknowledge, ...s.impact, ...s.stillWorks, ...s.options.flatMap((o) => [o.label, o.detail]), s.uncertainty, s.humanRoute.label, s.humanRoute.note, ...differences(r)];
}

describe('the events table', () => {
  it('covers every event type and has a test event for each', () => {
    expect(Object.keys(EVENTS).sort()).toEqual([...EVENT_TYPES].sort());
    expect(Object.keys(OPTIONS_FOR).sort()).toEqual([...EVENT_TYPES].sort());
  });
});

describe.each(EVENT_TYPES)('%s', (type) => {
  const open = () => openRecovery(EVENTS[type], plan(), NOW);

  it('keeps the original plan byte for byte, however it is read', () => {
    const before = JSON.stringify(plan());
    const input = plan();
    const r = open();
    const rr = openRecovery(EVENTS[type], input, NOW);
    for (const o of rr.steps.options) choose(rr, o.id);
    keepCurrent(rr);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(r.scenarioA)).toBe(before);
  });

  it('holds Scenario A apart from the caller’s plan and frozen', () => {
    const input = plan();
    const r = openRecovery(EVENTS[type], input, NOW);
    input.items[0].title = 'edited later';
    expect(r.scenarioA.items[0].title).not.toBe('edited later');
    expect(() => {
      (r.scenarioA.items[0] as PlanItem).title = 'x';
    }).toThrow();
  });

  it('offers three to five options, always keep-current and an official route', () => {
    const ids = open().steps.options.map((o) => o.id);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(ids.length).toBeLessThanOrEqual(MAX_OPTIONS);
    expect(ids).toContain('keep_current');
    expect(ids).toContain('official');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('always names a human or official route', () => {
    const route = open().steps.humanRoute;
    expect(route.label.length).toBeGreaterThan(5);
    expect(route.note.length).toBeGreaterThan(5);
  });

  it('says nothing blaming or alarming', () => {
    for (const line of copyOf(open())) expect(line).not.toMatch(HARSH);
  });

  it('changes nothing until confirm, and confirm needs a choice', () => {
    const r = open();
    expect(r.resolution).toBe('open');
    expect(r.chosen).toBeNull();
    expect(confirm(r)).toBeNull();
  });

  it('keeping the current plan returns no plan to apply', () => {
    const kept = keepCurrent(open());
    expect(kept.resolution).toBe('kept');
    expect(confirm(kept)).toBeNull();
    expect(JSON.stringify(kept.scenarioB)).toBe(JSON.stringify(plan()));
  });

  it('dates the source on the uncertainty line', () => {
    expect(open().steps.uncertainty).toMatch(/Updated .*ago|Updated just now/);
    expect(open().steps.uncertainty).toMatch(/official source/);
  });

  it('lists what still works without the affected items', () => {
    const r = open();
    expect(r.steps.stillWorks).not.toContain(EVENTS[type].itemId);
    expect(r.steps.stillWorks.length).toBe(plan().items.length - (EVENTS[type].otherId ? 2 : 1));
  });
});

describe('confirm', () => {
  it('returns Scenario B for a chosen editing option, and not the original', () => {
    const r = choose(openRecovery(EVENTS.lab_time_changed, plan(), NOW), 'accept_change');
    const next = confirm(r)!;
    const lab = next.items.find((i) => i.id === 'Chem lab')!;
    expect([lab.day, lab.startMin, lab.endMin]).toEqual(['2026-10-07', 900, 1080]);
    expect(next.items).toHaveLength(plan().items.length);
    // The original is still the original.
    expect(r.scenarioA.items.find((i) => i.id === 'Chem lab')!.day).toBe('2026-10-06');
    expect(differences(r)).toEqual(['Changed: Chem lab, Tue, Oct 6 14:00–17:00 to Wed, Oct 7 15:00–18:00']);
  });

  it('returns null for a chosen option that edits nothing', () => {
    const r = choose(openRecovery(EVENTS.lab_time_changed, plan(), NOW), 'ask_instructor');
    expect(confirm(r)).toBeNull();
  });

  it('cannot be used twice or after keeping the plan', () => {
    const r = choose(openRecovery(EVENTS.section_cancelled, plan(), NOW), 'remove_item');
    expect(confirm(r)).not.toBeNull();
    expect(confirm(markConfirmed(r))).toBeNull();
    expect(confirm({ ...keepCurrent(r), chosen: 'remove_item' })).toBeNull();
  });

  it('ignores an option that is not offered', () => {
    const r = openRecovery(EVENTS.stale_source, plan(), NOW);
    expect(choose(r, 'remove_item')).toBe(r);
  });

  it('removes the repeated entry, not the first', () => {
    const next = confirm(choose(openRecovery(EVENTS.duplicate_calendar, plan(), NOW), 'remove_duplicate'))!;
    expect(next.items.map((i) => i.id)).toContain('Chem 101 section B');
    expect(next.items.map((i) => i.id)).not.toContain('Intro to Chem (copy)');
  });

  it('puts an earlier work block no earlier than today', () => {
    const r = choose(openRecovery({ ...EVENTS.deadline_moved, newDay: '2026-10-02' }, plan(), NOW), 'move_work_earlier');
    const block = confirm(r)!.items.find((i) => i.title.startsWith('Work block'))!;
    expect(block.day).toBe('2026-10-01');
    const later = choose(openRecovery(EVENTS.deadline_moved, plan(), NOW), 'move_work_earlier');
    expect(confirm(later)!.items.find((i) => i.title.startsWith('Work block'))!.day).toBe('2026-10-07');
  });
});

describe('Scenario B proposal', () => {
  it('is a proposed edit while the student has chosen nothing', () => {
    const r = openRecovery(EVENTS.section_cancelled, plan(), NOW);
    expect(r.chosen).toBeNull();
    expect(differences(r)).toEqual(['Added: Sort out: Chem 101 section B']);
    expect(r.scenarioB).not.toBe(r.scenarioA);
  });

  it('reads as no difference when no option edits the plan', () => {
    const r = openRecovery(EVENTS.stale_source, plan(), NOW);
    expect(differences(r)).toEqual(['No difference. Your plan stays as it is.']);
  });
});

describe('uncertainty', () => {
  it('says the age is unknown rather than fresh when no time was recorded', () => {
    const p = plan();
    p.items[0].sourceAt = null;
    const r = openRecovery(EVENTS.stale_source, p, NOW);
    expect(r.steps.uncertainty).toMatch(/age unknown/);
    expect(r.steps.uncertainty).not.toMatch(/just now/);
  });

  it('handles an item that is not on the plan', () => {
    const r = openRecovery({ type: 'course_full', itemId: 'nope' }, plan(), NOW);
    expect(r.steps.uncertainty).toMatch(/not in your plan/);
    expect(r.steps.stillWorks).toHaveLength(plan().items.length);
    for (const line of copyOf(r)) expect(line).not.toMatch(HARSH);
  });
});

describe('applyEdit', () => {
  it('does not write to the plan it is given', () => {
    const p = plan();
    const before = JSON.stringify(p);
    applyEdit(p, { op: 'remove', id: 'Essay 2' });
    applyEdit(p, { op: 'update', id: 'Essay 2', patch: { day: null } });
    expect(JSON.stringify(p)).toBe(before);
  });
});
