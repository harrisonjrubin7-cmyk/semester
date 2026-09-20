// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blankDoc, fromMarkdown, runs, safeUrl, toMarkdown, unmarked, words, type Doc } from './document';
import { parts } from './docx';

const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

function withText(text: string): Doc {
  return { ...blankDoc('Paper'), id: 'd1', blocks: [{ kind: 'text', text }] };
}

describe('a URL this app will put behind words', () => {
  it('takes the three schemes a document has any business carrying', () => {
    expect(safeUrl('https://vanderbilt.edu')).toBe('https://vanderbilt.edu/');
    expect(safeUrl('http://example.com/a')).toBe('http://example.com/a');
    expect(safeUrl('mailto:someone@vanderbilt.edu')).toBe('mailto:someone@vanderbilt.edu');
  });

  /*
   * Checked against a list of three rather than against a list of the bad
   * ones. `javascript:` is the one everybody remembers; the point is the next
   * scheme somebody thinks of, which a denial list allows and this refuses.
   */
  it('refuses everything else, including the ones nobody lists', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://example.com/x',
    ]) {
      expect(safeUrl(bad), bad).toBe('');
    }
  });

  it('completes a bare domain, because that is what people type', () => {
    expect(safeUrl('vanderbilt.edu')).toBe('https://vanderbilt.edu/');
    expect(safeUrl('example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  /* Neither of these is a link out of the document, and stapling a scheme to
     the front of one would invent a destination nobody named. */
  it('does not turn a fragment or a relative path into a website', () => {
    expect(safeUrl('#notes')).toBe('');
    expect(safeUrl('../thing')).toBe('');
    expect(safeUrl('')).toBe('');
    expect(safeUrl('   ')).toBe('');
  });
});

/**
 * One run written the short way — the marks that are on, and nothing else.
 *
 * `runs` returns five of them, and spelling all five out on every line would
 * be a wall of `false` with the one interesting word buried in it.
 */
const piece = (text: string, on: Partial<Omit<ReturnType<typeof runs>[number], 'text'>> = {}) => ({
  text,
  bold: false,
  italic: false,
  strike: false,
  underline: false,
  highlight: false,
  code: false,
  link: '',
  ...on,
});

describe('links in a line of text', () => {
  it('reads the words and the target apart', () => {
    expect(runs('See [the syllabus](https://example.com/s.pdf) for dates.')).toEqual([
      piece('See '),
      piece('the syllabus', { link: 'https://example.com/s.pdf' }),
      piece(' for dates.'),
    ]);
  });

  it('keeps the marks inside a link on the link', () => {
    expect(runs('[**Trounstine**](https://example.com)')).toEqual([
      piece('Trounstine', { bold: true, link: 'https://example.com/' }),
    ]);
  });

  /*
   * A numbered citation is not a link. The space between `]` and `(` is the
   * whole of what tells them apart, and getting this wrong would turn every
   * bracketed reference in a politics paper into a hyperlink.
   */
  it('is not fooled by a bracketed citation', () => {
    const out = runs('As Tiebout argues [3] (see above), the model holds.');
    expect(out.every((r) => r.link === '')).toBe(true);
    expect(unmarked('As Tiebout argues [3] (see above), the model holds.')).toBe(
      'As Tiebout argues [3] (see above), the model holds.',
    );
  });

  it('leaves a target it will not follow on the page, brackets and all', () => {
    const out = runs('Click [here](javascript:alert(1)) now');
    expect(out.every((r) => r.link === '')).toBe(true);
    expect(unmarked('Click [here](javascript:alert(1)) now')).toContain('[here](javascript:alert(1))');
  });

  it('handles several in one paragraph, and text with none', () => {
    const out = runs('[a](https://a.com) and [b](https://b.com)');
    expect(out.filter((r) => r.link).map((r) => r.text)).toEqual(['a', 'b']);
    expect(runs('nothing here').every((r) => r.link === '')).toBe(true);
  });

  it('counts the words shown and not the address', () => {
    expect(words(withText('See [the syllabus](https://example.com/verylongpath) today'))).toBe(4);
  });
});

describe('a link in the exported .docx', () => {
  it('is a relationship, not a URL in the paragraph', () => {
    const made = parts(withText('See [the syllabus](https://example.com/s.pdf) for dates.')).text;
    const body = made['word/document.xml'];
    expect(body).toContain('<w:hyperlink r:id="rId3">');
    expect(body).not.toContain('https://example.com/s.pdf');

    const rels = parse(made['word/_rels/document.xml.rels']);
    const link = [...rels.querySelectorAll('Relationship')].find((r) => r.getAttribute('Id') === 'rId3');
    expect(link?.getAttribute('Target')).toBe('https://example.com/s.pdf');
    expect(link?.getAttribute('TargetMode')).toBe('External');
  });

  it('does not collide with the two relationships the part always has', () => {
    const rels = parse(parts(withText('[a](https://a.com)')).text['word/_rels/document.xml.rels']);
    const ids = [...rels.querySelectorAll('Relationship')].map((r) => r.getAttribute('Id'));
    expect(ids).toEqual(['rId1', 'rId2', 'rId3']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* What Word itself writes: one relationship per target, however often cited. */
  it('writes one relationship for a page cited twice', () => {
    const made = parts(withText('[one](https://a.com) and [two](https://a.com) and [three](https://b.com)')).text;
    const rels = parse(made['word/_rels/document.xml.rels']);
    expect(rels.querySelectorAll('Relationship').length).toBe(4);
    expect(made['word/document.xml'].match(/<w:hyperlink r:id="rId3">/g)?.length).toBe(2);
  });

  it('draws it the way a reader expects a link to look', () => {
    const body = parts(withText('[a](https://a.com)')).text['word/document.xml'];
    expect(body).toContain('<w:u w:val="single"/>');
    expect(body).toContain('<w:color w:val="0563C1"/>');
  });

  it('links from a list item and a heading as well as a paragraph', () => {
    const doc: Doc = {
      ...blankDoc('Paper'),
      id: 'd1',
      blocks: [
        { kind: 'heading', level: 2, text: '[Sources](https://a.com)' },
        { kind: 'bullets', items: ['[one](https://b.com)'], numbered: false },
      ],
    };
    const made = parts(doc).text;
    expect(made['word/document.xml'].match(/<w:hyperlink /g)?.length).toBe(2);
    expect(parse(made['word/_rels/document.xml.rels']).querySelectorAll('Relationship').length).toBe(4);
  });

  it('escapes a target with an ampersand in it, and stays well-formed', () => {
    const made = parts(withText('[search](https://example.com/?a=1&b=2)')).text;
    expect(() => parse(made['word/_rels/document.xml.rels'])).not.toThrow();
    expect(() => parse(made['word/document.xml'])).not.toThrow();
    const rels = parse(made['word/_rels/document.xml.rels']);
    const link = [...rels.querySelectorAll('Relationship')].find((r) => r.getAttribute('Id') === 'rId3');
    expect(link?.getAttribute('Target')).toBe('https://example.com/?a=1&b=2');
  });

  /*
   * The words stay on the page — including the target, as *text*. That is the
   * point: a refused link is visible and fixable, where a silently dropped
   * one is a sentence that lost a phrase and a silently kept one is the thing
   * being refused. What must not exist is a hyperlink or a relationship.
   */
  it('leaves a refused target as words with nothing behind them', () => {
    const made = parts(withText('[here](javascript:alert(1))')).text;
    expect(made['word/document.xml']).not.toContain('<w:hyperlink');
    expect(made['word/document.xml']).not.toContain('w:u w:val="single"');
    expect(parse(made['word/_rels/document.xml.rels']).querySelectorAll('Relationship').length).toBe(2);
    // Still readable on the page, brackets and all.
    expect(
      [...parse(made['word/document.xml']).querySelectorAll('t')].map((n) => n.textContent).join(''),
    ).toContain('[here](javascript:alert(1))');
  });

  it('leaves a document with no links exactly as it was', () => {
    const rels = parse(parts(withText('plain words')).text['word/_rels/document.xml.rels']);
    expect(rels.querySelectorAll('Relationship').length).toBe(2);
    expect(parts(withText('plain words')).text['word/document.xml']).not.toContain('hyperlink');
  });
});

describe('the Markdown round trip', () => {
  /*
   * Links are written in the form Markdown already uses, which is not a
   * coincidence: `toMarkdown` writes a paragraph's text out as it was typed
   * and `fromMarkdown` reads it back the same way, so a link survives an
   * export and a re-import without either of them knowing what one is.
   */
  it('carries a link out and back unchanged', () => {
    const line = 'See [the syllabus](https://example.com/s.pdf) for dates.';
    const doc = withText(line);
    const text = toMarkdown(doc);
    expect(text).toContain('[the syllabus](https://example.com/s.pdf)');
    const back = fromMarkdown(text);
    const paragraph = back.find((b) => b.kind === 'text' && b.text.includes('syllabus'));
    expect(paragraph && paragraph.kind === 'text' ? paragraph.text : '').toContain(line);
    expect(runs(line)[1].link).toBe('https://example.com/s.pdf');
  });
});
