import { describe, expect, it } from 'vitest';
import {
  CHALLENGES, CHALLENGE_RULES, CONTRIBUTION_SIGNALS, EMPLOYER_OPT_IN_DAYS, FORBIDDEN_SUGGESTION_INPUTS, HUB_HOMES, HUB_SECTIONS, INSTEAD,
  MENTOR_FLOW, MENTOR_NEVER_SEES, NOT_A_MEASURE, QUESTIONS, ROLLOUT, ROLLOUT_LAST, ROOM_MAX_DAYS, ROOM_PARTS, ROOM_PURPOSES, SHOWCASE_VISIBILITY,
  SUGGESTION_INPUTS, VISIBILITY_MEANS, explainSuggestion, hide, hubRows, milestoneLine, newShowcaseItem, openRoom, publish,
  publishedWithoutChoice, recognise, shown, visibleAs, type RoomSpec,
} from './connect';
import { FORBIDDEN_MECHANICS, NON_GOALS } from './governance';
import { DESTINATIONS, screenName } from '../lib/nav';
import { ROOTS } from '../state/shape';

const at = new Date('2026-09-29T12:00:00Z');
const days = (n: number) => new Date(at.getTime() + n * 86_400_000).toISOString();

describe('where the hub appears', () => {
  it('is inside screens that exist, and is no root of its own', () => {
    for (const s of HUB_HOMES) expect(screenName(s), s).not.toBe(s);
    expect(DESTINATIONS.some((d) => /connect hub/i.test(d.label))).toBe(false);
    expect(ROOTS.some((r) => /connect|hub|social/.test(r))).toBe(false);
  });

  it('answers each of the five questions from at least one section that has a screen', () => {
    const rows = hubRows();
    for (let q = 0; q < QUESTIONS.length; q++) expect(rows.some((r) => r.answers === q), QUESTIONS[q]).toBe(true);
  });

  it('draws only sections with somewhere to go, and every section without one says why', () => {
    for (const r of hubRows()) expect(screenName(r.screen), r.id).not.toBe(r.screen);
    for (const s of HUB_SECTIONS) {
      if (s.screen === null) expect(s.gap.length, s.id).toBeGreaterThan(20);
      else expect(s.gap, s.id).toBe('');
      expect(s.sub, s.id).toMatch(/^[A-Z]/);
    }
    expect(new Set(HUB_SECTIONS.map((s) => s.id)).size).toBe(HUB_SECTIONS.length);
  });

  it('builds instead of a feed, and the non-goals agree', () => {
    expect(INSTEAD.map((i) => i.avoid).join(' ')).toMatch(/feed/i);
    expect(INSTEAD.map((i) => i.avoid).join(' ')).toMatch(/risk scoring/i);
    expect(NON_GOALS.join(' ')).toMatch(/surveillance/i);
  });
});

describe('why a suggestion appeared', () => {
  it('says so from what the student chose, in one sentence', () => {
    const e = explainSuggestion([
      { kind: 'career_interest', value: 'Data Analytics' },
      { kind: 'enrolled_course', value: 'STAT 201' },
      { kind: 'opted_in', value: 'related campus opportunities' },
    ]);
    expect(e.reason).toBe('Recommended because you saved “Data Analytics” as a career interest, you are enrolled in STAT 201 and you opted into related campus opportunities.');
    expect(e.inputs).toHaveLength(3);
    expect(e.limits).toMatch(/grades/);
    expect(explainSuggestion([{ kind: 'interest', value: 'Chess' }]).reason).toBe('Recommended because you saved “Chess” as an interest.');
  });

  it('refuses every forbidden input by key, an unknown one, and none at all', () => {
    for (const k of FORBIDDEN_SUGGESTION_INPUTS) {
      expect(k in SUGGESTION_INPUTS, k).toBe(false);
      expect(() => explainSuggestion([{ kind: k, value: 'x' }]), k).toThrow(/may not explain/);
    }
    expect(() => explainSuggestion([{ kind: 'zodiac', value: 'x' }])).toThrow(/may not explain/);
    expect(() => explainSuggestion([])).toThrow(/at least one reason/);
  });
});

describe('the showcase', () => {
  const item = newShowcaseItem('p1', 'Poster', 'Research poster');

  it('starts private, and nobody has chosen otherwise', () => {
    expect(item.visibility).toBe('private');
    expect(item.chosenBy).toBeNull();
    expect(SHOWCASE_VISIBILITY[0]).toBe('private');
    for (const v of SHOWCASE_VISIBILITY) expect(VISIBILITY_MEANS[v].length).toBeGreaterThan(5);
  });

  it('is published only by the student', () => {
    expect(publish(item, 'campus', 'student', at).visibility).toBe('campus');
    for (const by of ['advisor', 'institution', 'system'] as const) expect(() => publish(item, 'campus', by, at), by).toThrow(/Only the student/);
  });

  it('reaches employers only while a talent profile is on, for 180 days at most', () => {
    expect(() => publish(item, 'employers', 'student', at)).toThrow(/talent profile/);
    expect(() => publish(item, 'employers', 'student', at, days(-1))).toThrow(/talent profile/);
    expect(() => publish(item, 'employers', 'student', at, days(EMPLOYER_OPT_IN_DAYS + 1))).toThrow(/180 days at most/);
    const shownTo = publish(item, 'employers', 'student', at, days(30));
    expect(visibleAs(shownTo, at)).toBe('employers');
  });

  it('becomes private when the opt-in expires, never a wider audience nobody chose', () => {
    const shownTo = publish(item, 'employers', 'student', at, days(30));
    expect(visibleAs(shownTo, new Date(days(31)))).toBe('private');
    expect(visibleAs({ ...shownTo, talentOptInUntil: undefined }, at)).toBe('private');
  });

  it('refuses an opt-in date that does not parse, and never treats one as unexpired', () => {
    for (const bad of ['not a date', '', '2026-13-45']) {
      expect(() => publish(item, 'employers', 'student', at, bad), bad).toThrow(/talent profile/);
    }
    expect(visibleAs({ ...item, visibility: 'employers', chosenBy: 'student', talentOptInUntil: 'not a date' }, at)).toBe('private');
  });

  it('never publishes without a choice', () => {
    const planted = { ...item, visibility: 'public' as const };
    expect(publishedWithoutChoice([item, planted, publish(item, 'public', 'student', at)])).toEqual([planted]);
  });
});

describe('collaboration rooms', () => {
  const room: RoomSpec = {
    name: 'BIO 201 Exam 2 Study Group',
    purpose: { kind: 'study_group', ref: 'sg-1' },
    members: [{ id: 'a', role: 'lead' }, { id: 'b', role: 'member' }],
    ends: days(40),
    closure: 'archive',
  };

  it('opens with a name, a purpose, two members, a lead, an end and a closure rule', () => {
    expect(openRoom(room, at)).toEqual([]);
    expect(ROOM_PARTS.map((p) => p.id)).toContain('members');
    expect(ROOM_PARTS.map((p) => p.id)).toContain('closure');
    expect(ROOM_PURPOSES).toContain('mentorship');
  });

  it('refuses a room about nothing, of one, with no lead, without an end, for ever, or with no closure rule', () => {
    expect(openRoom({ ...room, purpose: { kind: 'project', ref: '  ' } }, at)).toEqual(['A room is about a course, a study group, an organization, an event, a project or a mentorship, and says which.']);
    expect(openRoom({ ...room, members: [{ id: 'a', role: 'lead' }] }, at)).toEqual(['A room has at least two members; a room of one is a notebook.']);
    expect(openRoom({ ...room, members: [{ id: 'a', role: 'member' }, { id: 'b', role: 'member' }] }, at)).toEqual(['Somebody leads the room, so there is a person to answer for it.']);
    expect(openRoom({ ...room, ends: days(-1) }, at)).toEqual(['A room has an end date in the future.']);
    expect(openRoom({ ...room, ends: days(ROOM_MAX_DAYS + 1) }, at)).toEqual([`A room lasts ${ROOM_MAX_DAYS} days at most; open another when the next thing starts.`]);
    expect(openRoom({ ...room, closure: 'keep' as never }, at)).toEqual(['A room says whether it is archived or deleted when it ends.']);
    expect(openRoom({ ...room, name: '' }, at)).toEqual(['A room needs a name.']);
  });
});

describe('mentors, challenges and recognition', () => {
  it('walks the mentor flow from a goal to consent, and keeps the record from the mentor', () => {
    expect(MENTOR_FLOW[0]).toMatch(/goal/);
    expect(MENTOR_FLOW[MENTOR_FLOW.length - 1]).toMatch(/consent/);
    expect(MENTOR_FLOW.join(' ')).toMatch(/accepts or declines/);
    for (const x of ['grades', 'financial data', 'medical information', 'AI history']) expect(MENTOR_NEVER_SEES).toContain(x);
  });

  it('shapes every challenge around an outcome, private by default, with no comparison', () => {
    for (const c of CHALLENGES) expect(c.outcome.length, c.id).toBeGreaterThan(15);
    expect(CHALLENGE_RULES.participation).toMatch(/private by default/);
    expect(CHALLENGE_RULES.comparison).toMatch(/^Never/);
    const forbidden = FORBIDDEN_MECHANICS.map((m) => m.what.toLowerCase()).join(' ');
    expect(forbidden).toMatch(/leaderboard/);
  });

  it('counts a student’s own steps and nobody else’s', () => {
    expect(milestoneLine(0, 5)).toBe('5 steps, none started yet');
    expect(milestoneLine(2, 5)).toBe('2 of 5 steps done');
    expect(milestoneLine(5, 5)).toBe('All 5 steps done');
    expect(milestoneLine(9, 5)).toBe('All 5 steps done');
    expect(milestoneLine(2, 5)).not.toMatch(/%|rank|other/);
    expect(() => milestoneLine(0, 0)).toThrow();
  });

  it('recognises only from the verifier the signal names, and the student can hide any of it', () => {
    const officer = recognise('officer', 'organization_role');
    expect(officer.hidden).toBe(false);
    expect(() => recognise('officer', 'human_review')).toThrow(/verified by organization role/);
    expect(() => recognise('answer', 'human_review')).toThrow(/student acceptance/);
    expect(() => recognise('nope' as never, 'human_review')).toThrow(/No such signal/);
    expect(shown([officer, hide(recognise('resource', 'human_review'))])).toEqual([officer]);
    expect(NOT_A_MEASURE.join(' ')).toMatch(/follower count/);
    expect(NOT_A_MEASURE.join(' ')).toMatch(/academic ability/);
    expect(new Set(CONTRIBUTION_SIGNALS.map((s) => s.id)).size).toBe(CONTRIBUTION_SIGNALS.length);
  });

  it('builds verified connections first and commerce last', () => {
    expect(ROLLOUT[0]).toMatch(/Verified clubs/);
    expect(ROLLOUT[ROLLOUT_LAST - 1]).toMatch(/marketplace|talent pool/);
    expect(ROLLOUT.slice(0, -1).join(' ')).not.toMatch(/marketplace/);
  });
});
