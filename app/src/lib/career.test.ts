import { describe, expect, it } from 'vitest';
import {
  EMPTY_CAREER,
  builtResume,
  hasTargets,
  newOpportunity,
  outreachDrafts,
  readCareer,
  resumeDocumentTitle,
  resumeReadout,
  sharedTags,
  sharedWith,
  targetScore,
  targetTerms,
  type CareerContact,
  type CareerExperience,
  type Opportunity,
} from './career';

/**
 * The readout, and the thing it must never turn into.
 *
 * Every product that competes with this one puts a meter above these fields —
 * a percentage, a ring, "All-Star". The tests below are mostly about what is
 * absent: no number that stands for the whole, no band, no adjective. A
 * student with two real jobs on one page would score below one with nine lines
 * of padding on any such meter, which is how a meter ends up advising padding.
 */

const experience = (title: string): CareerExperience => ({
  id: title,
  category: 'Experience',
  title,
  organization: '',
  dates: '',
  details: '',
});

const contact = (name: string): CareerContact => ({
  id: name,
  name,
  organization: '',
  interests: '',
  permission: 'Not requested',
  next: '',
  nextDate: '',
  notes: '',
});

describe('what the résumé tab says is filled in', () => {
  it('starts as four plain facts about an empty library', () => {
    expect(resumeReadout(EMPTY_CAREER, false)).toBe(
      'Headline: not set · 0 experience entries · 0 contacts saved · no résumé draft built in Write yet',
    );
  });

  it('counts what is there, in the singular where there is one', () => {
    const one = {
      ...EMPTY_CAREER,
      headline: 'Economics and national security',
      experiences: [experience('Research assistant')],
      contacts: [contact('Priya')],
    };
    expect(resumeReadout(one, true)).toBe(
      'Headline: set · 1 experience entry · 1 contact saved · résumé draft built in Write',
    );
  });

  it('treats a headline of spaces as not set, because it is', () => {
    expect(resumeReadout({ ...EMPTY_CAREER, headline: '   ' }, false)).toContain('Headline: not set');
  });

  /*
   * The constraint, asserted rather than trusted. If somebody later adds a
   * percentage, a score out of anything, or a "Beginner/Intermediate/All-Star"
   * band to this line, this is the test that says no.
   */
  it('is never a score, a percentage or a band', () => {
    const full = {
      ...EMPTY_CAREER,
      headline: 'Set',
      experiences: Array.from({ length: 9 }, (_, i) => experience(`Entry ${i}`)),
      contacts: Array.from({ length: 4 }, (_, i) => contact(`Person ${i}`)),
    };
    for (const said of [resumeReadout(EMPTY_CAREER, false), resumeReadout(full, true)]) {
      expect(said).not.toMatch(/%/);
      expect(said).not.toMatch(/\b\d+\s*(?:of|\/|out of)\s*\d+/);
      expect(said).not.toMatch(/beginner|intermediate|advanced|all.?star|strength|complete|score|rank/i);
    }
  });

  it('says more when there is more, and nothing about how it is going', () => {
    const grown = resumeReadout({ ...EMPTY_CAREER, experiences: [experience('A'), experience('B')] }, false);
    expect(grown).toContain('2 experience entries');
    expect(grown).not.toMatch(/good|strong|weak|ready|nearly|almost/i);
  });
});

describe('whether a draft has been built', () => {
  it('names the document after the student, or says "My" when they have not', () => {
    expect(resumeDocumentTitle(EMPTY_CAREER)).toBe('My résumé');
    expect(resumeDocumentTitle({ ...EMPTY_CAREER, name: 'Harrison' })).toBe('Harrison résumé');
  });

  /*
   * By the ending rather than by an exact match. The name is part of the
   * title, and correcting your own name afterwards has not un-built the draft.
   */
  it('recognises the draft after the name on it has changed', () => {
    const built = resumeDocumentTitle({ ...EMPTY_CAREER, name: 'Harrison' });
    expect(builtResume([built])).toBe(true);
    expect(builtResume(['ECON 1010 response paper', built])).toBe(true);
  });

  it('is false with nothing written, and is not fooled by another career draft', () => {
    expect(builtResume([])).toBe(false);
    expect(builtResume(['Brookings · Cover letter', 'Conversation with Priya'])).toBe(false);
  });
});

const listing = (patch: Partial<Opportunity> = {}): Opportunity => ({
  ...newOpportunity(),
  title: 'Summer analyst',
  ...patch,
});

describe('what the student says they are looking for', () => {
  it('reads a stored library that predates the fields rather than refusing it', () => {
    const old = { ...EMPTY_CAREER } as Record<string, unknown>;
    delete old.targetRoles;
    delete old.targetLocations;
    delete old.lookingSince;
    const read = readCareer(old);
    expect(read.targetRoles).toBe('');
    expect(read.targetLocations).toBe('');
    expect(read.lookingSince).toBe('');
  });

  it('keeps what was typed, and refuses a date that is not one', () => {
    const lib = { ...EMPTY_CAREER, targetRoles: 'Policy analyst', lookingSince: '2026-09-01' };
    expect(readCareer(lib).targetRoles).toBe('Policy analyst');
    expect(readCareer(lib).lookingSince).toBe('2026-09-01');
    expect(() => readCareer({ ...EMPTY_CAREER, lookingSince: '2026-02-31' })).toThrow();
    expect(() => readCareer({ ...EMPTY_CAREER, targetRoles: 'x'.repeat(501) })).toThrow();
  });

  it('splits a comma list into terms, and nothing out of an empty box', () => {
    expect(targetTerms('Policy analyst, Research , ,economics')).toEqual([
      'policy analyst',
      'research',
      'economics',
    ]);
    expect(targetTerms('   ')).toEqual([]);
    expect(hasTargets(EMPTY_CAREER)).toBe(false);
    expect(hasTargets({ ...EMPTY_CAREER, targetLocations: 'Washington' })).toBe(true);
  });

  it('counts role terms in the title and the skills line', () => {
    const lib = { ...EMPTY_CAREER, targetRoles: 'analyst, economics' };
    expect(targetScore(listing({ title: 'Summer analyst', skills: 'economics, Stata' }), lib)).toBe(2);
    expect(targetScore(listing({ title: 'Summer analyst' }), lib)).toBe(1);
    expect(targetScore(listing({ title: 'Kitchen porter' }), lib)).toBe(0);
  });

  /*
   * A place is looked for where places are written down. "Washington Fellow"
   * is not a job in Washington, and counting it as one is a coincidence
   * dressed up as an answer.
   */
  it('looks for a place in the location and the country, not in the job title', () => {
    const lib = { ...EMPTY_CAREER, targetLocations: 'washington' };
    expect(targetScore(listing({ title: 'Washington Fellow' }), lib)).toBe(0);
    expect(targetScore(listing({ location: 'Washington, DC' }), lib)).toBe(1);
    expect(targetScore(listing({ country: 'United States', location: 'Washington' }), lib)).toBe(1);
  });

  it('scores nothing at all when nothing has been said', () => {
    expect(targetScore(listing({ title: 'Analyst', location: 'Nashville' }), EMPTY_CAREER)).toBe(0);
  });
});

describe('what a contact has in common with the student', () => {
  const EDUCATION = 'Vanderbilt University, B.A. Economics and Political Science, 2029';

  it('matches a school or a course the student wrote into their own line', () => {
    expect(sharedWith(EDUCATION, 'Vanderbilt University')).toBe(true);
    expect(sharedWith(EDUCATION, 'economics')).toBe(true);
    expect(sharedWith(EDUCATION, 'Duke')).toBe(false);
  });

  /*
   * Everybody has nothing in common with a blank. A tag that matched on
   * emptiness would offer to filter a list of people down to the ones nothing
   * is known about, which is the opposite of what it is for.
   */
  it('shares nothing with an empty field on either side', () => {
    expect(sharedWith(EDUCATION, '')).toBe(false);
    expect(sharedWith(EDUCATION, '   ')).toBe(false);
    expect(sharedWith(EDUCATION, undefined)).toBe(false);
    expect(sharedWith('', 'Vanderbilt University')).toBe(false);
    expect(sharedWith('   ', 'Vanderbilt University')).toBe(false);
  });

  it('reads a note saved before the two fields existed rather than refusing it', () => {
    const before = contact('Priya');
    expect(readCareer({ ...EMPTY_CAREER, contacts: [before] }).contacts[0].school).toBeUndefined();
    expect(sharedTags(EDUCATION, before)).toEqual([]);
  });

  it('names both where both overlap, and refuses an overlong one', () => {
    const both = { ...contact('Priya'), school: 'Vanderbilt University', major: 'Economics' };
    expect(sharedTags(EDUCATION, both)).toEqual(['school', 'major']);
    expect(sharedTags(EDUCATION, { ...both, major: 'Chemistry' })).toEqual(['school']);
    expect(() => readCareer({ ...EMPTY_CAREER, contacts: [{ ...both, major: 'x'.repeat(201) }] })).toThrow();
  });
});

describe('the three outreach drafts', () => {
  const priya = contact('Priya');

  it('fills in only what the app knows, and leaves the rest in brackets', () => {
    const drafts = outreachDrafts({ ...priya, organization: 'Brookings' }, []);
    expect(drafts).toContain('# Messages to Priya');
    expect(drafts).toContain('Brookings');
    expect(drafts).toContain('Permission recorded: Not requested');
    expect(drafts.match(/\[/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it('is three asks, not one message repeated', () => {
    const drafts = outreachDrafts(priya, []);
    expect(drafts).toContain('## Asking for a first conversation');
    expect(drafts).toContain('## After you have spoken');
    expect(drafts).toContain('## Writing to somebody you have not met');
  });

  /*
   * The shared line belongs to the cold ask and nowhere else — it is the one
   * of the three where "we were both at X" is doing any work.
   */
  it('opens the cold ask on a shared attribute where one was recorded', () => {
    const together = { ...priya, school: 'Vanderbilt University', major: 'Economics' };
    expect(outreachDrafts(together, ['school'])).toContain('We were both at Vanderbilt University.');
    expect(outreachDrafts(together, ['major'])).toContain('We both studied Economics.');
  });

  it('asks for the sentence rather than inventing one where nothing is shared', () => {
    const drafts = outreachDrafts(priya, []);
    expect(drafts).toContain('[Say what you actually have in common.');
    expect(drafts).not.toMatch(/We were both at|We both studied/);
  });

  it('says nothing has been sent, because nothing has and nothing can be', () => {
    expect(outreachDrafts(priya, [])).toContain('Nothing has been sent');
  });

  it('writes a draft for a note with no name rather than addressing an empty string', () => {
    expect(outreachDrafts({ ...priya, name: '' }, [])).toContain('Hello [their name],');
  });
});
