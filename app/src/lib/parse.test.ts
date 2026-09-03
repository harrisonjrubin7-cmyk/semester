import { describe, expect, it } from 'vitest';
import { parseMaterial } from './parse';

/**
 * The rule this module exists to keep is "do not invent a card", because a
 * fabricated card gets drilled and believed. So most of these tests are about
 * what it declines to do.
 */
describe('parseMaterial', () => {
  it('reads a Q:/A: pair', () => {
    const p = parseMaterial('Q: What is elasticity?\nA: The percentage change in quantity.');
    expect(p.cards).toEqual([
      { q: 'What is elasticity?', a: 'The percentage change in quantity.' },
    ]);
    expect(p.body).toBe('');
  });

  it('reads several Q:/A: pairs out of one block', () => {
    const p = parseMaterial('Q: One?\nA: First.\nQ: Two?\nA: Second.');
    expect(p.cards).toHaveLength(2);
    expect(p.cards[1]).toEqual({ q: 'Two?', a: 'Second.' });
  });

  it('accepts the Q. and Q) spellings people actually type', () => {
    expect(parseMaterial('Q. What?\nA. This.').cards).toHaveLength(1);
    expect(parseMaterial('Q) What?\nA) This.').cards).toHaveLength(1);
  });

  it('reads a question line with its answer underneath', () => {
    const p = parseMaterial('Why does MR lie below demand?\nBecause price falls on every unit.');
    expect(p.cards).toEqual([
      { q: 'Why does MR lie below demand?', a: 'Because price falls on every unit.' },
    ]);
  });

  it('reads a run of term — definition lines', () => {
    const p = parseMaterial(
      'Elasticity — the responsiveness of quantity to a change in price\n' +
        'Deadweight loss — the surplus destroyed when trade does not happen',
    );
    expect(p.terms).toHaveLength(2);
    expect(p.terms[0].t).toBe('Elasticity');
    expect(p.cards).toHaveLength(0);
  });

  it('accepts a colon or a spaced hyphen as the separator', () => {
    const colon = parseMaterial(
      'Margin: the extra unit, and the only one that matters\n' +
        'Surplus: the gap between what you would pay and what you did',
    );
    const hyphen = parseMaterial(
      'Margin - the extra unit, and the only one that matters\n' +
        'Surplus - the gap between what you would pay and what you did',
    );
    expect(colon.terms).toHaveLength(2);
    expect(hyphen.terms).toHaveLength(2);
  });

  // ── what it refuses ────────────────────────────────────────────────────

  it('keeps ordinary prose as prose rather than guessing a card out of it', () => {
    const prose = 'The lecture covered monopoly pricing and then ran long, so we skipped part four.';
    const p = parseMaterial(prose);
    expect(p.cards).toHaveLength(0);
    expect(p.terms).toHaveLength(0);
    expect(p.body).toBe(prose);
  });

  it('does not make a card from a question with no answer under it', () => {
    const p = parseMaterial('What is elasticity?');
    expect(p.cards).toHaveLength(0);
    expect(p.body).toContain('What is elasticity?');
  });

  it('does not treat a sentence containing a colon as a term', () => {
    // A definition has to be a definition, not any line with punctuation in it.
    const p = parseMaterial('Note: bring the formula sheet');
    expect(p.terms).toHaveLength(0);
    expect(p.body).not.toBe('');
  });

  it('does not turn a lone term line inside prose into a term', () => {
    const p = parseMaterial(
      'We talked about a lot of things in a long paragraph that is plainly not a glossary.\n' +
        'Elasticity — the responsiveness of quantity to a change in price',
    );
    expect(p.terms).toHaveLength(0);
    expect(p.body).not.toBe('');
  });

  it('loses nothing: everything unparsed comes back in the body', () => {
    const text = 'Q: Kept?\nA: Yes.\n\nThis paragraph is not a card and must survive.';
    const p = parseMaterial(text);
    expect(p.cards).toHaveLength(1);
    expect(p.body).toBe('This paragraph is not a card and must survive.');
  });

  it('handles empty and whitespace input without throwing', () => {
    expect(parseMaterial('')).toEqual({ cards: [], terms: [], body: '' });
    expect(parseMaterial('   \n\n  ')).toEqual({ cards: [], terms: [], body: '' });
  });

  it('survives Windows line endings', () => {
    const p = parseMaterial('Q: What?\r\nA: This.');
    expect(p.cards).toHaveLength(1);
  });

  it('strips bullet characters from the front of a line', () => {
    const p = parseMaterial(
      '- Elasticity — the responsiveness of quantity to a price change\n' +
        '- Surplus — the gap between what you would pay and what you did',
    );
    expect(p.terms[0]?.t).toBe('Elasticity');
    expect(p.terms).toHaveLength(2);
  });

  it('skips week and chapter headings when reading a glossary', () => {
    const p = parseMaterial(
      'Week 7\n' +
        'Elasticity — the responsiveness of quantity to a change in price\n' +
        'Deadweight loss — the surplus destroyed when trade does not happen',
    );
    expect(p.terms).toHaveLength(2);
  });
});
