// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { COMMON_SCALE } from '../lib/degree';
import { NO_SCHOOL, type School } from '../lib/school';

/**
 * The school's own note on grading, on the one screen that asks about it.
 *
 * `SchoolData.gradingNotes` was the last field of the profile that reached no
 * screen — VANDERBILT-AUDIT.md made that finding about ten fields, two
 * survived it, and `docs/SCHOOL_DATA_PACK.md` then went on to ask partners to
 * fill this one in. An unrendered field is somebody else's afternoon.
 *
 * What is under test is not "does a string appear". It is the three rules the
 * placement rests on: it is attributed to the school rather than spoken in the
 * app's voice, it is absent rather than empty when there is nothing to say,
 * and the paragraph it sits under — the one telling you to check the table
 * against your registrar — is untouched either way.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let school: School = { ...NO_SCHOOL };

vi.mock('../state/store', () => ({
  useStore: () => ({
    state: { scale: { ...COMMON_SCALE } },
    dispatch: () => {},
    school,
  }),
}));

const { GpaScale } = await import('./GpaScale');

let host: HTMLDivElement;
let root: Root;

/** A school carrying whatever grading note the case is about. */
const withNote = (gradingNotes?: string, over: Partial<School> = {}): School => ({
  ...NO_SCHOOL,
  id: 'vanderbilt',
  name: 'Vanderbilt University',
  shortName: 'Vanderbilt',
  data: gradingNotes === undefined ? {} : { gradingNotes },
  ...over,
});

const draw = (s: School) => {
  school = s;
  act(() => root.render(<GpaScale />));
  return host.textContent ?? '';
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

// The root is unmounted rather than left standing. `src/rootunmount.test.ts`
// is why this cannot quietly go away again: a React tree still mounted when a
// file ends throws out of react-dom in whichever file happens to run next.
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  school = { ...NO_SCHOOL };
});

const VU = 'Vanderbilt grades on a 4.0 scale with pluses and minuses; an A+ still counts as 4.0.';

describe('a school that publishes something about grading', () => {
  it('shows it, in the school’s own words', () => {
    expect(draw(withNote(VU))).toContain(VU);
  });

  it('attributes it, rather than speaking it in the app’s voice', () => {
    // This is the rule `sourceLine` keeps for the cutoffs and the reason it
    // keeps it: a claim shown without a source reads as institutional fact.
    // The app has not checked this sentence and must not appear to have.
    expect(draw(withNote(VU))).toContain('Vanderbilt publishes:');
  });

  it('uses the full name when there is no short one', () => {
    expect(draw(withNote(VU, { shortName: undefined }))).toContain('Vanderbilt University publishes:');
  });

  it('still says somebody published it when the school has no name at all', () => {
    const anonymous = draw(withNote(VU, { shortName: undefined, name: '' }));
    expect(anonymous).toContain('Your school publishes:');
    expect(anonymous).toContain(VU);
  });
});

describe('a school that publishes nothing', () => {
  it('draws no attribution line', () => {
    expect(draw(withNote(undefined))).not.toContain('publishes:');
  });

  it('draws nothing for whitespace where a sentence was meant', () => {
    // A profile edited by somebody else, or loaded from a file, can carry
    // this. `note &&` on a string of spaces would draw an empty bordered box
    // with an attribution and no claim under it.
    expect(draw(withNote('   \n  '))).not.toContain('publishes:');
  });

  it('draws nothing when no school is set, which is most people', () => {
    expect(draw({ ...NO_SCHOOL })).not.toContain('publishes:');
  });
});

describe('the paragraph it sits under is untouched', () => {
  /*
   * The control, and the reason it is here.
   *
   * Every assertion above would pass against a component that had quietly
   * stopped drawing the table's own caveat — the one that says universities
   * disagree about whether an A+ is 4.0 or 4.3 and to check with your
   * registrar. A school's note is a step towards that check and not a
   * substitute for it, so both have to survive together.
   */
  const CAVEAT = 'check it against your registrar';

  it('is there when the school has published a note', () => {
    expect(draw(withNote(VU))).toContain(CAVEAT);
  });

  it('is there when it has not', () => {
    expect(draw(withNote(undefined))).toContain(CAVEAT);
  });

  it('and the table itself still renders either way', () => {
    // Guards against the note landing somewhere that swallows the rows.
    expect(draw(withNote(VU))).toContain('A+');
    expect(draw(withNote(undefined))).toContain('A+');
  });
});
