import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { agoLine, held, heading, initials, named, oldestLine, saidAbout } from './profile';
import type { Row } from './inventory';
import { sources, withoutComments } from '../styles/rules';

const account = { id: 'u1', email: 'harrison@vanderbilt.edu', via: 'Google' };

const row = (key: string, count: number): Row => ({
  key,
  label: key,
  count,
  bytes: count * 10,
  browsable: count > 0,
});

describe('the letters in the circle', () => {
  it('takes the first and last word', () => {
    expect(initials('Harrison Rubin')).toBe('HR');
    expect(initials('  ada   byron  lovelace ')).toBe('AL');
  });

  it('takes one letter from one word', () => {
    expect(initials('Harrison')).toBe('H');
  });

  it('skips punctuation rather than drawing it', () => {
    // "J." would read as a typo in a circle 40px across.
    expect(initials('J.R.R. Tolkien')).toBe('JT');
    expect(initials('María')).toBe('M');
  });

  it('keeps letters that are not Latin', () => {
    expect(initials('Ямал Ким')).toBe('ЯК');
  });

  /*
   * The promise `state/shape.ts` makes where the field is declared: a name is
   * asked for, never derived. An avatar is where that gets broken quietly,
   * because a letter off the email address looks like a reasonable guess and
   * is a guess at somebody's name shown back to them as fact.
   */
  it('draws nothing at all rather than guessing from an email', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });
});

describe('what the screen calls you', () => {
  it('uses the name when there is one', () => {
    expect(heading('Harrison')).toBe('Harrison');
    expect(named('Harrison')).toBe(true);
  });

  it('asks for one rather than showing an address or a blank', () => {
    expect(heading('')).toBe('Add your name');
    expect(named('')).toBe(false);
    expect(heading('  ')).not.toContain('@');
  });
});

describe('the lines under the avatar', () => {
  it('says this device, not an apology, when signed out', () => {
    const said = saidAbout({ account: null, status: 'signed-out', at: 0 });
    expect(said.line).toBe('Not signed in');
    expect(said.sub).toContain('optional');
    // Nothing on a signed-out profile should read as a failure.
    expect(said.sub.toLowerCase()).not.toContain('error');
  });

  it('says so when the build has no account service at all', () => {
    const said = saidAbout({ account: null, status: 'off', at: 0 });
    expect(said.line).toBe('This device');
    expect(said.sub).toContain('no account service');
  });

  it('shows the address and when it last caught up', () => {
    const now = Date.UTC(2026, 8, 11, 12, 0);
    const said = saidAbout({ account, status: 'synced', at: now - 5 * 60_000 }, now);
    expect(said.line).toBe('harrison@vanderbilt.edu');
    expect(said.sub).toBe('Synced 5 minutes ago');
  });

  it('sends a failed sync to the screen that can explain it', () => {
    const said = saidAbout({ account, status: 'error', at: 0 });
    expect(said.sub).toContain('Account');
  });

  it('names which button they pressed while nothing has synced yet', () => {
    // The thing somebody needs on a second device, which an email does not say.
    expect(saidAbout({ account, status: 'signed-out', at: 0 }).sub).toContain('Google');
  });
});

describe('how long ago', () => {
  const now = Date.UTC(2026, 8, 11, 12, 0);

  it('rounds to something a person would say', () => {
    expect(agoLine(now - 20_000, now)).toBe('just now');
    expect(agoLine(now - 60_000, now)).toBe('1 minute ago');
    expect(agoLine(now - 40 * 60_000, now)).toBe('40 minutes ago');
    expect(agoLine(now - 3 * 3_600_000, now)).toBe('3 hours ago');
    expect(agoLine(now - 26 * 3_600_000, now)).toBe('yesterday');
    expect(agoLine(now - 5 * 86_400_000, now)).toBe('5 days ago');
  });

  it('treats never-synced as now rather than as 1970', () => {
    expect(agoLine(0, now)).toBe('just now');
  });
});

describe('what the app holds about you', () => {
  const rows = [row('courses', 0), row('notes', 12), row('tasks', 0), row('reviews', 88)];

  it('counts what the data screen counts, not a second tally', () => {
    expect(held(rows, 4)).toEqual([
      { label: 'Courses', count: 4 },
      { label: 'Notes', count: 12 },
      { label: 'Cards reviewed', count: 88 },
    ]);
  });

  /*
   * The bug this argument exists for, in the state the app actually ships in.
   *
   * `state.courses` is empty while the semester the app ships with is the one
   * on screen — those courses are in the catalogue. Counting the stored row
   * told somebody looking at four courses that the app held nothing.
   */
  it('takes the course count from the catalogue, not from the stored row', () => {
    expect(held([row('courses', 0)], 4)).toEqual([{ label: 'Courses', count: 4 }]);
    // And the other way: an imported course that the catalogue is not showing
    // — a different term is open — is not counted as this term's.
    expect(held([row('courses', 9)], 4)).toEqual([{ label: 'Courses', count: 4 }]);
  });

  it('drops the empty ones rather than showing a column of noughts', () => {
    expect(held(rows, 4).map((r) => r.label)).not.toContain('Tasks');
    expect(held([], 0)).toEqual([]);
  });
});

describe('the age of what is here', () => {
  const now = Date.UTC(2026, 8, 11, 12, 0);

  it('says nothing on a first day, because there is nothing to say', () => {
    expect(oldestLine(null, now)).toBe('');
    expect(oldestLine({ from: now - 3_600_000, to: now }, now)).toBe('');
  });

  it('counts days, then months', () => {
    expect(oldestLine({ from: now - 9 * 86_400_000, to: now }, now)).toContain('9 days');
    expect(oldestLine({ from: now - 90 * 86_400_000, to: now }, now)).toContain('3 months');
    expect(oldestLine({ from: now - 32 * 86_400_000, to: now }, now)).toContain('1 month old');
  });

  /*
   * The claim this line is not allowed to make.
   *
   * `inventory`'s span is the oldest timestamp in the saved state, which after
   * a restore, a sync from a second device or an import of last spring's
   * course is older than this device has held anything. The sentence used to
   * report that as how long the semester had been on this device. Nothing in
   * `Persisted` records an arrival, so the line says what it measures instead.
   */
  it('talks about the record, never about the device or an install', () => {
    const said = oldestLine({ from: now - 200 * 86_400_000, to: now }, now);
    expect(said).toContain('record');
    for (const claim of ['device', 'installed', 'since you', 'using']) {
      expect(said.toLowerCase(), claim).not.toContain(claim);
    }
  });
});

/**
 * One box for the name, in a codebase that had two for everything else.
 *
 * The name was a field on Settings → Courses before the profile screen
 * existed, and the easy version of adding a profile is to put a second field
 * on it and leave the first alone. Then the two drift — one gets a maxLength,
 * the other gets a placeholder, a third appears in onboarding — and a string
 * with three editors is a string nobody can say the rules for.
 *
 * `lib/onehome.test.ts` catches a duplicated *screen* and `lib/onecontrol.ts`
 * a duplicated *control*; neither can see this one, because a second `<input>`
 * dispatching the same action is ordinary markup. So it is counted.
 *
 * Dispatches rather than inputs: what matters is how many places can *change*
 * the name, and a row that only shows it — the one Settings keeps, so somebody
 * who learned where the name lived is not left hunting — is not one of them.
 */
describe('where the name can be changed', () => {
  /*
   * `sources` walks `.tsx` only, which is exactly the right net here and worth
   * saying out loud: a second editor is markup, so it can only appear in a
   * component. The action's own declaration in `state/shape.ts` and the arm
   * that handles it in `state/slices/settings.ts` are `.ts` and are not
   * editors — they are the one place the string is defined and the one place
   * it is written, which is what this is protecting.
   */
  const dispatches = () =>
    sources(join(process.cwd(), 'src'))
      .filter((f) => !f.path.endsWith('.test.tsx'))
      .filter((f) => /type: 'setMyName'/.test(withoutComments(f.text)))
      .map((f) => f.path.slice(f.path.indexOf('/src/') + 1));

  it('is exactly one screen, and it is the profile', () => {
    // Named rather than counted: a failure has to say which file grew the
    // second field, or the next person greps for it across sixty screens.
    expect(dispatches()).toEqual(['src/screens/Profile.tsx']);
  });

  it('is a rule about editing, not about showing', () => {
    // Guards the assertion above against passing for the wrong reason: the
    // settings row that shows the name and opens this screen must not be
    // counted, and must still exist.
    const settings = sources(join(process.cwd(), 'src')).find((f) =>
      f.path.endsWith('/screens/settings/Courses.tsx'),
    );
    expect(settings, 'the settings page has moved; point this test at it').toBeDefined();
    expect(withoutComments(settings!.text)).toContain("screen: 'profile'");
  });
});
