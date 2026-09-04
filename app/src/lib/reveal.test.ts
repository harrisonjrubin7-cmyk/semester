import { describe, expect, it } from 'vitest';
import { FIRST, NOTHING_YET, UNLOCKS, countHidden, revealLine, showing, unlocked, type Facts } from './reveal';
import { DESTINATIONS } from './nav';

const fresh: Facts = { ...NOTHING_YET };
const settled: Facts = {
  courses: 4,
  hasExam: true,
  hasGrades: true,
  notes: 6,
  sittings: 2,
  ownThings: 9,
  terms: 2,
  signedIn: true,
};

const none: Record<string, boolean> = {};

describe('a first morning', () => {
  it('shows the ten that do something before there is a course', () => {
    for (const s of FIRST) {
      expect(unlocked(s, fresh), s).toBe(true);
    }
  });

  it('includes the one that gets you started', () => {
    // Hiding the importer from somebody with no courses would be perfect.
    expect(FIRST).toContain('import');
    expect(FIRST).toContain('home');
  });

  it('includes the one that says what happens to your data', () => {
    // Never gated. Somebody deciding whether to trust this must be able to
    // read it before they have done anything.
    expect(FIRST).toContain('privacy');
    expect(FIRST).toContain('account');
  });

  it('hides a good deal, but not most of it', () => {
    const hidden = countHidden(fresh, none, false);
    expect(hidden).toBeGreaterThan(8);
    expect(hidden).toBeLessThan(DESTINATIONS.length - FIRST.length + 6);
  });

  it('does not show an exam runway with no exams', () => {
    expect(unlocked('runway', fresh)).toBe(false);
    expect(unlocked('grades', fresh)).toBe(false);
  });
});

describe('earning a screen', () => {
  it('opens the study formats on the first course', () => {
    const one: Facts = { ...fresh, courses: 1 };
    for (const s of ['study', 'deck', 'solve']) {
      expect(unlocked(s, one), s).toBe(true);
    }
  });

  it('opens the runway on the first exam, not on the first course', () => {
    expect(unlocked('runway', { ...fresh, courses: 3 })).toBe(false);
    expect(unlocked('runway', { ...fresh, courses: 3, hasExam: true })).toBe(true);
  });

  it('opens the projection on the first grade', () => {
    expect(unlocked('grades', { ...fresh, courses: 3 })).toBe(false);
    expect(unlocked('grades', { ...fresh, hasGrades: true })).toBe(true);
  });

  it('waits for two courses before offering to sort out a bad week', () => {
    // "I'm behind" with one course is not a triage problem.
    expect(unlocked('behind', { ...fresh, courses: 1 })).toBe(false);
    expect(unlocked('behind', { ...fresh, courses: 2 })).toBe(true);
  });

  it('opens sync only with an account', () => {
    expect(unlocked('cloud', { ...fresh, courses: 4 })).toBe(false);
    expect(unlocked('cloud', { ...fresh, signedIn: true })).toBe(true);
  });

  it('shows everything to somebody a term in', () => {
    expect(countHidden(settled, none, false)).toBe(0);
  });

  it('gates on a fact about the semester, never on a timer', () => {
    // "You have used the app five times" is not a reason to be shown
    // anything, so there is nowhere for a count of sessions to come from.
    const keys = Object.keys(NOTHING_YET);
    for (const k of keys) {
      expect(k).not.toMatch(/session|visit|days|opened|since/i);
    }
  });
});

describe('the three rules that stop it being annoying', () => {
  it('never takes back a screen you have opened', () => {
    // Unlocked on the laptop, still there on the phone. Unlocked by a course
    // you later dropped, still there.
    expect(showing('runway', fresh, { runway: true }, false)).toBe(true);
    expect(showing('grades', fresh, { grades: true }, false)).toBe(true);
  });

  it('is switched off entirely by one setting', () => {
    for (const d of DESTINATIONS) {
      expect(showing(d.screen as string, fresh, none, true), d.screen).toBe(true);
    }
    expect(countHidden(fresh, none, true)).toBe(0);
  });

  it('hides nothing from somebody who has been everywhere', () => {
    const been = Object.fromEntries(DESTINATIONS.map((d) => [d.screen, true]));
    expect(countHidden(fresh, been, false)).toBe(0);
  });
});

describe('what the setting says', () => {
  it('does not sell it', () => {
    const said = `${revealLine(12, false)} ${revealLine(0, true)}`.toLowerCase();
    for (const word of ['simple', 'clean', 'clutter', 'overwhelm', 'streamlin']) {
      expect(said, word).not.toContain(word);
    }
  });

  it('says search still finds them, which is the part people need to know', () => {
    expect(revealLine(12, false)).toContain('Search finds them');
  });

  it('says so when there is nothing left to unlock', () => {
    expect(revealLine(0, false)).toContain('Nothing is being held back');
  });

  it('counts one screen as one', () => {
    expect(revealLine(1, false)).toContain('1 screen appears');
    expect(revealLine(3, false)).toContain('3 screens appear');
  });
});

describe('the table itself', () => {
  it('names only screens that exist', () => {
    const real = new Set(DESTINATIONS.map((d) => d.screen as string));
    // No exceptions. A key that names nothing in the directory hides nothing,
    // and its presence would suggest a gate that is not there.
    for (const s of Object.keys(UNLOCKS)) {
      expect(real.has(s), s).toBe(true);
    }
  });

  it('lists only real screens as the first ten', () => {
    const real = new Set(DESTINATIONS.map((d) => d.screen as string));
    for (const s of FIRST) {
      expect(real.has(s), s).toBe(true);
    }
  });

  it('never gates a screen on itself having been used', () => {
    // A screen that unlocks once you have used it can never unlock.
    for (const [screen, gate] of Object.entries(UNLOCKS)) {
      expect(gate(settled), screen).toBe(true);
    }
  });
});
