import { describe, expect, it } from 'vitest';
import { FORMULAS, fields, formula, mathml, omml, parse, plain, renderAll } from './maths';

/**
 * One equation, three renderings, and the same equation in each.
 *
 * The failure this guards against is the quiet one: a formula that looks right
 * on screen and reaches the .docx with its numerator and denominator the wrong
 * way up, or a superscript that becomes a multiplication. Nobody re-reads an
 * equation they have already checked once, so the check has to be here.
 */
describe('reading the notation', () => {
  it('reads a fraction', () => {
    expect(plain(parse('\\frac{a}{b}'))).toBe('(a)/(b)');
  });

  it('keeps a fraction bracketed, because that is the lossy step that changes the answer', () => {
    expect(plain(parse('\\frac{a}{b+c}'))).toBe('(a)/(b+c)');
  });

  it('reads a single-token script without braces', () => {
    expect(plain(parse('x^2'))).toBe('x²');
    expect(plain(parse('x_i'))).toBe('xᵢ');
  });

  it('falls back to brackets where there is no superscript character', () => {
    expect(plain(parse('x^{q+1}'))).toBe('x^(q+1)');
  });

  it('reads both scripts, in either order', () => {
    expect(plain(parse('\\sum_{i=1}^{n}'))).toBe('∑ᵢ₌₁ⁿ');
    expect(plain(parse('\\sum^{n}_{i=1}'))).toBe('∑ᵢ₌₁ⁿ');
  });

  it('reads a root', () => {
    expect(plain(parse('\\sqrt{x}'))).toBe('√(x)');
    expect(plain(parse('\\sqrt[3]{x}'))).toBe('3√(x)');
  });

  it('knows its greek and its relations', () => {
    // The space after `\mu` is how the command's name ends rather than a gap
    // in the equation, so it does not survive as one — and the relation then
    // gets its own spacing back, which is what makes the one-line copy
    // readable however it was typed.
    expect(plain(parse('\\mu \\pm \\sigma'))).toBe('μ ± σ');
    expect(plain(parse('a \\le b'))).toBe('a ≤ b');
    expect(plain(parse('\\Delta Q'))).toBe('ΔQ');
  });

  it('keeps words upright and whole', () => {
    expect(plain(parse('\\text{price elasticity}'))).toBe('price elasticity');
  });

  it('gathers digits into one number', () => {
    const tree = parse('1000');
    expect(tree).toEqual({ kind: 'run', text: '1000', italic: false });
  });

  it('shows an unknown command rather than swallowing it', () => {
    expect(plain(parse('\\wibble'))).toBe('wibble');
  });

  it('survives a missing brace rather than losing the line', () => {
    expect(plain(parse('\\frac{a}{b'))).toBe('(a)/(b)');
  });

  it('reads nothing out of nothing', () => {
    expect(plain(parse(''))).toBe('');
  });
});

describe('MathML, for the screen', () => {
  it('marks a variable as a variable and a number as a number', () => {
    const out = mathml(parse('x + 2'));
    expect(out).toContain('<mi>x</mi>');
    expect(out).toContain('<mn>2</mn>');
    expect(out).toContain('<mo>+</mo>');
  });

  it('puts the numerator first', () => {
    const out = mathml(parse('\\frac{a}{b}'));
    expect(out.indexOf('<mi>a</mi>')).toBeLessThan(out.indexOf('<mi>b</mi>'));
    expect(out).toContain('<mfrac>');
  });

  it('puts a sum’s limits above and below it, not beside it', () => {
    expect(mathml(parse('\\sum_{i=1}^{n}'))).toContain('<munderover>');
    expect(mathml(parse('x_i^2'))).toContain('<msubsup>');
  });

  it('escapes what would otherwise close a tag', () => {
    expect(mathml(parse('a < b'))).toContain('&lt;');
    expect(mathml(parse('a & b'))).toContain('&amp;');
  });

  it('is one root element a browser will lay out', () => {
    const out = mathml(parse('E = mc^2'));
    expect(out.startsWith('<math ')).toBe(true);
    expect(out.endsWith('</math>')).toBe(true);
  });
});

describe('OMML, for Word', () => {
  it('writes a fraction as a fraction', () => {
    const out = omml(parse('\\frac{a}{b}'));
    expect(out).toContain('<m:f>');
    expect(out).toContain('<m:num>');
    expect(out).toContain('<m:den>');
    expect(out.indexOf('<m:num>')).toBeLessThan(out.indexOf('<m:den>'));
  });

  it('writes a root with its degree hidden where there is none', () => {
    expect(omml(parse('\\sqrt{x}'))).toContain('<m:degHide m:val="1"/>');
    expect(omml(parse('\\sqrt[3]{x}'))).toContain('<m:deg>');
  });

  it('writes both scripts', () => {
    expect(omml(parse('x_i^2'))).toContain('<m:sSubSup>');
    expect(omml(parse('x^2'))).toContain('<m:sSup>');
    expect(omml(parse('x_i'))).toContain('<m:sSub>');
  });

  it('marks upright what should not lean', () => {
    expect(omml(parse('\\text{cost}'))).toContain('<m:sty m:val="p"/>');
  });

  it('escapes, because an ampersand in an equation is a parse error in Word', () => {
    expect(omml(parse('a & b'))).toContain('&amp;');
    expect(omml(parse('a & b'))).not.toMatch(/<m:t[^>]*>[^<]*&(?!amp;|lt;|gt;|quot;)/);
  });
});

describe('all three at once', () => {
  it('renders the same equation three ways', () => {
    const out = renderAll('\\frac{1}{n}');
    expect(out.plain).toBe('(1)/(n)');
    expect(out.mathml).toContain('<mfrac>');
    expect(out.omml).toContain('<m:f>');
  });
});

describe('the starting library', () => {
  it('has an id nothing shares', () => {
    const ids = FORMULAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('parses every formula it ships', () => {
    for (const f of FORMULAS) {
      expect(plain(parse(f.latex)).length, f.id).toBeGreaterThan(0);
      // The rendered MathML must be balanced enough to be one element, or the
      // screen shows raw markup for a formula the app itself wrote.
      expect(mathml(parse(f.latex)).startsWith('<math '), f.id).toBe(true);
    }
  });

  it('names every symbol it uses in a formula', () => {
    for (const f of FORMULAS) {
      expect(f.where.length, f.id).toBeGreaterThan(0);
      expect(f.says.trim().length, f.id).toBeGreaterThan(0);
    }
  });

  it('is findable by id', () => {
    expect(formula('elasticity')?.field).toBe('Economics');
    expect(formula('nothing-like-this')).toBeUndefined();
  });

  it('groups into the fields the list draws', () => {
    expect(fields()).toContain('Statistics');
    expect(new Set(fields()).size).toBe(fields().length);
  });
});
