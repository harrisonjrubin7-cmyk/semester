import { describe, expect, it } from 'vitest';
import { dataValidationXml, validationsFor } from './xlsxvalid';
import { blankRule, type DataRule } from './validate';
import { parts } from './xlsx';

/**
 * A rule carried into the file.
 *
 * A validated column exported without its `dataValidation` is a column whose
 * rule was silently removed on the way out — and for a list, the dropdown
 * that is half the point of it would be gone too.
 */

const rule = (over: Partial<DataRule> = {}): DataRule => ({
  ...blankRule('B2:B9', 1),
  ...over,
});

describe('a list', () => {
  const made = dataValidationXml(rule({ check: 'list', values: 'ECON, PSCI' }));

  it('is written as a list Excel can drop down', () => {
    expect(made).toContain('type="list"');
    expect(made).toContain('sqref="B2:B9"');
  });

  it('carries its values as the quoted string the format wants', () => {
    expect(made).toContain('<formula1>&quot;ECON,PSCI&quot;</formula1>');
  });

  /*
   * Excel splits that quoted string on commas, so a value containing one
   * cannot be said this way at all — it would arrive as two choices that were
   * never offered here. Left out rather than written wrong.
   */
  it('leaves out a value with a comma in it rather than splitting it in two', () => {
    const made = dataValidationXml(rule({ check: 'list', values: 'A, "B, C", D' }));
    expect(made).toContain('&quot;A,&quot;B');
  });

  it('says nothing at all for an empty list', () => {
    expect(dataValidationXml(rule({ check: 'list', values: '' }))).toBe('');
  });
});

describe('a number', () => {
  it('is a band where both ends are given', () => {
    const made = dataValidationXml(rule({ check: 'between', min: '0', max: '100' }));
    expect(made).toContain('type="decimal"');
    expect(made).toContain('operator="between"');
    expect(made).toContain('<formula1>0</formula1><formula2>100</formula2>');
  });

  it('is a one-sided comparison where one end is given', () => {
    expect(dataValidationXml(rule({ check: 'decimal', min: '0', max: '' }))).toContain(
      'operator="greaterThanOrEqual"',
    );
    expect(dataValidationXml(rule({ check: 'decimal', min: '', max: '10' }))).toContain(
      'operator="lessThanOrEqual"',
    );
  });

  /*
   * Excel's `whole` and `decimal` types each need an operator and the bounds
   * to go with it, and this app allows *a number* with no bounds at all.
   * Rather than invent a floor of minus a trillion and call it unbounded, the
   * test is spelled out — which is a real validation in Excel, and a true one.
   */
  it('is spelled out as a formula where nothing bounds it', () => {
    const made = dataValidationXml(rule({ check: 'decimal', min: '', max: '' }));
    expect(made).toContain('type="custom"');
    expect(made).toContain('ISNUMBER(B2)');
  });

  it('asks for a whole one too, where that is what was wanted', () => {
    const made = dataValidationXml(rule({ check: 'whole', min: '', max: '' }));
    expect(made).toContain('INT(B2)');
  });

  it('uses the native whole type once it has bounds, for the better message', () => {
    const made = dataValidationXml(rule({ check: 'whole', min: '1', max: '5' }));
    expect(made).toContain('type="whole"');
    expect(made).not.toContain('custom');
  });
});

describe('text length', () => {
  it('is written as one', () => {
    const made = dataValidationXml(rule({ check: 'length', max: '4' }));
    expect(made).toContain('type="textLength"');
    expect(made).toContain('operator="lessThanOrEqual"');
  });
});

describe('an empty cell', () => {
  it('is allowed in the file where it is allowed on the screen', () => {
    expect(dataValidationXml(rule({ check: 'decimal' }))).toContain('allowBlank="1"');
    expect(dataValidationXml(rule({ check: 'decimal', blankOk: false }))).toContain(
      'allowBlank="0"',
    );
  });
});

describe('the element that holds them', () => {
  it('counts what it holds, because the attribute is not optional', () => {
    const made = validationsFor([
      rule({ id: 'a', check: 'list', values: 'A,B' }),
      rule({ id: 'b', range: 'C2:C9', check: 'between', min: '0', max: '9' }),
    ]);
    expect(made).toContain('<dataValidations count="2">');
  });

  it('is absent entirely where there are no rules', () => {
    expect(validationsFor([])).toBe('');
  });

  /*
   * An unfinished rule is not written. It marks nothing on screen, so writing
   * it would put a rule in the file that the app it came from was not
   * applying — a disagreement between the two that nobody would look for.
   */
  it('leaves out a rule that is not finished', () => {
    expect(validationsFor([rule({ check: 'list', values: '' })])).toBe('');
  });

  it('leaves out a rule over a range that is not one', () => {
    expect(validationsFor([rule({ check: 'decimal', range: 'nonsense' })])).toBe('');
  });
});

/**
 * `CT_Worksheet` is a sequence: `dataValidations` after `conditionalFormatting`
 * and before `drawing`. Out of order is a repair notice naming nothing, so the
 * position is pinned here rather than trusted to stay where it was put.
 */
it('lands after the conditional formatting and before the drawing', () => {
  const made = parts({
    tabs: [
      {
        name: 'Marks',
        rows: [[{ kind: 'text' as const, value: 'Mark' }], [{ kind: 'number' as const, value: 88 }]],
        header: true,
        checks: [rule({ check: 'between', min: '0', max: '100' })],
        rules: [
          {
            id: 'r',
            range: 'A2:A9',
            test: 'less',
            value: '60',
            ink: 'red',
            as: 'wash',
            created: 1,
          },
        ],
      },
    ],
  });
  const sheet = made['xl/worksheets/sheet1.xml'];
  expect(sheet.indexOf('<dataValidations')).toBeGreaterThan(sheet.indexOf('<conditionalFormatting'));
  expect(sheet).toContain('</sheetData>');
  expect(sheet.indexOf('</sheetData>')).toBeLessThan(sheet.indexOf('<dataValidations'));
});
