// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cleanMermaid, cleanSvg, drawingName, kind, systemFor, unfence } from './diagram';

describe('unfence', () => {
  it('takes a fence off, since the model adds one anyway', () => {
    expect(unfence('```mermaid\ngraph TD\nA-->B\n```')).toBe('graph TD\nA-->B');
    expect(unfence('```svg\n<svg/>\n```')).toBe('<svg/>');
  });

  it('leaves unfenced text alone', () => {
    expect(unfence('graph TD\nA-->B')).toBe('graph TD\nA-->B');
  });
});

describe('cleanSvg', () => {
  const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

  it('keeps the drawing', () => {
    const out = cleanSvg(wrap('<line x1="0" y1="0" x2="10" y2="10" stroke="currentColor"/>'));
    expect(out).toContain('<line');
    expect(out).toContain('stroke="currentColor"');
  });

  it('removes a script element', () => {
    const out = cleanSvg(wrap('<script>alert(1)</script><circle r="4"/>'));
    expect(out).not.toContain('script');
    expect(out).toContain('<circle');
  });

  it('removes foreignObject, which can carry arbitrary HTML', () => {
    const out = cleanSvg(wrap('<foreignObject><div>hi</div></foreignObject>'));
    expect(out?.toLowerCase()).not.toContain('foreignobject');
  });

  it('removes every event handler, whatever its case', () => {
    const out = cleanSvg(wrap('<rect onload="x()" ONCLICK="y()" width="5"/>'));
    expect(out).not.toMatch(/onload|onclick/i);
    expect(out).toContain('width="5"');
  });

  it('removes a handler on the root element too', () => {
    // Walking only the children would leave the root untouched.
    const out = cleanSvg('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><circle r="1"/></svg>');
    expect(out).not.toMatch(/onload/i);
  });

  it('removes a handler nested several levels down', () => {
    const out = cleanSvg(wrap('<g><g><rect onmouseover="x()"/></g></g>'));
    expect(out).not.toMatch(/onmouseover/i);
  });

  it('keeps a fragment reference but drops one that reaches outside', () => {
    // #grad is a gradient in this document; the other is a tracking pixel.
    const kept = cleanSvg(wrap('<rect fill="url(#grad)"/><use href="#a"/>'));
    expect(kept).toContain('href="#a"');
    const cut = cleanSvg(wrap('<image href="https://example.com/p.png"/>'));
    expect(cut).not.toContain('example.com');
  });

  it('drops the size it asked for so it fits the screen', () => {
    const out = cleanSvg('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>');
    expect(out).not.toContain('width="900"');
    expect(out).toContain('viewBox');
    expect(out).toContain('width:100%');
  });

  it('is null for something that is not an SVG at all', () => {
    // Which is the right answer for a model that replied with an apology.
    expect(cleanSvg('I cannot draw that.')).toBeNull();
    expect(cleanSvg('')).toBeNull();
  });

  it('is null for an SVG that will not parse, rather than half of one', () => {
    expect(cleanSvg('<svg><rect')).toBeNull();
  });
});

describe('cleanMermaid', () => {
  it('keeps a diagram that names its type', () => {
    expect(cleanMermaid('flowchart TD\n  A-->B')).toBe('flowchart TD\n  A-->B');
    expect(cleanMermaid('timeline\n  1929 : Crash')).toContain('timeline');
  });

  it('strips an init directive', () => {
    // It can set arbitrary configuration, including loading fonts elsewhere.
    const out = cleanMermaid('%%{init: {"theme":"x"}}%%\ngraph TD\nA-->B');
    expect(out).toBe('graph TD\nA-->B');
  });

  it('refuses text that names no diagram type', () => {
    // Better than letting the library print a cryptic red box.
    expect(cleanMermaid('Here is a diagram of the process:')).toBeNull();
    expect(cleanMermaid('')).toBeNull();
  });

  it('sees through a fence', () => {
    expect(cleanMermaid('```mermaid\ngraph LR\nA-->B\n```')).toBe('graph LR\nA-->B');
  });
});

describe('systemFor', () => {
  it('forbids inventing figures, in both languages', () => {
    for (const id of ['curves', 'flow']) {
      expect(systemFor(kind(id))).toContain('Never invent a figure');
    }
  });

  it('tells an SVG to scale and to draw for a dark page', () => {
    const s = systemFor(kind('curves'));
    expect(s).toContain('viewBox');
    expect(s).toContain('no width or height');
    expect(s).not.toContain('Output Mermaid');
  });

  it('tells Mermaid to quote awkward labels', () => {
    expect(systemFor(kind('flow'))).toContain('Quote any node label');
  });
});

describe('drawingName', () => {
  it('names the file after what was asked for', () => {
    expect(drawingName('a shift in the demand curve', 'svg')).toBe('a-shift-in-the-demand.svg');
    expect(drawingName('how a bill becomes law', 'mermaid')).toBe('how-a-bill-becomes-law.mmd');
  });

  it('never produces a nameless file', () => {
    expect(drawingName('   ', 'svg')).toBe('diagram.svg');
  });
});
