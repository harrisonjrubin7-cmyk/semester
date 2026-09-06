import { describe, expect, it } from 'vitest';
import {
  DISCLOSURE,
  LENGTHS,
  SYSTEM,
  USES,
  brief,
  fileName,
  gate,
  holes,
  readDraft,
  stanceLine,
  target,
  forUse,
  words,
  type Spec,
} from './essay';

const spec = (over: Partial<Spec> = {}): Spec => ({
  useId: 'application',
  audience: 'Senator Chen’s district office',
  purpose: 'Apply for the spring policy internship',
  facts: 'Sophomore, national security and economics.',
  instructions: '',
  sources: '',
  lengthId: 'standard',
  voiceId: 'plain',
  ...over,
});

describe('gate', () => {
  it('lets non-coursework through once the writer confirms the recipient allows it', () => {
    expect(gate({ useId: 'application', attested: true }).ok).toBe(true);
  });

  it('will not draft anything until that confirmation is given', () => {
    const g = gate({ useId: 'application', attested: false });
    expect(g.ok).toBe(false);
    expect(g.why).toMatch(/allows/i);
  });

  /*
   * The recorded stance no longer refuses anything.
   *
   * These three used to assert the opposite: banned refused, limited refused,
   * and an unrecorded policy refused on the principle that an unread policy is
   * not a permissive one. The owner of this app asked for that removed. The
   * field is their own transcription of their own syllabus, so it was a
   * guardrail they set for themselves and have since decided against.
   *
   * Kept as tests rather than deleted, inverted, so that putting the gate back
   * is a change these notice.
   */
  it('no longer refuses a course recorded as banning AI', () => {
    expect(
      gate({ useId: 'course', attested: true, courseCode: 'CORE 2500', stance: 'banned' }).ok,
    ).toBe(true);
  });

  it('no longer refuses a limited policy', () => {
    expect(
      gate({ useId: 'course', attested: true, courseCode: 'BUS 1600', stance: 'limited' }).ok,
    ).toBe(true);
  });

  it('no longer refuses an unrecorded policy', () => {
    expect(gate({ useId: 'course', attested: true, courseCode: 'ECON 1020' }).ok).toBe(true);
  });

  it('still records what the syllabus said, even though it does not act on it', () => {
    // The record is the point of keeping the field: it is what the student
    // read in their own syllabus, and it stays visible.
    expect(stanceLine('banned')).toMatch(/Recorded, not enforced/);
    expect(stanceLine('limited')).toMatch(/Recorded, not enforced/);
  });

  it('needs the course named before it can check anything', () => {
    expect(gate({ useId: 'course', attested: true }).ok).toBe(false);
  });

  it('still asks per assignment, which is the one check that remains', () => {
    expect(
      gate({ useId: 'course', attested: false, courseCode: 'X 100', stance: 'allowed' }).ok,
    ).toBe(false);
    expect(
      gate({ useId: 'course', attested: true, courseCode: 'X 100', stance: 'allowed' }).ok,
    ).toBe(true);
  });

  it('falls back to the first use rather than throwing on an id it does not know', () => {
    expect(forUse('nonsense').id).toBe(USES[0].id);
    expect(gate({ useId: 'nonsense', attested: true }).ok).toBe(true);
  });
});

describe('the system prompt', () => {
  it('forbids inventing a fact about the writer, which is the failure that matters here', () => {
    expect(SYSTEM).toContain('NEVER invent a fact about this person');
    expect(SYSTEM).toContain('GPA');
  });

  it('forbids inventing a citation, same as everywhere else in the app', () => {
    expect(SYSTEM).toContain('NEVER invent a source');
    expect(SYSTEM).toContain('[source needed]');
  });

  it('says those two rules outrank anything the brief asks for', () => {
    expect(SYSTEM).toContain('override every other instruction');
  });

  it('bans the phrases that give a machine-written letter away', () => {
    expect(SYSTEM).toContain('I am writing to express my interest');
    expect(SYSTEM).toContain('I am passionate about');
  });
});

describe('brief', () => {
  it('fences the facts, so anything unlisted has to become a blank', () => {
    const text = brief(spec());
    expect(text).toContain('The ONLY facts about this person you may use');
    expect(text).toContain('Sophomore, national security and economics.');
  });

  it('says plainly when no facts were given rather than leaving a gap', () => {
    expect(brief(spec({ facts: '' }))).toContain('every specific fact must be a bracketed blank');
  });

  it('carries the length as a number the model can aim at', () => {
    expect(brief(spec({ lengthId: 'long' }))).toContain('about 1100 words');
  });

  it('names the course only when this is coursework that passed the gate', () => {
    expect(brief(spec())).not.toContain('This IS coursework');
    expect(brief(spec({ useId: 'course', courseCode: 'X 100' }))).toContain('This IS coursework');
  });

  it('asks for a placeholder rather than an invented source when none were given', () => {
    expect(brief(spec())).toContain('rather than inventing one');
  });
});

describe('readDraft', () => {
  it('takes off a fence the model wrapped the whole draft in', () => {
    expect(readDraft('```markdown\nDear Sir\n```')).toBe('Dear Sir');
    expect(readDraft('```\nDear Sir\n```')).toBe('Dear Sir');
  });

  it('leaves a fence that is only part of the draft alone', () => {
    const mixed = 'Before\n\n```\ncode\n```\n\nAfter';
    expect(readDraft(mixed)).toBe(mixed);
  });
});

describe('words', () => {
  it('counts the prose and not the blanks, which are not written yet', () => {
    expect(words('One two three [a fact you have to supply] four')).toBe(4);
  });

  it('is zero for nothing', () => {
    expect(words('   ')).toBe(0);
  });
});

describe('holes', () => {
  it('finds the blanks left for the writer', () => {
    expect(holes('I started in [the month you joined] and stayed.')).toEqual([
      '[the month you joined]',
    ]);
  });

  it('does not count a markdown link as a blank', () => {
    expect(holes('See [the posting](https://example.org).')).toEqual([]);
  });

  it('ignores something too short to be an instruction', () => {
    expect(holes('an aside [1] here')).toEqual([]);
  });
});

describe('fileName', () => {
  it('is lowercase throughout, and says what the file is', () => {
    const name = fileName('Senator Chen’s district office', 'application');
    expect(name).toBe('an-application-senator-chens-district-office.md');
  });

  it('still returns something usable with no audience', () => {
    expect(fileName('', 'own')).toMatch(/\.md$/);
  });
});

describe('the pieces the screens read', () => {
  it('gives every length a word target', () => {
    for (const l of LENGTHS) expect(target(l.id)).toBeGreaterThan(0);
  });

  it('falls back rather than returning NaN for a length it does not know', () => {
    expect(target('nope')).toBe(600);
  });

  it('explains every stance', () => {
    for (const s of ['banned', 'limited', 'allowed', 'unstated'] as const) {
      expect(stanceLine(s).length).toBeGreaterThan(10);
    }
  });

  it('carries a disclosure that survives leaving the app', () => {
    expect(DISCLOSURE).toMatch(/edited by hand/);
  });
});
