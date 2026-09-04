import { describe, expect, it } from 'vitest';
import {
  NOTICE,
  known,
  knownLine,
  needing,
  newLetter,
  newPerson,
  newVisit,
  nextMove,
  notice,
  daysLeft,
  readLetters,
  readPeople,
  readVisits,
  short,
  type Letter,
  type Visit,
} from './letters';

const NOW = new Date(2026, 8, 18, 12, 0);
const AT = NOW.getTime();
const DAY = 86_400_000;

const day = (n: number) => {
  const d = new Date(2026, 8, 18 + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const letter = (patch: Partial<Letter>) => newLetter(patch, AT);
const visit = (personId: string, daysAgo: number): Visit =>
  newVisit({ personId, at: AT - daysAgo * DAY, what: 'Talked' }, AT);

describe('how much notice a request gives', () => {
  it('counts from today while there is still a choice about when to ask', () => {
    expect(notice(letter({ due: day(30) }), NOW)).toBe(30);
  });

  it('counts from the day it was asked once it has been', () => {
    expect(notice(letter({ due: day(30), askedOn: day(-10) }), NOW)).toBe(40);
  });

  it('measures against a convention, and calls it one', () => {
    expect(NOTICE).toBeGreaterThanOrEqual(14);
    expect(short(letter({ due: day(10) }), NOW)).toBe(true);
    expect(short(letter({ due: day(40) }), NOW)).toBe(false);
    // Adjustable, because some want a month and some are happy with ten days.
    expect(short(letter({ due: day(10) }), NOW, 7)).toBe(false);
  });

  it('says nothing about notice with no deadline recorded', () => {
    expect(notice(letter({}), NOW)).toBeNull();
    expect(daysLeft(letter({}), NOW)).toBeNull();
    expect(short(letter({}), NOW)).toBe(false);
  });
});

describe('the one thing to do next', () => {
  it('says to ask, and warns when asking now is already short notice', () => {
    expect(nextMove(letter({ due: day(40) }), NOW)).toContain('Ask them');
    const tight = nextMove(letter({ due: day(9) }), NOW);
    expect(tight).toContain('Ask now');
    expect(tight).toContain(`under the ${NOTICE}`);
  });

  it('sends the materials before anything else once they have agreed', () => {
    const said = nextMove(letter({ stage: 'agreed', due: day(30) }), NOW);
    expect(said).toContain('CV');
    expect(said).toContain('weaker letter');
  });

  it('nudges only close to the deadline, and only once they have what they need', () => {
    const soon = letter({ stage: 'agreed', sentMaterials: true, due: day(4) });
    expect(nextMove(soon, NOW)).toContain('nudge');
    const later = letter({ stage: 'agreed', sentMaterials: true, due: day(40) });
    expect(nextMove(later, NOW)).toContain('let them write it');
  });

  it('remembers the thank you, which nobody does', () => {
    expect(nextMove(letter({ stage: 'submitted', due: day(-2) }), NOW)).toContain('Thank them');
    expect(nextMove(letter({ stage: 'submitted', thanked: true, due: day(-2) }), NOW)).toContain(
      'Done, and thanked',
    );
  });

  it('says plainly when a deadline has gone', () => {
    expect(nextMove(letter({ due: day(-1) }), NOW)).toBe('The deadline has gone.');
    expect(nextMove(letter({ stage: 'asked', due: day(-1) }), NOW)).toContain('no answer');
  });

  it('never predicts whether somebody will say yes', () => {
    // That would be the app making a confident claim about another person's
    // regard for a student out of four database rows.
    for (const stage of ['thinking', 'asked', 'agreed', 'declined', 'submitted'] as const) {
      const said = nextMove(letter({ stage, due: day(20) }), NOW).toLowerCase();
      for (const word of ['likely', 'chance', 'probably will', 'should say yes', 'strong']) {
        expect(said).not.toContain(word);
      }
    }
  });
});

describe('what is wanting attention', () => {
  it('is sorted by deadline, soonest first', () => {
    const out = needing(
      [letter({ id: 'late', due: day(40) }), letter({ id: 'soon', due: day(5) })],
      NOW,
    );
    expect(out[0].due).toBe(day(5));
  });

  it('leaves out one that is agreed, supplied and not yet close', () => {
    const settled = letter({ stage: 'agreed', sentMaterials: true, due: day(40) });
    expect(needing([settled], NOW)).toEqual([]);
  });

  it('keeps one that is agreed but has had nothing sent', () => {
    const waiting = letter({ stage: 'agreed', sentMaterials: false, due: day(40) });
    expect(needing([waiting], NOW)).toHaveLength(1);
  });

  it('keeps a submitted one until it has been thanked, and drops a declined one', () => {
    expect(needing([letter({ stage: 'submitted', due: day(-5) })], NOW)).toHaveLength(1);
    expect(needing([letter({ stage: 'submitted', thanked: true, due: day(-5) })], NOW)).toEqual([]);
    expect(needing([letter({ stage: 'declined', due: day(5) })], NOW)).toEqual([]);
  });
});

describe('how long you have known somebody', () => {
  const visits = [visit('a', 90), visit('a', 40), visit('a', 3), visit('b', 5)];

  it('counts conversations and dates them', () => {
    const k = known(visits, 'a', NOW);
    expect(k.visits).toBe(3);
    expect(k.days).toBe(90);
    expect(k.last).toBe(AT - 3 * DAY);
  });

  it('says the counts and never scores the relationship', () => {
    const said = knownLine(known(visits, 'a', NOW), NOW);
    expect(said).toContain('3 conversations');
    expect(said).toContain('3 months');
    expect(said).toContain('last 3 days ago');
    for (const word of ['strong', 'weak', 'good', 'ready', '%', 'score']) {
      expect(said.toLowerCase()).not.toContain(word);
    }
  });

  it('says what to do about an empty record rather than nothing', () => {
    const said = knownLine(known(visits, 'nobody', NOW), NOW);
    expect(said).toContain('Nothing recorded yet');
    expect(said).toContain('one line after each conversation'.replace('one', 'One'));
  });

  it('counts days rather than months when it is only days', () => {
    expect(knownLine(known([visit('c', 6), visit('c', 0)], 'c', NOW), NOW)).toContain('over 6 days');
  });

  it('never says a conversation happened in the future', () => {
    // The store's clock zeroes seconds while a visit is stamped with the real
    // instant, so one recorded a moment ago floored to "-1 days ago". The
    // browser showed it; no unit test would have.
    const justNow = [newVisit({ personId: 'd', at: AT + 4000 }, AT)];
    expect(knownLine(known(justNow, 'd', NOW), NOW)).toBe('1 conversation, today.');
  });

  it('does not describe a span that does not exist', () => {
    // "1 conversation over 0 days" is not a sentence anybody writes.
    const one = [visit('e', 3)];
    expect(knownLine(known(one, 'e', NOW), NOW)).toBe('1 conversation, 3 days ago.');
  });
});

describe('reading what was stored', () => {
  it('falls back on an unknown stage', () => {
    expect(readLetters([{ id: 'a', stage: 'maybe' }])[0].stage).toBe('thinking');
  });

  it('takes a missing flag as false rather than undefined', () => {
    const [l] = readLetters([{ id: 'a' }]);
    expect(l.sentMaterials).toBe(false);
    expect(l.thanked).toBe(false);
  });

  it('takes anything that is not a list as nothing', () => {
    expect(readPeople(null)).toEqual([]);
    expect(readVisits('x')).toEqual([]);
    expect(readLetters(undefined)).toEqual([]);
  });

  it('keeps a person as recorded', () => {
    const p = newPerson({ name: ' Dr. Stromme ', role: 'Professor, ECON 1020' }, AT);
    expect(p.name).toBe('Dr. Stromme');
    expect(readPeople([p])).toHaveLength(1);
  });
});
