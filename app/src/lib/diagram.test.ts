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

  /*
   * A prefix is not a disguise.
   *
   * These are parsed as XML, where `nodeName` carries the prefix: bind one to
   * the SVG namespace and `<s:script>` reads as `s:script`, which matched
   * nothing in the banned list. `XMLSerializer` then wrote it back out as a
   * plain `<script>`, so the output held a live script element that the same
   * payload without a prefix had correctly lost.
   *
   * Checked in Chromium at the time: it did not execute, because `innerHTML`
   * never runs a script it inserts. That is the sink's protection, not this
   * function's, and this function is the one that promises the tag is gone.
   */
  const NS = 'http://www.w3.org/2000/svg';

  it('strips a banned tag wearing a namespace prefix', () => {
    const out = cleanSvg(`<svg xmlns:s="${NS}" xmlns="${NS}"><s:script>alert(1)</s:script><circle r="1"/></svg>`);
    expect(out).not.toContain('script');
    expect(out).toContain('<circle');
  });

  it('strips a prefixed foreignObject', () => {
    const out = cleanSvg(`<svg xmlns:s="${NS}" xmlns="${NS}"><s:foreignObject/><circle r="1"/></svg>`);
    expect(out?.toLowerCase()).not.toContain('foreignobject');
  });

  it('strips a prefixed event handler', () => {
    const out = cleanSvg(`<svg xmlns:s="${NS}" xmlns="${NS}"><circle r="1" s:onload="x()"/></svg>`);
    expect(out).not.toContain('onload');
  });

  it('strips an outside reference under an unusual prefix', () => {
    const out = cleanSvg(
      `<svg xmlns="${NS}" xmlns:xl="http://www.w3.org/1999/xlink"><image xl:href="https://example.com/p.png"/></svg>`,
    );
    expect(out).not.toContain('example.com');
  });

  /*
   * The root has to come back out as `<svg>`.
   *
   * With a prefix bound to the SVG namespace the serializer may write every
   * element through it, root included, and `<s:svg>` is an unknown element to
   * an HTML parser rather than a picture — so the drawing rendered as nothing.
   */
  it('serialises the root without a prefix', () => {
    const out = cleanSvg(`<svg xmlns:s="${NS}" xmlns="${NS}"><circle r="1"/></svg>`);
    expect(out?.startsWith('<svg')).toBe(true);
  });

  it('leaves a prefix that is not the SVG namespace alone', () => {
    const out = cleanSvg(`<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/></svg>`);
    expect(out).toContain('#a');
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
