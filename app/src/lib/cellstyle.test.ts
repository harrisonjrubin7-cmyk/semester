import { describe, expect, it } from 'vitest';
import { picture, places, restyle, styledDisplay, styleOf, type Sheet } from './sheet';
import { TEMPLATES, fromTemplate } from './sheettemplates';

const sheet = (cells: Record<string, string>, styles = {}): Sheet => ({
  id: 's',
  title: 't',
  courseId: null,
  cells,
  styles,
  rows: 12,
  cols: 6,
  created: 0,
  updated: 0,
});

/**
 * The picture over a number, and the promise it must not break: formatting a
 * cell changes what is shown and never what is stored.
 */
describe('a cell’s picture', () => {
  it('is nothing at all when the cell is plain', () => {
    expect(picture(undefined)).toBe('');
    expect(picture({})).toBe('');
    expect(picture({ num: 'plain' })).toBe('');
    expect(picture({ bold: true })).toBe('');
  });

  it('opens each picture at the places that picture is usually written with', () => {
    expect(picture({ num: 'percent' })).toBe('0%');
    expect(picture({ num: 'money' })).toBe('$#,##0.00');
    expect(picture({ num: 'number' })).toBe('#,##0.00');
    expect(picture({ num: 'date' })).toBe('yyyy-mm-dd');
  });

  it('takes the places from the style once somebody has pressed the buttons', () => {
    expect(picture({ num: 'percent', decimals: 2 })).toBe('0.00%');
    expect(picture({ num: 'money', decimals: 0 })).toBe('$#,##0');
    expect(places({ num: 'number' })).toBe(2);
    expect(places({ num: 'percent' })).toBe(0);
    expect(places({ bold: true })).toBe(0);
  });

  it('will not run away past the places the buttons allow', () => {
    expect(picture({ num: 'number', decimals: 99 })).toBe('#,##0.000000');
    expect(picture({ num: 'number', decimals: -3 })).toBe('#,##0');
  });
});

describe('what a formatted cell shows', () => {
  it('shows the value under the picture', () => {
    expect(styledDisplay({ A1: '0.8' }, 'A1', { num: 'percent' })).toBe('80%');
    expect(styledDisplay({ A1: '1234.5' }, 'A1', { num: 'money' })).toBe('$1,234.50');
    expect(styledDisplay({ A1: '1234.5' }, 'A1', { num: 'number', decimals: 0 })).toBe('1,235');
  });

  it('formats a formula’s answer, not its text', () => {
    expect(styledDisplay({ A1: '40', A2: '50', A3: '=A1/A2' }, 'A3', { num: 'percent' })).toBe('80%');
  });

  it('leaves what was typed alone when there is no picture on the cell', () => {
    // The rule `display` exists for: `80%`, `$12.50` and `007` read back as
    // typed. A plain cell must fall straight through to it.
    expect(styledDisplay({ A1: '007' }, 'A1', undefined)).toBe('007');
    expect(styledDisplay({ A1: '80%' }, 'A1', {})).toBe('80%');
  });

  it('does not force a picture onto a word, an error or an empty cell', () => {
    expect(styledDisplay({ A1: 'Midterm' }, 'A1', { num: 'money' })).toBe('Midterm');
    expect(styledDisplay({ A1: '=1/0' }, 'A1', { num: 'percent' })).toBe('#DIV/0!');
    expect(styledDisplay({}, 'A1', { num: 'money' })).toBe('');
  });

  it('changes nothing about what the cell holds', () => {
    // The whole point of keeping the picture apart from the value: a `SUM`
    // over a column shown as percentages is a sum of the values, not of the
    // text on the screen.
    const cells = { A1: '0.8' };
    expect(styledDisplay(cells, 'A1', { num: 'percent' })).toBe('80%');
    expect(cells.A1).toBe('0.8');
  });

  it('finds a style however the reference is spelled', () => {
    const s = sheet({ A1: '0.5' }, { A1: { num: 'percent' } });
    expect(styleOf(s, 'a1')?.num).toBe('percent');
    expect(styleOf(s, '$A$1')?.num).toBe('percent');
  });
});

describe('restyling a block', () => {
  it('puts the same change on every cell in it', () => {
    const s = sheet({});
    const styles = restyle(s, ['A1', 'A2', 'A3'], (was) => ({ ...was, num: 'percent' }));
    expect(Object.keys(styles)).toEqual(['A1', 'A2', 'A3']);
  });

  it('keeps what was already on the cell', () => {
    const s = sheet({}, { A1: { bold: true } });
    const styles = restyle(s, ['A1'], (was) => ({ ...was, num: 'money' }));
    expect(styles.A1).toEqual({ bold: true, num: 'money' });
  });

  it('takes the entry out again when nothing is left on it', () => {
    // Bold on and then off must leave no entry, or a sheet grows a table of
    // empty objects from buttons somebody pressed and unpressed.
    const s = sheet({}, { A1: { bold: true } });
    const styles = restyle(s, ['A1'], (was) => ({ ...was, bold: false }));
    expect(styles.A1).toBeUndefined();
    expect(Object.keys(styles)).toHaveLength(0);
  });

  it('leaves the cells outside the block alone', () => {
    const s = sheet({}, { B9: { bold: true } });
    const styles = restyle(s, ['A1'], (was) => ({ ...was, italic: true }));
    expect(styles.B9).toEqual({ bold: true });
  });
});

describe('the templates', () => {
  it('each arrive with their totals already written', () => {
    for (const template of TEMPLATES) {
      const made = fromTemplate(template, '');
      const formulas = Object.values(made.cells).filter((v) => v.startsWith('='));
      expect(formulas.length, `${template.id} has no formula in it`).toBeGreaterThan(0);
    }
  });

  it('keep the empty rows somebody is about to type into', () => {
    // Not `fromRows`, which trims to what is filled — a template is mostly
    // empty on purpose.
    const todo = fromTemplate(TEMPLATES.find((t) => t.id === 'todo')!, '');
    expect(todo.rows).toBeGreaterThanOrEqual(10);
    expect(todo.cells.A1).toBe('Task');
  });

  it('compute what they promise', () => {
    const month = fromTemplate(TEMPLATES.find((t) => t.id === 'month')!, '');
    const cells = { ...month.cells, B2: '900', C2: '950' };
    expect(styledDisplay(cells, 'D2', undefined)).toBe('50');
    expect(styledDisplay(cells, 'B7', month.styles?.B7)).toBe('$900.00');
  });

  it('carry a picture over the columns that hold money and percentages', () => {
    const month = fromTemplate(TEMPLATES.find((t) => t.id === 'month')!, '');
    expect(month.styles?.B2?.num).toBe('money');
    const readings = fromTemplate(TEMPLATES.find((t) => t.id === 'readings')!, '');
    expect(readings.styles?.E2?.num).toBe('percent');
  });

  it('name each other apart', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});
