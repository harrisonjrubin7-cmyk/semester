import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  RULES,
  addAction,
  addMilestone,
  classifyGoal,
  draftPlan,
  editMilestone,
  moveBlock,
  removeAction,
  removeBlock,
  removeMilestone,
  renameGoal,
  setProgressReview,
  toggleAction,
  type GoalPlan,
} from './goal-plan';

const NOW = new Date(2026, 9, 1, 9, 0); // Thursday 1 October 2026
const SHAME = /at risk|fail|behind|overdue|late\b|missed|streak|lazy|should have|falling|deadline pressure/i;

const textOf = (p: GoalPlan): string[] => [
  p.goal,
  ...p.milestones.map((m) => m.title),
  ...p.actions.map((a) => a.title),
  ...p.calendarBlocks.map((b) => b.title),
  ...p.sourceLinks.flatMap((s) => [s.label, s.where]),
  p.humanRoute.label,
  p.humanRoute.note,
];

describe('classifyGoal', () => {
  it.each([
    ['Register for spring classes', 'registration'],
    ['get off the waitlist for Bio 210', 'registration'],
    ['Get an internship for next summer', 'career'],
    ['update my résumé', 'career'],
    ['Find a tutor for calculus', 'support'],
    ['talk to accessibility services about accommodations', 'support'],
    ['Sort out housing for next year', 'practical'],
    ['Make a budget', 'practical'],
    ['Do well on the chem midterm', 'academic'],
    ['finish my essay draft', 'academic'],
    ['Learn Python', 'learning'],
    ['practise speaking Spanish', 'learning'],
  ])('%s -> %s', (goal, expected) => {
    expect(classifyGoal(goal)).toBe(expected);
  });

  it('is deterministic and case-blind', () => {
    expect(classifyGoal('REGISTER FOR CLASSES')).toBe(classifyGoal('register for classes'));
    expect(classifyGoal('learn python')).toBe(classifyGoal('learn python'));
  });

  it('breaks a tie by the rule order, and the more specific purpose wins', () => {
    // one academic hit, one support hit: support comes first in RULES
    expect(classifyGoal('get help with my essay')).toBe('support');
    // two academic hits beat one support hit
    expect(classifyGoal('help me study for the midterm')).toBe('academic');
  });

  it('matches whole words where a stem would catch the wrong one', () => {
    expect(classifyGoal('read the label carefully')).toBeNull();
    expect(classifyGoal('finally relax')).toBeNull();
    expect(classifyGoal('prepare for the final')).toBe('academic');
  });

  it('returns null for what no rule knows, including an empty goal', () => {
    expect(classifyGoal('learn to juggle')).toBe('learning');
    expect(classifyGoal('be happier')).toBeNull();
    expect(classifyGoal('')).toBeNull();
  });

  it('has a rule for every category, once', () => {
    expect(RULES.map((r) => r.category).sort()).toEqual([...CATEGORIES].sort());
  });
});

describe('registration template', () => {
  const plan = () => draftPlan({ goal: 'Register for spring classes', registrationDate: '2026-11-02', now: NOW });

  it('has the five steps in the spec order', () => {
    expect(plan().milestones.map((m) => m.title)).toEqual([
      'Review your open requirements',
      'Create your primary schedule',
      'Save two backups for each course',
      'Prepare your advisor agenda',
      'Complete the official handoff',
    ]);
    expect(plan().kind).toBe('registration');
  });

  it('counts back 21, 14, 10, 7 and 0 days from the registration date', () => {
    expect(plan().milestones.map((m) => m.by)).toEqual(['2026-10-12', '2026-10-19', '2026-10-23', '2026-10-26', '2026-11-02']);
  });

  it('squeezes the dates in proportion, in order and never before today, when time is short', () => {
    const p = draftPlan({ goal: 'register for classes', registrationDate: '2026-10-11', now: NOW });
    expect(p.milestones.map((m) => m.by)).toEqual(['2026-10-01', '2026-10-04', '2026-10-06', '2026-10-08', '2026-10-11']);
    const sameDay = draftPlan({ goal: 'register for classes', registrationDate: '2026-10-01', now: NOW });
    expect(new Set(sameDay.milestones.map((m) => m.by))).toEqual(new Set(['2026-10-01']));
  });

  it('hands off to the official system and says Semester does not register', () => {
    const handoff = plan().actions.filter((a) => a.milestone === 'm5');
    expect(handoff.map((a) => a.title).join(' ')).toMatch(/Semester does not register you/);
  });

  it('proposes a block per working step, not for the handoff', () => {
    const p = plan();
    expect(p.calendarBlocks.map((b) => b.day)).toEqual(['2026-10-12', '2026-10-19', '2026-10-23', '2026-10-26']);
    expect(p.calendarBlocks.every((b) => b.proposal === true && b.minutes > 0)).toBe(true);
  });

  it('routes to the advisor or registrar and cites official sources', () => {
    const p = plan();
    expect(p.humanRoute.need).toBe('registration');
    expect(p.sourceLinks.map((s) => s.label)).toContain('Degree audit');
  });

  it('without a date leaves the dates open instead of making one up', () => {
    const p = draftPlan({ goal: 'register for classes', now: NOW });
    expect(p.milestones.every((m) => m.by === null)).toBe(true);
    expect(p.calendarBlocks).toEqual([]);
    expect(p.milestones).toHaveLength(5);
  });

  it('ignores a registration date already past or not a date', () => {
    for (const registrationDate of ['2026-09-01', 'next week', '2026-02-31']) {
      expect(draftPlan({ goal: 'register for classes', registrationDate, now: NOW }).milestones.every((m) => m.by === null)).toBe(true);
    }
  });
});

describe('other categories', () => {
  it('spreads milestones over the time to the target date', () => {
    const p = draftPlan({ goal: 'Do well on the chem midterm', by: '2026-10-21', now: NOW });
    expect(p.kind).toBe('academic');
    expect(p.target).toBe('2026-10-21');
    expect(p.milestones.map((m) => m.by)).toEqual(['2026-10-05', '2026-10-13', '2026-10-21']);
    expect(p.progressReview).toBe('2026-10-08');
  });

  it('proposes at most six blocks, three days apart, none past the target', () => {
    const p = draftPlan({ goal: 'finish my essay', by: '2026-12-01', now: NOW });
    expect(p.calendarBlocks).toHaveLength(6);
    expect(p.calendarBlocks.map((b) => b.day)).toEqual(['2026-10-02', '2026-10-05', '2026-10-08', '2026-10-11', '2026-10-14', '2026-10-17']);
    const short = draftPlan({ goal: 'finish my essay', by: '2026-10-05', now: NOW });
    expect(short.calendarBlocks.every((b) => b.day <= '2026-10-05')).toBe(true);
    expect(short.progressReview).toBe('2026-10-05');
  });

  it('gives each category a milestone list, an action list and a route', () => {
    for (const goal of ['find an internship', 'find a tutor', 'sort out housing', 'learn python', 'do well on the exam']) {
      const p = draftPlan({ goal, now: NOW });
      expect(p.milestones.length).toBeGreaterThanOrEqual(3);
      expect(p.actions.length).toBeGreaterThanOrEqual(3);
      expect(p.humanRoute.label).toBeTruthy();
      expect(p.calendarBlocks.every((b) => b.proposal === true)).toBe(true);
    }
  });

  it('only points, never stores, for support', () => {
    const p = draftPlan({ goal: 'find a tutor', now: NOW });
    expect(p.humanRoute.need).toBe('wellbeing');
    expect(p.humanRoute.note).toMatch(/only points/);
  });

  it('attaches every action to a milestone that exists', () => {
    const p = draftPlan({ goal: 'do well on the exam', by: '2026-10-21', now: NOW });
    const ids = new Set(p.milestones.map((m) => m.id));
    expect(p.actions.every((a) => a.milestone && ids.has(a.milestone))).toBe(true);
    expect(new Set(p.actions.map((a) => a.id)).size).toBe(p.actions.length);
  });
});

describe('an unrecognised goal', () => {
  it('gets the generic three-milestone scaffold instead of a refusal', () => {
    const p = draftPlan({ goal: 'Be less tired', by: '2026-10-29', now: NOW });
    expect(p.kind).toBe('general');
    expect(p.milestones.map((m) => m.title)).toEqual(['Decide what done looks like', 'Take the first step', 'Check in on how it is going']);
    expect(p.milestones.at(-1)!.by).toBe('2026-10-29');
    expect(p.goal).toBe('Be less tired');
    expect(p.humanRoute.label).toBeTruthy();
  });

  it('copes with an empty or very long goal', () => {
    expect(draftPlan({ goal: '   ', now: NOW }).goal).toBe('My goal');
    expect(draftPlan({ goal: 'x'.repeat(900), now: NOW }).goal).toHaveLength(200);
    expect(draftPlan({ goal: '', now: NOW }).milestones).toHaveLength(3);
  });
});

describe('the student holds the plan', () => {
  const base = () => draftPlan({ goal: 'do well on the exam', by: '2026-10-21', now: NOW });

  it('is deterministic', () => {
    expect(base()).toEqual(base());
  });

  it('carries no locked or required field', () => {
    expect(JSON.stringify(base())).not.toMatch(/locked|required|mandatory/i);
  });

  it('edits without writing to the plan it was given', () => {
    const p = base();
    const before = JSON.stringify(p);
    renameGoal(p, 'x');
    editMilestone(p, 'm1', { title: 'x' });
    removeMilestone(p, 'm1');
    toggleAction(p, 'a1');
    removeBlock(p, 'b1');
    expect(JSON.stringify(p)).toBe(before);
  });

  it('lets every part be renamed, moved, added to and removed', () => {
    let p = renameGoal(base(), '  Pass chem  ');
    expect(p.goal).toBe('Pass chem');
    p = editMilestone(p, 'm1', { title: 'Mine', by: '2026-10-03' });
    expect(p.milestones[0]).toMatchObject({ title: 'Mine', by: '2026-10-03' });
    p = editMilestone(p, 'm1', { by: null });
    expect(p.milestones[0].by).toBeNull();
    p = addMilestone(p, 'Extra', '2026-10-20');
    expect(p.milestones.at(-1)).toEqual({ id: 'm4', title: 'Extra', by: '2026-10-20' });
    p = addAction(p, 'Email TA', 'm4');
    expect(p.actions.at(-1)).toMatchObject({ title: 'Email TA', milestone: 'm4', done: false });
    p = toggleAction(p, p.actions.at(-1)!.id);
    expect(p.actions.at(-1)!.done).toBe(true);
    p = moveBlock(p, 'b1', { day: '2026-10-09', minutes: 120 });
    expect(p.calendarBlocks[0]).toMatchObject({ day: '2026-10-09', minutes: 120, proposal: true });
    p = setProgressReview(p, '2026-10-15');
    expect(p.progressReview).toBe('2026-10-15');
  });

  it('can be emptied entirely', () => {
    let p = base();
    for (const m of p.milestones) p = removeMilestone(p, m.id);
    for (const a of p.actions) p = removeAction(p, a.id);
    for (const b of p.calendarBlocks) p = removeBlock(p, b.id);
    expect([p.milestones, p.actions, p.calendarBlocks]).toEqual([[], [], []]);
  });

  it('keeps an action when its milestone is removed', () => {
    const p = removeMilestone(base(), 'm1');
    const orphans = p.actions.filter((a) => a.milestone === null);
    expect(orphans.length).toBeGreaterThan(0);
    expect(p.actions).toHaveLength(base().actions.length);
  });

  it('ignores a malformed date or length rather than storing it', () => {
    let p = editMilestone(base(), 'm1', { by: 'soon' });
    expect(p.milestones[0].by).toBe(base().milestones[0].by);
    p = moveBlock(p, 'b1', { day: 'tomorrow', minutes: -5 });
    expect(p.calendarBlocks[0]).toEqual(base().calendarBlocks[0]);
    expect(setProgressReview(p, 'later')).toBe(p);
  });

  it('proposes blocks only: nothing in them can be mistaken for an event', () => {
    for (const goal of ['register for classes', 'do well on the exam', 'be happier']) {
      for (const b of draftPlan({ goal, registrationDate: '2026-11-02', by: '2026-10-30', now: NOW }).calendarBlocks) {
        expect(b.proposal).toBe(true);
        expect(Object.keys(b).sort()).toEqual(['day', 'id', 'minutes', 'proposal', 'title']);
      }
    }
  });
});

describe('copy', () => {
  it('uses no blame or alarm words in any plan', () => {
    for (const goal of ['register for classes', 'find an internship', 'find a tutor', 'sort out housing', 'learn python', 'do well on the exam', 'be happier']) {
      for (const line of textOf(draftPlan({ goal, by: '2026-10-29', registrationDate: '2026-11-02', now: NOW }))) {
        expect(line).not.toMatch(SHAME);
      }
    }
  });
});
