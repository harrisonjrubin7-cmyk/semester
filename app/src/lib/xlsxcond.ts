/**
 * A filter and a colour rule, carried into the file.
 *
 * Both are *views* in this app — the filter hides rows and the rules paint
 * them — and both have a real counterpart in the format, so both go in as what
 * they are rather than as their effect.
 *
 * That distinction is the whole of this file. A filtered sheet could be
 * exported as the rows that survived, and coloured cells could be exported
 * with the colour baked onto each one. Either would produce a file that looks
 * exactly like the screen and stops being true the moment somebody edits it:
 * the missing rows would be gone rather than hidden, and a mark changed from
 * 45 to 95 would still be red. A `cfRule` and an `autoFilter` keep working in
 * Excel, which is what "export" is supposed to mean.
 *
 * ## The order of the elements is the format
 *
 * `CT_Worksheet` is a sequence: `autoFilter` after `sheetData`,
 * `conditionalFormatting` after that, `drawing` after everything. Out of
 * order is a repair notice with no hint of which element, so the one place
 * that assembles them is `sheetXml` and the order is written there once.
 */

import { inkPaper, washPaper, type Ink } from './sheet';
import { corners } from './chart';
import { ready, type CondRule, type Test } from './condfmt';

/** What the file calls each test, and whether it takes a formula. */
const OPERATOR: Partial<Record<Test, string>> = {
  greater: 'greaterThan',
  less: 'lessThan',
  between: 'between',
  equal: 'equal',
};

function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Whether a rule's value is a number, which decides how it is written. */
function figure(text: string): number | null {
  const n = Number(text.trim().replace(/[$£€,]/g, '').replace(/%$/, ''));
  if (!Number.isFinite(n) || text.trim() === '') return null;
  return /%\s*$/.test(text) ? n / 100 : n;
}

/** A value as a formula: bare when it is a number, quoted when it is words. */
function formula(text: string): string {
  const n = figure(text);
  return n === null ? `"${xml(text.trim())}"` : String(n);
}

/**
 * The differential format a rule paints with.
 *
 * A `dxf` is a *difference* from whatever the cell already is, which is why it
 * carries only the one property the rule sets — and why a bold cell a rule
 * turns red stays bold in the file exactly as it does on the screen.
 *
 * The wash is written as `bgColor` and not `fgColor`. In an ordinary fill the
 * pattern's foreground is the colour; in a `dxf` it is the background, and
 * getting that the wrong way round produces a cell that is not coloured at
 * all, with nothing wrong anywhere in the file.
 */
export function dxfFor(rule: CondRule): string {
  if (rule.as === 'ink') {
    return `<dxf><font><color rgb="${inkPaper(rule.ink as Ink)}"/></font></dxf>`;
  }
  return (
    '<dxf><fill><patternFill>' +
    `<bgColor rgb="${washPaper(rule.ink as Ink)}"/>` +
    '</patternFill></fill></dxf>'
  );
}

/**
 * One rule as a `conditionalFormatting` block.
 *
 * `priority` counts down, because Excel reads *lower* as *stronger* and this
 * app reads *later* as stronger — a rule added on top of another is somebody
 * saying "and this one too". Written the other way round, the first rule
 * somebody set would quietly beat every rule they set afterwards.
 */
export function conditionalXml(rule: CondRule, dxfId: number, priority: number): string {
  const at = corners(rule.range);
  const first = at ? `${String.fromCharCode(65 + at.left)}${at.top + 1}` : 'A1';
  const head = `<conditionalFormatting sqref="${xml(rule.range)}">`;
  const tail = '</conditionalFormatting>';
  const attrs = `dxfId="${dxfId}" priority="${priority}"`;

  if (rule.test === 'contains') {
    return (
      `${head}<cfRule type="containsText" operator="containsText" text="${xml(rule.value.trim())}" ${attrs}>` +
      `<formula>NOT(ISERROR(SEARCH("${xml(rule.value.trim())}",${first})))</formula>` +
      `</cfRule>${tail}`
    );
  }
  if (rule.test === 'empty') {
    return (
      `${head}<cfRule type="containsBlanks" ${attrs}>` +
      `<formula>LEN(TRIM(${first}))=0</formula></cfRule>${tail}`
    );
  }
  if (rule.test === 'error') {
    return (
      `${head}<cfRule type="containsErrors" ${attrs}>` +
      `<formula>ISERROR(${first})</formula></cfRule>${tail}`
    );
  }

  const operator = OPERATOR[rule.test] ?? 'equal';
  const values =
    rule.test === 'between'
      ? `<formula>${formula(rule.value)}</formula><formula>${formula(rule.value2 ?? '')}</formula>`
      : `<formula>${formula(rule.value)}</formula>`;
  return `${head}<cfRule type="cellIs" operator="${operator}" ${attrs}>${values}</cfRule>${tail}`;
}

export interface Conditional {
  /** The blocks and their rules, in the order they will be written. */
  blocks: string;
  /** The differential formats they point into, for `styles.xml`. */
  dxfs: string[];
}

/**
 * Every rule on a sheet, ready for the two parts that carry it.
 *
 * `from` is where this sheet's formats start in the book's one `dxfs` table.
 * The table is book-wide because `dxfId` indexes into it, so a second tab
 * numbering its rules from zero would paint them in the *first* tab's
 * colours — a workbook that opens, with every rule on every sheet but the
 * first showing somebody else's red. Only `lib/xlsx.ts` knows the running
 * total, so only it passes this.
 */
export function conditionalFor(rules: readonly CondRule[], from = 0): Conditional {
  const usable = rules.filter((rule) => ready(rule) && corners(rule.range));
  return {
    blocks: usable
      .map((rule, i) => conditionalXml(rule, from + i, usable.length - i))
      .join(''),
    dxfs: usable.map(dxfFor),
  };
}

/** The `autoFilter` element, which is what makes the arrows appear in Excel. */
export function autoFilterXml(range: string): string {
  return corners(range) ? `<autoFilter ref="${xml(range)}"/>` : '';
}
