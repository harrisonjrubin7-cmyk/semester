// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pictureFileName, resolveVar, standalone } from './svgout';

const lookup = (name: string) => (name === '--app-accent' ? '#9aa4b2' : '');

describe('resolving a token', () => {
  it('reads the value the reader is actually looking at', () => {
    expect(resolveVar('var(--app-accent)', lookup)).toBe('#9aa4b2');
    expect(resolveVar(' var( --app-accent ) ', lookup)).toBe('#9aa4b2');
  });

  it('takes the written fallback when the token is not set', () => {
    expect(resolveVar('var(--nope, #123456)', lookup)).toBe('#123456');
  });

  /*
   * An empty `fill` is not "no fill" — it is invalid, and a renderer meeting
   * one may drop the element rather than the attribute.
   */
  it('never answers with nothing', () => {
    expect(resolveVar('var(--nope)', lookup)).toBe('currentColor');
  });

  it('leaves a real colour alone', () => {
    expect(resolveVar('#ff0000', lookup)).toBe('#ff0000');
    expect(resolveVar('none', lookup)).toBe('none');
  });
});

function drawing(): SVGSVGElement {
  document.documentElement.style.setProperty('--app-accent', '#9aa4b2');
  document.documentElement.style.setProperty('--app-panel', '#101215');
  const host = document.createElement('div');
  host.innerHTML =
    '<svg viewBox="0 0 640 360" style="width:100%"><rect fill="var(--app-accent)" stroke="var(--app-line, #333)"/></svg>';
  document.body.append(host);
  return host.querySelector('svg') as SVGSVGElement;
}

describe('saving one', () => {
  it('writes the colours out and leaves the live chart on its tokens', () => {
    const svg = drawing();
    const file = standalone(svg);
    expect(file).toContain('#9aa4b2');
    expect(file).not.toContain('var(--app-accent)');
    // The original still follows the theme.
    expect(svg.querySelector('rect')?.getAttribute('fill')).toBe('var(--app-accent)');
  });

  it('honours a fallback written into the drawing', () => {
    expect(standalone(drawing())).toContain('#333');
  });

  it('gives the file a namespace and its own size', () => {
    const file = standalone(drawing());
    expect(file).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(file).toContain('width="640"');
    expect(file).toContain('height="360"');
    expect(file.startsWith('<?xml')).toBe(true);
  });

  it('puts a ground under it when one is asked for', () => {
    const file = standalone(drawing(), 'var(--app-panel)');
    expect(file).toContain('#101215');
    expect(file.indexOf('#101215')).toBeLessThan(file.indexOf('#9aa4b2'));
  });
});

describe('what it is called', () => {
  it('is the title, made safe for a filesystem', () => {
    expect(pictureFileName('Marks: midterm & final')).toBe('Marks-midterm-final.svg');
    expect(pictureFileName('   ')).toBe('chart.svg');
    expect(pictureFileName('x'.repeat(200)).length).toBeLessThanOrEqual(64);
  });
});
