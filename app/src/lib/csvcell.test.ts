import { describe, expect, it } from 'vitest';
import { csvCell, csvNumber } from './csvcell';
import { toCsv as sheetCsv, toHandoffCsv } from './sheet';
import { toCsv as exportCsv } from './export';

describe('csvCell', () => {
  it('defuses a cell a spreadsheet would run as a formula', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('-1+1')).toBe("'-1+1");
    expect(csvCell('+cmd|x')).toBe("'+cmd|x");
  });

  it('defuses a formula that also needs quoting, and quotes the result once', () => {
    expect(csvCell('=IF(A1,1,0)')).toBe(`"'=IF(A1,1,0)"`);
  });

  it('defuses signed text even when it looks like a number, since a spreadsheet would coerce it', () => {
    expect(csvCell('-12.50')).toBe("'-12.50");
    expect(csvCell('+00123')).toBe("'+00123");
    expect(csvCell('-0007')).toBe("'-0007");
    expect(csvCell('42')).toBe('42');
  });

  it('leaves a value the caller formatted as a number alone, so a statement amount stays a number', () => {
    expect(csvNumber('-12.50')).toBe('-12.50');
    expect(csvNumber('+3')).toBe('+3');
    expect(csvNumber('42')).toBe('42');
  });

  it('defuses anything that is not a plain number even when offered as one', () => {
    expect(csvNumber('-1+1')).toBe("'-1+1");
    expect(csvNumber('=1')).toBe("'=1");
  });

  it('quotes a comma, quote or line break and doubles any quote inside', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('writes null and non-finite numbers as empty, and a finite number as its text', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(7)).toBe('7');
    expect(csvCell('')).toBe('');
  });
});

describe('every CSV writer of typed text uses the same guard', () => {
  it('the spreadsheet export defuses a formula in a cell', () => {
    expect(sheetCsv([['=1+1', 'ok']])).toBe("'=1+1,ok");
  });

  it('the export helper defuses a formula in a cell', () => {
    expect(exportCsv(['h'], [['@x']])).toBe("h\r\n'@x");
  });

  it('the in-app handover to Analyse is quoted but never defused, because Analyse reads the text as data', () => {
    expect(toHandoffCsv([['@alice', '+code', 'a,b']])).toBe('@alice,+code,"a,b"');
  });
});
