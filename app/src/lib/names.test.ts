import { describe, expect, it } from 'vitest';
import { namesIn, namesOf, pointAt, qualified, saysName, usable, whyNot, writeRef } from './names';
import { clock, evaluate, reading, type Cells } from './sheet';
import { moveRef, renameRef } from './sheetedit';

/**
 * A name for a block of cells.
 *
 * The engine's own tests are about what a formula comes to. These are about
 * the two things that make a name safe: what may *be* one, and what happens
 * when a name does not resolve — where the difference between `#NAME?` and
 * `#REF!` is the difference between "that does not exist" and "the cells are
 * gone", and telling somebody the wrong one sends them to fix the wrong thing.
 */
const AT = Date.parse('2026-09-14T12:00:00Z');

const MARKS: Cells = { B1: 'Mark', B2: '88', B3: '74', B4: '95', F1: '0.5' };
const TERM: Cells = { A1: '=SUM(Marks)', A2: '=Rate*10', A3: '=Marks' };

const SHEETS = [
  {
    title: 'Q1 marks',
    cells: MARKS,
    names: [
      { name: 'Marks', ref: 'B2:B4', created: AT },
      { name: 'Rate', ref: 'F1', created: AT },
    ],
  },
  { title: 'Term', cells: TERM },
];

const ctx = () => reading(SHEETS, 'Term', AT);

describe('what may be a name', () => {
  it('takes a word that reads as a word', () => {
    for (const ok of ['Marks', 'rate', '_total', 'q1.marks', 'Sum']) {
      expect(usable(ok), ok).toBe(true);
    }
  });

  /*
   * A name `A1` would never work: the lexer decides `A1` is a cell before
   * anything looks a name up, so it would be a name that silently does
   * nothing. Refusing it at the point of definition is the only place the
   * person can be told.
   */
  it('refuses anything that reads as a cell', () => {
    for (const no of ['A1', 'ZZ99', 'b2']) expect(usable(no), no).toBe(false);
    expect(whyNot('A1')).toMatch(/is a cell/);
  });

  it('refuses a space, an operator and a leading digit', () => {
    for (const no of ['Term total', 'A-B', '2024', 'a b']) expect(usable(no), no).toBe(false);
    expect(whyNot('Term total')).toMatch(/Letters, digits/);
  });

  it('refuses the two words the engine answers before it looks anything up', () => {
    expect(usable('TRUE')).toBe(false);
    expect(usable('false')).toBe(false);
    expect(whyNot('TRUE')).toMatch(/already a value/);
  });

  /* `SUM(` is a call and bare `SUM` is not, and the parser tells them apart
     by the bracket — so a name may shadow a function. */
  it('allows a name that shadows a function', () => {
    expect(usable('SUM')).toBe(true);
    expect(whyNot('SUM')).toBe('');
  });

  it('says something useful for an empty one', () => {
    expect(whyNot('')).toMatch(/Give it a name/);
  });
});

describe('where a name points', () => {
  it('reads a qualified block, absolute or not', () => {
    expect(pointAt("'Q1 marks'!$B$2:$B$4")).toEqual({ sheet: 'q1 marks', from: 'B2', to: 'B4' });
    expect(pointAt('Marks!B2:B4')).toEqual({ sheet: 'marks', from: 'B2', to: 'B4' });
  });

  it('takes the sheet it was defined on when the reference names none', () => {
    expect(pointAt('B2:B4', 'Q1 marks')).toEqual({ sheet: 'q1 marks', from: 'B2', to: 'B4' });
  });

  it('reads one cell as a block of one', () => {
    expect(pointAt('F1', 'Term')).toEqual({ sheet: 'term', from: 'F1', to: 'F1' });
  });

  it('is nothing for anything that is not a block', () => {
    expect(pointAt('nonsense')).toBeNull();
    expect(pointAt('')).toBeNull();
    expect(pointAt('A1:ZZ99999')).toBeNull();
  });

  it('writes one back qualified and absolute', () => {
    expect(writeRef('Q1 marks', 'B2', 'B4')).toBe("'Q1 marks'!$B$2:$B$4");
    expect(writeRef('Term', 'F1', 'F1')).toBe('Term!$F$1');
    expect(pointAt(writeRef('Q1 marks', 'B2', 'B4'))).toEqual({
      sheet: 'q1 marks',
      from: 'B2',
      to: 'B4',
    });
  });
});

describe('the names of a book', () => {
  it('finds a name defined on one sheet from another', () => {
    expect(evaluate(TERM, 'A1', new Set(), ctx())).toBe(257);
    expect(evaluate(TERM, 'A2', new Set(), ctx())).toBe(5);
  });

  it('does not mind the case it is written in', () => {
    expect(evaluate({ A1: '=SUM(MARKS)' }, 'A1', new Set(), ctx())).toBe(257);
    expect(evaluate({ A1: '=sum(marks)' }, 'A1', new Set(), ctx())).toBe(257);
  });

  it('works inside arithmetic and beside ordinary references', () => {
    expect(evaluate({ A1: '=SUM(Marks)/3' }, 'A1', new Set(), ctx())).toBeCloseTo(85.667, 2);
    expect(evaluate({ A1: '=AVERAGE(Marks)' }, 'A1', new Set(), ctx())).toBeCloseTo(85.667, 2);
    expect(evaluate({ A1: '5', A2: '=A1*Rate' }, 'A2', new Set(), ctx())).toBe(2.5);
  });

  /*
   * `#NAME?` and not `#REF!`: the formula mentions something that does not
   * exist, which is a different thing to fix from cells that are gone.
   */
  it('says #NAME? for a word nothing has been named', () => {
    expect(evaluate({ A1: '=SUM(Nothing)' }, 'A1', new Set(), ctx())).toBe('#NAME?');
    expect(evaluate({ A1: '=Nothing' }, 'A1', new Set(), ctx())).toBe('#NAME?');
  });

  it('says #REF! where two sheets have claimed the same name', () => {
    const both = [
      { title: 'One', cells: { A1: '1' }, names: [{ name: 'Shared', ref: 'A1', created: 1 }] },
      { title: 'Two', cells: { A1: '2' }, names: [{ name: 'shared', ref: 'A1', created: 1 }] },
    ];
    const over = reading(both, 'One', AT);
    expect(evaluate({ A1: '=Shared' }, 'A1', new Set(), over)).toBe('#REF!');
  });

  /* A block has no single value, exactly as a bare `A1:A9` has none. */
  it('refuses a block used where one value is wanted', () => {
    expect(evaluate(TERM, 'A3', new Set(), ctx())).toBe('#VALUE!');
  });

  it('says #NAME? when there is no book at all', () => {
    expect(evaluate({ A1: '=SUM(Marks)' }, 'A1', new Set(), clock(AT))).toBe('#NAME?');
  });

  it('leaves a name whose reference does not parse out, rather than storing a broken one', () => {
    const bad = [{ title: 'One', cells: { A1: '1' }, names: [{ name: 'Bad', ref: 'oops', created: 1 }] }];
    expect(namesIn(bad)).toEqual({});
    expect(evaluate({ A1: '=Bad' }, 'A1', new Set(), reading(bad, 'One', AT))).toBe('#NAME?');
  });

  it('resolves a name whose sheet has gone to #REF!', () => {
    const orphan = [
      { title: 'One', cells: { A1: '1' }, names: [{ name: 'Gone', ref: 'Nowhere!A1', created: 1 }] },
    ];
    expect(evaluate({ A1: '=Gone' }, 'A1', new Set(), reading(orphan, 'One', AT))).toBe('#REF!');
  });

  it('still lets a function keep its own spelling', () => {
    const shadow = [
      { title: 'One', cells: { A1: '5', A2: '6' }, names: [{ name: 'SUM', ref: 'A1:A2', created: 1 }] },
    ];
    const over = reading(shadow, 'One', AT);
    // In a third cell, or the formula is inside the block it is adding up.
    expect(evaluate({ ...shadow[0].cells, A4: '=SUM(A1:A2)' }, 'A4', new Set(), over)).toBe(11);
    expect(evaluate({ ...shadow[0].cells, A4: '=SUM(SUM)' }, 'A4', new Set(), over)).toBe(11);
  });
});

describe('reading them back off a stored sheet', () => {
  it('drops anything malformed or repeated', () => {
    const stored = {
      names: [
        { name: 'Marks', ref: 'B2:B4', created: 1 },
        null,
        { name: 'A1', ref: 'B2', created: 1 },
        { name: 'marks', ref: 'C2:C4', created: 2 },
        { ref: 'B2', created: 1 },
      ],
    };
    expect(namesOf(stored).map((n) => n.name)).toEqual(['Marks']);
  });

  it('is empty for a sheet nobody has named anything on', () => {
    expect(namesOf({})).toEqual([]);
    expect(namesOf({ names: 'no' })).toEqual([]);
  });
});

describe('how a name reads on the screen', () => {
  it('says the name and where it points', () => {
    expect(saysName({ name: 'Marks', ref: "'Q1 marks'!$B$2:$B$4", created: 1 })).toBe(
      "Marks → 'Q1 marks'!$B$2:$B$4",
    );
  });
});

describe('a name that has to move', () => {
  /*
   * A name is a reference, and nothing that rewrites formulas touches one —
   * so a name left pointing at `Marks!B2:B9` after a row is inserted on Marks
   * is every formula using it quietly measuring the wrong nine rows. Harder
   * to see than a stale formula, because the formula that is wrong does not
   * mention a row number anywhere.
   */
  it('follows rows put in above it', () => {
    expect(moveRef("'Q1 marks'!$B$2:$B$9", 'Q1 marks', 'row', 1, 1)).toBe("'Q1 marks'!$B$3:$B$10");
  });

  it('shrinks when rows inside it are taken out', () => {
    expect(moveRef("'Q1 marks'!$B$2:$B$9", 'Q1 marks', 'row', 2, -2)).toBe("'Q1 marks'!$B$2:$B$7");
  });

  it('is left alone by an edit to a different sheet', () => {
    expect(moveRef("'Q1 marks'!$B$2:$B$9", 'Term', 'row', 1, 1)).toBe("'Q1 marks'!$B$2:$B$9");
  });

  it('follows a sheet that is renamed, re-quoted where it has to be', () => {
    expect(renameRef('Marks!$B$2:$B$9', 'Marks', 'Q1 marks')).toBe("'Q1 marks'!$B$2:$B$9");
    expect(renameRef("'Q1 marks'!$B$2:$B$9", 'Q1 marks', 'Marks')).toBe('Marks!$B$2:$B$9');
  });

  /*
   * An unqualified reference means "the sheet I was defined on". Every reader
   * resolves that; no rewriter can, because a rewriter is told which sheet
   * changed and has to compare. Qualifying first is what makes the comparison
   * possible.
   */
  it('qualifies a bare reference against the sheet that defined it', () => {
    expect(qualified('B2:B9', 'Q1 marks')).toBe("'Q1 marks'!$B$2:$B$9");
    expect(qualified('Marks!B2:B9', 'Term')).toBe('Marks!$B$2:$B$9');
    expect(moveRef(qualified('B2:B9', 'Marks'), 'Marks', 'row', 1, 1)).toBe('Marks!$B$3:$B$10');
  });

  it('leaves a reference it cannot read exactly as it found it', () => {
    expect(qualified('oops', 'Marks')).toBe('oops');
    expect(moveRef('oops', 'Marks', 'row', 1, 1)).toBe('oops');
  });
});
