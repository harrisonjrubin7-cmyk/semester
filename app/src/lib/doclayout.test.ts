import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  PAGE_STYLES,
  adjusted,
  fontStack,
  fromStyle,
  layoutOf,
  lineHeight,
  pageSize,
  pages,
  styleNamed,
} from './doclayout';
import { parts } from './docx';
import { blankDoc, type Doc } from './document';

/**
 * The page setup, which is the difference between a file you hand in and a
 * file you have to open Word to fix.
 *
 * Every assertion here is something a syllabus says in words. "Double-spaced,
 * 12-point Times New Roman, one-inch margins" is three numbers in the .docx,
 * and getting any of the three wrong is invisible on this screen and obvious
 * to the marker.
 */

const doc = (over: Partial<Doc> = {}): Doc => ({
  id: 'd1',
  ...blankDoc('Tariffs and the 1930 vote'),
  ...over,
});

describe('the presets', () => {
  it('gives each a distinct name and a line saying who asks for it', () => {
    expect(new Set(PAGE_STYLES.map((s) => s.id)).size).toBe(PAGE_STYLES.length);
    for (const s of PAGE_STYLES) expect(s.says.length).toBeGreaterThan(10);
  });

  it('sets the three things a humanities syllabus asks for', () => {
    const mla = fromStyle('mla');
    expect(mla.font).toBe('Times New Roman');
    expect(mla.size).toBe(12);
    expect(mla.spacing).toBe('double');
    expect(mla.margin).toBe(1);
  });

  it('puts a surname beside the number for MLA and the number alone for the rest', () => {
    expect(fromStyle('mla').runningHead).not.toBe('');
    expect(fromStyle('apa').runningHead).toBe('');
    expect(fromStyle('apa').numbers).toBe(true);
    expect(fromStyle('chicago').numbers).toBe(true);
  });

  it('reads an unknown name as the app’s own rather than throwing', () => {
    expect(styleNamed('nonsense' as never).id).toBe('own');
    expect(layoutOf({})).toEqual(DEFAULT_LAYOUT);
  });
});

describe('editing a preset', () => {
  it('stops claiming to be the preset once something is changed', () => {
    const mine = adjusted(fromStyle('mla'), { font: 'Arial' });
    expect(mine.style).toBe('own');
    expect(mine.spacing).toBe('double');
  });

  /*
   * The other direction, which is the one that would have been left out: a
   * page edited back into agreement with a preset is that preset again, and
   * a picker showing "your own settings" over a page that is exactly MLA is
   * the picker lying the other way round.
   */
  it('claims it again when the change is undone', () => {
    const back = adjusted(adjusted(fromStyle('mla'), { font: 'Arial' }), { font: 'Times New Roman' });
    expect(back.style).toBe('mla');
  });
});

describe('measuring the page', () => {
  it('knows the two papers anybody prints on', () => {
    expect(pageSize('letter').width).toBeCloseTo(8.5, 2);
    expect(pageSize('a4').height).toBeCloseTo(11.69, 2);
  });

  it('reads single as Word’s single rather than as a true 1.0', () => {
    expect(lineHeight('single')).toBeCloseTo(1.15, 3);
    expect(lineHeight('double')).toBe(2);
  });

  it('halves the pages-per-word when the spacing doubles', () => {
    const single = pages(1000, fromStyle('own'));
    const double = pages(1000, { ...fromStyle('own'), spacing: 'double' });
    expect(double).toBeGreaterThan(single);
  });

  it('never says nothing — a one-word document is one page', () => {
    expect(pages(1, DEFAULT_LAYOUT)).toBe(1);
  });

  it('gives every font a stack a browser can actually draw', () => {
    expect(fontStack('Times New Roman')).toContain('serif');
    expect(fontStack('nothing by that name')).toBe(fontStack('Times New Roman'));
  });
});

describe('what reaches the Word file', () => {
  it('writes the font, the size and the spacing the layout asked for', () => {
    const styles = parts(doc({ layout: fromStyle('mla') })).text['word/styles.xml'];
    expect(styles).toContain('w:ascii="Times New Roman"');
    // 12 point is 24 half-points, and double spacing is 12 × 20 × 2.
    expect(styles).toContain('<w:sz w:val="24"/>');
    expect(styles).toContain('w:line="480"');
  });

  it('drops the gap between paragraphs when the spacing is not single', () => {
    expect(parts(doc({ layout: fromStyle('mla') })).text['word/styles.xml']).toContain('w:after="0"');
    expect(parts(doc({ layout: fromStyle('own') })).text['word/styles.xml']).toContain('w:after="160"');
  });

  it('sets the page to the paper and the margins chosen', () => {
    const a4 = parts(doc({ layout: adjusted(fromStyle('own'), { paper: 'a4', margin: 1.5 }) })).text;
    expect(a4['word/document.xml']).toContain('w:w="11909"');
    expect(a4['word/document.xml']).toContain('w:top="2160"');
  });

  /*
   * A header is three files agreeing — the part, its content type and the
   * relationship — and the failure when one is missing is not a missing
   * header. Word reports the whole document as unreadable.
   */
  it('writes a header part, its type and its relationship together, or none of them', () => {
    const numbered = parts(doc({ layout: fromStyle('apa') })).text;
    expect(numbered['word/header1.xml']).toContain('PAGE');
    expect(numbered['[Content_Types].xml']).toContain('/word/header1.xml');
    expect(numbered['word/_rels/document.xml.rels']).toContain('Target="header1.xml"');
    expect(numbered['word/document.xml']).toContain('<w:headerReference');

    const plain = parts(doc({ layout: fromStyle('own') })).text;
    expect(plain['word/header1.xml']).toBeUndefined();
    expect(plain['[Content_Types].xml']).not.toContain('header1.xml');
    expect(plain['word/document.xml']).not.toContain('<w:headerReference');
  });

  it('puts the surname in front of the number when one is asked for', () => {
    const head = parts(doc({ layout: adjusted(fromStyle('mla'), { runningHead: 'Rubin' }) })).text;
    expect(head['word/header1.xml']).toContain('Rubin');
  });

  it('breaks the page after the title when the title has a page of its own', () => {
    expect(parts(doc({ layout: fromStyle('apa') })).text['word/document.xml']).toContain(
      'w:type="page"',
    );
    expect(parts(doc({ layout: fromStyle('mla') })).text['word/document.xml']).not.toContain(
      'w:type="page"',
    );
  });
});
