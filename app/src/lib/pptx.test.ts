// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { bodySize, deckFileName, parts, xml, type Deck } from './pptx';

const deck = (over: Partial<Deck> = {}): Deck => ({
  title: 'Federalism',
  subtitle: 'PSCI 1104',
  slides: [
    { title: 'Federalism', bullets: [], note: 'PSCI 1104', opening: true },
    { title: 'Two sovereigns', bullets: ['States and the union', 'Neither is a delegate'] },
  ],
  ...over,
});

const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

describe('xml', () => {
  it('escapes the five characters that would end the document early', () => {
    expect(xml(`Marks & Spencer <"'>`)).toBe('Marks &amp; Spencer &lt;&quot;&apos;&gt;');
  });

  it('drops control characters, which XML 1.0 has no escape for at all', () => {
    expect(xml('a\u0000b\u0007c')).toBe('abc');
  });

  it('keeps the whitespace that is legal', () => {
    expect(xml('a\tb\nc')).toBe('a\tb\nc');
  });
});

describe('parts', () => {
  it('is XML, all of it', () => {
    for (const [name, body] of Object.entries(parts(deck()))) {
      expect(() => parse(body), name).not.toThrow();
    }
  });

  it('writes one slide part per slide, and declares each one', () => {
    const p = parts(deck());
    expect(p['ppt/slides/slide1.xml']).toBeTruthy();
    expect(p['ppt/slides/slide2.xml']).toBeTruthy();
    expect(p['ppt/slides/slide3.xml']).toBeUndefined();
    const types = p['[Content_Types].xml'];
    expect(types).toContain('/ppt/slides/slide1.xml');
    expect(types).toContain('/ppt/slides/slide2.xml');
  });

  it('closes the relationship graph — every r:id resolves to a part that exists', () => {
    const p = parts(deck());
    const rels = parse(p['ppt/_rels/presentation.xml.rels']);
    const targets = new Map<string, string>();
    for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
      targets.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
    }
    const pres = parse(p['ppt/presentation.xml']);
    const used = [
      ...Array.from(pres.getElementsByTagName('p:sldMasterId')),
      ...Array.from(pres.getElementsByTagName('p:sldId')),
    ].map((n) => n.getAttribute('r:id') ?? '');
    expect(used.length).toBe(3); // one master, two slides
    for (const id of used) {
      const target = targets.get(id);
      expect(target, id).toBeTruthy();
      expect(p[`ppt/${target}`], target).toBeTruthy();
    }
  });

  it('gives every shape on a slide a distinct id, which PowerPoint requires', () => {
    const doc = parse(parts(deck())['ppt/slides/slide2.xml']);
    const ids = Array.from(doc.getElementsByTagName('p:cNvPr')).map((n) => n.getAttribute('id'));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts the text on the slide it belongs to', () => {
    const p = parts(deck());
    expect(p['ppt/slides/slide2.xml']).toContain('Neither is a delegate');
    expect(p['ppt/slides/slide1.xml']).not.toContain('Neither is a delegate');
  });

  it('escapes text on the way in rather than producing a broken part', () => {
    const p = parts(deck({ slides: [{ title: 'Guns & butter <or>', bullets: [] }] }));
    expect(() => parse(p['ppt/slides/slide1.xml'])).not.toThrow();
    expect(p['ppt/slides/slide1.xml']).toContain('Guns &amp; butter');
  });

  it('still writes an openable deck when there are no slides at all', () => {
    const p = parts(deck({ slides: [] }));
    expect(p['ppt/slides/slide1.xml']).toContain('Federalism');
    expect(() => parse(p['ppt/presentation.xml'])).not.toThrow();
  });

  it('sets the page to 16:9 at PowerPoint’s own default size', () => {
    const doc = parse(parts(deck())['ppt/presentation.xml']);
    const size = doc.getElementsByTagName('p:sldSz')[0];
    expect(size.getAttribute('cx')).toBe('12192000');
    expect(size.getAttribute('cy')).toBe('6858000');
  });
});

describe('a table on a slide', () => {
  const withTable = () =>
    parts(
      deck({
        slides: [
          {
            title: 'Marks',
            bullets: [],
            table: [
              ['Piece', 'Weight'],
              ['Midterm', '30%'],
              ['Final', '40%'],
            ],
          },
        ],
      }),
    )['ppt/slides/slide1.xml'];

  it('is a real table rather than a picture or a run of bullets', () => {
    const doc = parse(withTable());
    expect(doc.getElementsByTagName('a:tbl')).toHaveLength(1);
    expect(doc.getElementsByTagName('a:tr')).toHaveLength(3);
    // Three columns' worth of grid for a two-column table would silently
    // squash every cell; the grid has to match the widest row.
    expect(doc.getElementsByTagName('a:gridCol')).toHaveLength(2);
  });

  it('names the graphic PowerPoint has to look up, or the slide opens empty', () => {
    expect(withTable()).toContain(
      'uri="http://schemas.openxmlformats.org/drawingml/2006/table"',
    );
  });

  it('draws its own borders rather than naming a style it does not ship', () => {
    // A missing style id is where the three applications disagree: PowerPoint
    // substitutes a blue banded style and Google Slides draws nothing.
    expect(withTable()).not.toContain('tableStyleId');
    expect(withTable()).toContain('<a:lnL');
  });

  it('pads a short row so the columns do not shift', () => {
    const doc = parse(
      parts(
        deck({
          slides: [{ title: 'x', bullets: [], table: [['a', 'b'], ['1']] }],
        }),
      )['ppt/slides/slide1.xml'],
    );
    expect(doc.getElementsByTagName('a:tc')).toHaveLength(4);
  });

  it('escapes a cell, because an ampersand in a heading breaks the file', () => {
    const out = parts(
      deck({ slides: [{ title: 'x', bullets: [], table: [['Marks & Spencer']] }] }),
    )['ppt/slides/slide1.xml'];
    expect(out).toContain('Marks &amp; Spencer');
    expect(() => parse(out)).not.toThrow();
  });
});

describe('an equation on a slide', () => {
  it('is one line of text, which every reader lays out the same way', () => {
    const out = parts(
      deck({ slides: [{ title: 'Elasticity', bullets: [], equation: 'E = (ΔQ)/(ΔP)' }] }),
    )['ppt/slides/slide1.xml'];
    expect(out).toContain('E = (ΔQ)/(ΔP)');
    // Deliberately not an equation object: OMML in a slide needs an
    // `mc:AlternateContent` block Keynote and Google Slides read differently.
    expect(out).not.toContain('m:oMath');
  });
});

describe('bodySize', () => {
  it('sets a short slide large and a full one smaller', () => {
    expect(bodySize(['One', 'Two'])).toBeGreaterThan(bodySize(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']));
  });

  it('drops the size for a few long bullets, not just for many of them', () => {
    const long = ['x'.repeat(120), 'y'.repeat(120)];
    expect(bodySize(long)).toBeLessThan(bodySize(['short', 'also short']));
  });
});

describe('deckFileName', () => {
  it('is a lowercase slug ending in .pptx', () => {
    expect(deckFileName('Federalism & the States')).toBe('federalism-the-states.pptx');
  });

  it('never returns a bare extension', () => {
    expect(deckFileName('???')).toBe('deck.pptx');
  });
});

describe('speaker notes', () => {
  const withNotes = {
    title: 'Sanctions',
    subtitle: '',
    slides: [
      { title: 'Opening', bullets: [], opening: true, notes: 'Say hello.\n\nThen the question.' },
      { title: 'Plain', bullets: ['a'] },
    ],
  };

  it('writes a notes part only for the slides that have any', () => {
    const files = parts(withNotes);
    expect(files['ppt/notesSlides/notesSlide1.xml']).toBeDefined();
    // An empty notes slide on every slide is a file half again as large
    // saying nothing.
    expect(files['ppt/notesSlides/notesSlide2.xml']).toBeUndefined();
  });

  it('carries the text, one paragraph per line', () => {
    const doc = new DOMParser().parseFromString(
      parts(withNotes)['ppt/notesSlides/notesSlide1.xml'],
      'application/xml',
    );
    const said = [...doc.getElementsByTagName('a:t')].map((n) => n.textContent);
    expect(said).toEqual(['Say hello.', 'Then the question.']);
  });

  it('keeps the slide-image placeholder, without which PowerPoint repairs the file', () => {
    expect(parts(withNotes)['ppt/notesSlides/notesSlide1.xml']).toContain('type="sldImg"');
  });

  it('closes the relationship graph in both directions', () => {
    const files = parts(withNotes);
    // Slide → its notes.
    expect(files['ppt/slides/_rels/slide1.xml.rels']).toContain(
      'Target="../notesSlides/notesSlide1.xml"',
    );
    // Notes → back to its slide.
    expect(files['ppt/notesSlides/_rels/notesSlide1.xml.rels']).toContain(
      'Target="../slides/slide1.xml"',
    );
    // And the slide with no notes gains no second relationship.
    expect(files['ppt/slides/_rels/slide2.xml.rels']).not.toContain('notesSlide');
  });

  it('declares the notes part in [Content_Types]', () => {
    const types = parts(withNotes)['[Content_Types].xml'];
    expect(types).toContain('/ppt/notesSlides/notesSlide1.xml');
    expect(types).not.toContain('/ppt/notesSlides/notesSlide2.xml');
  });

  it('escapes what a person actually types into a note', () => {
    const files = parts({
      title: 't',
      subtitle: '',
      slides: [{ title: 's', bullets: [], notes: 'Ask & wait <5s>' }],
    });
    expect(files['ppt/notesSlides/notesSlide1.xml']).toContain('Ask &amp; wait &lt;5s&gt;');
  });

  it('adds nothing at all to a deck with no notes', () => {
    const files = parts({ title: 't', subtitle: '', slides: [{ title: 's', bullets: [] }] });
    expect(Object.keys(files).some((n) => n.includes('notesSlide'))).toBe(false);
  });
});

describe('the notes master', () => {
  const withNotes = {
    title: 'T',
    subtitle: '',
    slides: [{ title: 'A', bullets: [], notes: 'Say this.' }],
  };

  /*
   * A notesSlide is not valid on its own. Without a master, PowerPoint opens
   * the file with "we found a problem with some content" and repairs it —
   * usually keeping the slides and dropping the notes, so the feature appears
   * to work right up until the moment it is needed.
   */
  it('is written, declared and related when a deck has notes', () => {
    const files = parts(withNotes);
    expect(files['ppt/notesMasters/notesMaster1.xml']).toBeDefined();
    expect(files['[Content_Types].xml']).toContain('/ppt/notesMasters/notesMaster1.xml');
    expect(files['ppt/_rels/presentation.xml.rels']).toContain('notesMasters/notesMaster1.xml');
    expect(files['ppt/presentation.xml']).toContain('<p:notesMasterIdLst>');
  });

  it('is what each notes slide points at, as well as its own slide', () => {
    const rels = parts(withNotes)['ppt/notesSlides/_rels/notesSlide1.xml.rels'];
    expect(rels).toContain('../notesMasters/notesMaster1.xml');
    expect(rels).toContain('../slides/slide1.xml');
  });

  it('has a theme of its own, as the format requires', () => {
    expect(parts(withNotes)['ppt/notesMasters/_rels/notesMaster1.xml.rels']).toContain('theme1.xml');
  });

  it('is absent entirely from a deck with no notes', () => {
    const files = parts({ title: 'T', subtitle: '', slides: [{ title: 'A', bullets: [] }] });
    expect(Object.keys(files).some((n) => n.includes('notesMaster'))).toBe(false);
    expect(files['ppt/presentation.xml']).not.toContain('notesMasterIdLst');
    expect(files['[Content_Types].xml']).not.toContain('notesMaster');
  });
});

describe('the order of presentation.xml', () => {
  it('puts the notes master before the slide list, as the schema requires', () => {
    // CT_Presentation is a sequence. A notesMasterIdLst after sldIdLst makes
    // the part invalid, Office repairs it, and what the repair drops is the
    // notes — the very thing it is there for.
    const xml = parts({
      title: 'T',
      subtitle: '',
      slides: [{ title: 'A', bullets: [], notes: 'Say this.' }],
    })['ppt/presentation.xml'];
    expect(xml.indexOf('<p:notesMasterIdLst>')).toBeGreaterThan(xml.indexOf('<p:sldMasterIdLst>'));
    expect(xml.indexOf('<p:notesMasterIdLst>')).toBeLessThan(xml.indexOf('<p:sldIdLst>'));
    expect(xml.indexOf('<p:sldIdLst>')).toBeLessThan(xml.indexOf('<p:sldSz'));
  });
});
