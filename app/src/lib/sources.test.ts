import { describe, expect, it } from 'vitest';
import {
  asLines,
  citeKey,
  completeness,
  forCourse,
  gaps,
  parse,
  projects,
  toBibtex,
  toMarkdown,
  type Source,
} from './sources';

const source = (over: Partial<Source> = {}): Source => ({
  id: 'abc123def',
  raw: 'Trounstine, J. (2018). Segregation by Design. Cambridge University Press.',
  author: 'Trounstine, J',
  year: '2018',
  title: 'Segregation by Design',
  container: '',
  url: '',
  role: 'The counter-case to the growth-machine story',
  courseId: 'psci',
  project: 'Federalism paper',
  created: 1,
  ...over,
});

describe('parse', () => {
  it('takes a bracketed year', () => {
    expect(parse('Trounstine, J. (2018). Segregation by Design.').year).toBe('2018');
  });

  it('takes a year fenced by punctuation', () => {
    expect(parse('Konner, M., 2010, The Evolution of Childhood.').year).toBe('2010');
  });

  it('does not read a number in a title as a year', () => {
    // "Chapter 1984 of" is not a date, and a wrong one propagates to the key.
    expect(parse('Orwell and the Chapter 1984 of that book').year).toBe('');
  });

  it('takes a quoted title and leaves an unquoted one alone', () => {
    expect(parse('Konner, M. “Play, Social Learning, and Teaching”.').title).toBe(
      'Play, Social Learning, and Teaching',
    );
    expect(parse('Konner, M. Play and social learning.').title).toBe('');
  });

  it('takes a URL', () => {
    expect(parse('Something, see https://example.org/paper.pdf for it').url).toBe(
      'https://example.org/paper.pdf',
    );
  });

  it('reads an author only when the head looks like names', () => {
    expect(parse('Trounstine, J. (2018). Segregation by Design.').author).toBe('Trounstine, J');
    // A sentence is not an author, and guessing one produces a bibliography
    // that is wrong in a way nobody proofreads. Both of these were filed as
    // authors by an earlier version — the second only showed up on screen.
    expect(parse('The lecture slides from the third week').author).toBe('');
    expect(parse('The lecture slides from week three').author).toBe('');
    expect(parse('Notes I took in the review session').author).toBe('');
  });

  it('takes a two-author line, which has no comma and is still names', () => {
    expect(parse('Acemoglu and Robinson (2012). Why Nations Fail.').author).toBe('');
    expect(parse('Acemoglu & Robinson (2012). Why Nations Fail.').author).toBe(
      'Acemoglu & Robinson',
    );
  });

  it('always keeps the line exactly as it was given', () => {
    const line = '  Konner, M. (2010). The Evolution of Childhood.  ';
    expect(parse(line).raw).toBe(line.trim());
  });
});

describe('forCourse and projects', () => {
  it('filters to one course, newest first', () => {
    const all = [
      source({ id: 'a', courseId: 'psci', created: 1 }),
      source({ id: 'b', courseId: 'psci', created: 3 }),
      source({ id: 'c', courseId: 'econ', created: 2 }),
    ];
    expect(forCourse(all, 'psci').map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('gives everything when no course is named', () => {
    expect(forCourse([source({ id: 'a' }), source({ id: 'c', courseId: 'econ' })], null)).toHaveLength(2);
  });

  it('lists the distinct project names, and no blank one', () => {
    const all = [
      source({ project: 'Federalism paper' }),
      source({ project: 'Federalism paper' }),
      source({ project: '' }),
      source({ project: 'Case brief' }),
    ];
    expect(projects(all)).toEqual(['Case brief', 'Federalism paper']);
  });
});

describe('asLines', () => {
  it('hands over the raw line, not a tidied one', () => {
    // A citation the app reformatted is a citation the app has altered.
    expect(asLines([source({ role: '' })])).toBe(source().raw);
  });

  it('carries what each source is for, which is the part that earns marks', () => {
    expect(asLines([source()])).toContain('— for: The counter-case');
  });
});

describe('citeKey', () => {
  it('is surname, year and a word of the title', () => {
    expect(citeKey(source())).toBe('trounstine2018segregation');
  });

  it('falls back rather than colliding when two share a key', () => {
    const taken = new Set(['trounstine2018segregation']);
    expect(citeKey(source(), taken)).toBe('trounstine2018segregation2');
  });

  it('still returns something usable with no author and no title', () => {
    const key = citeKey(source({ author: '', title: '', year: '' }));
    expect(key).toBe('sourceabc123');
  });
});

describe('toBibtex', () => {
  it('writes an entry from the fields that were entered', () => {
    const out = toBibtex([source()]);
    expect(out).toContain('@misc{trounstine2018segregation,');
    expect(out).toContain('author = {Trounstine, J}');
    expect(out).toContain('year = {2018}');
  });

  it('leaves out a field the app does not have rather than guessing one', () => {
    const out = toBibtex([source({ year: '', url: '' })]);
    expect(out).not.toContain('year =');
    expect(out).not.toContain('url =');
  });

  it('always keeps the raw line, which is the only field guaranteed correct', () => {
    const out = toBibtex([source({ author: '', title: '', year: '' })]);
    expect(out).toContain('note = {Trounstine, J. (2018). Segregation by Design.');
  });

  it('strips the characters that would break the entry and every one after it', () => {
    const out = toBibtex([source({ title: 'Braces {and} back\\slashes' })]);
    expect(out).toContain('title = {Braces and backslashes}');
  });

  it('gives two sources distinct keys', () => {
    const out = toBibtex([source({ id: 'one' }), source({ id: 'two' })]);
    expect(out).toContain('trounstine2018segregation,');
    expect(out).toContain('trounstine2018segregation2,');
  });
});

describe('toMarkdown', () => {
  it('lists the raw lines under a heading, with what each is for', () => {
    const out = toMarkdown([source()], 'PSCI 1104 sources');
    expect(out).toContain('# PSCI 1104 sources');
    expect(out).toContain('- Trounstine');
    expect(out).toContain('**For:** The counter-case');
  });

  it('leaves out the For line when there is none', () => {
    expect(toMarkdown([source({ role: '' })], 'x')).not.toContain('**For:**');
  });
});

describe('gaps and completeness', () => {
  it('names what is missing', () => {
    expect(gaps(source())).toEqual([]);
    expect(gaps(source({ role: '', year: '' }))).toEqual(['what it is for', 'a year']);
  });

  it('says plainly when the list is empty', () => {
    expect(completeness([])).toBe('Nothing here yet.');
  });

  it('says how many do not say what they are for, without scoring the list', () => {
    const said = completeness([source(), source({ role: '' })]);
    expect(said).toContain('1 does not say');
    expect(said).not.toMatch(/%/);
  });

  it('confirms a complete list rather than staying silent', () => {
    expect(completeness([source()])).toContain('every one says what it is for');
  });
});
