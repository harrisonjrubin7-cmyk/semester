import { describe, expect, it } from 'vitest';
import {
  MOST_SEARCHES,
  RESEARCH_SYSTEM,
  asSource,
  brief,
  dedupe,
  explainSearch,
  readFound,
  searchTool,
  type Found,
} from './research';

const page = (url: string, title = 'A paper'): Found => ({ url, title, site: '' });

/** A successful result block, in the shape the API streams it. */
const ok = (rows: { url: string; title?: string }[]) => ({
  type: 'web_search_tool_result',
  content: rows,
});

describe('choosing the tool for the model', () => {
  it('uses the dated tool on the models that take it', () => {
    for (const m of ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5-1', 'claude-opus-4-6']) {
      expect(searchTool(m).type, m).toBe('web_search_20260209');
    }
  });

  it('falls back to the basic tool on a model that predates it', () => {
    // Haiku 4.5 is in this app's own model list and does not take the dated
    // type. Sending it anyway is a 400, not a degraded search.
    expect(searchTool('claude-haiku-4-5').type).toBe('web_search_20250305');
  });

  it('takes the conservative side on a model it does not recognise', () => {
    // The older type is accepted everywhere the newer one is, so an unknown
    // model gets the one that cannot fail on grounds of age.
    expect(searchTool('some-future-model').type).toBe('web_search_20250305');
    expect(searchTool('').type).toBe('web_search_20250305');
  });

  it('caps the searches, because each one is billed', () => {
    expect(searchTool('claude-opus-5').max_uses).toBe(MOST_SEARCHES);
  });
});

describe('reading a result block', () => {
  it('reads the rows out of a successful search', () => {
    const { found, error } = readFound(
      ok([{ url: 'https://www.jstor.org/stable/2009958', title: 'Deterrence and Perception' }]),
    );
    expect(error).toBe('');
    expect(found).toEqual([
      {
        url: 'https://www.jstor.org/stable/2009958',
        title: 'Deterrence and Perception',
        site: 'jstor.org',
      },
    ]);
  });

  it('treats an error object as an error, not as no results', () => {
    /*
     * The branch this function exists for. A server tool does not throw: a
     * failed search is HTTP 200 with `content` as an object rather than an
     * array. Indexing into it yields nothing, which renders as "nothing was
     * found" — a claim about the world made from a failed request, and the
     * one wrong answer here that looks exactly like a right one.
     */
    const { found, error } = readFound({
      type: 'web_search_tool_result',
      content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' },
    });
    expect(found).toEqual([]);
    expect(error).not.toBe('');
    expect(error).toContain(String(MOST_SEARCHES));
  });

  it('says something useful for each code it knows, and names one it does not', () => {
    expect(explainSearch('too_many_requests')).toMatch(/rate-limited/i);
    expect(explainSearch('query_too_long')).toMatch(/shorten/i);
    expect(explainSearch('unavailable')).toMatch(/unavailable/i);
    // An unknown code is still information. "Something went wrong" is the
    // sentence that teaches people the app does not know what happened.
    expect(explainSearch('brand_new_code')).toContain('brand_new_code');
    expect(explainSearch('')).toBe('The search failed.');
  });

  it('survives a block with nothing usable in it', () => {
    expect(readFound(null)).toEqual({ found: [], error: '' });
    expect(readFound({})).toEqual({ found: [], error: '' });
    expect(readFound({ content: 'not a list' })).toEqual({ found: [], error: '' });
  });

  it('drops a row with no URL, and falls back to the URL when there is no title', () => {
    const { found } = readFound(ok([{ url: '', title: 'No link' }, { url: 'https://x.org/a' }]));
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe('https://x.org/a');
  });
});

describe('the same page twice', () => {
  it('is one page, across the searches that each found it', () => {
    const list = dedupe([
      page('https://www.jstor.org/stable/2009958'),
      page('https://jstor.org/stable/2009958/'),
      page('https://www.jstor.org/stable/2009958#page_scan_tab_contents'),
      page('https://www.jstor.org/stable/2009958?utm_source=search'),
    ]);
    expect(list).toHaveLength(1);
  });

  it('keeps two genuinely different pages on one site', () => {
    expect(
      dedupe([page('https://x.org/a'), page('https://x.org/b')]),
    ).toHaveLength(2);
  });

  it('keeps a query that is part of the address rather than tracking', () => {
    // `?id=` selects the document; `?utm_source=` does not.
    expect(
      dedupe([page('https://x.org/p?id=1'), page('https://x.org/p?id=2')]),
    ).toHaveLength(2);
  });

  it('does not lose a row whose URL will not parse', () => {
    expect(dedupe([page('not a url'), page('also not a url')])).toHaveLength(2);
  });
});

describe('a found page, as a source row', () => {
  it('builds a line the sources parser can read', () => {
    const s = asSource(
      { title: 'Deterrence and Perception', url: 'https://x.org/a', site: 'x.org' },
      'psci' as never,
      'Midterm paper',
    );
    expect(s.raw).toContain('“Deterrence and Perception”');
    expect(s.raw).toContain('https://x.org/a');
    expect(s.url).toBe('https://x.org/a');
    expect(s.project).toBe('Midterm paper');
  });

  it('claims no author and no year, because a search result carries neither', () => {
    // A wrong author in a bibliography is worse than no author: the raw line
    // is right there to read, and a filled field looks like it was checked.
    const s = asSource(page('https://x.org/a'), null, '');
    expect(s.author).toBe('');
    expect(s.year).toBe('');
  });

  it('leaves the role empty, which is the field that earns marks', () => {
    // "What it is for in your argument" cannot honestly be filled in by
    // something that has read a search result. See the note in research.ts.
    expect(asSource(page('https://x.org/a'), null, '').role).toBe('');
  });
});

describe('the prompt', () => {
  it('forbids describing a source it did not open', () => {
    // The failure mode of this entire category, and the way it gets in is a
    // prompt that asks for references rather than for an account of pages.
    expect(RESEARCH_SYSTEM).toContain('Never describe a source you did not open');
    expect(RESEARCH_SYSTEM).toMatch(/invented citation/i);
  });

  it('forbids inventing the details a citation needs', () => {
    expect(RESEARCH_SYSTEM).toMatch(/Never state an author, a year, a journal or a page number/);
  });

  it('makes it say what kind of thing each source is', () => {
    // A list that presents a think-tank briefing and a peer-reviewed article
    // as equals costs marks in a way a student cannot see coming.
    expect(RESEARCH_SYSTEM).toMatch(/peer-reviewed/);
    expect(RESEARCH_SYSTEM).toMatch(/partisan/);
  });

  it('allows the honest answer that there is little there', () => {
    expect(RESEARCH_SYSTEM).toMatch(/not much good material/i);
    expect(RESEARCH_SYSTEM).toMatch(/librarian/i);
  });
});

describe('the question that goes out', () => {
  it('carries the question', () => {
    expect(brief('Does deterrence work?', '')).toBe('Does deterrence work?');
  });

  it('gives the course as context rather than as a search term', () => {
    /*
     * A search including "PSCI 1104" returns the syllabus, which is the one
     * document the student already has.
     */
    const out = brief('Does deterrence work?', 'PSCI 1104 — Introduction to International Politics');
    expect(out).toContain('PSCI 1104');
    expect(out).toMatch(/context, not a search term/);
  });
});
