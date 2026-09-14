/**
 * What a cell is allowed to hold, carried into the file.
 *
 * The same principle as `xlsxcond.ts`: a rule goes in as a rule, not as its
 * effect. The effect here is a mark on a screen, which cannot be exported at
 * all — so a validated column written out without its `dataValidation` would
 * be a column with the rule silently removed, and the dropdown that is half
 * the point of a list would be gone.
 *
 * ## Where it goes in the sheet
 *
 * `CT_Worksheet` is a sequence and `dataValidations` sits after
 * `conditionalFormatting` and before `drawing`. Out of order is a repair
 * notice naming nothing, so `sheetXml` in `lib/xlsx.ts` holds the order once
 * and this file only makes the element.
 *
 * ## The two shapes Excel accepts
 *
 * Its native types are the good ones — `list` puts a real dropdown on the
 * cell, `whole` and `decimal` give the right message — but each needs an
 * `operator` with the bounds to go with it, and this app allows *a number*
 * with no bounds at all. Rather than invent a floor of minus a trillion and
 * call it unbounded, an unbounded numeric rule is written as `custom` with
 * the test spelled out as a formula. Both are real validation in Excel; the
 * second is the one that is true.
 */

import { corners } from './chart';
import { choicesOf, ready, type DataRule } from './validate';

function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function figure(text: string): number | null {
  const n = Number(text.trim().replace(/[$£€,]/g, ''));
  return text.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** The top-left cell of a range, which a `custom` formula is written against. */
function firstCell(range: string): string {
  return range.split(':')[0].replace(/\$/g, '').toUpperCase();
}

/**
 * One rule as a `dataValidation` element, or empty where it says nothing.
 *
 * `showInputMessage` is off and `showErrorMessage` on: this app's rules carry
 * no prompt to show, and an error box with an empty message is a dialogue
 * that appears for no reason and says nothing.
 */
export function dataValidationXml(rule: DataRule): string {
  if (!ready(rule) || !corners(rule.range)) return '';
  const at = `sqref="${xml(rule.range)}" allowBlank="${rule.blankOk ? 1 : 0}"`;
  const show = 'showErrorMessage="1"';

  if (rule.check === 'list') {
    // Excel reads the quoted string as a comma-separated list. A value with a
    // comma in it cannot be expressed this way and is left out rather than
    // written as two choices that were never offered here.
    const choices = choicesOf(rule).filter((c) => !c.includes(','));
    if (!choices.length) return '';
    return (
      `<dataValidation type="list" ${show} showDropDown="0" ${at}>` +
      `<formula1>&quot;${xml(choices.join(','))}&quot;</formula1>` +
      '</dataValidation>'
    );
  }

  if (rule.check === 'length') {
    const most = figure(rule.max);
    if (most === null) return '';
    return (
      `<dataValidation type="textLength" operator="lessThanOrEqual" ${show} ${at}>` +
      `<formula1>${most}</formula1></dataValidation>`
    );
  }

  // `between` is a bounded `decimal`; the bounds are read the same way for
  // every numeric check, and which of them are present picks the operator.
  const type = rule.check === 'whole' ? 'whole' : 'decimal';
  const low = figure(rule.min);
  const high = figure(rule.max);

  if (low !== null && high !== null) {
    return (
      `<dataValidation type="${type}" operator="between" ${show} ${at}>` +
      `<formula1>${low}</formula1><formula2>${high}</formula2></dataValidation>`
    );
  }
  if (low !== null) {
    return (
      `<dataValidation type="${type}" operator="greaterThanOrEqual" ${show} ${at}>` +
      `<formula1>${low}</formula1></dataValidation>`
    );
  }
  if (high !== null) {
    return (
      `<dataValidation type="${type}" operator="lessThanOrEqual" ${show} ${at}>` +
      `<formula1>${high}</formula1></dataValidation>`
    );
  }

  /*
   * A number, or a whole number, with nothing bounding it.
   *
   * `ISNUMBER` alone for one; `INT` beside it for the other. Written against
   * the first cell of the block and relative, which is how Excel reads a
   * custom rule over a range — the same formula, re-based per cell.
   */
  const cell = firstCell(rule.range);
  const test =
    type === 'whole'
      ? `AND(ISNUMBER(${cell}),${cell}=INT(${cell}))`
      : `ISNUMBER(${cell})`;
  return (
    `<dataValidation type="custom" ${show} ${at}>` +
    `<formula1>${xml(test)}</formula1></dataValidation>`
  );
}

/** Every rule on a sheet, as the one element that holds them. */
export function validationsFor(rules: readonly DataRule[]): string {
  const made = rules.map(dataValidationXml).filter(Boolean);
  if (!made.length) return '';
  return `<dataValidations count="${made.length}">${made.join('')}</dataValidations>`;
}
