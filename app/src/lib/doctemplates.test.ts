import { describe, expect, it } from 'vitest';
import { TEMPLATES, fromTemplate, templateById } from './doctemplates';
import { hasContent, unmarked, words } from './document';

describe('every template', () => {
  it('is a shape, never a sentence anybody could hand in', () => {
    /*
     * The rule this file exists under. A template that arrived with a
     * paragraph in it is a template that gets submitted with that paragraph
     * still in it — so every one of them is headings and blanks, and the words
     * they do carry are labels for fields.
     */
    for (const t of TEMPLATES) {
      const doc = fromTemplate(t, 'A title');
      for (const block of doc.blocks) {
        if (block.kind !== 'text') continue;
        const text = unmarked(block.text).trim();
        // A field label like "To · From · Date · Subject" is allowed; a
        // sentence is not. Nothing here reaches ten words or ends in a stop.
        expect(text.split(/\s+/).filter(Boolean).length).toBeLessThan(10);
        expect(text.endsWith('.')).toBe(false);
      }
    }
  });

  it('is short enough that nothing in it reads as written work', () => {
    for (const t of TEMPLATES) {
      expect(words({ ...fromTemplate(t, 'T'), id: 'x' })).toBeLessThan(60);
    }
  });

  it('has structure in it, so it beats a blank page', () => {
    for (const t of TEMPLATES) {
      const doc = fromTemplate(t, 'T');
      expect(hasContent({ ...doc, id: 'x' })).toBe(true);
      expect(doc.blocks.filter((b) => b.kind === 'heading').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('takes the title it is given, and falls back to its own name', () => {
    const t = templateById('lecture')!;
    expect(fromTemplate(t, 'Week 4').title).toBe('Week 4');
    expect(fromTemplate(t, '   ').title).toBe('Lecture notes');
  });

  it('files itself against a course when it is given one', () => {
    expect(fromTemplate(TEMPLATES[0], 'x', 'econ').courseId).toBe('econ');
    expect(fromTemplate(TEMPLATES[0], 'x').courseId).toBeNull();
  });

  it('has a unique id and a blurb', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.blurb.length).toBeGreaterThan(10);
  });
});

describe('the three citation styles', () => {
  const of = (id: string) => fromTemplate(templateById(id)!, 'Paper').blocks;
  const headings = (id: string) =>
    of(id).filter((b) => b.kind === 'heading').map((b) => (b as { text: string }).text);

  it('names each reference list the way its style names it', () => {
    // The one thing about a citation style that is a fact rather than content.
    expect(headings('essay-mla')).toContain('Works Cited');
    expect(headings('essay-apa')).toContain('References');
    expect(headings('essay-chicago')).toContain('Bibliography');
  });

  it('puts MLA’s four lines before the title, with no title page', () => {
    const blocks = of('essay-mla');
    expect(blocks[0]).toMatchObject({ kind: 'text', text: 'Your name' });
    expect(blocks[4]).toMatchObject({ kind: 'heading', level: 1 });
    expect(blocks.some((b) => b.kind === 'break')).toBe(true);
  });

  it('gives APA and Chicago a title page, ended by a break', () => {
    for (const id of ['essay-apa', 'essay-chicago']) {
      const blocks = of(id);
      expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
      const firstBreak = blocks.findIndex((b) => b.kind === 'break');
      expect(firstBreak).toBeGreaterThan(0);
      expect(firstBreak).toBeLessThan(8);
    }
  });

  it('leaves every field blank, because the app does not know who you are', () => {
    for (const id of ['essay-mla', 'essay-apa', 'essay-chicago']) {
      const texts = of(id).filter((b) => b.kind === 'text').map((b) => (b as { text: string }).text);
      expect(texts).not.toContain(expect.stringContaining('@'));
      // The placeholders name the field; none of them is a real name.
      expect(texts.some((t) => t === 'Your name')).toBe(true);
    }
  });
});

describe('the ones a policy or economics course sets', () => {
  it('puts the memo’s recommendation before its background', () => {
    // The way a brief is actually read: the answer, then why.
    const blocks = fromTemplate(templateById('memo')!, 'Memo').blocks;
    const at = (text: string) =>
      blocks.findIndex((b) => b.kind === 'heading' && (b as { text: string }).text === text);
    expect(at('Recommendation')).toBeLessThan(at('Background'));
    expect(at('Recommendation')).toBeLessThan(at('Analysis'));
  });

  it('puts the lab report’s method before its results', () => {
    const blocks = fromTemplate(templateById('lab')!, 'Lab').blocks;
    const at = (text: string) =>
      blocks.findIndex((b) => b.kind === 'heading' && (b as { text: string }).text === text);
    expect(at('Method')).toBeLessThan(at('Results'));
    expect(at('Results')).toBeLessThan(at('Analysis'));
  });

  it('gives the problem set somewhere to show the working', () => {
    const blocks = fromTemplate(templateById('problem')!, 'PS1').blocks;
    expect(blocks.filter((b) => b.kind === 'equation').length).toBeGreaterThanOrEqual(2);
  });

  it('gives the reading response a citation to fill in', () => {
    const blocks = fromTemplate(templateById('reading')!, 'R').blocks;
    const quote = blocks.find((b) => b.kind === 'quote');
    expect(quote).toMatchObject({ text: '', source: 'Author, title, page' });
  });
});
