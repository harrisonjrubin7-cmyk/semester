import { describe, expect, it } from 'vitest';
import {
  asLines,
  citeKey,
  completeness,
  forCourse,
  gaps,
  listFile,
  listName,
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

  it('escapes the characters that would break the entry, and keeps them', () => {
    // This used to assert stripping — "Braces and backslashes", with the
    // author's own characters quietly gone. Escaping renders the same on the
    // page and does not edit somebody's title to make the export work.
    const out = toBibtex([source({ title: 'Braces {and} back\\slashes' })]);
    expect(out).toContain('title = {Braces \\{and\\} back\\textbackslash{}slashes}');
  });

  it('escapes the five that break LaTeX rather than BibTeX', () => {
    // `%` is the one that costs most: it opens a comment, so the rest of the
    // line goes, closing brace included, and usually the entries after it.
    const out = toBibtex([source({ title: 'The 50% Rule in R&D: $5, #3, cost_benefit' })]);
    expect(out).toContain('title = {The 50\\% Rule in R\\&D: \\$5, \\#3, cost\\_benefit}');
  });

  it('escapes a url, where percent-encoding puts one there unasked', () => {
    const out = toBibtex([source({ url: 'https://x.org/a%20b_c#frag' })]);
    expect(out).toContain('url = {https://x.org/a\\%20b\\_c\\#frag}');
  });

  it('escapes the two that render as something else without complaining', () => {
    const out = toBibtex([source({ title: 'a ~ b and x^2' })]);
    expect(out).toContain('\\textasciitilde{}');
    expect(out).toContain('\\textasciicircum{}');
  });

  it('does not escape the backslashes it just inserted', () => {
    // One pass, not several: escaping `&` and then escaping backslashes would
    // turn `\&` into `\textbackslash{}&`.
    const out = toBibtex([source({ title: 'R&D' })]);
    expect(out).toContain('title = {R\\&D}');
    expect(out).not.toContain('textbackslash');
  });

  it('leaves ordinary words exactly as they were', () => {
    const out = toBibtex([source({ title: 'Segregation by Design' })]);
    expect(out).toContain('title = {Segregation by Design}');
  });

  it('gives two sources distinct keys', () => {
    const out = toBibtex([source({ id: 'one' }), source({ id: 'two' })]);
    expect(out).toContain('trounstine2018segregation,');
    expect(out).toContain('trounstine2018segregation2,');
  });
});

describe('what the list is called', () => {
  it('names the course, and the project inside it', () => {
    expect(listName('ECON 1020', '')).toBe('ECON 1020 sources');
    expect(listName('ECON 1020', 'Midterm paper')).toBe('ECON 1020 · Midterm paper sources');
  });

  it('never says "Everything sources", which is what it used to say', () => {
    /*
     * The defect, and the state of the screen nobody has to choose: the course
     * picker's first option is labelled "Everything", the screen used that
     * label as the scope, and the heading came out as a phrase no one would
     * write. It left the app too — see the export tests below.
     */
    expect(listName('', '')).toBe('All sources');
    expect(listName('', '')).not.toMatch(/everything/i);
  });

  it('lets a project name the list when no course narrows it', () => {
    // "All · Midterm paper" names the absence of a narrowing and then
    // contradicts it in the next word.
    expect(listName('', 'Midterm paper')).toBe('Midterm paper sources');
  });

  it('reads as a noun phrase in every scope there is', () => {
    /*
     * The property rather than four spellings of it — and the third assertion
     * is the one that matters. Written with only the first two, this test
     * passed against the defect: "Everything sources" starts with a capital
     * and ends in the thing it is a list of, and is still a phrase nobody
     * would write. A sweep that agrees with the bug is a sweep that will agree
     * with the next one, so it asks the thing that is actually true here —
     * **the picker's word for a choice never reaches the heading.**
     */
    for (const course of ['', 'ECON 1020']) {
      for (const project of ['', 'Midterm paper']) {
        const name = listName(course, project);
        expect(name, `${course}/${project}`).toMatch(/^[A-Z]/);
        expect(name, `${course}/${project}`).toMatch(/ sources$/);
        expect(name, `${course}/${project}`).not.toMatch(/everything/i);
      }
    }
  });

  it('ignores whitespace that would otherwise draw a separator', () => {
    // A project field holding only spaces is a real state — the input is
    // optional — and ` · ` hanging off a heading is how it used to show.
    expect(listName('ECON 1020', '   ')).toBe('ECON 1020 sources');
    expect(listName('  ', '  ')).toBe('All sources');
  });
});

describe('the list as a file name', () => {
  it('builds a name from the heading', () => {
    expect(listFile('ECON 1020 sources', 'bib')).toBe('econ-1020-sources.bib');
  });

  it('collapses the separator rather than leaving a stray dash', () => {
    expect(listFile('ECON 1020 · Midterm paper sources', 'md')).toBe(
      'econ-1020-midterm-paper-sources.md',
    );
  });

  it('does not start or end a name with a dash', () => {
    // A project called "(draft)" is the case: some tools read a leading dash
    // as the start of an option rather than as a name.
    expect(listFile('(draft) sources', 'bib')).toBe('draft-sources.bib');
    expect(listFile('sources!', 'md')).toBe('sources.md');
  });

  it('never produces a hidden file', () => {
    // Every character unusable leaves an empty stem, and `.md` is a hidden
    // file on every system this app runs on — a download that vanishes.
    expect(listFile('···', 'md')).toBe('sources.md');
    expect(listFile('', 'bib')).toBe('sources.bib');
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

  it('titles the exported list with the name the screen shows', () => {
    // The heading is not only a heading. This is the line a student sees at
    // the top of a file they hand to somebody else, and it is where
    // "# Everything sources" used to end up.
    expect(toMarkdown([source()], listName('', ''))).toContain('# All sources');
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
